
export async function onRequestPost({ request, env }) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };


  try {
    const apiKey = env.AI_API_KEY;
    const accessCode = env.COACH_ACCESS_CODE;

    if (!apiKey || !accessCode) {
      return new Response(
        JSON.stringify({ error: "Konfigurasi AI di Cloudflare belum lengkap." }),
        { status: 500, headers }
      );
    }

    const body = await request.json();

    if (
      typeof body.accessCode !== "string" ||
      body.accessCode !== accessCode
    ) {
      return new Response(
        JSON.stringify({ error: "Kode akses coach salah." }),
        { status: 401, headers }
      );
    }

    const mode = body.mode === "weekly" ? "weekly" : "chat";
    const message = String(body.message || "").slice(0, 5000);

    if (!message.trim()) {
      return new Response(
        JSON.stringify({ error: "Pesan belum diisi." }),
        { status: 400, headers }
      );
    }

    const activities = Array.isArray(body.activities)
      ? body.activities.slice(0, 100).map((a) => ({
          date: String(a.date || "").slice(0, 30),
          type: String(a.type || "").slice(0, 50),
          name: String(a.name || "").slice(0, 100),
          km: Number(a.km) || 0,
          duration: String(a.duration || "").slice(0, 30),
          pace: String(a.pace || "").slice(0, 30),
          hr: Number(a.hr) || null,
          rpe: String(a.rpe || "").slice(0, 30),
        }))
      : [];

const incomingSummary = body.summary || {};

const summary = {
  periodDays: Number(incomingSummary.periodDays) || 0,
  activityCount: Number(incomingSummary.activityCount) || 0,
  totalKm: Number(incomingSummary.totalKm) || 0,
  averageKmPerActivity:
    Number(incomingSummary.averageKmPerActivity) || 0,
  earliestDate: incomingSummary.earliestDate || null,
  latestDate: incomingSummary.latestDate || null,
  longestRun: incomingSummary.longestRun || null,
  activitiesWithDuration:
    Number(incomingSummary.activitiesWithDuration) || 0,
  totalDurationSeconds:
    Number.isFinite(Number(incomingSummary.totalDurationSeconds)) &&
    incomingSummary.totalDurationSeconds !== null
      ? Number(incomingSummary.totalDurationSeconds)
      : null,
  typeCounts: incomingSummary.typeCounts || {}
};

    const history = Array.isArray(body.history)
      ? body.history
          .filter(
            (m) =>
              ["user", "assistant"].includes(m.role) &&
              typeof m.content === "string"
          )
          .slice(-10)
          .map((m) => ({
            role: m.role,
            content: m.content.slice(0, 3000),
          }))
      : [];

    
    const systemPrompt = `
Kamu adalah COROS Running Coach, pelatih lari yang berkomunikasi
dalam bahasa Indonesia dengan jelas, realistis, dan berbasis data.

SUMBER DATA:
- Data berasal dari aktivitas yang dikirim dashboard.
- Jangan mengklaim sinkronisasi langsung COROS kecuali sudah diverifikasi.
- Gunakan ringkasan statistik yang dihitung oleh JavaScript sebagai
  sumber angka utama.
- Daftar aktivitas adalah bukti pendukung untuk menilai pola latihan.
- Jangan menganggap data yang tidak dikirim sebagai data nol.

PRINSIP COACHING:
- Utamakan pace dan RPE sebagai target latihan.
- Gunakan HR, durasi, dan konsistensi sebagai konteks pendukung.
- Bedakan fakta, interpretasi, dan rekomendasi.
- Jangan mengarang RPE, jenis sesi, elevasi, cadence, HRV, tidur,
  atau informasi lain yang tidak tersedia.
- Jangan menyebut suatu lari sebagai easy, tempo, threshold, atau
  interval hanya berdasarkan nama jika data tidak cukup.
- Pertimbangkan volume, intensitas, long run, dan pemulihan.
- Jangan menyarankan peningkatan jarak atau intensitas secara otomatis.
- Jika ada nyeri yang memburuk, mengubah cara berlari, atau gejala
  mengkhawatirkan, sarankan mengurangi atau menghentikan latihan
  dan mencari evaluasi profesional bila diperlukan.
- Hindari menyimpulkan peningkatan kebugaran dari satu sesi.

RINGKASAN YANG SUDAH DIHITUNG:
${JSON.stringify(summary)}

DAFTAR AKTIVITAS:
${JSON.stringify(activities)}

MODE:
${mode === "weekly" ? "EVALUASI MINGGUAN" : "CHAT HARIAN"}

ATURAN ANGKA:
- Jangan mengubah total jarak, jumlah aktivitas, atau tanggal dari
  ringkasan di atas.
- Total jarak dan jumlah aktivitas dalam ringkasan adalah acuan utama.
- Jika daftar aktivitas dan ringkasan tidak konsisten, jelaskan
  adanya ketidaksesuaian; jangan mengarang angka pengganti.
- Aktivitas valid dalam ringkasan sudah difilter agar jaraknya > 0 km.

JIKA MODE EVALUASI MINGGUAN:
1. Sebutkan periode dan jumlah aktivitas yang tersedia.
2. Rangkum total jarak, rata-rata jarak per aktivitas, dan long run
   terpanjang jika tersedia.
3. Bahas pola latihan yang benar-benar dapat dikenali dari data.
4. Bandingkan dengan periode sebelumnya hanya jika data pembanding
   memang tersedia.
5. Berikan rekomendasi untuk tujuh hari berikutnya, termasuk
   intensitas dan pace/RPE bila cukup didukung data.
6. Sebutkan keterbatasan data yang memengaruhi kesimpulan.

JIKA MODE CHAT HARIAN:
- Jawab pertanyaan secara langsung.
- Gunakan data aktivitas yang relevan dengan pertanyaan.
- Ajukan satu pertanyaan klarifikasi jika informasi penting belum ada.

Jangan hanya menjelaskan cara kerja AI. Bertindaklah sebagai pelatih
lari dan berikan analisis yang relevan dengan pertanyaan pengguna.
`;


    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      {
        role: "user",
        content: message,
      },
    ];

    const apiResponse = await fetch(
      "https://api.vengetic.biz.id/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-v4.1-flash:free",
          messages,
        }),
      }
    );

    const result = await apiResponse.json().catch(() => ({}));

    if (!apiResponse.ok) {
      console.error("Vengetic API error:", apiResponse.status, result);

      return new Response(
        JSON.stringify({
          error:
            apiResponse.status === 401 || apiResponse.status === 403
              ? "Autentikasi Vengetic gagal. Periksa API key."
              : apiResponse.status === 429
              ? "Batas penggunaan API tercapai. Periksa kuota Vengetic."
              : "Vengetic gagal memproses permintaan. Periksa model dan konfigurasi API.",
        }),
        { status: 502, headers }
      );
    }

    const answer = result.choices?.[0]?.message?.content;

    if (!answer) {
      return new Response(
        JSON.stringify({ error: "Respons AI tidak berisi jawaban." }),
        { status: 502, headers }
      );
    }

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("AI coach function error:", error);

    return new Response(
      JSON.stringify({ error: "Terjadi kesalahan saat memproses permintaan." }),
      { status: 500, headers }
    );
  }
};
