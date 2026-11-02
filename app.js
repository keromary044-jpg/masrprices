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
      if(Array.isArray(phone.priceOffers) && phone.priceOffers.length){const offers=element("details","phone-offers");offers.append(element("summary","","مقارنة الأسعار ("+phone.priceOffers.length+" عروض مرصودة)"));phone.priceOffers.forEach(offer=>{const row=element("p","phone-offer",offer.merchant+" — "+offer.priceEGP.toLocaleString("en-US")+" جنيه · "+offer.variant);const link=element("a","","المصدر");link.href=offer.source;link.target="_blank";link.rel="noopener noreferrer";row.append(" ",link);offers.append(row);});article.append(offers);}
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
      if (opening) {
        panel.hidden=false;
        card.setAttribute("aria-expanded","true");
        const title=normalize(getTitle(card));
        if (title.includes("موبايلات") || title.includes("الكترونيات")) {
          panel.hidden=true;
          if (phoneCatalog) { phoneCatalog.hidden=false; loadPhones(); phoneCatalog.scrollIntoView({behavior:"smooth",block:"start"}); }
        } else if (title.includes("كتب") || title.includes("روايات")) {
          panel.hidden=true;
          if (bookCatalog) { bookCatalog.hidden=false; bookCatalog.scrollIntoView({behavior:"smooth",block:"start"}); }
        }
      }
    });
    card.addEventListener("keydown",event => {
      if(event.key==="Enter" || event.key===" ") { event.preventDefault(); card.click(); }
    });
  });

  if(searchInput) {
    searchInput.addEventListener("input",() => {
      const term=normalize(searchInput.value);
      let count=0;
      cards.forEach(card => {
        const match=!term || normalize(card.textContent+" "+(card.dataset.search||"")).includes(term);
        card.hidden=!match; panels.get(card).hidden=true;
        card.setAttribute("aria-expanded","false");
        if(match) count++;
      });
      if(noResults) noResults.hidden=count>0;
      if(phoneCatalog) phoneCatalog.hidden=true;
      const bookCatalog=document.getElementById("bookCatalog"); if(bookCatalog) bookCatalog.hidden=true;
    });
  }


  let bookData = null;
  function renderBooks(data) {
    const container=document.getElementById("bookProducts");
    if(!container) return;
    const query=normalize(document.getElementById("bookSearch")?.value || "");
    const category=document.getElementById("bookCategory")?.value || "";
    const grade=document.getElementById("bookGrade")?.value || "";
    const sort=document.getElementById("bookSort")?.value || "name";
    const items=data.products.filter(book=>(!category || book.category===category) && (!grade || book.grade===grade) && (!query || normalize([book.title,book.author,book.category,book.merchant,book.grade,book.subject,book.series].join(" ")).includes(query)));
    items.sort((a,b)=>sort==="price" ? a.price-b.price : a.title.localeCompare(b.title,"ar"));
    container.replaceChildren();
    items.forEach(book=>{
      const card=element("article","book-card");
      card.append(element("span","book-category",book.category));
      card.append(element("h3","",book.title));
      if(book.author) card.append(element("p","book-author","المؤلف: "+book.author));
      card.append(element("p","book-price",book.category==="كتب الوزارة" ? "مجاني – من موقع الوزارة" : book.price.toLocaleString("en-US")+" جنيه"));
      card.append(element("p","book-store","المتجر: "+book.merchant));
      card.append(element("small","book-date","آخر رصد: "+book.checkedAt));
      const link=element("a","book-source","راجع السعر لدى المتجر");
      link.href=book.source;link.target="_blank";link.rel="noopener noreferrer";
      card.append(link);
      if(book.legalPdfUrl){const pdf=element("a","book-pdf",book.category==="كتب الوزارة" ? "فتح مكتبة الوزارة وتحميل الكتاب" : "تحميل PDF قانوني");pdf.href=book.legalPdfUrl;pdf.target="_blank";pdf.rel="noopener noreferrer";card.append(pdf);}else{card.append(element("small","book-pdf-unavailable",book.pdfStatus || "لا يتوفر ملف PDF مرخّص"));}
      container.append(card);
    });
    const count=document.getElementById("bookCount");
    if(count) count.textContent="عرض "+items.length+" من "+data.products.length+" كتابًا";
    if(!items.length) container.append(element("p","catalog-footnote","لا توجد كتب مطابقة. جرّب كلمة بحث أخرى."));
  }
  async function loadBooks() {
    const container=document.getElementById("bookProducts");
    if(!container) return;
    try {
      const response=await fetch("./books.json",{cache:"no-cache"});
      if(!response.ok) throw new Error("books data unavailable");
      bookData=await response.json();
      const select=document.getElementById("bookCategory");
      const gradeSelect=document.getElementById("bookGrade");
      [...new Set(bookData.products.map(book=>book.grade).filter(Boolean))].sort().forEach(grade=>{const option=element("option","",grade);option.value=grade;gradeSelect.append(option);});
      [...new Set(bookData.products.map(book=>book.category))].sort().forEach(category=>{
        const option=element("option","",category);option.value=category;select.append(option);
      });
      renderBooks(bookData);
    } catch(error) {
      container.textContent="تعذر تحميل قائمة الكتب حاليًا.";
      console.error(error);
    }
  }
  ["bookSearch","bookCategory","bookGrade","bookSort"].forEach(id=>{
    const control=document.getElementById(id);
    if(control) control.addEventListener(id==="bookSearch"?"input":"change",()=>{if(bookData)renderBooks(bookData);});
  });
  loadBooks();


  let constructionData=null;
  function renderConstruction(data){
    const container=document.getElementById("constructionProducts");if(!container)return;
    const q=normalize(document.getElementById("constructionSearch")?.value||"");
    const cat=document.getElementById("constructionCategory")?.value||"";
    const sort=document.getElementById("constructionSort")?.value||"name";
    const rows=data.products.filter(x=>(!cat||x.category===cat)&&(!q||normalize([x.name,x.category,x.spec,x.unit].join(" ")).includes(q)));
    rows.sort((a,b)=>sort==="price"?a.price-b.price:a.name.localeCompare(b.name,"ar"));
    container.replaceChildren();
    rows.forEach(x=>{const card=element("article","book-card");card.append(element("span","book-category",x.category));card.append(element("h3","",x.name));card.append(element("p","book-price",x.price.toLocaleString("en-US")+" جنيه / "+x.unit));card.append(element("p","",x.spec));card.append(element("small","book-date","آخر رصد: "+x.checkedAt+" · "+data.region));const link=element("a","book-source","تفاصيل المصدر");link.href=data.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);container.append(card);});
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
})();