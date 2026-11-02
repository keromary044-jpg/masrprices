"use strict";

(function () {
  const searchInput = document.getElementById("searchInput");
  const cards = Array.from(document.querySelectorAll(".category-card"));
  const noResults = document.getElementById("noResults");
  const phoneCatalog = document.getElementById("phoneCatalog");
  const phoneProducts = document.getElementById("phoneProducts");
  let phoneData = null;\n  let modelIndexData = null;

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
      article.dataset.search = normalize([phone.brand,phone.name,phone.category,phone.processor,phone.memory].join(" "));\n      article.append(element("h3", "phone-name", phone.name));
      article.append(element("p", "phone-price", "السعر في مصر: لم يُتحقق منه بعد"));
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
      modelIndexData = index;\n      const brandFilter = document.getElementById("phoneBrandFilter");\n      index.brands.forEach(brand => {\n        if (brandFilter) { const option=element("option","",brand.brand); option.value=brand.brand; brandFilter.append(option); }
        const group = element("div", "model-brand-group");
        group.dataset.brand = brand.brand;\n        group.dataset.search = normalize(brand.brand + " " + brand.models.join(" "));\n        group.append(element("h4", "", brand.brand + " (" + brand.models.length + " موديل)"));
        const link = element("a", "", "صفحة الشركة الرسمية");
        link.href = brand.source; link.target = "_blank"; link.rel = "noopener noreferrer";
        group.append(link);
        const list = element("ul", "model-name-list");
        brand.models.forEach(name => list.append(element("li", "", name)));
        group.append(list);
        section.append(group);
      });
      phoneCatalog.append(section);\n      applyPhoneFilters();
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

\n  function applyPhoneFilters() {\n    const query=normalize(document.getElementById("phoneSearch")?.value || "");\n    const brand=document.getElementById("phoneBrandFilter")?.value || "";\n    const sort=document.getElementById("phoneSort")?.value || "name";\n    const productCards=Array.from(phoneProducts?.querySelectorAll(".phone-card") || []);\n    let visible=0;\n    productCards.forEach(card=>{const show=(!query || card.dataset.search.includes(query)) && (!brand || card.querySelector(".phone-brand")?.textContent===brand);card.hidden=!show;if(show)visible++;});\n    const groups=Array.from(document.querySelectorAll("#officialModelIndex .model-brand-group"));\n    groups.forEach(group=>{const show=(!brand || group.dataset.brand===brand) && (!query || group.dataset.search.includes(query));group.hidden=!show;const list=group.querySelector(".model-name-list");if(list){Array.from(list.children).forEach(item=>item.hidden=!!query && !item.dataset.search.includes(query));}});\n    if(sort==="brand" && phoneProducts){productCards.sort((a,b)=>(a.querySelector(".phone-brand")?.textContent||"").localeCompare(b.querySelector(".phone-brand")?.textContent||""));productCards.forEach(card=>phoneProducts.append(card));}\n    const totalModels=(modelIndexData?.brands||[]).reduce((n,b)=>n+b.models.length,0);\n    const modelVisible=groups.filter(g=>!g.hidden).reduce((n,g)=>n+g.querySelectorAll(".model-name-list li:not([hidden])").length,0);\n    const count=document.getElementById("phoneResultCount");\n    if(count) count.textContent="المواصفات التفصيلية: "+visible+" من "+productCards.length+" • فهرس الموديلات: "+modelVisible+" من "+totalModels;\n  }\n\n  ["phoneSearch","phoneBrandFilter","phoneSort"].forEach(id=>{const control=document.getElementById(id);if(control){control.addEventListener(id==="phoneSearch"?"input":"change",applyPhoneFilters);}});\n\n  const panels = new Map();
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
      if (opening) {
        panel.hidden=false;
        card.setAttribute("aria-expanded","true");
        if (normalize(getTitle(card)).includes("موبايلات") || normalize(getTitle(card)).includes("الكترونيات")) {
          panel.hidden=true;
          if (phoneCatalog) {
            phoneCatalog.hidden=false;
            loadPhones();
            phoneCatalog.scrollIntoView({behavior:"smooth",block:"start"});
          }
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
    });
  }

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