"use strict";
const search = document.getElementById("q");
if (search) {
  search.addEventListener("input", () => {
    const term = search.value.trim().toLocaleLowerCase("ar");
    let count = 0;
    document.querySelectorAll(".group").forEach(group => {
      let visible = 0;
      group.querySelectorAll("li").forEach(item => {
        const show = item.textContent.toLocaleLowerCase("ar").includes(term);
        item.hidden = !show;
        if (show) visible++;
      });
      group.hidden = visible === 0;
      count += visible;
    });
    const empty = document.getElementById("empty");
    if (empty) empty.style.display = count ? "none" : "block";
  });
}

/* Multi-product comparison for the product directory */
(function(){
  "use strict";
  const groups=[...document.querySelectorAll(".products-directory-page .group")];
  if(!groups.length)return;
  const selected=new Map();
  const create=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const tray=create("aside","mp-compare-tray");tray.hidden=true;tray.setAttribute("aria-label","شريط مقارنة المنتجات");
  const trayText=create("span","mp-compare-count","لم تختر منتجات");
  const compareBtn=create("button","mp-compare-open","قارن المنتجات");
  compareBtn.type="button";compareBtn.disabled=true;
  const clearBtn=create("button","mp-compare-clear","إلغاء الاختيار");clearBtn.type="button";
  tray.append(trayText,compareBtn,clearBtn);
  const overlay=create("div","mp-compare-overlay");overlay.hidden=true;
  overlay.setAttribute("role","presentation");
  const dialog=create("section","mp-compare-dialog");dialog.setAttribute("role","dialog");dialog.setAttribute("aria-modal","true");dialog.setAttribute("aria-labelledby","mpCompareTitle");
  const dialogHead=create("div","mp-compare-dialog-head");
  const title=create("h2","","مقارنة المنتجات");
  const close=create("button","mp-compare-close","إغلاق");close.type="button";close.setAttribute("aria-label","إغلاق المقارنة");
  dialogHead.append(title,close);
  const intro=create("p","mp-compare-note","قارن الأسعار المسجلة والمواصفات الأساسية. قد تتغير أسعار المتاجر؛ افتح المصدر للتأكد من السعر النهائي والتوافر.");
  const tableWrap=create("div","mp-compare-table-wrap");
  const table=create("table","mp-compare-table");
  const tableHead=document.createElement("thead"),tableBody=document.createElement("tbody");
  table.append(tableHead,tableBody);tableWrap.append(table);
  dialog.append(dialogHead,intro,tableWrap);
  overlay.append(dialog);document.body.append(tray,overlay);
  function productFrom(li,group){
    const link=li.querySelector("div a[href]");
    if(!link)return null;
    const priceNode=li.querySelector(":scope > strong");
    const source=li.querySelector("a.source[href]");
    const date=li.querySelector("small");
    const rawPrice=(priceNode?.textContent||"").replace(/[^0-9٠-٩۰-۹.,]/g,"").replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/,/g,"");
    const price=Number(rawPrice);
    return {id:link.getAttribute("href"),name:link.textContent.trim(),url:link.href,price:Number.isFinite(price)&&price>0?price:null,priceText:priceNode?.textContent.trim()||"غير مسجل",date:date?.textContent.trim()||"غير محدد",category:group.querySelector("h2,h3")?.textContent.trim()||"غير محدد",sourceUrl:source?.href||"",sourceText:source?.textContent.trim()||"المصدر غير متاح"};
  }
  function refresh(){
    const count=selected.size;tray.hidden=count===0;
    trayText.textContent="تم اختيار "+count+" من 4 منتجات";
    compareBtn.disabled=count<2;
    compareBtn.textContent=count<2?"اختر منتجًا آخر للمقارنة":"قارن "+count+" منتجات";
    document.querySelectorAll(".mp-compare-pick").forEach(btn=>{
      const on=selected.has(btn.dataset.compareId);
      btn.classList.toggle("is-picked",on);
      btn.setAttribute("aria-pressed",String(on));
      btn.textContent=on?"✓ تمت الإضافة":"＋ أضف للمقارنة";
    });
  }
  function makeCell(row,text,cls){const td=create("td",cls||"",text);row.append(td);return td;}
  function renderTable(){
    tableHead.replaceChildren();tableBody.replaceChildren();
    const items=[...selected.values()];
    const head=document.createElement("tr");
    ["البيان",...items.map(x=>x.name)].forEach((label,i)=>{const th=create("th","",label);if(i)th.scope="col";else th.scope="row";head.append(th);});
    tableHead.append(head);
    const lowest=items.filter(x=>x.price!==null).reduce((m,x)=>Math.min(m,x.price),Infinity);
    const rows=[
      ["القسم",x=>x.category],
      ["السعر المسجل",x=>x.price===null?"لا يوجد سعر مسجل":x.priceText],
      ["تاريخ السعر",x=>x.date],
      ["صفحة المنتج",x=>x.url],
      ["مصدر السعر",x=>x.sourceUrl]
    ];
    rows.forEach(([label,get],index)=>{
      const tr=document.createElement("tr");makeCell(tr,label,"mp-compare-row-label");
      items.forEach(item=>{
        const value=get(item);
        const td=document.createElement("td");
        if(index===1&&item.price!==null&&item.price===lowest){td.classList.add("mp-compare-lowest");td.append(create("span","mp-compare-lowest-tag","أقل سعر مسجل"));}
        if(index===3||index===4){
          if(value){const a=create("a","",index===3?"عرض المنتج":item.sourceText);a.href=value;a.target="_blank";a.rel="noopener noreferrer";td.append(a);}
          else td.textContent="غير متاح";
        }else td.append(document.createTextNode(value));
        tr.append(td);
      });
      tableBody.append(tr);
    });
    intro.textContent="تظهر الأسعار كما سُجلت في الموقع مع تاريخها، وليس بالضرورة أنها أسعار لحظية. أقل سعر هنا هو الأقل بين الأسعار المسجلة فقط؛ افتح المصدر وتأكد قبل الشراء.";
  }
  function openDialog(){if(selected.size<2)return;renderTable();overlay.hidden=false;close.focus();}
  function closeDialog(){overlay.hidden=true;compareBtn.focus();}
  compareBtn.addEventListener("click",openDialog);
  close.addEventListener("click",closeDialog);
  overlay.addEventListener("click",e=>{if(e.target===overlay)closeDialog();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay.hidden)closeDialog();});
  clearBtn.addEventListener("click",()=>{selected.clear();refresh();});
  groups.forEach(group=>group.querySelectorAll("li").forEach(li=>{
    const item=productFrom(li,group);if(!item)return;
    const btn=create("button","mp-compare-pick","＋ أضف للمقارنة");
    btn.type="button";btn.dataset.compareId=item.id;btn.setAttribute("aria-pressed","false");
    btn.addEventListener("click",()=>{
      if(selected.has(item.id))selected.delete(item.id);
      else if(selected.size>=4){trayText.textContent="يمكنك مقارنة 4 منتجات كحد أقصى";return;}
      else selected.set(item.id,item);
      refresh();
    });
    li.append(btn);
  }));
  refresh();
})();
