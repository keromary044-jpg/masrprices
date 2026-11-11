const LIMIT=40,CONCURRENCY=8;
const SKIP_PATH=/\/collections?\/|\/category\/|\/product-category\/|\/categories\/|\/search|\/brand\//i;
const now=()=>new Date().toISOString().replace('T',' ').slice(0,19);
function collect(v,out,inheritedCurrency=""){
 if(!v||typeof v!=="object")return;
 if(Array.isArray(v)){for(const x of v)collect(x,out,inheritedCurrency);return;}
 const currency=String(v.priceCurrency||v.currency||inheritedCurrency||"").toUpperCase();
 const type=Array.isArray(v["@type"])?v["@type"].join(" "):String(v["@type"]||"");
 if(currency==="EGP"&&(/Offer|AggregateOffer/i.test(type)||v.price!==undefined||v.lowPrice!==undefined)){
  for(const raw of [v.price,v.lowPrice,v.highPrice]){
   const n=Number(String(raw??"").replace(/,/g,""));
   if(Number.isFinite(n)&&n>0&&n<1e10)out.push(n);
  }
 }
 for(const x of Object.values(v))if(x&&typeof x==="object")collect(x,out,currency);
}
function extract(html){
 const prices=[];
 const blocks=html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];
 for(const block of blocks){
  const raw=block.replace(/^.*?>/s,"").replace(/<\/script>$/i,"").trim();
  try{collect(JSON.parse(raw.replace(/&quot;/g,'"').replace(/&#34;/g,'"')),prices);}catch{}
 }
 const tags=html.match(/<meta\b[^>]*>/gi)||[];
 const attrs=tag=>Object.fromEntries([...tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),m[2]]));
 let currency="";
 const amounts=[];
 for(const tag of tags){
  const a=attrs(tag);
  const key=String(a.itemprop||a.property||a.name||"").toLowerCase();
  if(["pricecurrency","product:price:currency","og:price:currency"].includes(key))currency=String(a.content||"").toUpperCase();
  if(["price","product:price:amount","og:price:amount"].includes(key)&&a.content)amounts.push(a.content);
 }
 if(currency==="EGP")for(const raw of amounts){const n=Number(String(raw).replace(/,/g,""));if(Number.isFinite(n)&&n>0&&n<1e10)prices.push(n);}
 const valid=prices.filter(x=>Number.isFinite(x)&&x>0&&x<1e10).sort((a,b)=>a-b);
 return valid.length?valid[Math.floor(valid.length/2)]:null;
}
async function saveState(env,row,value){await env.DB.prepare("INSERT INTO price_monitor_state(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind("offer:"+row.id,JSON.stringify(value)).run();}
async function saveFailure(env,row,error){let attempts=0;try{const old=await env.DB.prepare("SELECT value FROM price_monitor_state WHERE key=?").bind("offer:"+row.id).first();attempts=Number(JSON.parse(old?.value||"{}").failures||0);}catch{}attempts++;const hours=attempts>=3?24:6;await saveState(env,row,{failures:attempts,lastAttempt:now(),retryAfter:new Date(Date.now()+hours*3600000).toISOString().replace('T',' ').slice(0,19),lastError:String(error?.message||error||"تعذر التحقق").slice(0,180)});}
async function checkOne(env,row){const stamp=now();try{const target=new URL(row.product_url);if(target.protocol!=="https:"||target.username||target.password)throw Error("رابط المصدر غير آمن");if(SKIP_PATH.test(target.pathname))return {kind:"skipped"};const res=await fetch(target.href,{headers:{"User-Agent":"Mozilla/5.0 (compatible; MasrPricesPriceMonitor/1.2; +https://masrprices.pages.dev)","Accept":"text/html,application/xhtml+xml"},redirect:"follow",signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error("HTTP "+res.status);const html=await res.text();if(html.length>1800000)throw Error("صفحة المصدر أكبر من الحد المسموح");const price=extract(html);if(!price)throw Error("لم يظهر سعر EGP صريح في صفحة المنتج");const old=Number(row.price_egp),delta=Math.abs(price-old)/Math.max(old,1);if(Math.abs(price-old)<0.005){await env.DB.prepare("UPDATE offers SET checked_at=? WHERE id=?").bind(stamp,row.id).run();}else if(delta>0.30){await env.DB.prepare("INSERT INTO offers(product_id,store_name,price_egp,product_url,source_name,variant,region,checked_at,status) SELECT product_id,store_name,?,product_url,?,variant,region,?,'pending' FROM offers WHERE id=?").bind(price,"مراجعة آلية لتغير كبير: "+row.source_name,stamp,row.id).run();await env.DB.prepare("INSERT INTO price_update_log(source_name,items_received,items_accepted,status,message) VALUES(?,1,0,'review_required',?)").bind(row.source_name,"تغير كبير يحتاج مراجعة: "+row.name+" من "+old+" إلى "+price+" جنيه").run();await env.DB.prepare("UPDATE offers SET checked_at=? WHERE id=?").bind(stamp,row.id).run();}else{await env.DB.prepare("UPDATE offers SET price_egp=?,checked_at=? WHERE id=?").bind(price,stamp,row.id).run();await env.DB.prepare("INSERT INTO price_history(product_id,offer_id,store_name,price_egp,source_name,checked_at) VALUES(?,?,?,?,?,?)").bind(row.product_id,row.id,row.store_name,price,row.source_name,stamp).run();}await saveState(env,row,{verifiedAt:stamp,failures:0});return {kind:"checked",changed:Math.abs(price-old)>=0.005};}catch(error){await saveFailure(env,row,error);console.error("price-check-failed",row.id,String(error?.message||error));return {kind:"failed"};}}
async function run(env){await env.DB.prepare("CREATE TABLE IF NOT EXISTS price_monitor_state (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();const {results=[]}=await env.DB.prepare("SELECT o.id,o.product_id,o.store_name,o.price_egp,o.product_url,o.source_name,o.checked_at,p.category,p.name FROM offers o JOIN products p ON p.id=o.product_id LEFT JOIN price_monitor_state ms ON ms.key=('offer:'||o.id) WHERE o.status='verified' AND o.product_url LIKE 'https://%' AND (length(o.product_url)-length(replace(o.product_url,'/',''))) > 3 AND (ms.value IS NULL OR (json_extract(ms.value,'$.retryAfter') IS NOT NULL AND datetime(json_extract(ms.value,'$.retryAfter'))<=datetime('now')) OR (json_extract(ms.value,'$.verifiedAt') IS NOT NULL AND datetime(json_extract(ms.value,'$.verifiedAt'))<=datetime('now','-24 hours'))) AND lower(p.category) NOT LIKE '%fuel%' AND lower(p.category) NOT LIKE '%وقود%' AND lower(p.category) NOT LIKE '%motorcycle%' AND lower(p.category) NOT LIKE '%موتوسيكل%' AND o.product_url NOT LIKE '%/collections/%' AND o.product_url NOT LIKE '%/collection/%' AND o.product_url NOT LIKE '%/category/%' AND o.product_url NOT LIKE '%/product-category/%' AND o.product_url NOT LIKE '%/categories/%' AND o.product_url NOT LIKE '%/search%' AND o.product_url NOT LIKE '%/brand/%' ORDER BY o.checked_at ASC,o.id ASC LIMIT ?").bind(LIMIT).all();let checked=0,changed=0,failed=0,skipped=0;for(let i=0;i<results.length;i+=CONCURRENCY){const outcomes=await Promise.all(results.slice(i,i+CONCURRENCY).map(row=>checkOne(env,row)));for(const x of outcomes){if(x.kind==="checked"){checked++;if(x.changed)changed++;}else if(x.kind==="failed")failed++;else skipped++;}}const summary={received:results.length,checked,changed,failed,skipped,limit:LIMIT,at:now(),failurePolicy:"failed requests do not refresh price check date; retry in 6h or 24h after repeated failures; successful checks expire after 24h"};await env.DB.prepare("INSERT INTO price_update_log(source_name,items_received,items_accepted,status,message) VALUES('Cloudflare automatic price monitor',?,?,?,?)").bind(results.length,changed,failed?"partial":"completed",JSON.stringify(summary)).run();console.log("price-monitor-run",JSON.stringify(summary));return summary;}
export default{async scheduled(controller,env,ctx){ctx.waitUntil(run(env).catch(e=>console.error("price-monitor-fatal",String(e?.stack||e))));},async fetch(req,env){const u=new URL(req.url);if(u.pathname==="/health"){const row=await env.DB.prepare("SELECT created_at,status,message FROM price_update_log WHERE source_name='Cloudflare automatic price monitor' ORDER BY id DESC LIMIT 1").first();return Response.json({ok:true,service:"MasrPrices price monitor",schedule:"every 15 minutes",batch:LIMIT,lastRun:row||null});}return new Response("Not found",{status:404});}};