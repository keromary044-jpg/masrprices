"use strict";

(function () {
  const searchInput = document.getElementById("searchInput");
  const cards = Array.from(document.querySelectorAll(".category-card"));
  const noResults = document.getElementById("noResults");
  const clearSearchButton = document.getElementById("clearSearch");
  const categoryCount = document.getElementById("categoryCount");
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
  function updateCategoryCount(){
    if(!categoryCount)return;
    const visible=cards.filter(card=>!card.hidden).length;
    categoryCount.textContent=searchInput&&searchInput.value.trim()?("الأقسام المطابقة: "+visible):("عدد الأقسام: "+cards.length);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  let activeBudgetSection=null;
  function attachBudgetTool(section){
    if(!section)return;
    if(activeBudgetSection&&activeBudgetSection!==section){
      activeBudgetSection.querySelector(".budget-fab")?.remove();
      activeBudgetSection.querySelector(".budget-panel")?.remove();
    }
    activeBudgetSection=section;
    if(section.querySelector(".budget-fab"))return;

    const fab=element("button","budget-fab","ميزانيتي");
    fab.type="button";
    fab.setAttribute("aria-label","ابحث عن المنتجات حسب ميزانيتك");
    fab.setAttribute("aria-expanded","false");

    const panel=element("form","budget-panel");
    panel.hidden=true;
    panel.append(
      element("strong","","ابحث حسب ميزانيتك"),
      element("p","budget-hint","اكتب أقصى مبلغ بالجنيه، وسنعرض المنتجات التي لها سعر رقمي مسجل داخل القسم الحالي فقط.")
    );
    const input=element("input","budget-input");
    input.type="number";
    input.min="1";
    input.step="1";
    input.inputMode="numeric";
    input.placeholder="مثال: 10000";
    input.required=true;
    input.setAttribute("aria-label","الحد الأقصى للميزانية بالجنيه");
    const actions=element("div","budget-actions");
    const apply=element("button","budget-apply","اعرض النتائج");
    const clear=element("button","budget-clear","إلغاء التصفية");
    apply.type="submit";
    clear.type="button";
    actions.append(apply,clear);
    const status=element("p","budget-status","أدخل الميزانية ثم اضغط اعرض النتائج.");
    status.setAttribute("aria-live","polite");
    panel.append(input,actions,status);

    function productCards(){
      return Array.from(section.querySelectorAll("article"));
    }
    function priceOf(card){
      const node=card.querySelector(".phone-price,.book-price,.generic-price-available,.property-price,.appliance-price,[data-price]");
      if(!node)return null;
      const raw=node.getAttribute("data-price")||node.textContent||"";
      const digits=String(raw)
        .replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
        .replace(/[۰-۹]/g,d=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
        .replace(/[٬،]/g,",")
        .replace(/٫/g,".");
      const match=digits.match(/\d[\d,]*(?:\.\d+)?/);
      if(!match)return null;
      const amount=Number(match[0].replace(/,/g,""));
      return Number.isFinite(amount)&&amount>0?amount:null;
    }
    function applyBudget(){
      const raw=input.value.trim();
      const max=raw===""?NaN:Number(raw);
      if(!Number.isFinite(max)||max<=0){
        status.textContent="من فضلك اكتب مبلغًا صحيحًا أكبر من صفر.";
        input.focus();
        return;
      }
      const cards=productCards();
      let shown=0,priced=0,unpriced=0;
      cards.forEach(card=>{
        const price=priceOf(card);
        if(price===null){unpriced++;card.classList.add("budget-hidden");return;}
        priced++;
        const match=price<=max;
        card.classList.toggle("budget-hidden",!match);
        if(match)shown++;
      });
      status.textContent=shown
        ? "وجدنا "+shown+" منتج ضمن ميزانيتك من "+priced+" منتج له سعر مسجل"+(unpriced?"، وهناك "+unpriced+" بدون سعر رقمي.":"." )
        : "لا توجد منتجات بسعر مسجل ضمن هذا المبلغ. جرّب ميزانية أعلى."+(unpriced?" يوجد أيضًا "+unpriced+" منتج بدون سعر رقمي.":"");
    }
    fab.addEventListener("click",()=>{
      panel.hidden=!panel.hidden;
      fab.setAttribute("aria-expanded",String(!panel.hidden));
      if(!panel.hidden)input.focus();
    });
    panel.addEventListener("submit",event=>{
      event.preventDefault();
      applyBudget();
    });
    clear.addEventListener("click",()=>{
      productCards().forEach(card=>card.classList.remove("budget-hidden"));
      input.value="";
      status.textContent="تم إلغاء تصفية الميزانية وعرض المنتجات مرة أخرى.";
    });
    section.append(fab,panel);

    if(typeof MutationObserver!=="undefined"){
      const observer=new MutationObserver(()=>{
        if(!panel.hidden&&input.value.trim()&&Number(input.value)>0)applyBudget();
      });
      observer.observe(section,{childList:true,subtree:true});
    }
  }

  function xmlText(value){
    return String(value||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[ch]));
  }
  function productIllustration(item){
    const name=String(item?.name||item?.title||"منتج").slice(0,34);
    const category=String(item?.category||item?.brand||"MasrPrices").slice(0,24);
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eaf1f8"/><stop offset="1" stop-color="#d6e2ef"/></linearGradient></defs><rect width="640" height="420" rx="28" fill="url(#g)"/><circle cx="320" cy="150" r="82" fill="#fff" opacity=".85"/><path d="M276 178V124q0-12 12-12h64q12 0 12 12v54q0 12-12 12h-64q-12 0-12-12Z" fill="#173d68"/><path d="M296 132h48M296 146h48M296 160h30" stroke="#fff" stroke-width="7" stroke-linecap="round"/><text x="320" y="292" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="#102b50">'+xmlText(name)+'</text><text x="320" y="332" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#65758b">'+xmlText(category)+'</text><text x="320" y="378" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" fill="#8b3b42">رسم تعريفي مؤقت — ليس صورة المنتج</text></svg>';
    return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg);
  }

  // Device-local account, favorites, price targets and product feedback.
  const mpStore={
    read(key,fallback){try{return JSON.parse(localStorage.getItem("mp:"+key)||"null")??fallback;}catch{return fallback;}},
    write(key,value){try{localStorage.setItem("mp:"+key,JSON.stringify(value));return true;}catch{return false;}}
  };
  const mpId=item=>stableProductId(item)||normalize(item?.name||item?.title||"منتج").replace(/\\s+/g,"-").slice(0,120);
  function mpEnsurePanel(){
    if(document.getElementById("mpSavedPanel"))return;
    const fab=element("button","mp-saved-fab","المحفوظات");
    fab.type="button";fab.setAttribute("aria-expanded","false");
    const panel=element("aside","mp-saved-panel");panel.id="mpSavedPanel";panel.hidden=true;
    panel.append(element("h3","","محفوظاتي على هذا الجهاز"));
    const profile=element("div","mp-profile");
    const nickname=element("input","");nickname.type="text";nickname.maxLength=30;nickname.placeholder="اسم عرض اختياري";nickname.value=mpStore.read("nickname","");
    const saveName=element("button","mp-action","حفظ الاسم");saveName.type="button";
    saveName.addEventListener("click",()=>{mpStore.write("nickname",nickname.value.trim());saveName.textContent="تم الحفظ";});
    profile.append(nickname,saveName);
    const list=element("div","mp-saved-list");list.id="mpSavedList";
    const privacy=element("button","mp-action","تغيير اختيار الإعلانات");privacy.type="button";privacy.addEventListener("click",()=>{try{localStorage.removeItem("mp:ad-consent");}catch{}location.reload();});
    panel.append(profile,list,privacy,element("p","catalog-footnote","المحفوظات والاسم محفوظة على هذا الجهاز فقط، ولا تنشئ حسابًا سحابيًا."));
    fab.addEventListener("click",()=>{panel.hidden=!panel.hidden;fab.setAttribute("aria-expanded",String(!panel.hidden));mpRenderSaved();});
    document.body.append(fab,panel);
    mpRenderSaved();
  }
  function mpRenderSaved(){
    const root=document.getElementById("mpSavedList");if(!root)return;
    const favs=mpStore.read("favorites",[]),alerts=mpStore.read("alerts",[]);
    root.replaceChildren();
    if(!favs.length&&!alerts.length){root.append(element("p","catalog-footnote","لم تحفظ أي منتج بعد."));return;}
    favs.forEach(x=>{const row=element("p","mp-saved-row", "★ "+x.name);root.append(row);});
    alerts.forEach(x=>{const row=element("p","mp-saved-row","تنبيه: "+x.name+" عند "+Number(x.target).toLocaleString("en-US")+" جنيه أو أقل");root.append(row);});
  }
  function mpAttachProductTools(card,item){
    if(!item||card.dataset.mpTools)return;card.dataset.mpTools="1";
    const id=mpId(item),name=String(item.name||item.title||"منتج").slice(0,180);
    const actions=element("div","mp-product-actions");
    const fav=element("button","mp-action","☆ حفظ");fav.type="button";
    const updateFav=()=>{const rows=mpStore.read("favorites",[]);fav.textContent=rows.some(x=>x.id===id)?"★ محفوظ":"☆ حفظ";};
    updateFav();
    fav.addEventListener("click",()=>{let rows=mpStore.read("favorites",[]);rows=rows.some(x=>x.id===id)?rows.filter(x=>x.id!==id):[...rows,{id,name}];mpStore.write("favorites",rows);updateFav();mpRenderSaved();});
    const alert=element("button","mp-action","تنبيه سعر");alert.type="button";
    alert.addEventListener("click",()=>{
      const current=Number(item.priceEGP??item.price);
      const existing=mpStore.read("alerts",[]).find(x=>x.id===id);
      const target=prompt("اكتب السعر المستهدف بالجنيه. سننبهك عند فتح الموقع إذا ظهر سعر مسجل يساويه أو يقل عنه.",existing?String(existing.target):current>0?String(Math.floor(current*.95)):"");
      if(target===null)return;const amount=Number(target);
      if(!Number.isFinite(amount)||amount<=0){alert.textContent="سعر غير صالح";return;}
      const rows=mpStore.read("alerts",[]).filter(x=>x.id!==id);rows.push({id,name,target:amount,lastNotified:""});
      mpStore.write("alerts",rows);alert.textContent="تم ضبط التنبيه";mpRenderSaved();
    });
    const review=element("button","mp-action","تقييم على جهازي");review.type="button";
    review.addEventListener("click",()=>{
      const current=mpStore.read("reviews",{})[id]||{};
      const rating=prompt("قيّم المنتج من 1 إلى 5 نجوم (تقييم محفوظ على جهازك فقط):",String(current.rating||5));
      if(rating===null)return;const n=Number(rating);
      if(!Number.isInteger(n)||n<1||n>5){review.textContent="تقييم غير صالح";return;}
      const note=prompt("ملاحظة اختيارية قصيرة (لن تُنشر للآخرين):",current.note||"");
      const all=mpStore.read("reviews",{});all[id]={rating:n,note:String(note||"").slice(0,300),updatedAt:new Date().toISOString()};mpStore.write("reviews",all);
      review.textContent="تقييمك: "+"★".repeat(n);review.title="تقييم خاص بهذا الجهاز فقط";
    });
    actions.append(fav,alert,review);card.append(actions);
    const alerts=mpStore.read("alerts",[]),price=Number(item.priceEGP??item.price);
    if(Number.isFinite(price)&&price>0){
      const match=alerts.find(x=>x.id===id&&price<=Number(x.target)&&x.lastNotified!==String(price));
      if(match){const notice=element("p","mp-alert-hit","وصل السعر المسجل إلى "+price.toLocaleString("en-US")+" جنيه — أقل من هدفك.");card.append(notice);match.lastNotified=String(price);mpStore.write("alerts",alerts);}
    }
  }
  function mpInitConsent(){
    const key="mp:ad-consent";let choice=null;try{choice=localStorage.getItem(key);}catch{}
    const loadAds=()=>{if(document.querySelector('script[data-mp-ads]'))return;const s=document.createElement("script");s.async=true;s.crossOrigin="anonymous";s.dataset.mpAds="1";s.src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7745184141725915";document.head.append(s);};
    if(choice==="accepted"){loadAds();return;}
    if(choice==="rejected")return;
    const box=element("section","mp-consent");box.setAttribute("aria-label","اختيارات الإعلانات");
    box.append(element("strong","","اختيارات الإعلانات والخصوصية"),element("p","","يمكنك السماح بتحميل إعلانات Google أو رفضها. اختيارك محفوظ على هذا الجهاز ويمكن تغييره لاحقًا."));
    const yes=element("button","mp-action","السماح بالإعلانات"),no=element("button","mp-action","رفض الإعلانات");
    yes.type=no.type="button";
    yes.addEventListener("click",()=>{try{localStorage.setItem(key,"accepted");}catch{}box.remove();loadAds();});
    no.addEventListener("click",()=>{try{localStorage.setItem(key,"rejected");}catch{}box.remove();});
    box.append(yes,no);document.body.append(box);
  }
  mpEnsurePanel();
  mpInitConsent();

  function appendProductVisual(card,item){
    const wrap=element("div","catalog-image-wrap");
    const image=element("img","catalog-product-image");
    const realUrl=item?.image||item?.imageUrl||item?.image_url||item?.coverImage||"";
    const fallback=productIllustration(item);
    image.alt="صورة "+String(item?.name||item?.title||"المنتج");
    image.loading="lazy";image.decoding="async";image.referrerPolicy="no-referrer";
    image.src=/^https:\/\//i.test(realUrl)?realUrl:fallback;
    if(!/^https:\/\//i.test(realUrl))wrap.append(element("span","catalog-image-label","رسم تعريفي مؤقت"));
    image.onerror=()=>{if(image.src!==fallback){image.src=fallback;wrap.replaceChildren(element("span","catalog-image-label","رسم تعريفي مؤقت"));}};
    wrap.append(image);card.append(wrap);
    mpAttachProductTools(card,item);
  }
  // Ensure every product card in every catalogue has at least an honest illustrative image.
  function ensureCatalogueImages(root=document){
    const selector='[id$="Products"] article,[id$="Catalog"] article,.book-grid article,.phone-grid article,.product-grid article,.catalog-grid article,.market-grid article';
    const candidates=[];
    if(root.matches?.(selector))candidates.push(root);
    if(root.querySelectorAll)candidates.push(...root.querySelectorAll(selector));
    candidates.forEach(card=>{
      if(card.querySelector(".catalog-image-wrap")||!card.querySelector("h3,strong"))return;
      const title=card.querySelector("h3,strong")?.textContent?.trim()||"منتج";
      const item={name:title,category:card.closest("[id$='Catalog']")?.querySelector("h2")?.textContent?.trim()||"MasrPrices"};
      const wrap=element("div","catalog-image-wrap");
      const image=element("img","catalog-product-image");
      image.alt="رسم توضيحي لـ "+title;
      image.loading="lazy";image.decoding="async";
      image.src=productIllustration(item);
      wrap.append(element("span","catalog-image-label","رسم توضيحي — ليس صورة حقيقية"),image);
      card.prepend(wrap);
    });
  }
  ensureCatalogueImages();
  if(typeof MutationObserver!=="undefined"){
    const catalogueImageObserver=new MutationObserver(records=>{
      records.forEach(record=>record.addedNodes.forEach(node=>{
        if(node.nodeType===1)ensureCatalogueImages(node);
      }));
    });
    catalogueImageObserver.observe(document.body,{childList:true,subtree:true});
  }

  function catalogPriceExists(item){
    const p=Number(item?.priceEGP??item?.price);
    return (Number.isFinite(p)&&p>0)||(Number.isFinite(Number(item?.priceFrom))&&Number(item.priceFrom)>0);
  }
  function updateCatalogMetrics(target,data,visible){
    if(!target)return;
    const all=Array.isArray(data)?data:[];
    const priced=all.filter(catalogPriceExists).length;
    const realImages=all.filter(x=>/^https:\/\//i.test(String(x?.image||x?.imageUrl||x?.image_url||x?.coverImage||""))).length;
    target.textContent="عرض "+visible+" من "+all.length+" عنصرًا · أسعار مسجلة: "+priced+" · صور منتجات فعلية: "+realImages+" · الباقي يحتاج استكمالًا موثقًا";
  }


  function stableProductId(product){
    if(product && product.id) return String(product.id);
    const raw=[product?.brand,product?.name,product?.modelYear,product?.model,product?.variant,product?.size].filter(Boolean).join("-");
    return raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\u0600-\u06ff]+/g,"-").replace(/^-|-$/g,"").slice(0,120);
  }
  const popularStores=["Amazon.eg","Jumia","Carrefour","B.TECH","2B","Raneen","Noon","Dream2000","Raya","Tradeline","Sharaf DG","Compume","Sigma Computer","Elaraby Group","Samsung Shop","Xiaomi Store","OPPO Egypt","Huawei Egypt"];
  function normalizeOffer(raw){
    const price=Number(raw.priceEGP??raw.price_egp??raw.price);
    const merchant=String(raw.merchant??raw.store_name??"").trim();
    const source=String(raw.source??raw.product_url??"").trim();
    if(!merchant||!Number.isFinite(price)||price<=0)return null;
    return {merchant,price,source,sourceLabel:String(raw.sourceLabel??raw.source_name??""),checkedAt:String(raw.checkedAt??raw.checked_at??""),variant:String(raw.variant??"")};
  }
  function addStoreComparison(card,product,isPhone=false){
    const button=element("button","book-source compare-toggle","قارن المتاجر");
    button.type="button";
    const panel=element("section","offer-comparison store-comparison");panel.hidden=true;
    let offers=[];
    const addOffer=raw=>{const offer=normalizeOffer(raw);if(offer&&!offers.some(o=>o.merchant===offer.merchant&&o.price===offer.price&&o.variant===offer.variant))offers.push(offer);};
    (Array.isArray(product.priceOffers)?product.priceOffers:[]).forEach(addOffer);
    addOffer({merchant:product.merchant,priceEGP:isPhone?product.priceEGP:product.price,source:product.source,sourceLabel:product.priceSource||product.sourceLabel,checkedAt:product.priceCheckedAt||product.checkedAt,variant:product.variant||product.model});
    let loaded=false;
    function paint(selected){
      panel.replaceChildren();
      const sorted=[...offers].sort((a,b)=>a.price-b.price),best=sorted[0];
      const names=[...new Set(offers.map(o=>o.merchant))];
      panel.append(element("strong","store-comparison-title","اختر المتجر"),element("small","offer-count",offers.length?offers.length+" عروض مسجلة":"لا توجد عروض متعددة موثقة بعد"));
      const choices=element("div","store-choices");
      names.forEach(name=>{
        const found=offers.filter(o=>o.merchant.toLocaleLowerCase()===name.toLocaleLowerCase()).sort((a,b)=>a.price-b.price);
        const cheapest=found.length&&best&&found[0].price===best.price;
        const choice=element("button","store-choice"+(selected===name?" is-selected":"")+(cheapest?" is-cheapest":""),name+(cheapest?" ★":""));
        choice.type="button";choice.setAttribute("aria-pressed",String(selected===name));choice.addEventListener("click",()=>paint(name));choices.append(choice);
      });
      panel.append(choices);
      const matches=offers.filter(o=>o.merchant.toLocaleLowerCase()===String(selected||"").toLocaleLowerCase()).sort((a,b)=>a.price-b.price);
      if(!offers.length)panel.append(element("p","store-no-price","لا توجد عروض موثقة لهذا المنتج حتى الآن. لن نعرض متاجر أو أسعارًا غير مؤكدة."));
      else if(!selected)panel.append(element("p","store-no-price","اختار متجرًا لعرض السعر المسجل لديه."));
      else if(!matches.length)panel.append(element("p","store-no-price","لا يوجد سعر موثّق لهذا المنتج لدى "+selected+" حاليًا."));
      else matches.forEach(offer=>{
        const row=element("article","store-price-row"+(best&&offer.price===best.price?" is-best":""));
        const details=element("div","store-price-details");details.append(element("strong","",offer.merchant));
        if(offer.variant)details.append(element("small","offer-variant",offer.variant));
        if(offer.sourceLabel||offer.checkedAt)details.append(element("small","offer-variant",[offer.sourceLabel,offer.checkedAt].filter(Boolean).join(" · ")));
        row.append(details,element("strong","offer-price",offer.price.toLocaleString("en-US")+" جنيه"));
        if(best&&offer.price===best.price)row.append(element("span","best-store-star","★ أقل سعر"));
        if(offer.source){
          try{
            const sourceUrl=new URL(offer.source);
            if(sourceUrl.protocol==="https:"){
              const link=element("a","offer-source-link","زيارة العرض لدى المتجر");
              link.href=sourceUrl.href;link.target="_blank";link.rel="noopener noreferrer nofollow";
              row.append(link);
            }
          }catch(_error){/* Ignore malformed source URLs. */}
        }
        panel.append(row);
      });
      if(best){
        const highest=sorted[sorted.length-1];
        panel.append(element("p","offer-savings","أقل سعر موثّق: "+best.merchant+" — "+best.price.toLocaleString("en-US")+" جنيه"));
        if(highest&&highest.price>best.price){
          panel.append(element("p","offer-savings-difference","توفير محتمل "+(highest.price-best.price).toLocaleString("en-US")+" جنيه مقارنة بأعلى عرض مسجل."));
        }
      }
      panel.append(element("small","offer-disclaimer","الأسعار حسب آخر رصد موضح، وقد تتغير لدى المتجر."));
    }
    button.addEventListener("click",async()=>{
      panel.hidden=!panel.hidden;if(panel.hidden)return;
      paint(offers.length?[...offers].sort((a,b)=>a.price-b.price)[0].merchant:"");
      if(loaded)return;loaded=true;
      const id=stableProductId(product);if(!id)return;
      try{const response=await fetch("./api/compare?product_id="+encodeURIComponent(id),{cache:"no-store"});const data=await response.json();if(response.ok&&Array.isArray(data.offers))data.offers.forEach(addOffer);paint(offers.length?[...offers].sort((a,b)=>a.price-b.price)[0].merchant:"");}
      catch(_error){/* Keep local offers visible if the comparison service is unavailable. */}
    });
    card.append(button,panel);
  }

  function addDatabaseComparison(card, product){ addStoreComparison(card,product,false); }
  function renderPhones(data) {
    if (!phoneProducts) return;
    phoneProducts.replaceChildren();
    data.products.forEach(phone => {
      const article = element("article", "phone-card");
      const top = element("div", "phone-card-top");
      top.append(element("span", "phone-brand", phone.brand), element("span", "phone-category", phone.category));
      article.append(top);
      appendProductVisual(article,phone);
      article.dataset.search = normalize([phone.brand,phone.name,phone.category,phone.processor,phone.memory].join(" "));
      article.append(element("h3", "phone-name", phone.name));
      if(Number(phone.priceEGP)>0){
        const status=String(phone.priceStatus||"");
        const isReference=/(تاريخي|تاريخيًا|تقديري|تقريبي|إعلان فردي|ليس سعر بيع حالي|ليس عرض متجر|غير متاح في مصر|ملغى|مرجع سعري)/.test(status);
        const priceLine=element("p","phone-price",(isReference?"مرجع سعري: ":"السعر في مصر: ")+phone.priceEGP.toLocaleString("en-US")+" جنيه");
        priceLine.dataset.price=String(phone.priceEGP);
        article.append(priceLine);
        article.append(element("small","phone-price-source",(phone.priceSource || "مصدر السعر")+" · "+(phone.priceCheckedAt || "تاريخ الرصد غير محدد")));
        if(status) article.append(element("small","phone-price-status",status));
      } else {
        article.append(element("p","phone-price phone-price-unavailable","السعر غير متاح حاليًا"));
        article.append(element("small","phone-price-source","لم نعثر على عرض موثّق لهذا الموديل. لن نعرض سعرًا تقديريًا على أنه سعر حقيقي."));
      }
      addStoreComparison(article,phone,true);
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
      const source=element("a","phone-source","راجع صفحة الشركة للتحقق من الموديل");
      source.href=phone.source; source.target="_blank"; source.rel="noopener noreferrer";
      article.append(details,source);
      phoneProducts.append(article);
    });
  }

  let selectedPhoneBrand = "";
  let pendingPhoneQuery = "";
  function renderBrandPicker() {
    const root=document.getElementById("phoneBrandPicker");
    if(!root||!modelIndexData)return;
    root.replaceChildren();
    const products=Array.isArray(phoneData?.products)?phoneData.products:[];
    const availableBrands=modelIndexData.brands
      .map(brand=>({...brand, productCount:products.filter(p=>p.brand===brand.brand).length,
        pricedCount:products.filter(p=>p.brand===brand.brand&&catalogPriceExists(p)).length}))
      .filter(brand=>brand.productCount>0);
    root.append(element("h3","","اختار شركة الموبايل"));
    root.append(element("p","catalog-footnote","الشركات التي لديها موديلات مسجلة فقط. ابحث باسم الشركة أو الموبايل."));
    const search=element("input","brand-picker-search");
    search.type="search";search.id="phoneBrandSearch";search.placeholder="ابحث عن شركة أو موديل...";
    search.setAttribute("aria-label","البحث عن شركة أو موديل");
    root.append(search);
    const grid=element("div","phone-brand-grid");grid.id="phoneBrandGrid";
    availableBrands.forEach(brand=>{
      const button=element("button","phone-brand-tile");
      button.type="button";button.dataset.brand=brand.brand;
      button.append(element("span","brand-mark",brand.brand.slice(0,2).toUpperCase()));
      button.append(element("strong","brand-tile-name",brand.brand));
      button.append(element("small","brand-tile-count",brand.productCount+" موبايل"));
      button.append(element("small","brand-market-status",brand.pricedCount+" بأسعار مسجلة"));
      button.addEventListener("click",()=>{
        selectedPhoneBrand=brand.brand;
        const bar=document.getElementById("phoneSelectedBar");
        if(bar){
          bar.hidden=false;
          bar.replaceChildren(element("strong","","شركة "+brand.brand));
          const change=element("button","brand-change-button","تغيير الشركة");
          change.type="button";
          change.addEventListener("click",()=>{
            selectedPhoneBrand="";bar.hidden=true;
            const productsNode=document.getElementById("phoneProducts");
            if(productsNode)productsNode.hidden=true;
            const modelSection=document.getElementById("phoneModelSection");
            if(modelSection)modelSection.hidden=true;
            root.hidden=false;applyPhoneFilters();
          });
          bar.append(change);
        }
        root.hidden=true;
        const modelSection=document.getElementById("phoneModelSection");
        if(modelSection)modelSection.hidden=false;
        const productsNode=document.getElementById("phoneProducts");
        if(productsNode)productsNode.hidden=false;
        const empty=document.getElementById("phoneModelEmpty");
        const matches=products.filter(p=>p.brand===selectedPhoneBrand);
        if(empty){empty.hidden=matches.length>0;empty.textContent=matches.length?"":"لا توجد موديلات مسجلة لهذه الشركة.";}
        const q=document.getElementById("phoneSearch");
        if(q)q.value=pendingPhoneQuery;
        pendingPhoneQuery="";
        applyPhoneFilters();
        modelSection?.scrollIntoView({behavior:"smooth",block:"start"});
      });
      grid.append(button);
    });
    root.append(grid);
    function matchingBrands(query){
      const q=normalize(query);
      if(!q)return availableBrands;
      return availableBrands.filter(brand=>
        normalize(brand.brand).includes(q)||
        products.some(phone=>phone.brand===brand.brand&&normalize(phone.name).includes(q))
      );
    }
    function filterBrandChoices(){
      const matches=matchingBrands(search.value);
      const allowed=new Set(matches.map(x=>x.brand));
      grid.querySelectorAll(".phone-brand-tile").forEach(tile=>{tile.hidden=!allowed.has(tile.dataset.brand);});
      let status=root.querySelector(".brand-search-count");
      if(!status){status=element("p","brand-search-count");grid.after(status);}
      status.textContent=search.value.trim()?"عدد الشركات المطابقة: "+matches.length:"";
      return matches;
    }
    search.addEventListener("input",filterBrandChoices);
    search.addEventListener("keydown",event=>{
      if(event.key!=="Enter")return;
      const matches=filterBrandChoices();
      if(matches.length!==1)return;
      pendingPhoneQuery=normalize(search.value)===normalize(matches[0].brand)?"":search.value.trim();
      grid.querySelector('[data-brand="'+CSS.escape(matches[0].brand)+'"]')?.click();
    });
  }
  async function loadModelIndex() {
    if (!phoneCatalog || modelIndexData) return;
    try {
      const response=await fetch("./phone-model-index.json",{cache:"no-cache"});
      if(!response.ok)throw new Error("تعذر تحميل دليل الشركات");
      modelIndexData=await response.json();
      renderBrandPicker();
    } catch(error) { console.error(error); }
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
    const query=normalize(document.getElementById("phoneSearch")?.value||"");
    const sort=document.getElementById("phoneSort")?.value||"name";
    const productCards=Array.from(phoneProducts?.querySelectorAll(".phone-card")||[]);
    let visible=0;
    productCards.forEach(card=>{
      const show=!!selectedPhoneBrand&&card.querySelector(".phone-brand")?.textContent===selectedPhoneBrand&&(!query||card.dataset.search.includes(query));
      card.hidden=!show;if(show)visible++;
    });
    if(phoneProducts){
      productCards.sort((x,y)=>{
        if(sort==="price"){
          const px=Number(x.querySelector(".phone-price")?.dataset.price||0),py=Number(y.querySelector(".phone-price")?.dataset.price||0);
          return (px||Number.MAX_SAFE_INTEGER)-(py||Number.MAX_SAFE_INTEGER);
        }
        return (x.querySelector(".phone-name")?.textContent||"").localeCompare(y.querySelector(".phone-name")?.textContent||"","ar");
      });
      productCards.forEach(card=>phoneProducts.append(card));
    }
    const count=document.getElementById("phoneResultCount");
    if(count)count.textContent=selectedPhoneBrand?"موديلات "+selectedPhoneBrand+": "+visible+" موديل":"اختار شركة لعرض الموديلات";
    const empty=document.getElementById("phoneModelEmpty");
    if(empty&&selectedPhoneBrand){
      const exists=(phoneData?.products||[]).some(p=>p.brand===selectedPhoneBrand);
      empty.hidden=exists;
      if(!exists)empty.textContent="لم نسجل موديلات لهذه الشركة حتى الآن. اختر شركة أخرى أو تابع تحديثات الكتالوج.";
    }
  }
  ["phoneSearch","phoneSort"].forEach(id=>{const control=document.getElementById(id);if(control)control.addEventListener(id==="phoneSearch"?"input":"change",applyPhoneFilters);});

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
      ["householdCleaningCatalog","educationCostsCatalog","clothingCatalog","furnitureCatalog","personalCareCatalog","sportsCatalog","electricalCatalog","toolsCatalog","petsCatalog","plantsCatalog","telecomCatalog","travelCatalog","electronicsCatalog","medicinesCatalog","sparePartsCatalog","servicesCatalog","fuelCatalog","babyCatalog","goldRatesCatalog","silverRatesCatalog","currencyRatesCatalog","realEstateCatalog"].forEach(id=>{const node=document.getElementById(id);if(node)node.hidden=true;});
      if (opening) {
        panel.hidden=false;
        card.setAttribute("aria-expanded","true");
        const targetId=(card.getAttribute("href")||"").replace(/^#/,"");
        const openCatalog=(id,loader)=>{
          const section=document.getElementById(id);
          if(!section)return false;
          panel.hidden=true;
          section.hidden=false;
          attachBudgetTool(section);
          if(typeof loader==="function")loader();
          section.scrollIntoView({behavior:"smooth",block:"start"});
          return true;
        };
        const routes={
          computersCatalog:()=>openCatalog("computersCatalog",()=>loadGenericCatalog("computers")),
          printersCatalog:()=>openCatalog("printersCatalog",()=>loadGenericCatalog("printers")),
          gamingCatalog:()=>openCatalog("gamingCatalog",()=>loadGenericCatalog("gaming")),
          networkingCatalog:()=>openCatalog("networkingCatalog",()=>loadGenericCatalog("networking")),
          securityCamerasCatalog:()=>openCatalog("securityCamerasCatalog",()=>loadGenericCatalog("securityCameras")),
          solarCatalog:()=>openCatalog("solarCatalog",()=>loadGenericCatalog("solar")),
          tiresCatalog:()=>openCatalog("tiresCatalog",()=>loadGenericCatalog("tires")),
          carBatteriesCatalog:()=>openCatalog("carBatteriesCatalog",()=>loadGenericCatalog("carBatteries")),
          motorcyclesCatalog:()=>openCatalog("motorcyclesCatalog",()=>loadGenericCatalog("motorcycles")),
          carOilsCatalog:()=>openCatalog("carOilsCatalog",()=>loadGenericCatalog("carOils")),
          kitchenwareCatalog:()=>openCatalog("kitchenwareCatalog",()=>loadGenericCatalog("kitchenware")),
          mattressesCatalog:()=>openCatalog("mattressesCatalog",()=>loadGenericCatalog("mattresses")),
          bathroomCatalog:()=>openCatalog("bathroomCatalog",()=>loadGenericCatalog("bathroom")),
          eyewearCatalog:()=>openCatalog("eyewearCatalog",()=>loadGenericCatalog("eyewear")),
          watchesCatalog:()=>openCatalog("watchesCatalog",()=>loadGenericCatalog("watches")),
          bagsCatalog:()=>openCatalog("bagsCatalog",()=>loadGenericCatalog("bags")),
          perfumesCatalog:()=>openCatalog("perfumesCatalog",()=>loadGenericCatalog("perfumes")),
          maternityCatalog:()=>openCatalog("maternityCatalog",()=>loadGenericCatalog("maternity")),
          irrigationCatalog:()=>openCatalog("irrigationCatalog",()=>loadGenericCatalog("irrigation")),
          waterFiltersCatalog:()=>openCatalog("waterFiltersCatalog",()=>loadGenericCatalog("waterFilters")),
          homeMedicalCatalog:()=>openCatalog("homeMedicalCatalog",()=>loadGenericCatalog("homeMedical")),
          phoneCatalog:()=>openCatalog("phoneCatalog",loadPhones),
          bookCatalog:()=>openCatalog("bookCatalog"),
          constructionCatalog:()=>openCatalog("constructionCatalog"),
          carCatalog:()=>openCatalog("carCatalog",loadCars),
          applianceCatalog:()=>openCatalog("applianceCatalog",loadAppliances),
          groceryCatalog:()=>openCatalog("groceryCatalog",loadGroceries),
          householdCleaningCatalog:()=>openCatalog("householdCleaningCatalog",()=>loadGenericCatalog("householdCleaning")),
          stationeryCatalog:()=>openCatalog("stationeryCatalog",loadStationery),
          educationCostsCatalog:()=>openCatalog("educationCostsCatalog"),
          clothingCatalog:()=>openCatalog("clothingCatalog",()=>loadSimpleCatalog("clothing")),
          furnitureCatalog:()=>openCatalog("furnitureCatalog",()=>loadSimpleCatalog("furniture")),
          personalCareCatalog:()=>openCatalog("personalCareCatalog",()=>loadGenericCatalog("personalCare")),
          sportsCatalog:()=>openCatalog("sportsCatalog",()=>loadGenericCatalog("sports")),
          electricalCatalog:()=>openCatalog("electricalCatalog",()=>loadGenericCatalog("electrical")),
          toolsCatalog:()=>openCatalog("toolsCatalog",()=>loadGenericCatalog("tools")),
          petsCatalog:()=>openCatalog("petsCatalog",()=>loadGenericCatalog("pets")),
          plantsCatalog:()=>openCatalog("plantsCatalog",()=>loadGenericCatalog("plants")),
          telecomCatalog:()=>openCatalog("telecomCatalog",()=>loadGenericCatalog("telecom")),
          travelCatalog:()=>openCatalog("travelCatalog",()=>loadGenericCatalog("travel")),
          electronicsCatalog:()=>openCatalog("electronicsCatalog",()=>loadGenericCatalog("electronics")),
          sparePartsCatalog:()=>openCatalog("sparePartsCatalog",()=>loadGenericCatalog("spareParts")),
          servicesCatalog:()=>openCatalog("servicesCatalog",()=>loadGenericCatalog("services")),
          babyCatalog:()=>openCatalog("babyCatalog",()=>loadGenericCatalog("baby")),
          realEstateCatalog:()=>openCatalog("realEstateCatalog",loadRealEstate),
          goldRatesCatalog:()=>{const section=document.getElementById("goldRatesCatalog");if(section){panel.hidden=true;section.hidden=false;loadMarketRates();section.scrollIntoView({behavior:"smooth",block:"start"});}},
          silverRatesCatalog:()=>{const section=document.getElementById("silverRatesCatalog");if(section){panel.hidden=true;section.hidden=false;loadMarketRates();section.scrollIntoView({behavior:"smooth",block:"start"});}},
          currencyRatesCatalog:()=>{const section=document.getElementById("currencyRatesCatalog");if(section){panel.hidden=true;section.hidden=false;loadMarketRates();section.scrollIntoView({behavior:"smooth",block:"start"});}},
          medicinesCatalog:()=>openCatalog("medicinesCatalog",()=>loadGenericCatalog("medicines")),
          fuelCatalog:()=>openCatalog("fuelCatalog",()=>loadGenericCatalog("fuel"))
        };
        const route=routes[targetId];
        if(route)route();
      }
    });
    card.addEventListener("keydown",event => {
      if(event.key==="Enter" || event.key===" ") { event.preventDefault(); card.click(); }
    });
  });

  const globalSearchBox=element("div","global-search-results");
  globalSearchBox.id="globalSearchResults";globalSearchBox.hidden=true;
  if(searchInput)searchInput.parentElement.insertAdjacentElement("afterend",globalSearchBox);
  updateCategoryCount();
  if(clearSearchButton&&searchInput){
    clearSearchButton.addEventListener("click",()=>{
      searchInput.value="";
      searchInput.dispatchEvent(new Event("input",{bubbles:true}));
      searchInput.focus();
    });
  }
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
    ["medicines.json","الأدوية والصحة","medicinesCatalog","medicinesCatalogSearch"],
    ["spare-parts.json","قطع غيار السيارات","sparePartsCatalog","sparePartsCatalogSearch"],
    ["services.json","الخدمات الحكومية","servicesCatalog","servicesCatalogSearch"],
    ["fuel.json","الوقود ومشتقاته","fuelCatalog","fuelCatalogSearch"],
    ["baby-products.json","مستلزمات الأطفال والرضع","babyCatalog","babyCatalogSearch"],
    ["electronics.json","الموبايلات والإلكترونيات","electronicsCatalog","electronicsCatalogSearch"]
  ];
  let allSearchData=null,searchLoadPromise=null;
  async function loadAllSearchData(){
    if(allSearchData)return allSearchData;
    if(searchLoadPromise)return searchLoadPromise;
    searchLoadPromise=Promise.all(searchableFiles.map(async meta=>{
      try{const response=await fetch("./"+meta[0],{cache:"no-cache"});if(!response.ok)return {meta,items:[]};const data=await response.json();return {meta,items:[...(Array.isArray(data.products)?data.products:[]),...(meta[0]==="pets.json"&&Array.isArray(data.animals)?data.animals:[])]};}
      catch(e){return {meta,items:[]};}
    })).then(rows=>(allSearchData=rows));
    return searchLoadPromise;
  }
  function searchText(item){return normalize([item.name,item.title,item.brand,item.category,item.model,item.spec,item.author,item.merchant,item.unit,item.grade,item.subject,item.variant,item.memory,item.processor,item.details,item.description,item.note,item.size,item.capacity,item.fuelType,item.engine].filter(Boolean).join(" "));}
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
      "telecom.json":["الخدمات"],"travel.json":["السياحة"],"medicines.json":["الأدوية"],"spare-parts.json":["قطع غيار السيارات"],"services.json":["الخدمات الحكومية"],"fuel.json":["الوقود"],"baby-products.json":["الأطفال"]
    };
    const wanted=routeWords[meta[0]]||[];
    const target=cards.find(c=>wanted.some(word=>normalize(getTitle(c)).includes(normalize(word))));
    if(target){target.hidden=false;target.click();}
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
    if(noResults)noResults.hidden=matches.length>0||cards.some(card=>!card.hidden);
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
      const numericPrice=rawPrice!==null&&rawPrice!==""?Number(rawPrice):NaN;
      if(Number.isFinite(numericPrice)&&numericPrice>0)info.append(element("small","",meta[1]+" · "+numericPrice.toLocaleString("en-US")+" جنيه"));
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
      if(clearSearchButton)clearSearchButton.hidden=!searchInput.value.trim();
      cards.forEach(card=>{card.hidden=!!query&&!normalize(getTitle(card)+" "+(card.dataset.search||"")).includes(query);});
      updateCategoryCount();
      if(!query){closeGlobalSearch();globalSearchBox.replaceChildren();if(noResults)noResults.hidden=true;return;}
      if(noResults)noResults.hidden=Array.from(cards).some(card=>!card.hidden);
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
      const card=element("article","book-card generic-product-card");
      card.append(element("span","book-category",book.teacher||book.series||"كتاب خارجي"));
      appendProductVisual(card,{...book,name:book.title,category:book.subject});
      card.append(element("h3","",book.title));
      if(book.author)card.append(element("p","book-author","المؤلف: "+book.author));
      if(book.category==="كتب الوزارة")card.append(element("p","book-price","مجاني – من موقع الوزارة"));else if(Number.isFinite(book.price))card.append(element("p","book-price",book.price.toLocaleString("en-US")+" جنيه"));
      card.append(element("p","book-store","المصدر: "+book.merchant));
      card.append(element("small","book-date","آخر رصد: "+book.checkedAt));
      const link=element("a","book-source","عرض الكتاب لدى المصدر");link.href=book.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);
      if(book.legalPdfUrl){const pdf=element("a","book-pdf","فتح نسخة إلكترونية مرخّصة");pdf.href=book.legalPdfUrl;pdf.target="_blank";pdf.rel="noopener noreferrer";card.append(pdf);}
      else card.append(element("small","book-pdf-unavailable",book.pdfStatus||"لا يتوفر PDF مجاني مرخّص تم التحقق منه"));
      container.append(card);
    });
    updateCatalogMetrics(document.getElementById("bookCount"),items,items.length);
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
    rows.forEach(x=>{const card=element("article","book-card");card.append(element("span","book-category",x.category));appendProductVisual(card,x);card.append(element("h3","",x.name));if(Number.isFinite(x.price))card.append(element("p","book-price",x.price.toLocaleString("en-US")+" جنيه / "+x.unit));card.append(element("p","",x.spec));card.append(element("small","book-date","آخر رصد: "+x.checkedAt+" · "+data.region));const link=element("a","book-source","تفاصيل المصدر");link.href=data.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);container.append(card);});
    const count=document.getElementById("constructionCount");if(count)updateCatalogMetrics(count,data.products,rows.length);
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
    const targetIds={"أسعار الذهب":"goldRates","أسعار الفضة":"silverRates","أسعار العملات مقابل الجنيه":"currencyRates"};
    groups.forEach(group=>{
      const root=document.getElementById(targetIds[group.title]);
      if(!root)return;
      root.replaceChildren();
      if(!Array.isArray(group.items)||!group.items.length){
        root.append(element("p","market-unavailable","تعذر الحصول على أسعار موثوقة في هذه اللحظة. لن نعرض أرقامًا قديمة على أنها أسعار اليوم."));
        if(group.note)root.append(element("small","catalog-footnote",group.note));
        if(group.source){const link=element("a","market-source-link","افتح صفحة المصدر للتحقق من السعر");link.href=group.source;link.target="_blank";link.rel="noopener noreferrer";root.append(link);}
        return;
      }
      const table=element("div","market-rate-list");
      group.items.forEach(x=>{
        const row=element("div","market-rate-row");
        row.append(element("strong","",x.name),element("span","",x.value));
        table.append(row);
      });
      root.append(table);
      const note=element("small","catalog-footnote",group.note);
      const link=element("a","","فتح المصدر");
      link.href=group.source;link.target="_blank";link.rel="noopener noreferrer";
      note.append(link);root.append(note);
      const groupIsLive=group.live===undefined?live:group.live;
      root.append(element("p","catalog-footnote",groupIsLive
        ?"تحديث من المصدر المباشر · آخر استجابة: "+new Date(generatedAt||Date.now()).toLocaleString("ar-EG")
        :"بيانات محفوظة احتياطيًا · تاريخ الرصد موضح أعلاه وقد لا تمثل السعر الحالي."));
    });
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
    const make=(title,items)=>({title,items,live:true,note:"آخر رصد من المصدر: "+stamp+" · الأسعار استرشادية وليست عرض بيع ملزم. ",source:"https://getdaleelak.com/ar/api"});
    return [make("أسعار الذهب",gold),make("أسعار الفضة",silver),make("أسعار العملات مقابل الجنيه",currencies)];
  }
  async function loadMarketRates(){
    const targets=["goldRates","silverRates","currencyRates"];
    if(!targets.some(id=>document.getElementById(id)))return;
    const fallbackGroups=[
      {title:"أسعار الذهب",items:[
        {name:"ذهب عيار 24 – جرام",value:"شراء 7,171.85 · بيع 7,081.58 جنيه"},
        {name:"ذهب عيار 21 – جرام",value:"شراء 6,276.00 · بيع 6,197.00 جنيه"},
        {name:"ذهب عيار 18 – جرام",value:"شراء 5,379.43 · بيع 5,311.71 جنيه"}
      ],source:"https://react.arabfinance.com/ar/prices-hub",note:"آخر بيانات منشورة بالمصدر: 5 نوفمبر 2026، 01:29 صباحًا. لقطة احتياطية مؤرخة وليست سعرًا لحظيًا؛ تحقق من المصدر قبل التعامل."},
      {title:"أسعار الفضة",items:[
        {name:"فضة – جرام",value:"شراء 95.66 · بيع 92.77 جنيه"}
      ],source:"https://react.arabfinance.com/ar/prices-hub",note:"آخر بيانات منشورة بالمصدر: 5 نوفمبر 2026، 01:29 صباحًا. لقطة احتياطية مؤرخة وليست سعرًا لحظيًا؛ تحقق من المصدر قبل التعامل."},
      {title:"أسعار العملات مقابل الجنيه",items:[
        {name:"الدولار الأمريكي USD",value:"55.4209 جنيه"},
        {name:"اليورو EUR",value:"61.9661 جنيه"},
        {name:"الجنيه الإسترليني GBP",value:"74.3415 جنيه"},
        {name:"الريال السعودي SAR",value:"14.7659 جنيه"},
        {name:"الدرهم الإماراتي AED",value:"15.0899 جنيه"},
        {name:"اليوان الصيني CNY",value:"8.3064 جنيه"}
      ],source:"https://nafeza.gov.eg/en/currencies",note:"أسعار منشورة لدى مصلحة الجمارك المصرية بتاريخ 5 نوفمبر 2026، 12:00 صباحًا. أسعار جمركية مرجعية وليست بالضرورة أسعار بيع وشراء البنوك."}
    ];
    try{
      const headers={};if(marketETag)headers["If-None-Match"]=marketETag;
      const res=await fetch("https://getdaleelak.com/api/v1/feed.json",{headers,cache:"no-store"});
      if(res.status===304)return;
      if(!res.ok)throw new Error("Live market feed unavailable: "+res.status);
      const feed=await res.json();if(!Array.isArray(feed.assets))throw new Error("Invalid market feed");
      marketETag=res.headers.get("ETag")||marketETag;
      const groups=groupsFromLiveFeed(feed),byTitle=new Map(groups.map(g=>[g.title,g]));
      renderMarketGroups(fallbackGroups.map(f=>{const live=byTitle.get(f.title);return live&&live.items.length?live:f;}),true,feed.generatedAt);
    }catch(error){
      console.warn("Market data unavailable; showing source links.",error);
      renderMarketGroups(fallbackGroups,false, "2026-11-05T01:29:01");
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
    rows.sort((a,b)=>sort==="price"?((a.price??Infinity)-(b.price??Infinity)):a.name.localeCompare(b.name,"ar"));
    root.replaceChildren();
    rows.forEach(x=>{const card=element("article","book-card");card.append(element("span","book-category",x.brand+" · "+x.category));appendProductVisual(card,x);card.append(element("h3","",x.name));if(Number.isFinite(x.price))card.append(element("p","book-price",x.price.toLocaleString("en-US")+" جنيه"));card.append(element("p","",x.spec));if(x.checkedAt)card.append(element("small","book-date","آخر تحديث للمصدر: "+x.checkedAt));if(x.source){const link=element("a","book-source",x.price==null?"معلومات عن السيارة":"مصدر السعر");link.href=x.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);}addDatabaseComparison(card,x);root.append(card);});
    const count=document.getElementById("carCount");if(count)updateCatalogMetrics(count,data.products,rows.length);
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
      appendProductVisual(card,x);
      card.append(element("h3","",x.name));
      if(Number.isFinite(Number(x.price))&&Number(x.price)>0)card.append(element("p","book-price",Number(x.price).toLocaleString("en-US")+" جنيه"));
      card.append(element("p","book-store","المتجر: "+x.merchant+" · الموديل: "+x.model));
      card.append(element("small","book-date","آخر رصد: "+x.checkedAt));
      const link=element("a","book-source","راجع السعر لدى المتجر");link.href=x.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);
      root.append(card);
    });
    const count=document.getElementById("applianceCount");if(count)updateCatalogMetrics(count,data.products,rows.length);
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
      appendProductVisual(card,x);
      card.append(element("h3","",x.name));
      card.append(element("p","book-price",x.price.toLocaleString("en-US")+" جنيه"));
      card.append(element("p","book-store","العبوة: "+x.unit+" · المتجر: "+x.merchant));
      card.append(element("small","book-date","آخر رصد: "+x.checkedAt));
      const link=element("a","book-source","فتح قائمة المتجر");link.href=data.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);
      root.append(card);
    });
    const count=document.getElementById("groceryCount");if(count)updateCatalogMetrics(count,data.products,rows.length);
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
      appendProductVisual(card,x);
      card.append(element("h3","",x.name));
      if(Number.isFinite(x.priceFrom)&&Number.isFinite(x.priceTo))card.append(element("p","book-price",x.priceFrom===x.priceTo?x.priceFrom.toLocaleString("en-US")+" جنيه":x.priceFrom.toLocaleString("en-US")+"–"+x.priceTo.toLocaleString("en-US")+" جنيه"));
      card.append(element("p","book-store","الوحدة: "+x.unit));
      card.append(element("small","book-date","آخر رصد: "+x.checkedAt+" · نطاق تقريبي منشور"));
      const link=element("a","book-source","مصدر نطاق السعر");link.href=x.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);
      root.append(card);
    });
    const count=document.getElementById("stationeryCount");if(count)updateCatalogMetrics(count,data.products,rows.length);
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
    rows.sort((a,b)=>sort==="price"?((a.price??Infinity)-(b.price??Infinity)):a.name.localeCompare(b.name,"ar"));
    root.replaceChildren();
    rows.forEach(x=>{
      const card=element("article","book-card");
      card.append(element("span","book-category",[x.brand,x.category].filter(Boolean).join(" · ")));
      appendProductVisual(card,x);
      card.append(element("h3","",x.name));
      const validPrice=x.price!==null&&x.price!==undefined&&x.price!==""&&Number.isFinite(Number(x.price))&&Number(x.price)>0;
      if(validPrice)card.append(element("p","book-price",Number(x.price).toLocaleString("en-US")+" جنيه"));
      if(x.size||x.unit)card.append(element("p","book-store","المقاس / الوحدة: "+(x.size||x.unit)));
      if(x.details||x.description)card.append(element("p","catalog-footnote",x.details||x.description));
      if(x.source&&/^https:\/\//i.test(x.source)){const link=element("a","phone-source","مصدر المنتج");link.href=x.source;link.target="_blank";link.rel="noopener noreferrer";card.append(link);}
      if(x.checkedAt)card.append(element("small","catalog-footnote","آخر رصد: "+x.checkedAt));
      addDatabaseComparison(card,x);root.append(card);
    });
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


  let realEstateData=null;
  async function loadRealEstate(){
    const governorate=document.getElementById("propertyGovernorate"),center=document.getElementById("propertyCenter"),area=document.getElementById("propertyArea"),results=document.getElementById("propertyListings");
    if(!governorate||!center||!area||!results)return;
    if(!realEstateData){
      results.textContent="جارٍ تحميل المحافظات والإعلانات...";
      try{
        const [baseResponse,apiResponse]=await Promise.all([fetch("./real-estate.json",{cache:"no-cache"}),fetch("/api/real-estate",{cache:"no-store"})]);
        if(!baseResponse.ok)throw new Error("تعذر تحميل دليل المحافظات");
        const base=await baseResponse.json();
        let live={listings:[]};
        if(apiResponse.ok)live=await apiResponse.json();
        else console.warn("Real estate API:",(await apiResponse.json().catch(()=>({}))).error||apiResponse.status);
        realEstateData={governorates:live.governorates?.length?live.governorates:base.governorates,listings:Array.isArray(live.listings)?live.listings:[]};
        governorate.replaceChildren(new Option("اختر المحافظة",""));
        realEstateData.governorates.forEach(g=>governorate.add(new Option(g.name,g.name)));
        const submitGov=document.getElementById("submitPropertyGovernorate");
        if(submitGov){submitGov.replaceChildren(new Option("اختر المحافظة",""));realEstateData.governorates.forEach(g=>submitGov.add(new Option(g.name,g.name)));}
      }catch(error){results.textContent="تعذر تحميل دليل المحافظات حاليًا.";console.error(error);return;}
    }
    renderPropertyListings();
  }
  function renderPropertyListings(){
    if(!realEstateData)return;
    const gov=document.getElementById("propertyGovernorate")?.value||"",center=document.getElementById("propertyCenter")?.value||"",area=normalize(document.getElementById("propertyArea")?.value||"");
    const type=document.getElementById("propertyType")?.value||"",min=Math.max(0,Number(document.getElementById("propertyMinPrice")?.value)||0),max=Math.max(0,Number(document.getElementById("propertyMaxPrice")?.value)||0),rooms=document.getElementById("propertyRooms")?.value||"",sort=document.getElementById("propertySort")?.value||"newest";
    const root=document.getElementById("propertyListings"),count=document.getElementById("propertyCount");if(!root)return;
    let rows=(realEstateData.listings||[]).filter(x=>(!gov||x.governorate===gov)&&(!center||x.center===center)&&(!area||normalize(x.area||"").includes(area))&&(!type||x.type===type)&&(!min||Number(x.price)>=min)&&(!max||Number(x.price)<=max)&&(!rooms||(rooms==="4"?Number(x.rooms)>=4:Number(x.rooms)===Number(rooms))));
    rows.sort((a,b)=>sort==="price-asc"?(Number(a.price||Infinity)-Number(b.price||Infinity)):sort==="price-desc"?(Number(b.price||0)-Number(a.price||0)):sort==="area-desc"?(Number(b.areaM2||0)-Number(a.areaM2||0)):String(b.publishedAt||"").localeCompare(String(a.publishedAt||"")));
    root.replaceChildren();
    if(count)count.textContent=gov?(center?("نتائج "+gov+" – "+center+(area?" – "+document.getElementById("propertyArea").value:"")+" : "+rows.length+" إعلان"):"اختر المركز أو المدينة لعرض الإعلانات"):"اختر المحافظة لبدء البحث";
    if(!gov||!center){root.append(element("p","catalog-footnote","ابدأ باختيار المحافظة ثم المركز أو المدينة والمنطقة المطلوبة."));return;}
    if(!rows.length){root.append(element("div","property-empty","لا توجد إعلانات معتمدة مطابقة لهذا المكان حاليًا. يمكنك إضافة عقارك من نموذج «أضف عقارك للبيع»."));return;}
    rows.forEach(x=>{
      const card=element("article","property-card");
      const photos=Array.isArray(x.photoUrls)?x.photoUrls:Array.isArray(x.photo_urls)?x.photo_urls:[];
      photos.filter(url=>/^https:\/\//i.test(url)).slice(0,8).forEach(url=>{const img=element("img","property-photo");img.src=url;img.alt=x.title||"صورة العقار";img.loading="lazy";img.referrerPolicy="no-referrer";card.append(img);});
      card.append(element("span","property-type",x.type||"عقار للبيع"),element("h3","",x.title||((x.type||"عقار")+" للبيع في "+(x.area||center))));
      card.append(element("p","property-location",[x.governorate,x.center,x.area].filter(Boolean).join(" · ")));
      if(Number(x.price)>0)card.append(element("strong","property-price",Number(x.price).toLocaleString("en-US")+" جنيه"+(x.price_negotiable?" — قابل للتفاوض":"")));
      else card.append(element("strong","property-price","السعر عند التواصل"));
      const specs=[x.areaM2?("المساحة: "+x.areaM2+" م²"):"",x.rooms?("الغرف: "+x.rooms):"",x.bathrooms?("الحمامات: "+x.bathrooms):"",x.floor?("الدور: "+x.floor):""].filter(Boolean);
      if(specs.length)card.append(element("p","property-specs",specs.join(" • ")));
      if(x.description)card.append(element("p","property-description",x.description));
      if(x.publishedAt)card.append(element("small","catalog-footnote","تاريخ النشر: "+x.publishedAt));
      if(x.contact){const contact=element("a","property-contact","التواصل مع المعلن");const digits=String(x.contact).replace(/[^0-9]/g,"");if(digits.length>=7){contact.href="https://wa.me/"+digits;contact.target="_blank";contact.rel="noopener noreferrer";card.append(contact);}}
      root.append(card);
    });
  }
  function fillPropertyCenters(govSelect,centerSelect){
    if(!govSelect||!centerSelect)return;
    const selected=(realEstateData?.governorates||[]).find(g=>g.name===govSelect.value);
    centerSelect.replaceChildren(new Option(selected?"اختر المركز أو المدينة":"اختر المحافظة أولًا",""));
    (selected?.centers||[]).forEach(c=>centerSelect.add(new Option(c,c)));
    centerSelect.disabled=!selected;
  }
  const propertyGovernorate=document.getElementById("propertyGovernorate"),propertyCenter=document.getElementById("propertyCenter");
  propertyGovernorate?.addEventListener("change",()=>{
    fillPropertyCenters(propertyGovernorate,propertyCenter);
    const area=document.getElementById("propertyArea");if(area){area.value="";area.disabled=!propertyGovernorate.value;area.placeholder=propertyGovernorate.value?"اكتب اسم المنطقة أو القرية...":"اختر المحافظة أولًا";}
    renderPropertyListings();
  });
  propertyCenter?.addEventListener("change",renderPropertyListings);
  ["propertyArea","propertyType","propertyMinPrice","propertyMaxPrice","propertyRooms","propertySort"].forEach(id=>{const control=document.getElementById(id);control?.addEventListener(id==="propertyArea"?"input":"change",renderPropertyListings);});
  const submitGov=document.getElementById("submitPropertyGovernorate"),submitCenter=document.getElementById("submitPropertyCenter");
  submitGov?.addEventListener("change",()=>fillPropertyCenters(submitGov,submitCenter));
  const propertyForm=document.getElementById("propertySubmitForm");
  propertyForm?.addEventListener("submit",async event=>{
    event.preventDefault();const message=document.getElementById("propertySubmitMessage"),button=propertyForm.querySelector('button[type="submit"]');
    if(!message||!button)return;button.disabled=true;message.textContent="جارٍ إرسال الإعلان...";
    const f=new FormData(propertyForm),value=name=>String(f.get(name)||"").trim();
    const payload={title:value("title"),type:value("type"),governorate:value("governorate"),center:value("center"),area:value("area"),price:value("price"),price_negotiable:f.has("price_negotiable"),area_m2:value("area_m2"),rooms:value("rooms"),bathrooms:value("bathrooms"),floor:value("floor"),description:value("description"),photo_urls:value("photo_urls"),owner_name:value("owner_name"),contact_phone:value("contact_phone"),consent:f.has("consent"),website:value("website")};
    try{const response=await fetch("/api/real-estate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error||"تعذر إرسال الإعلان.");message.textContent=result.message||"تم إرسال الإعلان للمراجعة.";propertyForm.reset();if(submitCenter){submitCenter.replaceChildren(new Option("اختر المحافظة أولًا",""));submitCenter.disabled=true;}}
    catch(error){message.textContent=error.message||"تعذر الاتصال بالخادم. حاول لاحقًا.";}
    finally{button.disabled=false;}
  });
  const adminForm=document.getElementById("propertyAdminLogin"),adminQueue=document.getElementById("propertyAdminQueue"),adminPassword=document.getElementById("propertyAdminPassword");
  async function loadPropertyQueue(){
    if(!adminPassword?.value||!adminQueue)return;
    adminQueue.textContent="جارٍ تحميل الإعلانات المنتظرة...";
    try{
      const response=await fetch("/api/real-estate-admin",{headers:{"X-Admin-Password":adminPassword.value,"Cache-Control":"no-store"}});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"تعذر تحميل قائمة المراجعة.");
      adminQueue.replaceChildren();
      if(!data.listings?.length){adminQueue.textContent="لا توجد إعلانات تنتظر المراجعة.";return;}
      data.listings.forEach(item=>{
        const card=element("article","property-review-card");
        card.append(element("h3","",item.title),element("p","property-location",[item.governorate,item.center,item.area].join(" · ")),element("p","",item.type+" — "+(item.price?Number(item.price).toLocaleString("en-US")+" جنيه":"السعر عند التواصل")),element("p","",item.description),element("p","","المعلن: "+item.owner_name+" — "+item.contact_phone));
        (item.photoUrls||[]).forEach(url=>{if(/^https:\/\//i.test(url)){const a=element("a","property-source","رابط صورة");a.href=url;a.target="_blank";a.rel="noopener noreferrer";card.append(a);}});
        const actions=element("div","property-review-actions");
        [["approve","موافقة ونشر"],["reject","رفض الإعلان"]].forEach(([action,label])=>{const button=element("button",action==="approve"?"property-contact":"property-reject",label);button.type="button";button.addEventListener("click",async()=>{button.disabled=true;try{const r=await fetch("/api/real-estate-admin",{method:"POST",headers:{"Content-Type":"application/json","X-Admin-Password":adminPassword.value},body:JSON.stringify({id:item.id,action})});const result=await r.json();if(!r.ok)throw new Error(result.error||"تعذر حفظ القرار.");await loadPropertyQueue();if(action==="approve"){realEstateData=null;await loadRealEstate();}}catch(error){button.disabled=false;adminQueue.prepend(element("p","catalog-footnote",error.message));}});actions.append(button);});
        card.append(actions);adminQueue.append(card);
      });
    }catch(error){adminQueue.textContent=error.message;}
  }
  adminForm?.addEventListener("submit",event=>{event.preventDefault();loadPropertyQueue();});

  const genericCatalogs={computers:{file:"computers-laptops.json",id:"computersCatalog"},printers:{file:"printers-ink.json",id:"printersCatalog"},gaming:{file:"gaming-devices.json",id:"gamingCatalog"},networking:{file:"networking-internet.json",id:"networkingCatalog"},securityCameras:{file:"security-cameras.json",id:"securityCamerasCatalog"},solar:{file:"solar-energy.json",id:"solarCatalog"},tires:{file:"car-tires.json",id:"tiresCatalog"},carBatteries:{file:"car-batteries.json",id:"carBatteriesCatalog"},motorcycles:{file:"motorcycles-scooters.json",id:"motorcyclesCatalog"},carOils:{file:"car-oils-lubricants.json",id:"carOilsCatalog"},kitchenware:{file:"kitchen-tools-utensils.json",id:"kitchenwareCatalog"},mattresses:{file:"mattresses-home-linen.json",id:"mattressesCatalog"},bathroom:{file:"bathroom-fixtures.json",id:"bathroomCatalog"},eyewear:{file:"eyewear-lenses.json",id:"eyewearCatalog"},watches:{file:"watches.json",id:"watchesCatalog"},bags:{file:"bags-luggage.json",id:"bagsCatalog"},perfumes:{file:"perfumes.json",id:"perfumesCatalog"},maternity:{file:"maternity.json",id:"maternityCatalog"},irrigation:{file:"agriculture-irrigation.json",id:"irrigationCatalog"},waterFilters:{file:"water-filters.json",id:"waterFiltersCatalog"},homeMedical:{file:"home-medical-devices.json",id:"homeMedicalCatalog"},householdCleaning:{file:"household-cleaning.json",id:"householdCleaningCatalog"},fuel:{file:"fuel.json",id:"fuelCatalog"},baby:{file:"baby-products.json",id:"babyCatalog"},medicines:{file:"medicines.json",id:"medicinesCatalog"},spareParts:{file:"spare-parts.json",id:"sparePartsCatalog"},services:{file:"services.json",id:"servicesCatalog"},personalCare:{file:"personal-care.json",id:"personalCareCatalog"},sports:{file:"sports.json",id:"sportsCatalog"},electrical:{file:"electrical.json",id:"electricalCatalog"},tools:{file:"tools.json",id:"toolsCatalog"},pets:{file:"pets.json",id:"petsCatalog"},plants:{file:"plants.json",id:"plantsCatalog"},telecom:{file:"telecom.json",id:"telecomCatalog"},travel:{file:"travel.json",id:"travelCatalog"},electronics:{file:"electronics.json",id:"electronicsCatalog"}};
  const genericData={};
  async function loadGenericCatalog(key){
    const cfg=genericCatalogs[key],root=document.getElementById(cfg.id+"Products");if(!root)return;
    if(genericData[key]){renderGenericCatalog(key);return;}
    try{
      const r=await fetch("./"+cfg.file,{cache:"no-cache"});if(!r.ok)throw new Error("HTTP "+r.status);
      const parsed=await r.json();genericData[key]=parsed;
      const products=Array.isArray(parsed.products)?parsed.products:(Array.isArray(parsed)?parsed:[]);
      const animals=key==="pets"&&Array.isArray(parsed.animals)?parsed.animals:[];
      const sel=document.getElementById(cfg.id+"Category");
      if(sel){[...new Set([...products,...animals].map(x=>x.category).filter(Boolean))].sort().forEach(x=>{const o=element("option","",x);o.value=x;sel.append(o);});}
      renderGenericCatalog(key);
      
    }catch(e){root.textContent="تعذر تحميل بيانات القسم حاليًا. حاول تحديث الصفحة لاحقًا.";}
  }
  Object.entries(genericCatalogs).forEach(([key,cfg])=>[cfg.id+"Search",cfg.id+"Category",cfg.id+"Sort"].forEach(id=>{const control=document.getElementById(id);if(control)control.addEventListener(id.endsWith("Search")?"input":"change",()=>renderGenericCatalog(key));}));

  const educationInputIds=["eduTuition","eduRegistration","eduBooks","eduSupplies","eduDevices","eduActivities","eduOther","eduTransport","eduLessons","eduMeals"];
  const educationInputs=educationInputIds.map(id=>document.getElementById(id)).filter(Boolean);
  const educationStudents=document.getElementById("eduStudents");
  const educationInstallments=document.getElementById("eduInstallments");
  function updateEducationCost(){
    const amount=id=>Math.max(0,Number(document.getElementById(id)?.value)||0);
    const annualPerStudent=amount("eduTuition")+amount("eduRegistration")+amount("eduBooks")+amount("eduSupplies")+amount("eduDevices")+amount("eduActivities")+amount("eduOther")+12*(amount("eduTransport")+amount("eduLessons")+amount("eduMeals"));
    const students=Math.min(20,Math.max(1,Math.floor(Number(educationStudents?.value)||1)));
    const familyAnnual=annualPerStudent*students;
    const money=value=>value.toLocaleString("ar-EG",{maximumFractionDigits:2})+" جنيه";
    document.getElementById("eduAnnualPerStudent").textContent=money(annualPerStudent);
    document.getElementById("eduAnnualTotal").textContent=money(familyAnnual);
    document.getElementById("eduMonthlyTotal").textContent=money(familyAnnual/12);
    document.getElementById("eduInstallmentTotal").textContent=money(familyAnnual/Math.max(1,Number(educationInstallments?.value)||2));
  }
  [...educationInputs,educationStudents,educationInstallments].filter(Boolean).forEach(input=>input.addEventListener("input",updateEducationCost));
  if(educationInstallments)educationInstallments.addEventListener("change",updateEducationCost);
  updateEducationCost();

})();
