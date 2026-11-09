/* Same-origin scripts are used so the site's Content Security Policy can run them. */
(function () {
  document.addEventListener("click", function (event) {
    const card = event.target.closest && event.target.closest(".category-card");
    if (!card) return;
    const href = card.getAttribute("href") || "";
    if (!href.startsWith("#")) return;
    const target = document.getElementById(href.slice(1));
    if (!target || !/Catalog$/.test(target.id)) return;
    event.preventDefault();
    document.querySelectorAll("main section[id$='Catalog']").forEach(function (section) {
      section.hidden = true;
    });
    target.hidden = false;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, false);

  const form = document.getElementById("contactForm");
  if (!form) return;
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const status = document.getElementById("contactStatus");
    if (!document.getElementById("contactConsent").checked) {
      status.textContent = "يرجى الموافقة قبل المتابعة.";
      return;
    }
    const clean = value => String(value || "").trim();
    const name = clean(document.getElementById("contactName").value);
    const type = clean(document.getElementById("contactType").value);
    const section = clean(document.getElementById("contactSection").value);
    const message = clean(document.getElementById("contactMessage").value);
    const contact = clean(document.getElementById("contactMethod").value);
    if (message.length < 8) {
      status.textContent = "اكتب رسالة لا تقل عن 8 أحرف.";
      return;
    }
    const lines = [
      "رسالة جديدة من موقع MasrPrices",
      "الاسم: " + (name || "لم يذكر"),
      "النوع: " + type,
      "القسم: " + (section || "غير محدد"),
      "التفاصيل: " + message,
      contact ? "وسيلة تواصل إضافية: " + contact : ""
    ].filter(Boolean);
    const url = "https://wa.me/201204482537?text=" + encodeURIComponent(lines.join("\n"));
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.href = url;
      return;
    }
    status.textContent = "تم فتح واتساب. راجع الرسالة واضغط إرسال لإيصالها إلينا.";
  });
  const priceForm = document.getElementById("communityPriceForm");
  if (priceForm) {
    priceForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const status = document.getElementById("priceSubmitStatus");
      const button = document.getElementById("priceSubmitButton");
      const value = id => document.getElementById(id).value.trim();
      if (!document.getElementById("priceConsent").checked) { status.textContent = "وافق على إرسال السعر بعد التأكد من صحته."; return; }
      button.disabled = true; status.textContent = "جارٍ إرسال السعر إلى قائمة المراجعة...";
      try {
        const response = await fetch("/api/price-submission", {
          method: "POST", headers: {"Content-Type":"application/json"},
          body: JSON.stringify({
            product_name:value("priceProduct"), category:value("priceCategory"),
            store_name:value("priceStore"), price_egp:value("priceAmount"),
            unit:value("priceUnit"), product_url:value("priceUrl"),
            proof_url:value("priceProof"), notes:value("priceNotes"),
            website:value("priceWebsite"), consent:true
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "تعذر إرسال السعر.");
        status.textContent = data.message || "تم استلام السعر للمراجعة.";
        priceForm.reset();
      } catch (error) { status.textContent = error.message || "حدث خطأ. حاول لاحقًا."; }
      finally { button.disabled = false; }
    });
  }

})();
