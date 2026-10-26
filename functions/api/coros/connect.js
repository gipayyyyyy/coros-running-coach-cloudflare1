function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.COROS_CLIENT_ID || !env.COROS_KV || !env.COROS_REDIRECT_URI) {
      return new Response("Konfigurasi COROS belum lengkap. Atur COROS_CLIENT_ID, COROS_REDIRECT_URI, dan binding COROS_KV di Cloudflare.", { status: 500 });
    }
    const random = crypto.getRandomValues(new Uint8Array(32));
    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
    const verifier = base64url(random);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = base64url(new Uint8Array(digest));
    await env.COROS_KV.put(`oauth-pending/${state}`, JSON.stringify({ verifier, createdAt: Date.now() }), { expirationTtl: 600 });

    const authorize = new URL(env.COROS_AUTHORIZE_URL || "https://mcpus.coros.com/oauth2/authorize");
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", env.COROS_CLIENT_ID);
    authorize.searchParams.set("redirect_uri", env.COROS_REDIRECT_URI);
    authorize.searchParams.set("scope", env.COROS_SCOPE || "openid mcp.tools offline_access");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("code_challenge_method", "S256");
    if (env.COROS_RESOURCE) authorize.searchParams.set("resource", env.COROS_RESOURCE);
    return Response.redirect(authorize.toString(), 302);
  } catch (error) {
    console.error("COROS connect error", error);
    return new Response("Gagal memulai koneksi COROS. Periksa konfigurasi dan log Cloudflare.", { status: 500 });
  }
}
