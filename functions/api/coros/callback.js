export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) return new Response("Otorisasi COROS ditolak atau gagal.", { status: 400 });
  if (!code || !state || !/^[a-f0-9]{64}$/.test(state)) return new Response("Parameter otorisasi tidak lengkap atau tidak valid.", { status: 400 });
  if (!env.COROS_CLIENT_ID || !env.COROS_KV || !env.COROS_REDIRECT_URI) return new Response("Konfigurasi COROS belum lengkap.", { status: 500 });

  try {
    const key = `oauth-pending/${state}`;
    const pendingRaw = await env.COROS_KV.get(key);
    if (!pendingRaw) return new Response("State tidak ditemukan atau kedaluwarsa. Mulai koneksi dari awal.", { status: 400 });
    const pending = JSON.parse(pendingRaw);
    await env.COROS_KV.delete(key);
    if (!pending.verifier || Date.now() - pending.createdAt > 10 * 60 * 1000) return new Response("Permintaan otorisasi kedaluwarsa.", { status: 400 });

    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.COROS_CLIENT_ID,
      code,
      redirect_uri: env.COROS_REDIRECT_URI,
      code_verifier: pending.verifier
    });
    if (env.COROS_RESOURCE) form.set("resource", env.COROS_RESOURCE);
    const tokenResponse = await fetch(env.COROS_TOKEN_URL || "https://mcpus.coros.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: form
    });
    const tokens = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokens.access_token) {
      console.error("COROS token exchange failed", { status: tokenResponse.status, error: tokens.error || "token_exchange_failed" });
      return new Response("COROS belum memberikan token. Periksa URL OAuth, resource, redirect URI, dan log Cloudflare.", { status: 502 });
    }
    await env.COROS_KV.put("oauth/tokens", JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_type: tokens.token_type || "Bearer",
      scope: tokens.scope || null,
      expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      saved_at: Date.now()
    }));
    return new Response("Token COROS berhasil diterima dan disimpan di Cloudflare KV. Ini hanya mengonfirmasi OAuth; pengambilan aktivitas otomatis belum diaktifkan.", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("COROS callback error", error);
    return new Response("Koneksi COROS gagal. Periksa log Cloudflare.", { status: 500 });
  }
}
