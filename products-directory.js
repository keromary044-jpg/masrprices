"use strict";
(function () {
  function initProductComparison() {
    const page = document.querySelector("body.products-directory-page");
    if (!page || page.dataset.compareReady === "1") return;
    const groups = Array.from(page.querySelectorAll(".group"));
    if (!groups.length) return;
    const make = (tag, cls, value) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (value !== undefined) el.textContent = value;
      return el;
    };
    const normalize = value => String(value || "").toLocaleLowerCase("ar").normalize("NFD")
      .replace(/[\u064B-\u065F\u0670]/g, "").replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
    const toNumber = value => {
      const digits = String(value || "").replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
        .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
      const n = Number(digits.replace(/[^\d.,]/g, "").replace(/,/g, ""));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const entries = [];
    groups.forEach(group => {
      const heading = group.querySelector("h2,h3");
      const categoryName = heading ? heading.textContent.trim().replace(/\s*\(\d+\)\s*$/, "") : "قسم آخر";
      group.querySelectorAll("li").forEach(li => {
        const link = li.querySelector("a[href*='/products/']");
        if (!link) return;
        const priceNode = li.querySelector(":scope > strong") || li.querySelector("strong");
        const dateNode = li.querySelector("small");
        const priceText = priceNode ? priceNode.textContent.trim() : "غير مسجل";
        entries.push({id:link.getAttribute("href"),name:link.textContent.trim(),url:link.href,category:categoryName,
          price:toNumber(priceText),priceText,date:dateNode ? dateNode.textContent.trim() : "غير محدد"});
      });
    });
    if (!entries.length) return;
    page.dataset.compareReady = "1";
    const categoryNames = ["الموبايلات والإلكترونيات","الإلكترونيات والملحقات","الكتب والروايات","مواد البناء","الأدوية والصحة","الأجهزة المنزلية","السيارات وقطع الغيار","العقارات","قطع غيار السيارات","مستلزمات المنزل والتنظيف","الطعام والبقالة","الملابس والأحذية","الأدوات المدرسية","مصاريف التعليم","الأثاث والمفروشات","التجميل والعناية","الكهرباء والسباكة","الرياضة والترفيه","الخدمات والاتصالات","الخدمات الحكومية","أسعار الذهب","أسعار الفضة","العملات الأجنبية","الحيوانات الأليفة","الزراعة والنباتات","السياحة والسفر","الأدوات والمعدات","الوقود ومشتقاته","مستلزمات الأطفال والرضع","الكمبيوتر واللاب توب","الطابعات والأحبار","أجهزة الألعاب","الشبكات والإنترنت","كاميرات المراقبة والأمان","الطاقة الشمسية","إطارات السيارات","بطاريات السيارات","الموتوسيكلات والسكوتر","زيوت السيارات والشحوم","أدوات وأواني المطبخ","المراتب والمفروشات المنزلية","الأدوات الصحية والحمامات","النظارات والعدسات","الساعات","الحقائب وشنط السفر","العطور","مستلزمات الأمومة","مستلزمات الزراعة والري","فلاتر المياه","الأجهزة والمستلزمات الطبية المنزلية"];
    const categoryGroups = {
      "الموبايلات والإلكترونيات":["الموبايلات","الإلكترونيات والملحقات"],
      "الإلكترونيات والملحقات":["الإلكترونيات والملحقات"],
      "الكتب والروايات":["الكتب"],
      "الأجهزة المنزلية":["الأجهزة المنزلية"],
      "السيارات وقطع الغيار":["السيارات"],
      "قطع غيار السيارات":["السيارات"],
      "الطعام والبقالة":["الطعام والبقالة"],
      "الملابس والأحذية":["الملابس"],
      "الأثاث والمفروشات":["الأثاث"],
      "التجميل والعناية":["العناية الشخصية"],
      "الرياضة والترفيه":["الرياضة"],
      "الزراعة والنباتات":["الزراعة والنباتات"],
      "الخدمات والاتصالات":["خدمات الاتصالات"],
      "الأدوات والمعدات":["الأدوات"],
      "مستلزمات الأطفال والرضع":["مستلزمات الأطفال"]
    };
    const selected = new Map();
    const picker = make("section","mp-picker mp-modern-picker");
    picker.id = "compare-products";
    picker.setAttribute("aria-label","البحث واختيار المنتجات للمقارنة");
    const launch = make("button","mp-one-launch","إضافة منتج للمقارنة");
    launch.type = "button";
    launch.setAttribute("aria-expanded","false");
    const panel = make("div","mp-modern-panel");
    panel.hidden = true;
    const heading = make("h1","mp-modern-title","قارن المنتجات بسهولة");
    const sub = make("p","mp-modern-sub","ابحث عن المنتج أو اختر قسمًا من الأقسام الخمسين");
    const categoryLabel = make("label","mp-modern-label","تصفح الأقسام");
    const category = make("select","mp-modern-category");
    category.setAttribute("aria-label","اختيار واحد من 50 قسمًا");
    const all = make("option","","كل الأقسام");
    all.value = "";
    category.append(all);
    categoryNames.forEach(name => { const op=make("option","",name); op.value=name; category.append(op); });
    categoryLabel.append(category);
    const searchWrap = make("div","mp-modern-search-wrap");
    searchWrap.append(make("span","mp-modern-search-icon","⌕"));
    const search = make("input","mp-modern-search");
    search.type = "search"; search.autocomplete = "off"; search.enterKeyHint = "search";
    search.placeholder = "ابحث عن منتج بالاسم أو الموديل...";
    search.setAttribute("aria-label","ابحث عن منتج بالاسم أو الموديل");
    const clear = make("button","mp-modern-clear","×");
    clear.type="button"; clear.hidden=true; clear.setAttribute("aria-label","مسح البحث");
    searchWrap.append(search,clear);
    const results = make("div","mp-modern-results");
    results.setAttribute("role","listbox"); results.setAttribute("aria-label","المنتجات المطابقة"); results.hidden=true;
    const selectedTitle = make("h2","mp-modern-section-title","المنتجات المختارة");
    const selectedList = make("div","mp-one-selected-list");
    const compareArea = make("div","mp-one-comparison");
    panel.append(heading,sub,categoryLabel,searchWrap,results,selectedTitle,selectedList,compareArea);
    picker.append(launch,panel);
    groups[0].parentNode.insertBefore(picker,groups[0]);
    function allowedGroups() {
      if (!category.value) return null;
      return categoryGroups[category.value] || [];
    }
    function filteredEntries() {
      const q=normalize(search.value), allowed=allowedGroups();
      return entries.filter(item => !selected.has(item.id) &&
        (!allowed || allowed.some(name => normalize(name)===normalize(item.category))) &&
        (!q || normalize(item.name).includes(q) || normalize(item.category).includes(q)))
        .slice(0,40);
    }
    function showResults() {
      results.replaceChildren();
      const matches=filteredEntries();
      clear.hidden=!search.value;
      if (!search.value.trim() && !category.value) { results.hidden=true; return; }
      if (!matches.length) {
        const msg = category.value && !(categoryGroups[category.value] || []).length
          ? "القسم موجود ضمن الأقسام الخمسين، وسيظهر هنا بمجرد إضافة منتجاته إلى الكتالوج."
          : "مفيش منتجات مطابقة. جرّب كلمة تانية أو اختار قسمًا مختلفًا.";
        results.append(make("p","mp-modern-empty",msg));
      } else {
        matches.forEach(item => {
          const option=make("button","mp-modern-result");
          option.type="button"; option.setAttribute("role","option");
          const info=make("span","mp-modern-result-info");
          info.append(make("strong","",item.name),make("small","",item.category+" · "+item.priceText));
          option.append(info,make("span","mp-modern-add","＋"));
          option.addEventListener("click",()=>{
            if(selected.size>=4 || selected.has(item.id)) return;
            selected.set(item.id,item); search.value=""; render(); search.focus();
          });
          results.append(option);
        });
      }
      results.hidden=false;
    }
    function renderSelected() {
      selectedList.replaceChildren();
      if(!selected.size){selectedList.append(make("p","mp-one-empty-selected","لم تضف أي منتج بعد."));return;}
      selected.forEach(item=>{
        const row=make("div","mp-one-chip");
        row.append(make("span","mp-one-chip-name",item.name+" — "+item.category));
        const remove=make("button","mp-one-remove","×"); remove.type="button";
        remove.setAttribute("aria-label","حذف "+item.name);
        remove.addEventListener("click",()=>{selected.delete(item.id);render();});
        row.append(remove);selectedList.append(row);
      });
    }
    function renderComparison() {
      compareArea.replaceChildren();
      if(selected.size<2){if(selected.size===1)compareArea.append(make("p","mp-one-progress","اختار منتجًا ثانيًا لعرض المقارنة تلقائيًا."));return;}
      const items=[...selected.values()],wrap=make("div","mp-one-table-wrap"),table=make("table","mp-one-table");
      const head=document.createElement("thead"),body=document.createElement("tbody"),hr=document.createElement("tr");
      hr.append(make("th","","البيان"));items.forEach(item=>hr.append(make("th","",item.name)));head.append(hr);table.append(head,body);
      const prices=items.filter(x=>x.price!==null).map(x=>x.price),lowest=prices.length?Math.min(...prices):null;
      [["القسم",x=>x.category],["السعر",x=>x.priceText],["تاريخ السعر",x=>x.date],["صفحة المنتج",x=>x.url]].forEach(([label,get],idx)=>{
        const tr=document.createElement("tr");tr.append(make("th","mp-one-row-label",label));
        items.forEach(item=>{const td=document.createElement("td");
          if(idx===1&&item.price!==null&&item.price===lowest){td.classList.add("mp-one-lowest");td.append(make("small","mp-one-lowest-tag","أقل سعر مسجل"));}
          if(idx===3){const a=make("a","","عرض المنتج");a.href=get(item);td.append(a);}else td.append(document.createTextNode(get(item)||"غير متاح"));
          tr.append(td);
        });body.append(tr);
      });
      wrap.append(table);compareArea.append(make("h2","mp-modern-section-title","مقارنة الأسعار"),wrap);
    }
    function render(){renderSelected();renderComparison();showResults();}
    launch.addEventListener("click",()=>{panel.hidden=false;launch.hidden=true;launch.setAttribute("aria-expanded","true");search.focus();});
    category.addEventListener("change",showResults);
    search.addEventListener("input",showResults);
    search.addEventListener("search",showResults);
    clear.addEventListener("click",()=>{search.value="";showResults();search.focus();});
    if(location.hash==="#compare-products"){panel.hidden=false;launch.hidden=true;launch.setAttribute("aria-expanded","true");}
    render();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initProductComparison,{once:true});
  else initProductComparison();
})();