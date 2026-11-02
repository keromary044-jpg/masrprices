"use strict";

(function () {
  const searchInput = document.getElementById("searchInput");
  const cards = Array.from(document.querySelectorAll(".category-card"));
  const noResults = document.getElementById("noResults");
  const phoneCatalog = document.getElementById("phoneCatalog");
  const phoneProducts = document.getElementById("phoneProducts");
  let phoneData = null;
  let modelIndexData = null;

  function normalize(value) {
    return String(value || "").toLocaleLowerCase("ar").normalize("NFD")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآٱ]/g, "ا").replace(/[ىي]/g, "ي")
      .replace(/ة/g, "ه").replace(/[ـ]/g, "")
      .replace(/\s+/g, " ").trim();
  }

  function getTitle(card) {
    const strong = card.querySelector("strong");
    return strong ? strong.textContent.trim() : card.textContent.trim();
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderPhones(data) {
    if (!phoneProducts) return;
    phoneProducts.replaceChildren();
    data.products.forEach(phone => {
      const article = element("article", "phone-card");
      const top = element("div", "phone-card-top");
      top.append(element("span", "phone-brand", phone.brand), element("span", "phone-category", phone.category));
      article.append(top);
      article.dataset.search = normalize([phone.brand,phone.name,phone.category,phone.processor,phone.memory].join(" "));
      article.append(element("h3", "phone-name", phone.name));
      article.append(element("p", "phone-price", phone.priceEGP ? ("السعر في مصر: "+phone.priceEGP.toLocaleString("en-US")+" جنيه") : "السعر في مصر: لم يُتحقق منه بعد"));
      if(phone.priceEGP){article.append(element("small","phone-price-source",(phone.priceSource || "مصدر السعر")+" · "+(phone.priceCheckedAt || "تاريخ الرصد غير محدد")));}
      if(Array.isArray(phone.priceOffers) && phone.priceOffers.length){
        const validOffers=phone.priceOffers.filter(o=>Number.isFinite(Number(o.priceEGP))&&Number(o.priceEGP)>0&&o.merchant&&o.source);
        validOffers.sort((a,b)=>Number(a.priceEGP)-Number(b.priceEGP));
        const compare=element("section","offer-comparison");
        const head=element("div","offer-comparison-head");
        head.append(element("strong","","مقارنة المتاجر"));
        head.append(element("span","offer-count",validOffers.length+" عروض موثقة المصدر"));
        compare.append(head);
        if(validOffers.length){
          const best=validOffers[0];
          const bestBox=element("div","best-offer");
          bestBox.append(element("span","best-label","أقل سعر مرصود"));
          bestBox.append(element("strong","best-price",Number(best.priceEGP).toLocaleString("en-US")+" جنيه"));
          bestBox.append(element("span","best-store",best.merchant));
          compare.append(bestBox);
          const list=element("div","offer-list");
          validOffers.forEach((offer,index)=>{
            const row=element("article","offer-row"+(index===0?" is-best":""));
            const rank=element("span","offer-rank",String(index+1));
            const info=element("div","offer-main");
            info.append(element("strong","offer-merchant",offer.merchant));
            info.append(element("small","offer-variant",(offer.variant||"النسخة غير محددة")+" · تحقق: "+(offer.checkedAt||"غير محدد")));
            const side=element("div","offer-side");
            side.append(element("strong","offer-price",Number(offer.priceEGP).toLocaleString("en-US")+" ج.م"));
            const link=element("a","offer-link","تحقق من العرض");
            link.href=offer.source;link.target="_blank";link.rel="noopener noreferrer";
            side.append(link);row.append(rank,info,side);list.append(row);
          });
          compare.append(list);
          if(validOffers.length>1){
            const diff=Number(validOffers[validOffers.length-1].priceEGP)-Number(best.priceEGP);
            compare.append(element("p","offer-savings","الفرق بين أقل وأعلى عرض: "+diff.toLocaleString("en-US")+" جنيه"));
          }
        }else compare.append(element("p","catalog-footnote","لا توجد عروض مكتملة المصدر والسعر حاليًا."));
        compare.append(element("small","offer-disclaimer","الأسعار رُصدت في أوقات مختلفة وقد تتغير؛ تأكد من السعر النهائي والتوافر والنسخة والضمان لدى المتجر قبل الشراء."));
        article.append(compare);
      }
      const details = element("details", "phone-details");
      details.append(element("summary", "", "عرض المواصفات التفصيلية"));
      const list = element("dl", "spec-list");
      const specs = [
        ["الشاشة",phone.display],["المعالج",phone.processor],["الرام والتخزين",phone.memory],
        ["الكاميرات الخلفية",phone.rearCamera],["الكاميرا الأمامية",phone.frontCamera],
        ["البطارية والشحن",phone.battery],["نظام التشغيل",phone.os],
        ["الشبكات والاتصال",phone.connectivity],["الأبعاد والوزن",phone.build],
        ["سنة الإطلاق",phone.release]
      ];
      specs.forEach(([label,value]) => {
        const wrap=element("div","spec-row");
        wrap.append(element("dt","",label),element("dd","",value || "غير متاح في المصدر الذي تمت مراجعته"));
        list.append(wrap);
      });
      details.append(list);
      const source=element("a","phone-source","المصدر الرسمي للمواصفات");
      source.href=phone.source; source.target="_blank"; source.rel="noopener noreferrer";
      article.append(details,source);
      phoneProducts.append(article);
    });
  }

  async function loadModelIndex() {
    if (!phoneCatalog || document.getElementById("officialModelIndex")) return;
    try {
      const response = await fetch("./phone-model-index.json", {cache:"no-cache"});
      if (!response.ok) throw new Error("تعذر تحميل فهرس الموديلات");
      const index = await response.json();
      const section = element("section", "model-index");
      section.id = "officialModelIndex";
      section.append(element("h3", "", "فهرس موديلات الشركات الرسمية"));
      section.append(element("p", "catalog-footnote", index.purpose));
      modelIndexData = index;
      const brandFilter = document.getElementById("phoneBrandFilter");
      index.brands.forEach(brand => {
        if (brandFilter) { const option=element("option","",brand.brand); option.value=brand.brand; brandFilter.append(option); }
        const group = element("div", "model-brand-group");
        group.dataset.brand = brand.brand;
        group.dataset.search = normalize(brand.brand + " " + brand.models.join(" "));
        group.append(element("h4", "", brand.brand + " (" + brand.models.length + " موديل)"));
        const link = element("a", "", "صفحة الشركة الرسمية");
        link.href = brand.source; link.target = "_blank"; link.rel = "noopener noreferrer";
        group.append(link);
        const list = element("ul", "model-name-list");
        brand.models.forEach(name => { const item=element("li", "", name); item.dataset.search=normalize(name); list.append(item); });
        group.append(list);
        section.append(group);
      });
      phoneCatalog.append(section);
      applyPhoneFilters();
    } catch (error) {
      console.error(error);
    }
  }

  async function loadPhones() {
    if (phoneData) { renderPhones(phoneData); loadModelIndex(); return; }
    if (!phoneProducts) return;
    phoneProducts.textContent = "جارٍ تحميل الموبايلات...";
    try {
      const response = await fetch("./phones.json", {cache:"no-cache"});
      if (!response.ok) throw new Error("تعذر تحميل ملف المنتجات");
      phoneData = await response.json();
      renderPhones(phoneData);
      loadModelIndex();
    } catch (error) {
      phoneProducts.textContent = "تعذر تحميل كتالوج الموبايلات حاليًا. جرّب تحديث الصفحة بعد اكتمال النشر.";
      console.error(error);
    }
  }


  function applyPhoneFilters() {
    const query=normalize(document.getElementById("phoneSearch")?.value || "");
    const brand=document.getElementById("phoneBrandFilter")?.value || "";
    const sort=document.getElementById("phoneSort")?.value || "name";
    const productCards=Array.from(phoneProducts?.querySelectorAll(".phone-card") || []);
    let visible=0;
    productCards.forEach(card=>{const show=(!query || card.dataset.search.includes(query)) && (!brand || card.querySelector(".phone-brand")?.textContent===brand);card.hidden=!show;if(show)visible++;});
    const groups=Array.from(document.querySelectorAll("#officialModelIndex .model-brand-group"));
    groups.forEach(group=>{const show=(!brand || group.dataset.brand===brand) && (!query || group.dataset.search.includes(query));group.hidden=!show;const list=group.querySelector(".model-name-list");if(list){Array.from(list.children).forEach(item=>item.hidden=!!query && !item.dataset.search.includes(query));}});
    if(phoneProducts){productCards.sort((a,b)=>sort==="brand" ? (a.querySelector(".phone-brand")?.textContent||"").localeCompare(b.querySelector(".phone-brand")?.textContent||"") : (a.querySelector(".phone-name")?.textContent||"").localeCompare(b.querySelector(".phone-name")?.textContent||""));productCards.forEach(card=>phoneProducts.append(card));}
    const totalModels=(modelIndexData?.brands||[]).reduce((n,b)=>n+b.models.length,0);
    const modelVisible=groups.filter(g=>!g.hidden).reduce((n,g)=>n+g.querySelectorAll(".model-name-list li:not([hidden])").length,0);
    const count=document.getElementById("phoneResultCount");
    if(count) count.textContent="المواصفات التفصيلية: "+visible+" من "+productCards.length+" • فهرس الموديلات: "+modelVisible+" من "+totalModels;
  }

  ["phoneSearch","phoneBrandFilter","phoneSort"].forEach(id=>{const control=document.getElementById(id);if(control){control.addEventListener(id==="phoneSearch"?"input":"change",applyPhoneFilters);}});

  const panels = new Map();
  cards.forEach((card,index) => {
    card.setAttribute("aria-expanded","false");
    card.setAttribute("aria-controls","details-"+(index+1));
    const panel=element("section","category-details");
    panel.hidden=true; panel.id="details-"+(index+1);
    panel.setAttribute("role","region");
    panel.setAttribute("aria-label","تفاصيل القسم");
    panel.append(element("h3","",getTitle(card)));
    panel.append(element("p","","هذا القسم ضمن خطة MasrPrices. ستضاف بياناته بعد مراجعة مصادرها."));
    panel.append(element("p","details-note","لن نعرض سعراً غير موثّق على أنه سعر مؤكد."));
    card.insertAdjacentElement("afterend",panel);
    panels.set(card,panel);

    card.addEventListener("click",event => {
      event.preventDefault();
      const opening=panel.hidden;
      cards.forEach(other => {
        panels.get(other).hidden=true;
        other.setAttribute("aria-expanded","false");
      });
      if (phoneCatalog) phoneCatalog.hidden=true;
      const bookCatalog=document.getElementById("bookCatalog");
      if (bookCatalog) bookCatalog.hidden=true;
      const constructionCatalog=document.getElementById("constructionCatalog");
      if (constructionCatalog) constructionCatalog.hidden=true;
      const carCatalog=document.getElementById("carCatalog");
      if (carCatalog) carCatalog.hidden=true;
      const applianceCatalog=document.getElementById("applianceCatalog");
      if (applianceCatalog) applianceCatalog.hidden=true;
      const groceryCatalog=document.getElementById("groceryCatalog");
      if (groceryCatalog) groceryCatalog.hidden=true;
      const stationeryCatalog=document.getElementById("stationeryCatalog");
      if (stationeryCatalog) stationeryCatalog.hidden=true;
      ["clothingCatalog","furnitureCatalog","personalCareCatalog","sportsCatalog","electricalCatalog","toolsCatalog","petsCatalog","plantsCatalog","telecomCatalog","travelCatalog","stocksCatalog","electronicsCatalog"].forEach(id=>{const node=document.getElementById(id);if(node)node.hidden=true;});
      if (opening) {
        panel.hidden=false;
        card.setAttribute("aria-expanded","true");
        const title=normalize(getTitle(card));
        if (title.includes("موبايلات")) {
          panel.hidden=true;
          if (phoneCatalog) { phoneCatalog.hidden=false; loadPhones(); phoneCatalog.scrollIntoView({behavior:"smooth",block:"start"}); }
        } else if (title.includes("كتب") || title.includes("روايات")) {
          panel.hidden=true;
          if (bookCatalog) { bookCatalog.hidden=false; bookCatalog.scrollIntoView({behavior:"smooth",block:"start"}); }
        } else if (title.includes("مواد البناء")) {
          panel.hidden=true;
          if (constructionCatalog) { constructionCatalog.hidden=false; constructionCatalog.scrollIntoView({behavior:"smooth",block:"start"}); }
        }
        else if (title.includes("السيارات")) { panel.hidden=true; if(carCatalog){carCatalog.hidden=false;carCatalog.scrollIntoView({behavior:"smooth",block:"start"});} }
        else if (title.includes("الأجهزة المنزلية")) { panel.hidden=true; if(applianceCatalog){applianceCatalog.hidden=false;loadAppliances();applianceCatalog.scrollIntoView({behavior:"smooth",block:"start"});} }
        else if (title.includes("البقالة") || title.includes("مواد غذائية")) { panel.hidden=true; if(groceryCatalog){groceryCatalog.hidden=false;loadGroceries();groceryCatalog.scrollIntoView({behavior:"smooth",block:"start"});} }
        else if (title.includes("الأدوات المدرسية")) { panel.hidden=true; if(stationeryCatalog){stationeryCatalog.hidden=false;loadStationery();stationeryCatalog.scrollIntoView({behavior:"smooth",block:"start"});} }
        else if(title.includes("الملابس")||title.includes("الأحذية")){panel.hidden=true;const n=document.getElementById("clothingCatalog");if(n){n.hidden=false;loadSimpleCatalog("clothing");n.scrollIntoView({behavior:"smooth",block:"start"});}}
        else if(title.includes("الأثاث")||title.includes("المفروشات")){panel.hidden=true;const n=document.getElementById("furnitureCatalog");if(n){n.hidden=false;loadSimpleCatalog("furniture");n.scrollIntoView({behavior:"smooth",block:"start"});}}
        else if(title.includes("العناية")||title.includes("التجميل")){panel.hidden=true;const n=document.getElementById("personalCareCatalog");if(n){n.hidden=false;loadGenericCatalog("personalCare");n.scrollIntoView({behavior:"smooth",block:"start"});}}
        else if(title.includes("الرياضة")||title.includes("الترفيه")){panel.hidden=true;const n=document.getElementById("sportsCatalog");if(n){n.hidden=false;loadGenericCatalog("sports");n.scrollIntoView({behavior:"smooth",block:"start"});}}
        else if(title.includes("الكهرباء")||title.includes("السباكة")){panel.hidden=true;const n=document.getElementById("electricalCatalog");if(n){n.hidden=false;loadGenericCatalog("electrical");n.scrollIntoView({behavior:"smooth",block:"start"});}}
        else if(title.includes("الأدوات")||title.includes("المعدات")){panel.hidden=true;const n=document.getElementById("toolsCatalog");if(n){n.hidden=false;loadGenericCatalog("tools");n.scrollIntoView({behavior:"smooth",block:"start"});}}
        else if(title.includes("الحيوانات")){panel.hidden=true;const n=document.getElementById("petsCatalog");if(n){n.hidden=false;loadGenericCatalog("pets");n.scrollIntoView({behavior:"smooth",block:"start"});}}
        else if(title.includes("الزراعة")||title.includes("النباتات")){panel.hidden=true;const n=document.getElementById("plantsCatalog");if(n){n.hidden=false;loadGenericCatalog("plants");n.scrollIntoView({behavior:"smooth",block:"start"});}}
        else if(title.includes("الخدمات")||title.includes("الاتصالات")){panel.hidden=true;const n=document.getElementById("telecomCatalog");if(n){n.hidden=false;loadGenericCatalog("telecom");n.scrollIntoView({behavior:"smooth",block:"start"});}}
        else if(title.includes("السياحة")||title.includes("السفر")){panel.hidden=true;const n=document.getElementById("travelCatalog");if(n){n.hidden=false;loadGenericCatalog("travel");n.scrollIntoView({behavior:"smooth",block:"start"});}}
        else if(title.includes("البورصة")||title.includes("الأسهم")){panel.hidden=true;const n=document.getElementById("stocksCatalog");if(n){n.hidden=false;loadGenericCatalog("stocks");n.scrollIntoView({behavior:"smooth",block:"start"});}}
        else if(title.includes("الإلكترونيات")){panel.hidden=true;const n=document.getElementById("electronicsCatalog");if(n){n.hidden=false;loadGenericCatalog("electronics");n.scrollIntoView({behavior:"smooth",block:"start"});}}
        else if(title.includes("الذهب")||title.includes("الفضة")||title.includes("العملات")){panel.hidden=true;const n=document.getElementById("markets");if(n)n.scrollIntoView({behavior:"smooth",block:"start"});}
      }
    });
    card.addEventListener("keydown",event => {
      if(event.key==="Enter" || event.key===" ") { event.preventDefault(); card.click(); }
    });
  });

  const globalSearchBox=element("div","global-search-results");
  globalSearchBox.id="globalSearchResults";globalSearchBox.hidden=true;
  if(searchInput)searchInput.insertAdjacentElement("afterend",globalSearchBox);
  const searchableFiles=[
    ["phones.json","الموبايلات والإلكترونيات","phoneCatalog","phoneSearch"],
    ["books.json","الكتب والروايات","bookCatalog","bookSearch"],
    ["construction.json","مواد البناء","constructionCatalog","constructionSearch"],
    ["cars.json","السيارات وقطع الغيار","carCatalog","carSearch"],
    ["appliances.json","الأجهزة المنزلية","applianceCatalog","applianceSearch"],
    ["groceries.json","الطعام والبقالة","groceryCatalog","grocerySearch"],
    ["stationery.json","الأدوات المدرسية","stationeryCatalog","stationerySearch"],
    ["clothing.json","الملابس والأحذية","clothingCatalog","clothingSearch"],
    ["furniture.json","الأثاث والمفروشات","furnitureCatalog","furnitureSearch"],
    ["personal-care.json","التجميل والعناية","personalCareCatalog","personalCareCatalogSearch"],
    ["sports.json","الرياضة والترفيه","sportsCatalog","sportsCatalogSearch"],
    ["electrical.json","الكهرباء والسباكة","electricalCatalog","electricalCatalogSearch"],
    ["tools.json","الأدوات والمعدات","toolsCatalog","toolsCatalogSearch"],
    ["pets.json","الحيوانات الأليفة","petsCatalog","petsCatalogSearch"],
    ["plants.json","الزراعة والنباتات","plantsCatalog","plantsCatalogSearch"],
    ["telecom.json","الخدمات والاتصالات","telecomCatalog","telecomCatalogSearch"],
    ["travel.json","السياحة والسفر","travelCatalog","travelCatalogSearch"],
    ["stocks.json","البورصة والأسهم","stocksCatalog","stocksCatalogSearch"],
    ["electronics.json","الموبايلات والإلكترونيات","electronicsCatalog","electronicsCatalogSearch"]
  ];
  let allSearchData=null,searchLoadPromise=null;
  async function loadAllSearchData(){
    if(allSearchData)return allSearchData;
    if(searchLoadPromise)return searchLoadPromise;
    searchLoadPromise=Promise.all(searchableFiles.map(async meta=>{
      try{const response=await fetch("./"+meta[0],{cache:"no-cache"});if(!response.ok)return {meta,items:[]};const data=await response.json();return {meta,items:Array.isArray(data.products)?data.products:[]};}
      catch(e){return {meta,items:[]};}
    })).then(rows=>(allSearchData=rows));
    return searchLoadPromise;
  }
  function searchText(item){return normalize([item.name,item.title,item.brand,item.category,item.model,item.spec,item.author,item.merchant,item.unit,item.grade,item.subject,item.variant,item.memory,item.processor].filter(Boolean).join(" "));}
  function openSearchResult(meta,item){
    const routeWords={
      "phones.json":["موبايلات"],"electronics.json":["الإلكترونيات والملحقات"],
      "books.json":["كتب"],"construction.json":["مواد البناء"],
      "cars.json":["سيارات"],"appliances.json":["الأجهزة المنزلية"],
      "groceries.json":["البقالة"],"stationery.json":["الأدوات المدرسية"],
      "clothing.json":["الملابس"],"furniture.json":["الأثاث"],
      "personal-care.json":["التجميل"],"sports.json":["الرياضة"],
      "electrical.json":["الكهرباء"],"tools.json":["الأدوات والمعدات"],
      "pets.json":["الحيوانات"],"plants.json":["الزراعة"],
      "telecom.json":["الخدمات"],"travel.json":["السياحة"],
      "stocks.json":["البورصة"]
    };
    const wanted=routeWords[meta[0]]||[];
    const target=cards.find(c=>wanted.some(word=>normalize(getTitle(c)).includes(normalize(word))));
    if(target)target.click();
    setTimeout(()=>{
      const field=document.getElementById(meta[3]);
      if(field){field.value=item.name||item.title||"";field.dispatchEvent(new Event("input",{bubbles:true}));}
      const section=document.getElementById(meta[2]);if(section)section.scrollIntoView({behavior:"smooth",block:"start"});
      globalSearchBox.hidden=true;
    },180);
  }
  let searchTimer=null,activeSearchIndex=-1,lastSearchMatches=[];
  function closeGlobalSearch(){globalSearchBox.hidden=true;activeSearchIndex=-1;}
  function showSearchMatches(query,datasets){
    const matches=[];
    datasets.forEach(({meta,items})=>items.forEach(item=>{
      const full=searchText(item);
      const score=full===query?0:normalize(item.name||item.title||"")===query?1:
        normalize(item.name||item.title||"").startsWith(query)?2:
        normalize(item.brand||"").startsWith(query)?3:full.includes(query)?4:99;
      if(score<99)matches.push({meta,item,score});
    }));
    matches.sort((a,b)=>a.score-b.score||(a.item.name||a.item.title||"").localeCompare(b.item.name||b.item.title||"","ar"));
    lastSearchMatches=matches.slice(0,20);
    globalSearchBox.replaceChildren();
    if(!matches.length){
      globalSearchBox.append(element("p","search-empty-title","مفيش نتائج مطابقة"));
      globalSearchBox.append(element("p","catalog-footnote","جرّب اسم الماركة أو جزءًا من اسم المنتج، أو اختصر كلمة البحث."));
      return;
    }
    const heading=element("div","search-results-heading","نتائج البحث · "+matches.length+" نتيجة");
    globalSearchBox.append(heading);
    lastSearchMatches.forEach(({meta,item},index)=>{
      const button=element("button","global-search-result");button.type="button";button.dataset.index=String(index);
      const imageUrl=item.image||item.imageUrl||item.image_url||"";
      if(/^https?:\/\//i.test(imageUrl)){const thumb=element("img","global-search-thumb");thumb.src=imageUrl;thumb.alt="";thumb.loading="lazy";thumb.referrerPolicy="no-referrer";thumb.onerror=()=>thumb.remove();button.append(thumb);}
      const info=element("span","global-search-info");
      info.append(element("strong","",item.name||item.title||"منتج"));
      const rawPrice=item.price??item.priceEGP??item.priceFrom??null;
      const priceLabel=typeof rawPrice==="number"&&Number.isFinite(rawPrice)?rawPrice.toLocaleString("en-US")+" جنيه": "السعر غير متاح حاليًا";
      info.append(element("small","",meta[1]+" · "+priceLabel));
      button.append(info);
      button.addEventListener("click",()=>openSearchResult(meta,item));
      globalSearchBox.append(button);
    });
    if(matches.length>20)globalSearchBox.append(element("small","catalog-footnote","أول 20 نتيجة من "+matches.length+". حدّد البحث لمزيد من الدقة."));
  }
  if(searchInput){
    searchInput.setAttribute("aria-controls","globalSearchResults");
    searchInput.setAttribute("autocomplete","off");
    searchInput.setAttribute("aria-expanded","false");
    searchInput.addEventListener("input",()=>{
      clearTimeout(searchTimer);
      const query=normalize(searchInput.value);
      cards.forEach(card=>{card.hidden=!!query&&!normalize(getTitle(card)+" "+(card.dataset.search||"")).includes(query);});
      if(!query){closeGlobalSearch();globalSearchBox.replaceChildren();if(noResults)noResults.hidden=true;return;}
      if(noResults)noResults.hidden=!Array.from(cards).some(card=>!card.hidden);
      searchInput.setAttribute("aria-expanded","true");
      globalSearchBox.hidden=false;
      globalSearchBox.replaceChildren(element("p","catalog-footnote","جارٍ البحث في المنتجات والأقسام..."));
      searchTimer=setTimeout(async()=>{
        const datasets=await loadAllSearchData();
        if(normalize(searchInput.value)!==query)return;
        showSearchMatches(query,datasets);
      },160);
    });
    searchInput.addEventListener("keydown",event=>{
      const buttons=Array.from(globalSearchBox.querySelectorAll(".global-search-result"));
      if(event.key==="Escape"){closeGlobalSearch();searchInput.blur();return;}
      if(event.key==="ArrowDown"&&buttons.length){event.preventDefault();activeSearchIndex=Math.min(activeSearchIndex+1,buttons.length-1);buttons[activeSearchIndex].focus();}
    });
    globalSearchBox.addEventListener("keydown",event=>{
      const buttons=Array.from(globalSearchBox.querySelectorAll(".global-search-result"));
      if(event.key==="ArrowDown"||event.key==="ArrowUp"){
        event.preventDefault();activeSearchIndex=(activeSearchIndex+(event.key==="ArrowDown"?1:-1)+buttons.length)%buttons.length;buttons[activeSearchIndex]?.focus();
      }else if(event.key==="Escape"){closeGlobalSearch();searchInput.focus();}
    });
    document.addEventListener("click",event=>{if(!globalSearchBox.contains(event.target)&&event.target!==searchInput){closeGlobalSearch();searchInput.setAttribute("aria-expanded","false");}});
  }


  let bookData = null;
  const bookGrade=document.getElementById("bookGrade");
  const bookSubject=document.getElementById("bookSubject");
  const bookTeacher=document.getElementById("bookTeacher");
  function fillBookOptions(select,values,placeholder){
    select.replaceChildren(element("option","",placeholder));
    values.forEach(value=>{const o=element("option","",value);o.value=value;select.append(o);});
  }
  function bookSelectionChanged(){
    const grade=bookGrade.value;
    const gradeRows=bookData.products.filter(x=>x.grade===grade);
    const subjects=[...new Set(gradeRows.map(x=>x.subject).filter(x=>x&&x!=="جميع المواد"))].sort((a,b)=>a.localeCompare(b,"ar"));
    fillBookOptions(bookSubject,subjects,"اختر المادة");
    document.getElementById("bookSubjectStep").hidden=!grade;
    document.getElementById("bookTeacherStep").hidden=true;
    document.getElementById("bookProducts").replaceChildren(element("p","catalog-footnote",grade?"اختر المادة لعرض المدرسين والسلاسل المتاحة.":"اختر السنة الدراسية لعرض المواد."));
    document.getElementById("bookCount").textContent="";
  }
  function bookSubjectChanged(){
    const rows=bookData.products.filter(x=>x.grade===bookGrade.value&&x.subject===bookSubject.value);
    const teachers=[...new Set(rows.map(x=>x.teacher||x.series).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar"));
    fillBookOptions(bookTeacher,teachers,"اختر المدرس أو السلسلة");
    document.getElementById("bookTeacherStep").hidden=!bookSubject.value;
    document.getElementById("bookProducts").replaceChildren(element("p","catalog-footnote","اختر المدرس أو سلسلة الكتاب لعرض الكتب."));
  }
  function renderBooks(data) {
    const container=document.getElementById("bookProducts");if(!container)return;
    const grade=bookGrade.value,subject=bookSubject.value,teacher=bookTeacher.value;
    if(!grade||!subject||!teacher){container.replaceChildren(element("p","catalog-footnote","أكمل اختيار السنة ثم المادة ثم المدرس أو السلسلة."));return;}
    const query=normalize(document.getElementById("bookSearch").value||"");
    const sort=document.getElementById("bookSort").value||"name";
    const items=data.products.filter(book=>book.grade===grade&&book.subject===subject&&(book.teacher||book.series)===teacher&&(!query||normalize([book.title,book.author,book.merchant,book.series].join(" ")).includes(query)));
    items.sort((a,b)=>sort==="price"?(a.price??0)-(b.price??0):a.title.localeCompare(b.title,"ar"));
    container.replaceChildren();
    items.forEach(book=>{
      const card=element("article","book-card");
      card.append(element("span","book-category",book.teacher||book.series||"كتاب خارجي"));
      card.append(element("h3","",book.title));
      if(book.author)card.append(element("p","book-author","المؤلف: "+book.author));
      card.append(element("p","book-price",book.category==="كتب الوزارة"?"مجاني – من موقع الوزارة":(Number.isFinite(book.price)?book.price.toLocaleString("en-US")+" جنيه":"السعر غير متاح")));
      card.append(element("p","book-store","المصدر: "+book.merchant));
      card.append(element("small","book-date","آخر رصد: "+book.checkedAt));
      const link=element("a","book-source","عرض الكتاب لدى المصدر");link.href=book.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);
      if(book.legalPdfUrl){const pdf=element("a","book-pdf","فتح نسخة إلكترونية مرخّصة");pdf.href=book.legalPdfUrl;pdf.target="_blank";pdf.rel="noopener noreferrer";card.append(pdf);}
      else card.append(element("small","book-pdf-unavailable",book.pdfStatus||"لا يتوفر PDF مجاني مرخّص تم التحقق منه"));
      container.append(card);
    });
    document.getElementById("bookCount").textContent="عرض "+items.length+" كتابًا لهذه المادة والاختيار";
    if(!items.length)container.append(element("p","catalog-footnote","لا توجد كتب مسجلة لهذا الاختيار حاليًا."));
  }
  async function loadBooks(){
    const container=document.getElementById("bookProducts");if(!container)return;
    try{
      const response=await fetch("./books.json",{cache:"no-cache"});if(!response.ok)throw new Error();
      bookData=await response.json();
      const grades=[...new Set(bookData.products.map(x=>x.grade).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar"));
      fillBookOptions(bookGrade,grades,"اختر السنة الدراسية");
      bookGrade.addEventListener("change",bookSelectionChanged);
      bookSubject.addEventListener("change",bookSubjectChanged);
      bookTeacher.addEventListener("change",()=>renderBooks(bookData));
      ["bookSearch","bookSort"].forEach(id=>document.getElementById(id).addEventListener(id==="bookSearch"?"input":"change",()=>renderBooks(bookData)));
    }catch(error){container.textContent="تعذر تحميل قائمة الكتب حاليًا.";}
  }
  loadBooks();

  let constructionData=null;
  function renderConstruction(data){
    const container=document.getElementById("constructionProducts");if(!container)return;
    const q=normalize(document.getElementById("constructionSearch")?.value||"");
    const cat=document.getElementById("constructionCategory")?.value||"";
    const sort=document.getElementById("constructionSort")?.value||"name";
    const rows=data.products.filter(x=>(!cat||x.category===cat)&&(!q||normalize([x.name,x.category,x.spec,x.unit].join(" ")).includes(q)));
    rows.sort((a,b)=>sort==="price"?((a.price??Infinity)-(b.price??Infinity)):a.name.localeCompare(b.name,"ar"));
    container.replaceChildren();
    rows.forEach(x=>{const card=element("article","book-card");card.append(element("span","book-category",x.category));card.append(element("h3","",x.name));card.append(element("p","book-price",(Number.isFinite(x.price)?x.price.toLocaleString("en-US")+" جنيه / "+x.unit:"السعر غير متاح")));card.append(element("p","",x.spec));card.append(element("small","book-date","آخر رصد: "+x.checkedAt+" · "+data.region));const link=element("a","book-source","تفاصيل المصدر");link.href=data.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);container.append(card);});
    const count=document.getElementById("constructionCount");if(count)count.textContent="عرض "+rows.length+" من "+data.products.length+" بندًا";
    if(!rows.length)container.append(element("p","catalog-footnote","لا توجد نتائج مطابقة."));
  }
  async function loadConstruction(){
    const container=document.getElementById("constructionProducts");if(!container)return;
    try{const response=await fetch("./construction.json",{cache:"no-cache"});if(!response.ok)throw new Error("construction data unavailable");constructionData=await response.json();const select=document.getElementById("constructionCategory");[...new Set(constructionData.products.map(x=>x.category))].sort().forEach(x=>{const o=element("option","",x);o.value=x;select.append(o);});renderConstruction(constructionData);}
    catch(e){container.textContent="تعذر تحميل أسعار مواد البناء حاليًا.";}
  }
  ["constructionSearch","constructionCategory","constructionSort"].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener(id==="constructionSearch"?"input":"change",()=>{if(constructionData)renderConstruction(constructionData);});});
  loadConstruction();


  let marketStaticData=null;
  let marketETag=null;
  let marketTimer=null;
  function marketAssetName(asset){
    const names={"gold-24k":"ذهب عيار 24","gold-22k":"ذهب عيار 22","gold-21k":"ذهب عيار 21","gold-18k":"ذهب عيار 18","silver-999":"فضة عيار 999","silver-925":"فضة عيار 925","silver-900":"فضة عيار 900","silver-800":"فضة عيار 800","silver-600":"فضة عيار 600","us-dollar":"الدولار الأمريكي","euro":"اليورو","british-pound":"الجنيه الإسترليني","saudi-riyal":"الريال السعودي","uae-dirham":"الدرهم الإماراتي","kuwaiti-dinar":"الدينار الكويتي","japanese-yen":"الين الياباني","chinese-yuan":"اليوان الصيني"};
    return names[asset.slug]||asset.nameAr||asset.name||asset.slug||asset.id;
  }
  function renderMarketGroups(groups,live,generatedAt){
    const root=document.getElementById("marketRates");if(!root)return;
    root.replaceChildren();
    groups.forEach(group=>{
      if(!group.items.length)return;
      const box=element("section","market-rate-group");box.append(element("h3","",group.title));
      const table=element("div","market-rate-list");
      group.items.forEach(x=>{
        const row=element("div","market-rate-row");row.append(element("strong","",x.name));
        row.append(element("span","",x.value));table.append(row);
      });
      box.append(table);
      const note=element("small","catalog-footnote",group.note);
      const link=element("a","","فتح المصدر");link.href=group.source;link.target="_blank";link.rel="noopener noreferrer";note.append(link);box.append(note);root.append(box);
    });
    const status=element("p","catalog-footnote",live
      ? "تحديث تلقائي من المصدر كل 5 دقائق تقريبًا · آخر استجابة: "+new Date(generatedAt||Date.now()).toLocaleString("ar-EG")
      : "تعذر الاتصال بالمصدر المباشر؛ المعروض بيانات محفوظة وقد لا تكون محدثة.");
    root.append(status);
  }
  function groupsFromLiveFeed(feed){
    const assets=Array.isArray(feed.assets)?feed.assets:[];
    const gold=[],silver=[],currencies=[];
    assets.forEach(asset=>{
      const slug=String(asset.slug||"");
      const isSilver=/silver/i.test(slug)||/silver/i.test(String(asset.kind||""));
      const isGold=/gold/i.test(slug)||/gold/i.test(String(asset.kind||""));
      const isCurrency=asset.category==="currencies"||asset.kind==="currency";
      const buy=asset.directions?.buy?.best?.value;
      const sell=asset.directions?.sell?.best?.value;
      const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString("en-US",{maximumFractionDigits:4}):"غير متاح";
      if(isGold||isSilver){
        const row={name:marketAssetName(asset),value:"الجهة تشتري منك: "+fmt(buy)+" · الجهة تبيع لك: "+fmt(sell)+" جنيه"};
        (isSilver?silver:gold).push(row);
      }else if(isCurrency){
        const value=sell??asset.benchmark?.sell??asset.global?.value;
        if(value!=null)currencies.push({name:marketAssetName(asset),value:fmt(value)+" جنيه"});
      }
    });
    const stamp=feed.generatedAt||new Date().toISOString();
    const make=(title,items)=>({title,items,note:"آخر رصد من المصدر: "+stamp+" · الأسعار استرشادية وليست عرض بيع ملزم. ",source:"https://getdaleelak.com/ar/api"});
    return [make("أسعار الذهب",gold),make("أسعار الفضة",silver),make("أسعار العملات مقابل الجنيه",currencies)];
  }
  async function loadMarketRates(){
    const root=document.getElementById("marketRates");if(!root)return;
    try{
      const headers={};if(marketETag)headers["If-None-Match"]=marketETag;
      const res=await fetch("https://getdaleelak.com/api/v1/feed.json",{headers,cache:"no-store"});
      if(res.status===304)return;
      if(!res.ok)throw new Error("Live market feed unavailable: "+res.status);
      const feed=await res.json();if(!Array.isArray(feed.assets))throw new Error("Invalid market feed");
      marketETag=res.headers.get("ETag")||marketETag;
      const groups=groupsFromLiveFeed(feed);
      if(!groups.some(g=>g.items.length))throw new Error("No supported assets in feed");
      renderMarketGroups(groups,true,feed.generatedAt);
    }catch(error){
      if(!marketStaticData){
        try{const fallback=await fetch("./market-rates.json",{cache:"no-cache"});if(fallback.ok)marketStaticData=await fallback.json();}catch(_){}
      }
      if(marketStaticData){
        const d=marketStaticData;
        const make=(title,g,kind)=>({title,source:g.source,items:g.items.map(x=>({name:x.name,value:kind==="currency"?(Number(x.rate).toLocaleString("en-US",{maximumFractionDigits:4})+" جنيه"):"شراء "+Number(x.buy).toLocaleString("en-US")+" · بيع "+Number(x.sell).toLocaleString("en-US")+" جنيه / "+x.unit})),note:"آخر رصد محفوظ: "+g.checkedAt+" · "+g.sourceLabel+" · قد لا يكون السعر الحالي. "});
        renderMarketGroups([make("أسعار الذهب",d.gold,"gold"),make("أسعار الفضة",d.silver,"silver"),make("أسعار العملات مقابل الجنيه",d.currencies,"currency")],false);
      }else root.textContent="بيانات الأسواق غير متاحة حاليًا.";
    }
  }
  loadMarketRates();
  marketTimer=setInterval(loadMarketRates,5*60*1000);


  let carData=null;
  function renderCars(data){
    const root=document.getElementById("carProducts");if(!root)return;
    const q=normalize(document.getElementById("carSearch")?.value||"");
    const cat=document.getElementById("carCategory")?.value||"";
    const sort=document.getElementById("carSort")?.value||"name";
    const rows=data.products.filter(x=>(!cat||x.category===cat)&&(!q||normalize([x.name,x.brand,x.category,x.spec].join(" ")).includes(q)));
    rows.sort((a,b)=>sort==="price"?a.price-b.price:a.name.localeCompare(b.name,"ar"));
    root.replaceChildren();
    rows.forEach(x=>{const card=element("article","book-card");card.append(element("span","book-category",x.brand+" · "+x.category));card.append(element("h3","",x.name));card.append(element("p","book-price",x.price==null?"السعر غير منشور — راجع المصدر الرسمي":(Number.isFinite(x.price)?x.price.toLocaleString("en-US")+" جنيه":"السعر غير متاح")));card.append(element("p","",x.spec));card.append(element("small","book-date","آخر تحديث للمصدر: "+x.checkedAt));const link=element("a","book-source","مصدر السعر");link.href=x.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);root.append(card);});
    const count=document.getElementById("carCount");if(count)count.textContent="عرض "+rows.length+" من "+data.products.length+" فئة";
  }
  async function loadCars(){const root=document.getElementById("carProducts");if(!root)return;try{const res=await fetch("./cars.json",{cache:"no-cache"});if(!res.ok)throw new Error();carData=await res.json();const sel=document.getElementById("carCategory");[...new Set(carData.products.map(x=>x.category))].forEach(x=>{const o=element("option","",x);o.value=x;sel.append(o);});renderCars(carData);}catch(e){root.textContent="تعذر تحميل أسعار السيارات حاليًا.";}}
  ["carSearch","carCategory","carSort"].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener(id==="carSearch"?"input":"change",()=>{if(carData)renderCars(carData);});});
  loadCars();

  let installPrompt=null;
  const installButton=document.getElementById("installBtn");
  window.addEventListener("beforeinstallprompt",event => {
    event.preventDefault(); installPrompt=event;
    if(installButton) installButton.hidden=false;
  });
  if(installButton) installButton.addEventListener("click",async() => {
    if(!installPrompt) return;
    installPrompt.prompt(); await installPrompt.userChoice;
    installPrompt=null; installButton.hidden=true;
  });

  if("serviceWorker" in navigator && location.protocol==="https:") {
    window.addEventListener("load",() => {
      navigator.serviceWorker.register("./sw.js").catch(error => console.error("تعذر تشغيل وضع عدم الاتصال:",error));
    });
  }
  let applianceData=null;
  function renderAppliances(data){
    const root=document.getElementById("applianceProducts");if(!root)return;
    const q=normalize(document.getElementById("applianceSearch")?.value||"");
    const cat=document.getElementById("applianceCategory")?.value||"";
    const sort=document.getElementById("applianceSort")?.value||"name";
    const rows=data.products.filter(x=>(!cat||x.category===cat)&&(!q||normalize([x.name,x.brand,x.model,x.category,x.merchant].join(" ")).includes(q)));
    rows.sort((a,b)=>sort==="price"?a.price-b.price:a.name.localeCompare(b.name,"ar"));
    root.replaceChildren();
    rows.forEach(x=>{
      const card=element("article","book-card");
      card.append(element("span","book-category",x.brand+" · "+x.category));
      card.append(element("h3","",x.name));
      card.append(element("p","book-price",x.price==null?"السعر غير منشور — راجع المصدر الرسمي":Number(x.price).toLocaleString("en-US")+" جنيه"));
      card.append(element("p","book-store","المتجر: "+x.merchant+" · الموديل: "+x.model));
      card.append(element("small","book-date","آخر رصد: "+x.checkedAt));
      const link=element("a","book-source","راجع السعر لدى المتجر");link.href=x.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);
      root.append(card);
    });
    const count=document.getElementById("applianceCount");if(count)count.textContent="عرض "+rows.length+" من "+data.products.length+" جهازًا";
    if(!rows.length)root.append(element("p","catalog-footnote","لا توجد نتائج مطابقة."));
  }
  async function loadAppliances(){
    const root=document.getElementById("applianceProducts");if(!root||applianceData)return;
    try{
      const res=await fetch("./appliances.json",{cache:"no-cache"});if(!res.ok)throw new Error();
      applianceData=await res.json();
      const sel=document.getElementById("applianceCategory");
      [...new Set(applianceData.products.map(x=>x.category))].sort().forEach(x=>{const o=element("option","",x);o.value=x;sel.append(o);});
      renderAppliances(applianceData);
    }catch(e){root.textContent="تعذر تحميل أسعار الأجهزة المنزلية حاليًا.";}
  }
  ["applianceSearch","applianceCategory","applianceSort"].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener(id==="applianceSearch"?"input":"change",()=>{if(applianceData)renderAppliances(applianceData);});});

  let groceryData=null;
  function renderGroceries(data){
    const root=document.getElementById("groceryProducts");if(!root)return;
    const q=normalize(document.getElementById("grocerySearch")?.value||"");
    const cat=document.getElementById("groceryCategory")?.value||"";
    const sort=document.getElementById("grocerySort")?.value||"name";
    const rows=data.products.filter(x=>(!cat||x.category===cat)&&(!q||normalize([x.name,x.brand,x.category,x.unit].join(" ")).includes(q)));
    rows.sort((a,b)=>sort==="price"?a.price-b.price:a.name.localeCompare(b.name,"ar"));
    root.replaceChildren();
    rows.forEach(x=>{
      const card=element("article","book-card");
      card.append(element("span","book-category",x.category+" · "+x.brand));
      card.append(element("h3","",x.name));
      card.append(element("p","book-price",x.price.toLocaleString("en-US")+" جنيه"));
      card.append(element("p","book-store","العبوة: "+x.unit+" · المتجر: "+x.merchant));
      card.append(element("small","book-date","آخر رصد: "+x.checkedAt));
      const link=element("a","book-source","فتح قائمة المتجر");link.href=data.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);
      root.append(card);
    });
    const count=document.getElementById("groceryCount");if(count)count.textContent="عرض "+rows.length+" من "+data.products.length+" سلعة";
    if(!rows.length)root.append(element("p","catalog-footnote","لا توجد نتائج مطابقة."));
  }
  async function loadGroceries(){
    const root=document.getElementById("groceryProducts");if(!root||groceryData)return;
    try{
      const res=await fetch("./groceries.json",{cache:"no-cache"});if(!res.ok)throw new Error();
      groceryData=await res.json();
      const sel=document.getElementById("groceryCategory");
      [...new Set(groceryData.products.map(x=>x.category))].sort().forEach(x=>{const o=element("option","",x);o.value=x;sel.append(o);});
      renderGroceries(groceryData);
    }catch(e){root.textContent="تعذر تحميل أسعار البقالة حاليًا.";}
  }
  ["grocerySearch","groceryCategory","grocerySort"].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener(id==="grocerySearch"?"input":"change",()=>{if(groceryData)renderGroceries(groceryData);});});

  let stationeryData=null;
  function renderStationery(data){
    const root=document.getElementById("stationeryProducts");if(!root)return;
    const q=normalize(document.getElementById("stationerySearch")?.value||"");
    const cat=document.getElementById("stationeryCategory")?.value||"";
    const sort=document.getElementById("stationerySort")?.value||"name";
    const rows=data.products.filter(x=>(!cat||x.category===cat)&&(!q||normalize([x.name,x.category,x.unit].join(" ")).includes(q)));
    rows.sort((a,b)=>sort==="price"?((a.priceFrom??Infinity)-(b.priceFrom??Infinity)):a.name.localeCompare(b.name,"ar"));
    root.replaceChildren();
    rows.forEach(x=>{
      const card=element("article","book-card");
      card.append(element("span","book-category",x.category));
      card.append(element("h3","",x.name));
      card.append(element("p","book-price",(Number.isFinite(x.priceFrom)&&Number.isFinite(x.priceTo)?(x.priceFrom===x.priceTo?x.priceFrom.toLocaleString("en-US")+" جنيه":x.priceFrom.toLocaleString("en-US")+"–"+x.priceTo.toLocaleString("en-US")+" جنيه"):"السعر غير متاح")));
      card.append(element("p","book-store","الوحدة: "+x.unit));
      card.append(element("small","book-date","آخر رصد: "+x.checkedAt+" · نطاق تقريبي منشور"));
      const link=element("a","book-source","مصدر نطاق السعر");link.href=x.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);
      root.append(card);
    });
    const count=document.getElementById("stationeryCount");if(count)count.textContent="عرض "+rows.length+" من "+data.products.length+" مستلزمًا";
    if(!rows.length)root.append(element("p","catalog-footnote","لا توجد نتائج مطابقة."));
  }
  async function loadStationery(){
    const root=document.getElementById("stationeryProducts");if(!root||stationeryData)return;
    try{
      const res=await fetch("./stationery.json",{cache:"no-cache"});if(!res.ok)throw new Error();
      stationeryData=await res.json();
      const sel=document.getElementById("stationeryCategory");
      [...new Set(stationeryData.products.map(x=>x.category))].sort().forEach(x=>{const o=element("option","",x);o.value=x;sel.append(o);});
      renderStationery(stationeryData);
    }catch(e){root.textContent="تعذر تحميل أسعار الأدوات المدرسية حاليًا.";}
  }
  ["stationerySearch","stationeryCategory","stationerySort"].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener(id==="stationerySearch"?"input":"change",()=>{if(stationeryData)renderStationery(stationeryData);});});

  const simpleCatalogs={
    clothing:{file:"clothing.json",search:"clothingSearch",category:"clothingCategory",sort:"clothingSort",count:"clothingCount",products:"clothingProducts"},
    furniture:{file:"furniture.json",search:"furnitureSearch",category:"furnitureCategory",sort:"furnitureSort",count:"furnitureCount",products:"furnitureProducts"}
  };
  const simpleData={};
  function renderSimpleCatalog(key){
    const cfg=simpleCatalogs[key],data=simpleData[key],root=document.getElementById(cfg.products);if(!data||!root)return;
    const q=normalize(document.getElementById(cfg.search).value||""),cat=document.getElementById(cfg.category).value,sort=document.getElementById(cfg.sort).value;
    const rows=data.products.filter(x=>(!cat||x.category===cat)&&(!q||normalize([x.name,x.brand,x.category,x.model||"",x.size||""].join(" ")).includes(q)));
    rows.sort((a,b)=>sort==="price"?a.price-b.price:a.name.localeCompare(b.name,"ar"));
    root.replaceChildren();
    rows.forEach(x=>{const card=element("article","book-card");card.append(element("span","book-category",x.brand+" · "+x.category));card.append(element("h3","",x.name));card.append(element("p","book-price",x.price.toLocaleString("en-US")+" جنيه"));if(x.size)card.append(element("p","book-store","المقاس: "+x.size));card.append(element("p","book-store","المتجر: "+x.merchant));card.append(element("small","book-date","آخر رصد: "+x.checkedAt));const a=element("a","book-source","فتح صفحة المتجر");a.href=x.source;a.target="_blank";a.rel="noopener noreferrer";card.append(a);root.append(card);});
    document.getElementById(cfg.count).textContent="عرض "+rows.length+" من "+data.products.length+" منتجًا";
    if(!rows.length)root.append(element("p","catalog-footnote","لا توجد نتائج مطابقة."));
  }
  async function loadSimpleCatalog(key){
    if(simpleData[key])return renderSimpleCatalog(key);
    const cfg=simpleCatalogs[key],root=document.getElementById(cfg.products);
    try{const res=await fetch("./"+cfg.file,{cache:"no-cache"});if(!res.ok)throw new Error();simpleData[key]=await res.json();const sel=document.getElementById(cfg.category);[...new Set(simpleData[key].products.map(x=>x.category))].sort().forEach(x=>{const o=element("option","",x);o.value=x;sel.append(o);});renderSimpleCatalog(key);}
    catch(e){root.textContent="تعذر تحميل بيانات هذا القسم حاليًا.";}
  }
  Object.entries(simpleCatalogs).forEach(([key,cfg])=>[cfg.search,cfg.category,cfg.sort].forEach(id=>document.getElementById(id).addEventListener(id===cfg.search?"input":"change",()=>renderSimpleCatalog(key))));

  const genericCatalogs={spareParts:{file:"spare-parts.json",id:"sparePartsCatalog"},services:{file:"services.json",id:"servicesCatalog"},personalCare:{file:"personal-care.json",id:"personalCareCatalog"},sports:{file:"sports.json",id:"sportsCatalog"},electrical:{file:"electrical.json",id:"electricalCatalog"},tools:{file:"tools.json",id:"toolsCatalog"},pets:{file:"pets.json",id:"petsCatalog"},plants:{file:"plants.json",id:"plantsCatalog"},telecom:{file:"telecom.json",id:"telecomCatalog"},travel:{file:"travel.json",id:"travelCatalog"},stocks:{file:"stocks.json",id:"stocksCatalog"},electronics:{file:"electronics.json",id:"electronicsCatalog"}};
  const genericData={};
  function renderGenericCatalog(key){
    const cfg=genericCatalogs[key],data=genericData[key];if(!data)return;
    const root=document.getElementById(cfg.id+"Products"),q=normalize(document.getElementById(cfg.id+"Search").value||""),cat=document.getElementById(cfg.id+"Category").value,sort=document.getElementById(cfg.id+"Sort").value;
    const rows=data.products.filter(x=>(!cat||x.category===cat)&&(!q||normalize([x.name,x.brand,x.category].join(" ")).includes(q)));
    rows.sort((a,b)=>sort==="price"?((a.price??Infinity)-(b.price??Infinity)):a.name.localeCompare(b.name,"ar"));root.replaceChildren();
    rows.forEach(x=>{const card=element("article","book-card");card.append(element("span","book-category",[x.brand,x.category].filter(Boolean).join(" · ")),element("h3","",x.name),element("p","book-price",x.price==null?"السعر غير منشور أو لم يتم التحقق منه":Number(x.price).toLocaleString("en-US")+" جنيه"),element("p","book-store",x.merchant?"المتجر: "+x.merchant:"راجع المصدر لمعرفة جهة البيع"),element("small","book-date","آخر رصد: "+(x.checkedAt||"غير محدد")));if(x.source){const a=element("a","book-source","عرض المصدر");a.href=x.source;a.target="_blank";a.rel="noopener noreferrer";card.append(a);}root.append(card);});
    document.getElementById(cfg.id+"Count").textContent="عرض "+rows.length+" من "+data.products.length+" منتجًا";if(!rows.length)root.append(element("p","catalog-footnote","لا توجد نتائج مطابقة."));
  }
  async function loadGenericCatalog(key){
    const cfg=genericCatalogs[key],root=document.getElementById(cfg.id+"Products");if(genericData[key])return renderGenericCatalog(key);
    try{const r=await fetch("./"+cfg.file,{cache:"no-cache"});if(!r.ok)throw new Error();genericData[key]=await r.json();const sel=document.getElementById(cfg.id+"Category");[...new Set(genericData[key].products.map(x=>x.category))].sort().forEach(x=>{const o=element("option","",x);o.value=x;sel.append(o);});renderGenericCatalog(key);}
    catch(e){root.textContent="تعذر تحميل بيانات القسم.";}
  }
  Object.entries(genericCatalogs).forEach(([key,cfg])=>[cfg.id+"Search",cfg.id+"Category",cfg.id+"Sort"].forEach(id=>document.getElementById(id).addEventListener(id.endsWith("Search")?"input":"change",()=>renderGenericCatalog(key))));

})();
