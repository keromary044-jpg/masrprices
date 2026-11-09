const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
async function authorized(request, env) {
  const expected = env.ADMIN_PASSWORD;
  const supplied = request.headers.get("X-Admin-Password") || "";
  if (!expected || !supplied || supplied.length > 256) return false;
  const enc = new TextEncoder();
  const [a,b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
    crypto.subtle.digest("SHA-256", enc.encode(supplied))
  ]);
  const aa=new Uint8Array(a),bb=new Uint8Array(b);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0;
}
export async function onRequest({ request, env }) {
  if (!["GET","POST"].includes(request.method)) return json(405,{error:"طريقة الطلب غير مدعومة."});
  if (request.method === "POST" && request.headers.get("Origin") !== new URL(request.url).origin) return json(403,{error:"طلب غير مسموح."});
  if (request.method === "POST" && !(request.headers.get("Content-Type")||"").toLowerCase().startsWith("application/json")) return json(415,{error:"نوع البيانات غير مدعوم."});
  if (!env.DB) return json(503,{error:"قاعدة البيانات DB غير مربوطة بعد."});
  if (!await authorized(request,env)) return json(401,{error:"كلمة مرور الإدارة غير صحيحة."});
  if (request.method === "GET") {
    try {
      const {results}=await env.DB.prepare(`SELECT p.id,p.name,p.brand,p.category,p.variant,p.unit,p.image_url,
        COUNT(o.id) AS offers_count, MIN(CASE WHEN o.status='verified' THEN o.price_egp END) AS best_price
        FROM products p LEFT JOIN offers o ON o.product_id=p.id
        GROUP BY p.id ORDER BY p.updated_at DESC LIMIT 300`).all();
      const pending=await env.DB.prepare("SELECT id,product_name,category,store_name,price_egp,unit,product_url,proof_url,notes,created_at FROM community_price_submissions WHERE status='pending' ORDER BY created_at DESC LIMIT 100").all();
      return json(200,{products:results,priceSubmissions:pending.results||[]});
    } catch { return json(500,{error:"تعذر قراءة المنتجات."}); }
  }
  if (request.method !== "POST") return json(405,{error:"طريقة الطلب غير مدعومة."});
  let raw;try{raw=await request.text();if(new TextEncoder().encode(raw).length>262144)return json(413,{error:"حجم البيانات أكبر من المسموح."});}catch{return json(400,{error:"بيانات غير صالحة."});}
  let data;try{data=JSON.parse(raw);if(!data||typeof data!=="object"||Array.isArray(data))throw new Error();}catch{return json(400,{error:"بيانات غير صالحة."});}
  const clean=(v,n)=>String(v??"").trim().slice(0,n);
  try {
    if(data.action==="reviewCommunityPrice"){
      const id=clean(data.id,80),decision=clean(data.decision,20);
      if(!id||!["approve","reject"].includes(decision))return json(400,{error:"طلب المراجعة غير صالح."});
      const submission=await env.DB.prepare("SELECT * FROM community_price_submissions WHERE id=? AND status='pending'").bind(id).first();
      if(!submission)return json(404,{error:"الاقتراح غير موجود أو تمت مراجعته بالفعل."});
      if(decision==="reject"){
        await env.DB.prepare("UPDATE community_price_submissions SET status='rejected',reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
        return json(200,{ok:true,message:"تم رفض الاقتراح."});
      }
      const product=await env.DB.prepare("SELECT id FROM products WHERE lower(trim(name))=lower(trim(?)) AND lower(trim(category))=lower(trim(?)) LIMIT 1").bind(submission.product_name,submission.category).first();
      if(!product)return json(409,{error:"لا يوجد تطابق مطابق تمامًا في كتالوج المنتجات. أضف المنتج أو صحح اسمه وقسمه قبل اعتماد السعر."});
      const checkedAt=new Date().toISOString().slice(0,10);
      await env.DB.prepare("INSERT INTO offers(product_id,store_name,price_egp,product_url,source_name,variant,region,checked_at,status) VALUES(?,?,?,?,?,?,?,?, 'verified')")
        .bind(product.id,submission.store_name,submission.price_egp,submission.product_url,submission.store_name,submission.unit,"مصر",checkedAt).run();
      await env.DB.prepare("UPDATE community_price_submissions SET status='approved',reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
      return json(200,{ok:true,message:"تم اعتماد السعر وربطه بالمنتج المطابق."});
    }
    if(data.action==="saveProduct"){
      const id=clean(data.id,120),name=clean(data.name,180);
      if(!id||!name) return json(400,{error:"معرّف المنتج واسمه مطلوبان."});
      await env.DB.prepare(`INSERT INTO products(id,name,brand,category,variant,unit,image_url,updated_at)
        VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,brand=excluded.brand,category=excluded.category,
        variant=excluded.variant,unit=excluded.unit,image_url=excluded.image_url,updated_at=CURRENT_TIMESTAMP`)
        .bind(id,name,clean(data.brand,100),clean(data.category,100),clean(data.variant,160),clean(data.unit,80),clean(data.image_url,500)).run();
      return json(200,{ok:true});
    }
    if(data.action==="saveOffer"){
      const productId=clean(data.product_id,120),store=clean(data.store_name,120),source=clean(data.product_url,500),sourceName=clean(data.source_name,120),price=Number(data.price_egp);
      if(!productId||!store||!sourceName||!Number.isFinite(price)||price<0||price>100000000000||!/^https:\/\//i.test(source)) return json(400,{error:"أكمل المنتج والمتجر والسعر ورابط المصدر الصحيح."});
      const exists=await env.DB.prepare("SELECT id FROM products WHERE id=?").bind(productId).first();
      if(!exists) return json(400,{error:"سجّل المنتج أولًا."});
      await env.DB.prepare("INSERT INTO offers(product_id,store_name,price_egp,product_url,source_name,variant,region,checked_at,status) VALUES(?,?,?,?,?,?,?,?,?)")
        .bind(productId,store,price,source,sourceName,clean(data.variant,160),clean(data.region,100),clean(data.checked_at,30)||new Date().toISOString().slice(0,10),"verified").run();
      return json(200,{ok:true});
    }
    if(data.action==="importProducts"){
      if(!Array.isArray(data.items)||data.items.length>1000) return json(400,{error:"ملف المنتجات غير صالح أو أكبر من 1000 منتج."});
      let accepted=0;
      for(const item of data.items){
        const id=clean(item.id,120),name=clean(item.name||item.title,180);
        if(!id||!name) continue;
        await env.DB.prepare(`INSERT INTO products(id,name,brand,category,variant,unit,image_url,updated_at)
          VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name,brand=excluded.brand,category=excluded.category,
          variant=excluded.variant,unit=excluded.unit,image_url=excluded.image_url,updated_at=CURRENT_TIMESTAMP`)
          .bind(id,name,clean(item.brand,100),clean(item.category,100),clean(item.variant||item.model||item.spec,160),clean(item.unit,80),clean(item.image_url||item.image,500)).run();
        accepted++;
      }
      await env.DB.prepare("INSERT INTO price_update_log(source_name,items_received,items_accepted,status,message) VALUES(?,?,?,?,?)")
        .bind(clean(data.source_name||"استيراد كتالوج المنتجات",120),data.items.length,accepted,"completed","مزامنة كتالوج المنتجات").run();
      return json(200,{ok:true,accepted,received:data.items.length});
    }
    if(data.action==="importOffers"){
      if(!Array.isArray(data.items)||data.items.length>500) return json(400,{error:"ملف الاستيراد غير صالح أو أكبر من 500 عرض."});
      let accepted=0;
      for(const item of data.items){
        const productId=clean(item.product_id,120),store=clean(item.store_name,120),source=clean(item.product_url,500),sourceName=clean(item.source_name,120),price=Number(item.price_egp);
        if(!productId||!store||!sourceName||!Number.isFinite(price)||price<0||price>100000000000||!/^https:\/\//i.test(source)) continue;
        const exists=await env.DB.prepare("SELECT id FROM products WHERE id=?").bind(productId).first();
        if(!exists) continue;
        await env.DB.prepare("INSERT INTO offers(product_id,store_name,price_egp,product_url,source_name,variant,region,checked_at,status) VALUES(?,?,?,?,?,?,?,?,?)")
          .bind(productId,store,price,source,sourceName,clean(item.variant,160),clean(item.region,100),clean(item.checked_at,30)||new Date().toISOString().slice(0,10),"verified").run();
        accepted++;
      }
      await env.DB.prepare("INSERT INTO price_update_log(source_name,items_received,items_accepted,status,message) VALUES(?,?,?,?,?)")
        .bind(clean(data.source_name||"استيراد لوحة الإدارة",120),data.items.length,accepted,"completed","استيراد يدوي بعد مراجعة البيانات").run();
      return json(200,{ok:true,accepted,received:data.items.length});
    }
    return json(400,{error:"إجراء غير معروف."});
  } catch { return json(500,{error:"تعذر حفظ البيانات في قاعدة الأسعار."}); }
}