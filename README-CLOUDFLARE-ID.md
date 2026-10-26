# COROS Running Coach — Cloudflare starter

Ini adalah salinan terpisah untuk migrasi. Website Netlify dan repository asal tidak diubah.

## Yang sudah disiapkan
- Dashboard `index.html` dan data aktivitas statis tetap dipertahankan.
- Impor TCX, GPX, CSV, dan JSON tetap menggunakan browser/localStorage.
- Frontend AI Coach diarahkan dari `/.netlify/functions/ai-coach` ke `/api/ai-coach`.
- Cloudflare Pages Function `functions/api/ai-coach.js` memakai binding environment `AI_API_KEY` dan `COACH_ACCESS_CODE`.
- Health check di `/api/health`.
- Kerangka OAuth COROS di `/api/coros/connect` dan `/api/coros/callback`; URL/parameter OAuth harus diverifikasi dengan konfigurasi COROS milik pengguna.

## Batasan yang perlu diketahui
- Sinkronisasi otomatis aktivitas COROS BELUM diimplementasikan. OAuth berhasil hanya berarti token didapat/disimpan, bukan aktivitas telah diambil.
- Data dashboard yang tertanam di `index.html` masih data statis. Aktivitas impor disimpan di localStorage browser itu saja.
- API key Vengetic tidak boleh ditaruh di file atau GitHub.
- Endpoint OAuth lama sebelumnya pernah mengembalikan HTTP 400; jangan menganggap endpoint default di sini sudah benar. Periksa dokumentasi/konfigurasi COROS dan log sebelum menggunakan koneksi OAuth.

## Deploy Cloudflare Pages
1. Buat repository GitHub BARU, misalnya `coros-running-coach-cloudflare`. Jangan menimpa repository Netlify yang aktif.
2. Unggah seluruh isi folder ini ke repository baru (file `index.html` harus berada di root).
3. Di Cloudflare Dashboard, buka Workers & Pages → Create → Pages → Connect to Git.
4. Pilih repository baru tersebut. Framework preset: None. Build command: kosongkan. Build output directory: `/` atau `.` sesuai instruksi dashboard Cloudflare saat setup.
5. Deploy.
6. Setelah deploy, buka Settings → Variables and Secrets dan tambahkan:
   - `AI_API_KEY` (Secret): API key Vengetic
   - `COACH_ACCESS_CODE` (Secret): kode akses coach yang kamu pilih
   - `COROS_CLIENT_ID` (jika OAuth COROS sudah disiapkan)
   - `COROS_REDIRECT_URI`: URL persis `https://DOMAIN-BARU/api/coros/callback`
   - `COROS_AUTHORIZE_URL`, `COROS_TOKEN_URL`, `COROS_RESOURCE` hanya jika sudah diverifikasi dari konfigurasi/dokumentasi COROS
7. Untuk menyimpan state dan token OAuth, buat KV namespace dan tambahkan binding bernama `COROS_KV` pada Pages project.
8. Deploy ulang setelah variabel dan binding diatur.
9. Tes `https://DOMAIN-BARU/api/health` terlebih dahulu, kemudian AI Coach.

## Catatan
Pages Functions dijalankan di Cloudflare Workers runtime. File fungsi memakai `onRequestGet` / `onRequestPost` dan `env`, bukan `process.env`.
