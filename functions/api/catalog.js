const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=30, stale-while-revalidate=60"}});
export async function onRequestGet({request,env}){
 if(!env.DB)return json(503,{error:"قاعدة بيانات المنتجات غير متاحة حاليًا."});
 const url=new URL(request.url);
 const q=(url.searchParams.get("q")||"").trim().slice(0,80);
 const category=(url.searchParams.get("category")||"").trim().slice(0,100);
 const limit=Math.max(1,Math.min(60,Number.parseInt(url.searchParams.get("limit")||"40",10)||40));
 const offset=Math.max(0,Math.min(100000,Number.parseInt(url.searchParams.get("offset")||"0",10)||0));
 const where="(?='' OR instr(lower(p.name||' '||p.brand||' '||p.category),lower(?))>0) AND (?='' OR p.category=?)";
 try{
  const [count,items,categories]=await Promise.all([
   env.DB.prepare("SELECT COUNT(*) AS total FROM products p WHERE "+where).bind(q,q,category,category).first(),
   env.DB.prepare("SELECT p.id,p.name,p.brand,p.category,p.variant,p.unit,COUNT(o.id) AS offers_count,MIN(CASE WHEN json_extract(ms.value,'$.verifiedAt') IS NOT NULL AND datetime(json_extract(ms.value,'$.verifiedAt'))>=datetime('now','-1 day') AND (o.product_url LIKE '%/product/%' OR o.product_url LIKE '%/products/%' OR o.product_url LIKE '%/item/%' OR o.product_url LIKE '%/items/%' OR o.product_url LIKE '%/dp/%') THEN o.price_egp END) AS best_price FROM products p LEFT JOIN offers o ON o.product_id=p.id AND o.status='verified' LEFT JOIN price_monitor_state ms ON ms.key=('offer:'||o.id) WHERE "+where+" GROUP BY p.id ORDER BY CASE WHEN best_price IS NULL THEN 1 ELSE 0 END, p.category COLLATE NOCASE, p.name COLLATE NOCASE LIMIT ? OFFSET ?").bind(q,q,category,category,limit,offset).all(),
   env.DB.prepare("SELECT category,COUNT(*) AS count FROM products WHERE trim(category)<>'' GROUP BY category ORDER BY count DESC,category COLLATE NOCASE LIMIT 100").all()
  ]);
  const products=(items.results||[]).map(p=>({...p,price_status:p.best_price!==null?"verified":"needs_check"}));
  return json(200,{total:Number(count?.total||0),limit,offset,query:q,category,products,categories:categories.results||[],message:"الأسعار التي لم يتم التحقق منها حديثًا من صفحة منتج مباشرة لا تظهر كسعر مؤكد."});
 }catch{return json(500,{error:"تعذر تحميل دليل المنتجات. حاول مرة أخرى."});}
}
