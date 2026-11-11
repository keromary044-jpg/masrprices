function sourceQuality(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return "invalid";
    const path = url.pathname.toLowerCase();
    if (/\/(category|categories|product-category|collection|collections|search|brand)(\/|$)/.test(path)) return "category";
    if (path === "/" || /^\/(eg|en|ar|eg-en|en-eg)\/?$/.test(path)) return "homepage";
    if (/\/(product|products|item|items|p|dp)(\/|$)/.test(path)) return "direct";
    return "unclear";
  } catch { return "invalid"; }
}
function ageDays(value) {
  const time = Date.parse(String(value || "").replace(" ", "T") + (String(value || "").length === 19 ? "Z" : ""));
  return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 86400000) : null;
}
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
    const { results = [] } = await env.DB.prepare("SELECT o.store_name,o.price_egp,o.product_url,o.source_name,o.variant,o.region,o.checked_at,o.status,ms.value AS monitor_state FROM offers o LEFT JOIN price_monitor_state ms ON ms.key=('offer:'||o.id) WHERE o.product_id = ? AND o.status = 'verified' ORDER BY o.price_egp ASC,o.checked_at DESC").bind(productId).all();
    const offers = results.map((offer) => {
      const quality = sourceQuality(offer.product_url);
      const days = ageDays(offer.checked_at);
      let freshness = days === null ? "unknown" : days <= 1 ? "fresh" : days <= 7 ? "recent" : "stale";
      let recheckRequired = false;
      try { recheckRequired = Boolean(JSON.parse(offer.monitor_state || "{}").recheckRequired); } catch {}
      if (recheckRequired) freshness = "needs_recheck";
      return { ...offer, monitor_state: undefined, source_quality: quality, age_days: days === null ? null : Math.round(days * 10) / 10, freshness, recheck_required: recheckRequired };
    });
    const trusted = offers.filter(o => o.source_quality === "direct" && o.freshness === "fresh" && !o.recheck_required);
    const best = trusted.length ? Math.min(...trusted.map(o => Number(o.price_egp))) : null;
    const qualityCounts = offers.reduce((a,o) => { a[o.source_quality]=(a[o.source_quality]||0)+1; return a; }, {});
    return reply(200, {
      product,
      offers,
      best_price: best,
      best_price_basis: best === null ? "لا يوجد حاليًا عرض حديث من صفحة منتج مباشرة تم التحقق منه" : "أقل سعر حديث من صفحة منتج مباشرة",
      verified_offer_count: offers.length,
      trusted_offer_count: trusted.length,
      source_quality_counts: qualityCounts,
      currency: "EGP"
    });
  } catch {
    return reply(500, { error: "تعذر تحميل مقارنة المتاجر." });
  }
}
