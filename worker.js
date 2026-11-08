import { onRequest as adminHandler } from "./functions/api/admin.js";
import { onRequestGet as compareHandler } from "./functions/api/compare.js";
import { onRequestPost as suggestionHandler } from "./functions/api/suggestion.js";
import { onRequest as realEstateHandler } from "./functions/api/real-estate.js";
import { onRequest as realEstateAdminHandler } from "./functions/api/real-estate-admin.js";

function secure(response, request) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https: data:; connect-src 'self' https:; upgrade-insecure-requests");
  if (new URL(request.url).protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, {status:response.status,statusText:response.statusText,headers});
}

async function egidStocksHandler(request, env, ctx) {
  const reply = (status, body, cache = "no-store") => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache }
  });
  const token = String(env.EGID_API_TOKEN || "").trim();
  if (!token) return reply(503, {
    provider: "EGID",
    status: "credentials_required",
    error: "لم يتم ربط بيانات الدخول المعتمدة من EGID بالخادم بعد."
  });
  const mode = String(env.EGID_FEED_MODE || "delayed").toLowerCase() === "live" ? "live" : "delayed";
  const path = mode === "live"
    ? "/api/Feed/GetAllMarketWatch"
    : "/api/DelayedFeed/getAllMarketWatch";
  const upstreamUrl = "https://ticker.egidegypt.com" + path;
  const cacheKey = new Request(new URL("/__cache/egid-market-watch-" + mode, request.url).toString(), { method: "GET" });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return new Response(cached.body, { status: cached.status, headers: cached.headers });
  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: { "Accept": "application/json", "Authorization": "Bearer " + token },
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    return reply(502, { provider: "EGID", status: "upstream_unavailable", error: "تعذر الاتصال بواجهة بيانات EGID." });
  }
  if (!upstream.ok) {
    return reply(upstream.status === 401 || upstream.status === 403 ? 502 : 503, {
      provider: "EGID",
      status: upstream.status === 401 || upstream.status === 403 ? "authentication_or_permission_error" : "provider_error",
      error: "رفضت واجهة EGID الطلب أو تعذر الحصول على البيانات. تحقق من صلاحية الحساب ونوع البيانات المسموح بها."
    });
  }
  let data;
  try { data = await upstream.json(); }
  catch { return reply(502, { provider: "EGID", status: "invalid_response", error: "استجابة EGID ليست بصيغة JSON صالحة." }); }
  const body = {
    provider: "EGID",
    mode,
    receivedAt: new Date().toISOString(),
    data
  };
  const response = new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=5, stale-while-revalidate=10" }
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

async function rateLimit(binding, request, scope) {
  if (!binding || typeof binding.limit !== "function") {
    return json(503, { error: "حماية الطلبات غير مهيأة على الخادم." });
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const result = await binding.limit({ key: scope + ":" + ip });
  if (!result.success) return json(429, { error: "طلبات كثيرة خلال وقت قصير. انتظر دقيقة ثم حاول مجددًا." });
  return null;
}


function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch { return ""; }
}

async function productPageHandler(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/products\/([a-z0-9-]+)\/?$/i);
  if (!match) return null;
  const slug = match[1];
  let response;
  try {
    response = await env.ASSETS.fetch(new Request(new URL("/seo-products.json", url.origin), { method: "GET" }));
  } catch {
    return new Response("تعذر تحميل بيانات المنتجات حاليًا.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (!response.ok) return new Response("بيانات المنتجات غير متاحة.", { status: 503 });
  let products;
  try { products = await response.json(); } catch { return new Response("بيانات المنتجات غير صالحة.", { status: 503 }); }
  if (!Array.isArray(products)) return new Response("بيانات المنتجات غير صالحة.", { status: 503 });
  const item = products.find(product => product && product.slug === slug);
  if (!item) return new Response("المنتج غير موجود", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" } });

  const name = escapeHtml(item.name || "منتج");
  const category = escapeHtml(item.category || "منتجات");
  const price = Number(item.price);
  const hasPrice = Number.isFinite(price) && price >= 0;
  const priceText = hasPrice ? (price === 0 ? "مجاني" : price.toLocaleString("en-US") + " جنيه") : "لا يتوفر سعر مسجل";
  const checkedDate = escapeHtml(item.date || "غير محدد");
  const canonical = url.origin + "/products/" + encodeURIComponent(slug) + "/";
  const source = safeHttpUrl(item.source);
  const sourceLabel = escapeHtml(item.sourceLabel || "المصدر المسجل");
  const details = item.details && typeof item.details === "object" ? Object.entries(item.details)
    .filter(([key, value]) => value != null && String(value).trim() && !/^راجع\b/.test(String(value).trim()))
    .map(([key, value]) => '<tr><th>' + escapeHtml(({brand:"العلامة التجارية",category:"الفئة",release:"سنة الإصدار",display:"الشاشة",processor:"المعالج",memory:"الذاكرة والتخزين",rearCamera:"الكاميرا الخلفية",frontCamera:"الكاميرا الأمامية",battery:"البطارية",os:"نظام التشغيل",connectivity:"الاتصال",build:"التصميم"}[key] || key)) + '</th><td>' + escapeHtml(value) + '</td></tr>').join("") : "";
  const offers = Array.isArray(item.offers) ? item.offers.filter(o => o && Number.isFinite(Number(o.price)) && Number(o.price) >= 0).sort((a,b)=>Number(a.price)-Number(b.price)) : [];
  const offerRows = offers.map(offer => {
    const href = safeHttpUrl(offer.source);
    return '<tr><td>' + escapeHtml(offer.merchant || "متجر") + '</td><td>' + (Number(offer.price) === 0 ? 'مجاني' : Number(offer.price).toLocaleString("en-US") + ' جنيه') + '</td><td>' + escapeHtml(offer.variant || "—") + '</td><td>' + (href ? '<a rel="nofollow noopener" target="_blank" href="' + escapeHtml(href) + '">عرض المصدر</a>' : "—") + '</td></tr>';
  }).join("");
  const mainSource = source ? '<p><a rel="nofollow noopener" target="_blank" href="' + escapeHtml(source) + '">فتح ' + sourceLabel + '</a></p>' : '<p>لم يُسجل رابط مصدر مباشر لهذا المنتج.</p>';
  const jsonLd = JSON.stringify({
    "@context":"https://schema.org", "@type":"Product", name:String(item.name || "منتج"),
    category:String(item.category || ""), sku:String(item.slug || ""),
    offers: hasPrice ? {"@type":"Offer","priceCurrency":"EGP","price":price} : undefined
  }).replace(/</g, "\\u003c");
  const html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + name + ' — السعر والمصادر | MasrPrices</title><meta name="description" content="السعر المسجل لـ ' + name + ' في مصر، تاريخ الرصد ومصادر السعر والعروض المتاحة."><meta name="robots" content="index,follow"><link rel="canonical" href="' + escapeHtml(canonical) + '"><meta property="og:type" content="product"><meta property="og:title" content="' + name + ' | MasrPrices"><meta property="og:description" content="' + escapeHtml(priceText) + ' — آخر رصد: ' + checkedDate + '"><script type="application/ld+json">' + jsonLd + '</script><style>*{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#172b45;font:16px/1.8 Arial,Tahoma,sans-serif}header{background:#102b50;color:#fff;padding:14px 18px}header a{color:#fff;text-decoration:none;font-weight:bold}main{max-width:900px;margin:22px auto;padding:0 14px}.card{background:#fff;border:1px solid #dce5ef;border-radius:16px;padding:20px;margin-bottom:16px}h1{font-size:clamp(22px,5vw,32px);line-height:1.4}h2{font-size:20px;color:#102b50}a{color:#145da0}.price{font-size:30px;font-weight:bold;color:#b42332}.muted{color:#63758a;font-size:14px}.notice{background:#fff8e8;border-radius:10px;padding:12px}table{width:100%;border-collapse:collapse;display:block;overflow-x:auto}td,th{text-align:right;padding:9px;border-bottom:1px solid #e5ebf2;white-space:normal}th{color:#43566c;min-width:120px}.actions{display:flex;gap:12px;flex-wrap:wrap}.actions a{background:#102b50;color:white;padding:9px 14px;border-radius:9px;text-decoration:none}@media(max-width:600px){.card{padding:15px}td,th{font-size:14px}}</style></head><body><header><a href="/">MasrPrices | أسعار مصر</a></header><main><nav class="muted"><a href="/">الرئيسية</a> / <a href="/products/">دليل المنتجات</a> / ' + name + '</nav><section class="card"><p class="muted">' + category + '</p><h1>' + name + '</h1><div class="price">' + escapeHtml(priceText) + '</div><p class="muted">آخر تاريخ رصد مسجل: ' + checkedDate + '</p><p class="notice">هذا سعر مسجل في قاعدة بيانات الموقع وليس ضمانًا لتوفر المنتج أو ثبات السعر. تحقق من المصدر أو المتجر قبل الشراء.</p><div class="actions"><a href="/products/">كل المنتجات</a><a href="/">العودة للرئيسية</a></div></section>' + (details ? '<section class="card"><h2>المواصفات المسجلة</h2><table>' + details + '</table></section>' : '') + '<section class="card"><h2>مقارنة العروض المسجلة</h2>' + (offerRows ? '<table><thead><tr><th>المتجر</th><th>السعر</th><th>النسخة / التفاصيل</th><th>المصدر</th></tr></thead><tbody>' + offerRows + '</tbody></table>' : '<p>لا توجد عروض متاجر متعددة مسجلة لهذا المنتج حاليًا. لا يعني ذلك عدم توفره في المتاجر.</p>') + '</section><section class="card"><h2>مصدر السعر</h2>' + mainSource + '<p class="muted">تاريخ الرصد المعروض مأخوذ من سجل بيانات الموقع. الأسعار قد تتغير بعد تاريخ الرصد.</p></section></main></body></html>';
  return new Response(html, { status: 200, headers: { "Content-Type":"text/html; charset=utf-8", "Cache-Control":"public, max-age=300, stale-while-revalidate=3600" } });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Reject malformed API methods before dispatch; static assets remain read-only through GET/HEAD.
    if (url.pathname.startsWith("/api/") && !["GET","POST"].includes(request.method)) {
      return secure(json(405, { error: "طريقة الطلب غير مدعومة." }), request);
    }
    if (!url.pathname.startsWith("/api/") && !["GET","HEAD"].includes(request.method)) {
      return secure(json(405, { error: "طريقة الطلب غير مدعومة." }), request);
    }

    if (url.pathname === "/api/admin") {
      const blocked = await rateLimit(env.ADMIN_RATE_LIMITER, request, "admin");
      if (blocked) return secure(blocked, request);
      return secure(await adminHandler({ request, env, ctx, params: {} }), request);
    }

    if (url.pathname === "/api/stocks") {
      if (request.method !== "GET") return secure(json(405, { error: "طريقة الطلب غير مدعومة." }), request);
      const blocked = await rateLimit(env.PUBLIC_READ_RATE_LIMITER, request, "stocks");
      if (blocked) return secure(blocked, request);
      return secure(await egidStocksHandler(request, env, ctx), request);
    }

    if (url.pathname === "/api/compare") {
      if (request.method !== "GET") return secure(json(405, { error: "طريقة الطلب غير مدعومة." }), request);
      const blocked = await rateLimit(env.PUBLIC_READ_RATE_LIMITER, request, "compare");
      if (blocked) return secure(blocked, request);
      return secure(await compareHandler({ request, env, ctx, params: {} }), request);
    }

    if (url.pathname === "/api/real-estate") {
      const binding = request.method === "POST" ? env.PUBLIC_WRITE_RATE_LIMITER : env.PUBLIC_READ_RATE_LIMITER;
      const blocked = await rateLimit(binding, request, "real-estate-" + request.method.toLowerCase());
      if (blocked) return secure(blocked, request);
      return secure(await realEstateHandler({ request, env, ctx, params: {} }), request);
    }

    if (url.pathname === "/api/real-estate-admin") {
      const blocked = await rateLimit(env.ADMIN_RATE_LIMITER, request, "real-estate-admin");
      if (blocked) return secure(blocked, request);
      return secure(await realEstateAdminHandler({ request, env, ctx, params: {} }), request);
    }

    if (url.pathname === "/api/suggestion") {
      if (request.method !== "POST") return secure(json(405, { error: "طريقة الطلب غير مدعومة." }), request);
      const blocked = await rateLimit(env.SUGGESTION_RATE_LIMITER, request, "suggestion");
      if (blocked) return secure(blocked, request);
      return secure(await suggestionHandler({ request, env, ctx, params: {} }), request);
    }

    if (url.pathname.startsWith("/products/") && url.pathname !== "/products/") {
      const productResponse = await productPageHandler(request, env);
      if (productResponse) return secure(productResponse, request);
    }

    return secure(await env.ASSETS.fetch(request), request);
  }
};
