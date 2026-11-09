const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
const clean=(v,n)=>String(v??"").replace(/[<>]/g,"").trim().slice(0,n);
function validHttps(value){try{const u=new URL(String(value||""));return u.protocol==="https:"?u.href:"";}catch{return "";}}
export async function onRequestPost({request,env}){
 if(!env.DB)return reply(503,{error:"خدمة استقبال الأسعار غير مهيأة على قاعدة البيانات."});
 if(request.headers.get("Origin")!==new URL(request.url).origin)return reply(403,{error:"طلب غير مسموح."});
 if(!(request.headers.get("Content-Type")||"").toLowerCase().startsWith("application/json"))return reply(415,{error:"نوع البيانات غير مدعوم."});
 let raw;try{raw=await request.text();if(new TextEncoder().encode(raw).length>8000)return reply(413,{error:"حجم البيانات أكبر من المسموح."});}catch{return reply(400,{error:"بيانات غير صالحة."});}
 let d;try{d=JSON.parse(raw);if(!d||typeof d!=="object"||Array.isArray(d))throw new Error();}catch{return reply(400,{error:"بيانات غير صالحة."});}
 if(clean(d.website,200))return reply(200,{ok:true});
 const product=clean(d.product_name,180),category=clean(d.category,100),store=clean(d.store_name,120),url=validHttps(d.product_url),proof=validHttps(d.proof_url),price=Number(d.price_egp),unit=clean(d.unit,80),notes=clean(d.notes,700);
 if(!product||!category||!store||!url||!Number.isFinite(price)||price<=0||price>100000000000||!d.consent)return reply(400,{error:"أكمل اسم المنتج والقسم والمتجر والسعر ورابط صفحة المنتج والموافقة."});
 if(d.proof_url&&!proof)return reply(400,{error:"رابط الإثبات يجب أن يبدأ بـ https."});
 const ip=request.headers.get("CF-Connecting-IP")||"unknown";
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip));
 const ipHash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
 try{
  const recent=await env.DB.prepare("SELECT COUNT(*) AS n FROM community_price_submissions WHERE submitter_hash=? AND created_at>=datetime('now','-1 day')").bind(ipHash).first();
  if(Number(recent?.n||0)>=5)return reply(429,{error:"وصلت للحد اليومي لإرسال الأسعار. حاول غدًا."});
  const id=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO community_price_submissions(id,product_name,category,store_name,price_egp,unit,product_url,proof_url,notes,submitter_hash,status) VALUES(?,?,?,?,?,?,?,?,?,?,'pending')").bind(id,product,category,store,price,unit,url,proof,notes,ipHash).run();
  return reply(201,{ok:true,message:"وصل السعر إلى قائمة المراجعة. لن يظهر في الأسعار المنشورة قبل التحقق منه."});
 }catch{return reply(500,{error:"تعذر حفظ السعر الآن. حاول لاحقًا."});}
}