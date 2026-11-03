const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
const clean=(v,n)=>String(v??"").replace(/[<>]/g,"").trim().slice(0,n);
const allowedTypes=new Set(["شقة","فيلا","أرض","محل","مكتب","عمارة","مصيف","مزرعة"]);
function validHttpsList(value){
  const urls=Array.isArray(value)?value:String(value||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(urls.length>8)return null;
  for(const item of urls){try{const u=new URL(item);if(u.protocol!=="https:")return null;}catch{return null;}}
  return urls;
}
async function governorates(env,request){
  const asset=new URL("/real-estate.json",request.url);
  const response=await env.ASSETS.fetch(new Request(asset.toString(),{headers:request.headers}));
  if(!response.ok)throw new Error("تعذر تحميل دليل المحافظات");
  const data=await response.json();
  return data.governorates||[];
}
export async function onRequest({request,env}){
  if(!env.DB)return reply(503,{error:"قاعدة بيانات العقارات غير مربوطة بعد. يلزم إعداد D1 وربطها باسم DB."});
  if(request.method==="GET"){
    try{
      const govs=await governorates(env,request);
      const {results}=await env.DB.prepare("SELECT id,title,type,governorate,center,area,price,price_negotiable,area_m2,rooms,bathrooms,floor,description,photo_urls,contact_phone,published_at FROM real_estate_listings WHERE status='approved' ORDER BY published_at DESC LIMIT 300").all();
      return reply(200,{governorates:govs,listings:results.map(x=>({...x,price:x.price===null?null:Number(x.price),areaM2:x.area_m2,photoUrls:JSON.parse(x.photo_urls||"[]"),publishedAt:x.published_at,contact:x.contact_phone}))});
    }catch{return reply(500,{error:"تعذر تحميل الإعلانات العقارية."});}
  }
  if(request.method!=="POST")return reply(405,{error:"طريقة الطلب غير مدعومة."});
  if(request.headers.get("Origin")!==new URL(request.url).origin)return reply(403,{error:"طلب غير مسموح."});
  if(!(request.headers.get("Content-Type")||"").toLowerCase().startsWith("application/json"))return reply(415,{error:"نوع البيانات غير مدعوم."});
  let raw;try{raw=await request.text();if(new TextEncoder().encode(raw).length>20000)return reply(413,{error:"حجم البيانات أكبر من المسموح."});}catch{return reply(400,{error:"بيانات غير صالحة."});}
  let data;try{data=JSON.parse(raw);if(!data||typeof data!=="object"||Array.isArray(data))throw new Error();}catch{return reply(400,{error:"بيانات غير صالحة."});}
  if(data.website)return reply(200,{ok:true});
  const title=clean(data.title,140),type=clean(data.type,30),governorate=clean(data.governorate,80),center=clean(data.center,100),area=clean(data.area,120),description=clean(data.description,1800),owner=clean(data.owner_name,80),phone=clean(data.contact_phone,20);
  const price=data.price===""||data.price===null?null:Number(data.price),areaM2=data.area_m2===""||data.area_m2===null?null:Number(data.area_m2);
  const rooms=data.rooms===""||data.rooms===null?null:Number(data.rooms),bathrooms=data.bathrooms===""||data.bathrooms===null?null:Number(data.bathrooms);
  const photos=validHttpsList(data.photo_urls);
  if(!title||!allowedTypes.has(type)||!governorate||!center||!area||description.length<25||!owner||!/^[+0-9 ()-]{7,20}$/.test(phone)||!data.consent||photos===null)
    return reply(400,{error:"راجع الحقول المطلوبة، رقم التواصل، موافقتك على النشر وروابط الصور."});
  if(price!==null&&(!Number.isFinite(price)||price<=0||price>100000000000))return reply(400,{error:"السعر غير صالح."});
  if(areaM2!==null&&(!Number.isFinite(areaM2)||areaM2<=0||areaM2>1000000))return reply(400,{error:"المساحة غير صالحة."});
  if(rooms!==null&&(!Number.isInteger(rooms)||rooms<0||rooms>30))return reply(400,{error:"عدد الغرف غير صالح."});
  if(bathrooms!==null&&(!Number.isInteger(bathrooms)||bathrooms<0||bathrooms>30))return reply(400,{error:"عدد الحمامات غير صالح."});
  try{
    const govs=await governorates(env,request),g=govs.find(x=>x.name===governorate);
    if(!g||!g.centers.includes(center))return reply(400,{error:"المحافظة أو المركز غير موجود في الدليل."});
    const ip=request.headers.get("CF-Connecting-IP")||"unknown";
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip));
    const ipHash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
    const recent=await env.DB.prepare("SELECT COUNT(*) AS n FROM real_estate_listings WHERE submitter_hash=? AND created_at>=datetime('now','-1 hour')").bind(ipHash).first();
    if(Number(recent?.n||0)>=5)return reply(429,{error:"وصلت للحد المؤقت للإعلانات. حاول بعد ساعة."});
    const id=crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO real_estate_listings(id,title,type,governorate,center,area,price,price_negotiable,area_m2,rooms,bathrooms,floor,description,photo_urls,owner_name,contact_phone,status,submitter_hash,consent_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending',?,CURRENT_TIMESTAMP)`)
      .bind(id,title,type,governorate,center,area,price,data.price_negotiable?1:0,areaM2,rooms,bathrooms===null?null:bathrooms,clean(data.floor,30),description,JSON.stringify(photos),owner,phone,ipHash).run();
    return reply(201,{ok:true,message:"تم استلام إعلانك وسيظهر بعد مراجعته والموافقة عليه.",id});
  }catch{return reply(500,{error:"تعذر تسجيل الإعلان. حاول لاحقًا."});}
}
