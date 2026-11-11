const SITE = "https://masrprices.pages.dev";
const API_ORIGIN = "https://masrprices-new.keromary044.workers.dev";
const API_PATHS = new Set(["/api/admin","/api/compare","/api/price-submission","/api/real-estate","/api/real-estate-admin","/api/suggestion","/api/stocks"]);
function secure(response, request) {
 const headers = new Headers(response.headers);
 headers.set("X-Content-Type-Options","nosniff");
 headers.set("X-Permitted-Cross-Domain-Policies","none");
 headers.set("X-Frame-Options","DENY");
 headers.set("Referrer-Policy","strict-origin-when-cross-origin");
 headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
 headers.set("Cross-Origin-Opener-Policy","same-origin");
 headers.set("Content-Security-Policy","default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data:; font-src 'self' https: data:; connect-src 'self' https:; frame-src https:; upgrade-insecure-requests");
 if (new URL(request.url).protocol === "https:") headers.set("Strict-Transport-Security","max-age=31536000");
 const path = new URL(request.url).pathname;
 if (path === "/admin.html" || path.startsWith("/api/")) headers.set("X-Robots-Tag","noindex, nofollow, noarchive");
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
const apiError = (status,message) => new Response(JSON.stringify({error:message}),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
export default {
 async fetch(request, env) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  if (url.pathname.startsWith("/api/")) {
   if (!API_PATHS.has(url.pathname)) return secure(apiError(404,"واجهة API غير موجودة."),request);
   if (!["GET","POST"].includes(request.method)) return secure(apiError(405,"طريقة الطلب غير مدعومة."),request);
   if (request.method === "POST" && request.headers.get("Origin") !== url.origin) return secure(apiError(403,"طلب غير مسموح."),request);
   try {
    const target = new URL(url.pathname + url.search,API_ORIGIN);
    const original = new Request(target.toString(),request);
    const headers = new Headers(original.headers);
    if (request.method === "POST") headers.set("Origin",API_ORIGIN);
    const forwarded = new Request(original,{headers});
    return secure(await fetch(forwarded),request);
   } catch {
    return secure(apiError(502,"تعذر الاتصال بخدمة الموقع. حاول مرة أخرى."),request);
   }
  }
  const categoryMatch = pathParts[0] === "category" && pathParts.length === 2 ? pathParts[1] : null;
  if (categoryMatch) {
   if (request.method !== "GET" && request.method !== "HEAD") return secure(new Response("Method Not Allowed",{status:405}),request);
   if (!url.pathname.endsWith("/")) return secure(Response.redirect(SITE + "/category/" + encodeURIComponent(categoryMatch) + "/",301),request);
   const categoryNames = {"phones":"الموبايلات (9)","electronics":"الإلكترونيات والملحقات (35)","home-appliances":"الأجهزة المنزلية (24)","books":"الكتب (90)","cars":"السيارات (18)","groceries":"الطعام والبقالة (9)","tools":"الأدوات (21)","baby":"مستلزمات الأطفال (3)","clothing":"الملابس (9)","furniture":"الأثاث (13)","personal-care":"العناية الشخصية (18)","sports":"الرياضة (10)","plants":"الزراعة والنباتات (10)","telecom":"خدمات الاتصالات (12)"};
   const categoryName = categoryNames[categoryMatch];
   if (!categoryName) return secure(new Response("القسم غير موجود",{status:404}),request);
   const response = await env.ASSETS.fetch(new Request(new URL("/products-data.json",url)));
   if (!response.ok) return secure(new Response("تعذر تحميل بيانات المنتجات",{status:503}),request);
   const allProducts = await response.json();
   const items = allProducts.filter(item => item.category === categoryName);
   const definition = {"phones":{"title":"أسعار الموبايلات في مصر","description":"قارن أسعار الهواتف المحمولة المتاحة في دليل MasrPrices، وراجع السعر المسجل وتاريخ رصده قبل الشراء."},"electronics":{"title":"أسعار الإلكترونيات والملحقات في مصر","description":"تصفح أسعار السماعات والملحقات والأجهزة الإلكترونية المسجلة في دليل MasrPrices."},"home-appliances":{"title":"أسعار الأجهزة المنزلية في مصر","description":"قارن أسعار الأجهزة المنزلية المسجلة مثل الثلاجات والغسالات والتلفزيونات وأجهزة المطبخ."},"books":{"title":"أسعار الكتب في مصر","description":"تصفح أسعار الكتب والروايات والكتب التعليمية المسجلة في دليل MasrPrices."},"cars":{"title":"أسعار السيارات في مصر","description":"استعرض أسعار طرازات السيارات المسجلة في الدليل مع توضيح تاريخ الرصد عند توفره."},"groceries":{"title":"أسعار الطعام والبقالة في مصر","description":"تصفح أسعار السلع الغذائية ومنتجات البقالة المسجلة، وتحقق من تاريخ السعر قبل الشراء."},"tools":{"title":"أسعار الأدوات في مصر","description":"قارن أسعار الأدوات اليدوية ومستلزمات الورش والمنزل المسجلة في دليل MasrPrices."},"baby":{"title":"أسعار مستلزمات الأطفال في مصر","description":"تصفح أسعار مستلزمات الأطفال المسجلة في الدليل، مع عرض السعر فقط عند توفره."},"clothing":{"title":"أسعار الملابس والأحذية في مصر","description":"استعرض أسعار الملابس والأحذية المسجلة في دليل MasrPrices."},"furniture":{"title":"أسعار الأثاث والمفروشات في مصر","description":"تصفح أسعار الأثاث المنزلي والقطع المسجلة في دليل MasrPrices."},"personal-care":{"title":"أسعار العناية الشخصية في مصر","description":"قارن أسعار منتجات العناية الشخصية المسجلة في الدليل، وتحقق من تفاصيل العبوة والسعر."},"sports":{"title":"أسعار المنتجات الرياضية في مصر","description":"تصفح أسعار الأدوات والمنتجات الرياضية المسجلة في دليل MasrPrices."},"plants":{"title":"أسعار الزراعة والنباتات في مصر","description":"استعرض أسعار البذور ومستلزمات الزراعة والنباتات المسجلة في دليل MasrPrices."},"telecom":{"title":"أسعار خدمات الاتصالات والإنترنت في مصر","description":"تصفح أسعار باقات وخدمات الاتصالات والإنترنت المسجلة في الدليل، وتأكد من شروط كل باقة لدى مقدم الخدمة."}};
   const info = definition[categoryMatch];
   const title = info.title + " | MasrPrices";
   const description = info.description;
   const canonical = SITE + "/category/" + categoryMatch + "/";
   const list = items.map((item,index)=>({"@type":"ListItem","position":index+1,"name":item.name,"url":SITE+"/products/"+item.slug+"/"}));
   const schema = {"@context":"https://schema.org","@type":"CollectionPage","name":info.title,"description":description,"url":canonical,"mainEntity":{"@type":"ItemList","numberOfItems":items.length,"itemListElement":list}};
   const rows = items.map(item=>{const price=item.price===null?"لا يوجد سعر مسجل":Number(item.price).toLocaleString("en-US")+" جنيه";return '<li><a href="/products/'+encodeURIComponent(item.slug)+'/">'+esc(item.name)+'</a><strong>'+esc(price)+'</strong><small>'+(item.date?'آخر رصد: '+esc(item.date):'تاريخ الرصد غير متاح')+'</small></li>';}).join("");
   const html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="'+canonical+'"><meta property="og:type" content="website"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+canonical+'"><script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script><style>body{font-family:Arial,sans-serif;background:#f5f7fa;color:#172b43;margin:0;line-height:1.8}header{background:#102b50;color:white;padding:15px}header a{color:white}main{max-width:900px;margin:26px auto;padding:0 14px}.panel{background:white;border:1px solid #dce5ef;border-radius:15px;padding:20px;margin-bottom:16px}ul{list-style:none;padding:0}li{padding:12px 0;border-bottom:1px solid #e5ebf2;display:grid;grid-template-columns:1fr auto;gap:4px 12px}li a{font-weight:bold}li strong{color:#145da0}small{grid-column:1/-1;color:#63758a}a{color:#145da0}</style></head><body><header><a href="/">MasrPrices | أسعار مصر</a></header><main><nav><a href="/">الرئيسية</a> ← <a href="/products/">دليل المنتجات</a> ← '+esc(info.title)+'</nav><section class="panel"><h1>'+esc(info.title)+'</h1><p>'+esc(description)+'</p><p>عدد المنتجات في هذا القسم: '+items.length+'</p><p>الأسعار استرشادية وفق آخر بيانات مسجلة، وقد تتغير لدى البائع. عند عدم توفر سعر مسجل نوضح ذلك بدلًا من عرض سعر تخميني.</p></section><section class="panel"><h2>المنتجات والأسعار</h2><ul>'+rows+'</ul><p><a href="/products/">عرض جميع المنتجات والأقسام</a></p></section></main></body></html>';
   return secure(new Response(request.method === "HEAD" ? null : html,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=3600"}}),request);
  }
  const match = pathParts[0] === "products" && pathParts.length === 2 ? [url.pathname, pathParts[1]] : null;
  if (match) {
   if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed",{status:405});
   const slug = decodeURIComponent(match[1]);
   if (!url.pathname.endsWith("/")) return secure(Response.redirect(SITE + "/products/" + encodeURIComponent(slug) + "/",301),request);
   const response = await env.ASSETS.fetch(new Request(new URL("/products-data.json",url)));
   if (!response.ok) return new Response("تعذر تحميل بيانات المنتجات",{status:503});
   const products = await response.json();
   const p = products.find(item => item.slug === slug);
   if (!p) return new Response("<!doctype html><html lang='ar' dir='rtl'><meta charset='utf-8'><title>المنتج غير موجود | MasrPrices</title><h1>المنتج غير موجود</h1><a href='/products/'>دليل المنتجات</a></html>",{status:404,headers:{"Content-Type":"text/html; charset=utf-8"}});
   const title = "سعر " + p.name + " في مصر | MasrPrices";
   const price = p.price === null ? "لا يوجد سعر مسجل حاليًا" : Number(p.price).toLocaleString("en-US") + " جنيه مصري";
   const description = "سعر " + p.name + " في مصر: " + price + (p.date ? "، آخر رصد " + p.date : "") + ". بيانات استرشادية من MasrPrices وقد تتغير لدى البائع.";
   const canonical = SITE + "/products/" + p.slug + "/";
   const schema = {"@context":"https://schema.org","@type":"Product","name":p.name,"description":description,"category":p.category,"url":canonical,...(Number.isFinite(Number(p.price)) && Number(p.price)>0 ? {"offers":{"@type":"Offer","price":String(p.price),"priceCurrency":"EGP","url":canonical}} : {})};
   const sameCategory = products.filter(item => item.category === p.category && item.slug !== p.slug && Number.isFinite(Number(item.price)) && Number(item.price) > 0).sort((a,b)=>Number(a.price)-Number(b.price));
   const comparable = sameCategory.slice(0,6);
   const prices = sameCategory.map(item=>Number(item.price));
   const categoryRange = prices.length ? "تتراوح الأسعار المسجلة للمنتجات الأخرى في هذا القسم بين " + Math.min(...prices).toLocaleString("en-US") + " و" + Math.max(...prices).toLocaleString("en-US") + " جنيه مصري، وفق البيانات المتاحة." : "لا تتوفر حاليًا أسعار أخرى للمقارنة في هذا القسم.";
   const comparableRows = comparable.length ? comparable.map(item=>'<li><a href="/products/'+encodeURIComponent(item.slug)+'/">'+esc(item.name)+'</a><strong>'+Number(item.price).toLocaleString("en-US")+' جنيه</strong><small>'+(item.date?'آخر رصد مسجل: '+esc(item.date):'تاريخ الرصد غير متاح')+'</small></li>').join("") : '<li>لا توجد منتجات أخرى بأسعار مسجلة للمقارنة حاليًا.</li>';
   const sourceInfo = p.sourceUrl ? (p.sourceType === "search" ? '<p><strong>البحث عن مصادر السعر:</strong> <a href="'+esc(p.sourceUrl)+'" rel="nofollow noopener" target="_blank">ابحث عن المنتج والسعر</a></p>' : '<p><strong>مصدر السعر:</strong> <a href="'+esc(p.sourceUrl)+'" rel="nofollow noopener" target="_blank">عرض المصدر</a></p>') : '<p><strong>مصدر السعر:</strong> غير مسجل في بيانات هذا المنتج حاليًا. نعرض السعر كتسجيل استرشادي ولا ندّعي أنه سعر مؤكد من متجر بعينه.</p>';
   const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${canonical}"><link rel="icon" href="/assets/icon.svg" type="image/svg+xml"><meta property="og:type" content="product"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:site_name" content="MasrPrices"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,"\\\\u003c")}</script><style>body{font-family:Arial,sans-serif;background:#f5f7fa;color:#172b43;margin:0;line-height:1.8}header{background:#102b50;color:white;padding:15px}header a{color:white;text-decoration:none}main{max-width:850px;margin:28px auto;padding:0 14px}.panel{background:white;border:1px solid #dce5ef;border-radius:16px;padding:22px;margin-bottom:16px}.price{font-size:28px;font-weight:bold;color:#145da0}.muted{color:#63758a;font-size:14px}a{color:#145da0}</style></head><body><header><a href="/">MasrPrices | أسعار مصر</a></header><main><nav aria-label="مسار التنقل"><a href="/">الرئيسية</a> ← <a href="/products/">المنتجات والأسعار</a> ← ${esc(p.name)}</nav><article class="panel"><h1>${esc(p.name)} في مصر</h1><p class="muted">القسم: ${esc(p.category)}</p><p class="price">${esc(price)}</p><p class="muted">${p.date ? "آخر تاريخ رصد مسجل: " + esc(p.date) : "لا يتوفر تاريخ رصد للسعر"}</p><p>${esc(description)}</p><p>السعر استرشادي ويعكس آخر بيانات مسجلة لدينا، وقد يتغير أو ينفد لدى البائع. تحقق من السعر النهائي والمواصفات قبل الشراء.</p>${sourceInfo}</article><section class="panel"><h2>مقارنة مع منتجات أخرى في نفس القسم</h2><p>${esc(categoryRange)}</p><ul>${comparableRows}</ul><p class="muted">المقارنة مبنية على السجلات الموجودة في MasrPrices، وليست تأكيدًا لتوافر المنتجات أو تطابق مواصفاتها.</p></section><section class="panel"><h2>عن بيانات سعر ${esc(p.name)}</h2><p>نعرض الاسم والقسم والسعر وتاريخ الرصد المسجل. قد تختلف الأسعار حسب المتجر والموديل والنسخة والمحافظة وتكاليف الشحن. إذا كان لديك رابط مصدر أحدث أو لاحظت اختلافًا، أرسله من <a href="/contact.html">صفحة اتصل بنا</a> لمراجعته قبل تحديث البيانات.</p><p><a href="/category/phones/">تصفح الأقسام</a> · <a href="/products/">عرض باقي المنتجات والأسعار</a></p><p><a href="/">العودة إلى الصفحة الرئيسية</a></p></section></main></body></html>`;
   return secure(new Response(request.method === "HEAD" ? null : html,{status:200,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=3600"}}),request);
  }
  return secure(await env.ASSETS.fetch(request),request);
 }
};