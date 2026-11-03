export async function onRequestGet({ request, env }) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60, stale-while-revalidate=300" };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
  if (!env.DB) return reply(503, { error: "خدمة مقارنة المتاجر لم تُفعّل بعد." });
  const url = new URL(request.url);
  const productId = (url.searchParams.get("product_id") || "").trim().slice(0, 120);
  if (!productId) return reply(400, { error: "معرّف المنتج مطلوب." });
  try {
    const product = await env.DB.prepare("SELECT id,name,brand,category,variant,unit,image_url FROM products WHERE id = ?").bind(productId).first();
    if (!product) return reply(404, { error: "المنتج غير مسجل في قاعدة المقارنة." });
    const { results } = await env.DB.prepare("SELECT store_name,price_egp,product_url,source_name,variant,region,checked_at,status FROM offers WHERE product_id = ? AND status = 'verified' ORDER BY price_egp ASC, checked_at DESC").bind(productId).all();
    return reply(200, { product, offers: results, best_price: results[0]?.price_egp ?? null, currency: "EGP" });
  } catch {
    return reply(500, { error: "تعذر تحميل مقارنة المتاجر." });
  }
}