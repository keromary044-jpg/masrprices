"use strict";
(function () {
  function initProductComparison() {
    const page = document.querySelector("body.products-directory-page");
    if (!page || page.dataset.compareReady === "1") return;
    page.dataset.compareReady = "1";
    const groups = Array.from(page.querySelectorAll(".group"));
    const selected = new Map();
    if (!groups.length) return;
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const tray = el("aside", "mp-compare-tray");
    tray.hidden = true;
    tray.setAttribute("aria-label", "مقارنة المنتجات المختارة");
    const count = el("span", "mp-compare-count", "اختر منتجين على الأقل");
    const compare = el("button", "mp-compare-open", "قارن المنتجات المختارة");
    compare.type = "button";
    compare.disabled = true;
    compare.title = "اختر منتجين على الأقل أولًا";
    const clear = el("button", "mp-compare-clear", "مسح الاختيارات");
    clear.type = "button";
    tray.append(count, compare, clear);
    const overlay = el("div", "mp-compare-overlay");
    overlay.hidden = true;
    const dialog = el("section", "mp-compare-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "mpCompareTitle");
    const header = el("div", "mp-compare-dialog-head");
    const title = el("h2", "", "مقارنة المنتجات");
    title.id = "mpCompareTitle";
    const close = el("button", "mp-compare-close", "إغلاق");
    close.type = "button";
    header.append(title, close);
    const note = el("p", "mp-compare-note", "قارن الأسعار المسجلة وتاريخها. قد تتغير الأسعار، فتأكد من السعر النهائي لدى البائع قبل الشراء.");
    const wrap = el("div", "mp-compare-table-wrap");
    const table = el("table", "mp-compare-table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    wrap.append(table);
    dialog.append(header, note, wrap);
    overlay.append(dialog);
    document.body.append(tray, overlay);
    function getProduct(li, group) {
      const link = li.querySelector("a[href*='/products/']");
      if (!link) return null;
      const priceNode = li.querySelector(":scope > strong") || li.querySelector("strong");
      const dateNode = li.querySelector("small");
      const priceText = priceNode ? priceNode.textContent.trim() : "";
      const normalized = priceText.replace(/[^0-9٠-٩۰-۹.,]/g, "")
        .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
        .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/,/g, "");
      const price = Number(normalized);
      const heading = group.querySelector("h2,h3");
      return {
        id: link.getAttribute("href"), name: link.textContent.trim(), url: link.href,
        price: Number.isFinite(price) && price > 0 ? price : null,
        priceText: priceText || "غير مسجل",
        date: dateNode ? dateNode.textContent.trim() : "غير محدد",
        category: heading ? heading.textContent.trim() : "غير محدد"
      };
    }
    const products = new Map();
    groups.forEach(group => group.querySelectorAll("li").forEach(li => {
      const item = getProduct(li, group);
      if (!item) return;
      products.set(item.id, item);
      const button = el("button", "mp-compare-pick", "＋ أضف للمقارنة");
      button.type = "button";
      button.dataset.compareId = item.id;
      button.setAttribute("aria-pressed", "false");
      li.append(button);
    }));
    function refresh() {
      const n = selected.size;
      tray.hidden = n === 0;
      count.textContent = n + " منتجات مختارة (الحد الأقصى 4)";
      compare.disabled = n < 2;
      compare.textContent = "قارن المنتجات المختارة";
      compare.title = n < 2 ? "اختر منتجين على الأقل أولًا" : "اعرض مقارنة المنتجات";
      page.querySelectorAll(".mp-compare-pick").forEach(button => {
        const active = selected.has(button.dataset.compareId);
        button.classList.toggle("is-picked", active);
        button.setAttribute("aria-pressed", String(active));
        button.textContent = active ? "✓ تمت الإضافة (اضغط للإزالة)" : "＋ أضف للمقارنة";
      });
    }
    function addCell(row, value, className) {
      const td = el("td", className || "", value);
      row.append(td);
      return td;
    }
    function render() {
      thead.replaceChildren();
      tbody.replaceChildren();
      const items = Array.from(selected.values());
      const head = document.createElement("tr");
      ["البيان", ...items.map(item => item.name)].forEach((label, i) => {
        const th = el("th", "", label);
        th.scope = i === 0 ? "row" : "col";
        head.append(th);
      });
      thead.append(head);
      const prices = items.filter(item => item.price !== null).map(item => item.price);
      const lowest = prices.length ? Math.min(...prices) : null;
      const rows = [
        ["القسم", item => item.category],
        ["السعر المسجل", item => item.priceText],
        ["تاريخ السعر", item => item.date],
        ["صفحة المنتج", item => item.url]
      ];
      rows.forEach(([label, getter], rowIndex) => {
        const tr = document.createElement("tr");
        addCell(tr, label, "mp-compare-row-label");
        items.forEach(item => {
          const value = getter(item);
          const td = document.createElement("td");
          if (rowIndex === 1 && item.price !== null && item.price === lowest) {
            td.classList.add("mp-compare-lowest");
            td.append(el("span", "mp-compare-lowest-tag", "أقل سعر مسجل"));
          }
          if (rowIndex === 3) {
            const link = el("a", "", "عرض المنتج");
            link.href = value;
            td.append(link);
          } else td.append(document.createTextNode(value || "غير متاح"));
          tr.append(td);
        });
        tbody.append(tr);
      });
    }
    function openDialog() {
      if (selected.size < 2) return;
      render();
      overlay.hidden = false;
      close.focus();
    }
    function closeDialog() {
      overlay.hidden = true;
      compare.focus();
    }
    page.querySelectorAll(".mp-compare-pick").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.compareId;
        if (selected.has(id)) selected.delete(id);
        else {
          if (selected.size >= 4) {
            count.textContent = "يمكنك اختيار 4 منتجات فقط للمقارنة";
            return;
          }
          const item = products.get(id);
          if (item) selected.set(id, item);
        }
        refresh();
      }, { passive: true });
    });
    compare.addEventListener("click", openDialog);
    close.addEventListener("click", closeDialog);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeDialog(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !overlay.hidden) closeDialog(); });
    clear.addEventListener("click", () => { selected.clear(); refresh(); });
    refresh();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initProductComparison, { once: true });
  else initProductComparison();
})();