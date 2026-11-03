const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
async function authorized(request,env){
  const expected=env.ADMIN_PASSWORD,supplied=request.headers.get("X-Admin-Password")||"";
  if(!expected||!supplied||supplied.length>256)return false;
  const enc=new TextEncoder(),[a,b]=await Promise.all([crypto.subtle.digest("SHA-256",enc.encode(expected)),crypto.subtle.digest("SHA-256",enc.encode(supplied))]);
  const aa=new Uint8Array(a),bb=new Uint8Array(b);return aa.every((v,i)=>v===bb[i]);
}
export async function onRequest({request,env}){
  if(!env.DB)return reply(503,{error:"قاعدة بيانات العقارات غير مربوطة بعد."});
  if(!await authorized(request,env))return reply(401,{error:"كلمة مرور الإدارة غير صحيحة."});
  if(request.method==="GET"){
    try{const {results}=await env.DB.prepare("SELECT id,title,type,governorate,center,area,price,price_negotiable,area_m2,rooms,bathrooms,floor,description,photo_urls,owner_name,contact_phone,status,created_at FROM real_estate_listings WHERE status='pending' ORDER BY created_at ASC LIMIT 100").all();return reply(200,{listings:results.map(x=>({...x,photoUrls:JSON.parse(x.photo_urls||"[]")}))});}
    catch{return reply(500,{error:"تعذر تحميل الإعلانات المنتظرة."});}
  }
  if(request.method!=="POST")return reply(405,{error:"طريقة الطلب غير مدعومة."});
  let data;try{data=await request.json();}catch{return reply(400,{error:"بيانات غير صالحة."});}
  const id=String(data.id||"").slice(0,64),action=data.action;
  if(!id||!["approve","reject"].includes(action))return reply(400,{error:"الإجراء غير صالح."});
  try{
    const result=await env.DB.prepare("UPDATE real_estate_listings SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").bind(action==="approve"?"approved":"rejected",id).run();
    if(!result.meta?.changes)return reply(404,{error:"الإعلان غير موجود أو تمت مراجعته بالفعل."});
    return reply(200,{ok:true,status:action==="approve"?"approved":"rejected"});
  }catch{return reply(500,{error:"تعذر حفظ قرار المراجعة."});}
}
