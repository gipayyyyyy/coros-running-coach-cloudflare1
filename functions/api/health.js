export async function onRequestGet() {
  return Response.json({
    ok: true,
    platform: "Cloudflare Pages Functions",
    message: "Backend aktif",
    timestamp: new Date().toISOString()
  }, { headers: { "Cache-Control": "no-store" } });
}
