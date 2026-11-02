"use strict";

(function () {
  const searchInput = document.getElementById("searchInput");
  const cards = Array.from(document.querySelectorAll(".category-card"));
  const noResults = document.getElementById("noResults");

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase("ar")
      .normalize("NFD")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/[ىي]/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[ـ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getTitle(card) {
    const strong = card.querySelector("strong");
    return strong ? strong.textContent.trim() : card.textContent.trim();
  }

  function panelFor(card) {
    let panel = card.nextElementSibling;
    if (panel && panel.classList.contains("category-details")) return panel;

    panel = document.createElement("section");
    panel.className = "category-details";
    panel.hidden = true;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "تفاصيل القسم");
    const heading = document.createElement("h3");
    heading.textContent = getTitle(card);
    const message = document.createElement("p");
    message.textContent = "هذا القسم ضمن خطة MasrPrices. نضيف المنتجات والأسعار بعد التحقق من البيانات ومصادرها.";
    const note = document.createElement("p");
    note.className = "details-note";
    note.textContent = "لن نعرض سعراً غير موثّق على أنه سعر مؤكد.";
    panel.append(heading, message, note);
    card.insertAdjacentElement("afterend", panel);
    return panel;
  }

  const panels = new Map();
  cards.forEach(card => {
    card.setAttribute("aria-expanded", "false");
    card.setAttribute("aria-controls", "details-" + (cards.indexOf(card) + 1));
    const panel = panelFor(card);
    panel.id = "details-" + (cards.indexOf(card) + 1);
    panels.set(card, panel);

    card.addEventListener("click", event => {
      event.preventDefault();
      const shouldOpen = panel.hidden;
      cards.forEach(other => {
        const otherPanel = panels.get(other);
        otherPanel.hidden = true;
        other.setAttribute("aria-expanded", "false");
      });
      if (shouldOpen) {
        panel.hidden = false;
        card.setAttribute("aria-expanded", "true");
      }
    });
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        card.click();
      }
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const term = normalize(searchInput.value);
      let count = 0;
      cards.forEach(card => {
        const searchable = normalize(card.textContent + " " + (card.dataset.search || ""));
        const match = !term || searchable.includes(term);
        card.hidden = !match;
        panels.get(card).hidden = true;
        card.setAttribute("aria-expanded", "false");
        if (match) count++;
      });
      if (noResults) noResults.hidden = count > 0;
    });
  }

  // تثبيت الموقع كتطبيق عند دعم المتصفح.
  let installPrompt = null;
  const installButton = document.getElementById("installBtn");
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    if (installButton) installButton.hidden = false;
  });
  if (installButton) {
    installButton.addEventListener("click", async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      installButton.hidden = true;
    });
  }

  // تحديث ملفات الموقع المخزنة لتجنب بقاء نسخة قديمة.
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(error => {
        console.error("تعذر تشغيل وضع عدم الاتصال:", error);
      });
    });
  }
})();