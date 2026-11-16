"use strict";
(function () {
  function initProductComparison() {
    const page = document.querySelector("body.products-directory-page");
    if (!page || page.dataset.compareReady === "1") return;
    const groups = Array.from(page.querySelectorAll(".group"));
    if (!groups.length) return;
    page.dataset.compareReady = "1";
    const selected = new Map();
    const el = (tag, cls, value) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (value !== undefined) node.textContent = value;
      return node;
    };
    const products = new Map();
    const entries = [];
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
      return { id: link.getAttribute("href"), name: link.textContent.trim(), url: link.href,
        price: Number.isFinite(price) && price > 0 ? price : null,
        priceText: priceText || "غير مسجل", date: dateNode ? dateNode.textContent.trim() : "غير محدد",
        category: heading ? heading.textContent.trim() : "غير محدد", li, group };
    }
    groups.forEach(group => group.querySelectorAll("li").forEach(li => {
      const item = getProduct(li, group);
      if (!item) return;
      products.set(item.id, item); entries.push(item);
    }));
    const picker = el("section", "mp-picker");
    picker.setAttribute("aria-label", "اختيار المنتجات للمقارنة");
    const pickerHead = el("div", "mp-picker-head");
    pickerHead.append(el("div", "mp-picker-title", "اختار المنتجات اللي عايز تقارنها"),
      el("p", "mp-picker-hint", "ابحث بالاسم أو اختار القسم، وبعدها اضغط إضافة. تقدر تختار حتى 4 منتجات."));
    const controls = el("div", "mp-picker-controls");
    const search = el("input", "mp-picker-search");
    search.type = "search"; search.placeholder = "اكتب اسم المنتج للبحث…";
    search.setAttribute("aria-label", "ابحث عن منتج للمقارنة");
    const category = el("select", "mp-picker-category");
    category.setAttribute("aria-label", "تصفية حسب القسم");
    const allOption = el("option", "", "كل الأقسام"); allOption.value = "";
    category.append(allOption);
    [...new Set(entries.map(x => x.category))].forEach(name => {
      const option = el("option", "", name); option.value = name; category.append(option);
    });
    controls.append(search, category);
    const selection = el("div", "mp-picker-selection");
    const selectionLabel = el("strong", "mp-picker-selection-label", "المنتجات المختارة");
    const chips = el("div", "mp-picker-chips");
    const results = el("p", "mp-picker-results", "استخدم البحث للوصول للمنتج بسرعة، أو اختره من القائمة بالأسفل.");
    picker.append(pickerHead, controls, selectionLabel, chips, results);
    groups[0].parentNode.insertBefore(picker, groups[0]);
    const tray = el("aside", "mp-compare-tray");
    tray.hidden = true;
    const count = el("span", "mp-compare-count", "");
    const compare = el("button", "mp-compare-open", "قارن المنتجات");
    compare.type = "button"; compare.disabled = true;
    const clear = el("button", "mp-compare-clear", "مسح الاختيارات"); clear.type = "button";
    tray.append(count, compare, clear);
    const overlay = el("div", "mp-compare-overlay"); overlay.hidden = true;
    const dialog = el("section", "mp-compare-dialog");
    dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "mpCompareTitle");
    const header = el("div", "mp-compare-dialog-head");
    const title = el("h2", "", "مقارنة المنتجات");
    const close = el("button", "mp-compare-close", "إغلاق"); close.type = "button";
    header.append(title, close);
    const note = el("p", "mp-compare-note", "قارن الأسعار المسجلة وتاريخها. قد تتغير الأسعار، فتأكد من السعر النهائي لدى البائع قبل الشراء.");
    const wrap = el("div", "mp-compare-table-wrap");
    const table = el("table", "mp-compare-table");
    const thead = document.createElement("thead"), tbody = document.createElement("tbody");
    table.append(thead, tbody); wrap.append(table); dialog.append(header, note, wrap); overlay.append(dialog);
    document.body.append(tray, overlay);
    function renderChips() {
      chips.replaceChildren();
      if (!selected.size) chips.append(el("span", "mp-picker-empty", "لم تختر أي منتج بعد"));
      selected.forEach(item => {
        const chip = el("span", "mp-picker-chip");
        chip.append(el("span", "", item.name));
        const remove = el("button", "mp-picker-remove", "×");
        remove.type = "button"; remove.setAttribute("aria-label", "إزالة " + item.name);
        remove.addEventListener("click", () => { selected.delete(item.id); refresh(); });
        chip.append(remove); chips.append(chip);
      });
    }
    function refresh() {
      const n = selected.size;
      tray.hidden = n === 0;
      count.textContent = n + " من 4 منتجات مختارة";
      compare.disabled = n < 2;
      compare.title = n < 2 ? "اختر منتجين على الأقل" : "ابدأ مقارنة المنتجات";
      renderChips();
      page.querySelectorAll(".mp-compare-pick").forEach(button => {
        const active = selected.has(button.dataset.compareId);
        button.classList.toggle("is-picked", active);
        button.setAttribute("aria-pressed", String(active));
        button.textContent = active ? "✓ تمت الإضافة — إزالة" : "＋ أضف للمقارنة";
      });
    }
    function filterProducts() {
      const q = search.value.trim().toLocaleLowerCase("ar");
      const cat = category.value;
      let visible = 0;
      entries.forEach(item => {
        const match = (!q || item.name.toLocaleLowerCase("ar").includes(q)) && (!cat || item.category === cat);
        item.li.hidden = !match;
        visible += match ? 1 : 0;
      });
      groups.forEach(group => {
        group.hidden = !Array.from(group.querySelectorAll("li")).some(li => !li.hidden);
      });
      results.textContent = visible ? "ظهور " + visible + " منتج. اضغط «أضف للمقارنة» لاختياره." : "لا توجد منتجات مطابقة. جرّب كلمة بحث أخرى.";
    }
    entries.forEach(item => {
      const button = el("button", "mp-compare-pick", "＋ أضف للمقارنة");
      button.type = "button"; button.dataset.compareId = item.id;
      button.setAttribute("aria-pressed", "false");
      item.li.append(button);
      button.addEventListener("click", () => {
        if (selected.has(item.id)) selected.delete(item.id);
        else {
          if (selected.size >= 4) {
            results.textContent = "وصلت للحد الأقصى: 4 منتجات. أزل منتجًا أولًا لإضافة غيره.";
            return;
          }
          selected.set(item.id, item);
        }
        refresh();
      });
    });
    search.addEventListener("input", filterProducts);
    category.addEventListener("change", filterProducts);
    function renderComparison() {
      thead.replaceChildren(); tbody.replaceChildren();
      const items = [...selected.values()];
      const head = document.createElement("tr");
      ["البيان", ...items.map(item => item.name)].forEach((label, i) => {
        const th = el("th", "", label); th.scope = i ? "col" : "row"; head.append(th);
      });
      thead.append(head);
      const prices = items.filter(x => x.price !== null).map(x => x.price);
      const lowest = prices.length ? Math.min(...prices) : null;
      [["القسم", x => x.category], ["السعر المسجل", x => x.priceText],
        ["تاريخ السعر", x => x.date], ["صفحة المنتج", x => x.url]].forEach(([label, get], index) => {
        const tr = document.createElement("tr");
        const th = el("td", "mp-compare-row-label", label); tr.append(th);
        items.forEach(item => {
          const td = document.createElement("td"), value = get(item);
          if (index === 1 && item.price !== null && item.price === lowest) {
            td.classList.add("mp-compare-lowest");
            td.append(el("span", "mp-compare-lowest-tag", "أقل سعر مسجل"));
          }
          if (index === 3) {
            const a = el("a", "", "عرض المنتج"); a.href = value; td.append(a);
          } else td.append(document.createTextNode(value || "غير متاح"));
          tr.append(td);
        });
        tbody.append(tr);
      });
    }
    function openDialog() {
      if (selected.size < 2) return;
      renderComparison(); overlay.hidden = false; close.focus();
    }
    function closeDialog() { overlay.hidden = true; compare.focus(); }
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