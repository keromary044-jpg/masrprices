"use strict";
(() => {
 const q=document.getElementById("q"),category=document.getElementById("category"),search=document.getElementById("search"),results=document.getElementById("results"),count=document.getElementById("count"),prev=document.getElementById("prev"),next=document.getElementById("next");
 const limit=40;let offset=0,total=0;
 const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
 function render(data){
  total=Number(data.total||0);count.textContent="إجمالي المنتجات المطابقة: "+total.toLocaleString("en-US")+" · المعروض: "+(data.products||[]).length.toLocaleString("en-US");
  results.replaceChildren();
  if(!data.products?.length){results.append(el("p","empty","لا توجد منتجات مطابقة. جرّب اسمًا أو قسمًا آخر."));}
  for(const p of data.products){
   const card=el("article","product"),name=el("h3","",p.name||"منتج بدون اسم");
   card.append(name);
   if(p.brand)card.append(el("p","muted",p.brand));
   if(p.category)card.append(el("span","tag",p.category));
   if(p.best_price!==null&&p.best_price!==undefined)card.append(el("p","price",Number(p.best_price).toLocaleString("en-US")+" جنيه · سعر متحقق حديثًا"));
   else card.append(el("p","pending","السعر قيد التحقق"));
   card.append(el("p","muted",Number(p.offers_count||0).toLocaleString("en-US")+" عروض مسجلة"));
   results.append(card);
  }
  prev.disabled=offset<=0;next.disabled=offset+limit>=total;
 }
 async function load(){
  results.replaceChildren(el("p","empty","جارٍ تحميل المنتجات…"));
  count.textContent="جارٍ البحث…";
  const params=new URLSearchParams({limit:String(limit),offset:String(offset),q:q.value.trim(),category:category.value});
  try{const r=await fetch("/api/catalog?"+params.toString(),{cache:"no-store"});const data=await r.json();if(!r.ok)throw new Error(data.error||"تعذر تحميل المنتجات");render(data);if(category.options.length===1){for(const c of data.categories||[]){const o=document.createElement("option");o.value=c.category;o.textContent=c.category+" ("+Number(c.count).toLocaleString("en-US")+")";category.append(o);}}}
  catch(e){results.replaceChildren(el("p","empty error",e.message||"حدث خطأ أثناء تحميل البيانات."));count.textContent="تعذر تحميل الكتالوج";}
 }
 search.addEventListener("click",()=>{offset=0;load();});
 q.addEventListener("keydown",e=>{if(e.key==="Enter"){offset=0;load();}});
 category.addEventListener("change",()=>{offset=0;load();});
 prev.addEventListener("click",()=>{offset=Math.max(0,offset-limit);load();});
 next.addEventListener("click",()=>{offset+=limit;load();});
 load();
})();