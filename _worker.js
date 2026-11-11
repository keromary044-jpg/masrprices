const SITE = "https://masrprices.pages.dev";
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
export default {
 async fetch(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\\/products\\/([^/]+)\\/?$/);
  if (match) {
   if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed",{status:405});
   const slug = decodeURIComponent(match[1]);
   if (!url.pathname.endsWith("/")) return Response.redirect(SITE + "/products/" + encodeURIComponent(slug) + "/",301);
   const response = await env.ASSETS.fetch(new Request(new URL("/products-data.json",url)));
   if (!response.ok) return new Response("تعذر تحميل بيانات المنتجات",{status:503});
   const products = await response.json();
   const p = products.find(item => item.slug === slug);
   if (!p) return new Response("<!doctype html><html lang='ar' dir='rtl'><meta charset='utf-8'><title>المنتج غير موجود | MasrPrices</title><h1>المنتج غير موجود</h1><a href='/products/'>دليل المنتجات</a></html>",{status:404,headers:{"Content-Type":"text/html; charset=utf-8"}});
   const title = "سعر " + p.name + " في مصر | MasrPrices";
   const price = p.price === null ? "لا يوجد سعر مسجل حاليًا" : Number(p.price).toLocaleString("en-US") + " جنيه مصري";
   const description = "سعر " + p.name + " في مصر: " + price + (p.date ? "، آخر رصد " + p.date : "") + ". بيانات استرشادية من MasrPrices وقد تتغير لدى البائع.";
   const canonical = SITE + "/products/" + p.slug + "/";
   const schema = {"@context":"https://schema.org","@type":"Product","name":p.name,"description":description,"category":p.category,"url":canonical};
   const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${canonical}"><link rel="icon" href="/assets/icon.svg" type="image/svg+xml"><meta property="og:type" content="product"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:site_name" content="MasrPrices"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,"\\\\u003c")}</script><style>body{font-family:Arial,sans-serif;background:#f5f7fa;color:#172b43;margin:0;line-height:1.8}header{background:#102b50;color:white;padding:15px}header a{color:white;text-decoration:none}main{max-width:850px;margin:28px auto;padding:0 14px}.panel{background:white;border:1px solid #dce5ef;border-radius:16px;padding:22px;margin-bottom:16px}.price{font-size:28px;font-weight:bold;color:#145da0}.muted{color:#63758a;font-size:14px}a{color:#145da0}</style></head><body><header><a href="/">MasrPrices | أسعار مصر</a></header><main><nav aria-label="مسار التنقل"><a href="/">الرئيسية</a> ← <a href="/products/">المنتجات والأسعار</a> ← ${esc(p.name)}</nav><article class="panel"><h1>${esc(p.name)} في مصر</h1><p class="muted">القسم: ${esc(p.category)}</p><p class="price">${esc(price)}</p><p class="muted">${p.date ? "آخر تاريخ رصد مسجل: " + esc(p.date) : "لا يتوفر تاريخ رصد للسعر"}</p><p>${esc(description)}</p><p>السعر استرشادي ويعكس آخر بيانات مسجلة لدينا، وقد يتغير أو ينفد لدى البائع. تحقق من السعر النهائي والمواصفات قبل الشراء.</p></article><section class="panel"><h2>عن سعر ${esc(p.name)}</h2><p>تعرض هذه الصفحة بيانات المنتج المسجلة في دليل MasrPrices لمقارنة الأسعار في مصر. لا نضع سعرًا تخمينيًا عند عدم توفر بيانات موثوقة.</p><p><a href="/products/">عرض باقي المنتجات والأسعار</a></p><p><a href="/">العودة إلى الصفحة الرئيسية</a></p></section></main></body></html>`;
   return new Response(request.method === "HEAD" ? null : html,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=3600","X-Content-Type-Options":"nosniff"}});
  }
  return env.ASSETS.fetch(request);
 }
};