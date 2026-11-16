"use strict";
(function () {
  function initProductComparison() {
    const page = document.querySelector("body.products-directory-page");
    if (!page || page.dataset.compareReady === "1") return;
    const groups = Array.from(page.querySelectorAll(".group"));
    if (!groups.length) return;
    page.dataset.compareReady = "1";

    const el = (tag, cls, value) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (value !== undefined) node.textContent = value;
      return node;
    };
    const entries = [];
    groups.forEach(group => group.querySelectorAll("li").forEach(li => {
      const link = li.querySelector("a[href*='/products/']");
      if (!link) return;
      const priceNode = li.querySelector(":scope > strong") || li.querySelector("strong");
      const dateNode = li.querySelector("small");
      const priceText = priceNode ? priceNode.textContent.trim() : "";
      const normalizedPrice = priceText.replace(/[^0-9٠-٩۰-۹.,]/g, "")
        .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
        .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/,/g, "");
      const price = Number(normalizedPrice);
      const heading = group.querySelector("h2,h3");
      entries.push({
        id: link.getAttribute("href"), name: link.textContent.trim(), url: link.href,
        price: Number.isFinite(price) && price > 0 ? price : null,
        priceText: priceText || "غير مسجل",
        date: dateNode ? dateNode.textContent.trim() : "غير محدد",
        category: heading ? heading.textContent.trim() : "غير محدد"
      });
    }));
    if (!entries.length) return;

    const selected = new Map();
    const picker = el("section", "mp-picker mp-picker-simple");
    picker.setAttribute("aria-label", "اختيار المنتجات للمقارنة");
    const heading = el("h2", "mp-picker-title", "قارن المنتجات بسهولة");
    const hint = el("p", "mp-picker-hint", "اكتب اسم المنتج واضغط عليه من النتائج. بعد اختيار الأول، ابحث عن المنتج الثاني.");
    const searchWrap = el("div", "mp-simple-search-wrap");
    const search = el("input", "mp-picker-search");
    search.type = "search";
    search.placeholder = "اكتب اسم المنتج هنا…";
    search.autocomplete = "off";
    search.setAttribute("aria-label", "ابحث عن المنتج الذي تريد مقارنته");
    const results = el("div", "mp-simple-results");
    results.setAttribute("role", "listbox");
    results.setAttribute("aria-label", "نتائج البحث عن المنتجات");
    searchWrap.append(search, results);
    const selectedTitle = el("strong", "mp-picker-selection-label", "المنتجات المختارة");
    const chips = el("div", "mp-picker-chips");
    const footer = el("div", "mp-simple-footer");
    const count = el("span", "mp-simple-count", "اختر منتجين للبدء");
    const compare = el("button", "mp-compare-open", "قارن الآن");
    compare.type = "button";
    compare.disabled = true;
    const clear = el("button", "mp-compare-clear", "مسح");
    clear.type = "button";
    footer.append(count, compare, clear);
    picker.append(heading, hint, searchWrap, selectedTitle, chips, footer);
    groups[0].parentNode.insertBefore(picker, groups[0]);

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
    const note = el("p", "mp-compare-note", "قارن الأسعار المسجلة وتاريخها. الأسعار استرشادية وقد تتغير لدى المتاجر.");
    const wrap = el("div", "mp-compare-table-wrap");
    const table = el("table", "mp-compare-table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    wrap.append(table);
    dialog.append(header, note, wrap);
    overlay.append(dialog);
    document.body.append(overlay);

    function renderChips() {
      chips.replaceChildren();
      if (!selected.size) {
        chips.append(el("span", "mp-picker-empty", "لم تختر أي منتج بعد"));
        return;
      }
      selected.forEach(item => {
        const chip = el("div", "mp-picker-chip");
        chip.append(el("span", "", item.name));
        const remove = el("button", "mp-picker-remove", "×");
        remove.type = "button";
        remove.setAttribute("aria-label", "إزالة " + item.name);
        remove.addEventListener("click", () => {
          selected.delete(item.id);
          render();
          search.focus();
        });
        chip.append(remove);
        chips.append(chip);
      });
    }
    function renderResults() {
      results.replaceChildren();
      const q = search.value.trim().toLocaleLowerCase("ar");
      if (!q) {
        results.hidden = true;
        return;
      }
      const matches = entries.filter(item =>
        !selected.has(item.id) && item.name.toLocaleLowerCase("ar").includes(q)
      ).slice(0, 8);
      if (!matches.length) {
        results.append(el("p", "mp-simple-empty", "مش لاقيين المنتج ده. جرّب تكتب الاسم بشكل أبسط."));
        results.hidden = false;
        return;
      }
      matches.forEach(item => {
        const button = el("button", "mp-simple-result");
        button.type = "button";
        button.setAttribute("role", "option");
        const info = el("span", "mp-simple-result-info");
        info.append(el("strong", "", item.name));
        info.append(el("small", "", item.category + " · " + item.priceText));
        button.append(info, el("span", "mp-simple-add", "اختيار"));
        button.addEventListener("click", () => {
          if (selected.size >= 4) {
            count.textContent = "الحد الأقصى 4 منتجات.";
            return;
          }
          selected.set(item.id, item);
          search.value = "";
          render();
          search.placeholder = selected.size === 1 ? "ابحث عن المنتج الثاني…" : "ابحث عن منتج آخر…";
          search.focus();
        });
        results.append(button);
      });
      results.hidden = false;
    }
    function render() {
      renderChips();
      renderResults();
      compare.disabled = selected.size < 2;
      count.textContent = selected.size < 2
        ? "اختر منتجًا آخر للمقارنة"
        : selected.size + " منتجات جاهزة للمقارنة";
    }
    function renderComparison() {
      thead.replaceChildren();
      tbody.replaceChildren();
      const items = [...selected.values()];
      const head = document.createElement("tr");
      ["البيان", ...items.map(item => item.name)].forEach((label, i) => {
        const th = el("th", "", label);
        th.scope = i ? "col" : "row";
        head.append(th);
      });
      thead.append(head);
      const prices = items.filter(x => x.price !== null).map(x => x.price);
      const lowest = prices.length ? Math.min(...prices) : null;
      [["القسم", x => x.category], ["السعر المسجل", x => x.priceText],
        ["تاريخ السعر", x => x.date], ["صفحة المنتج", x => x.url]].forEach(([label, get], index) => {
        const tr = document.createElement("tr");
        tr.append(el("td", "mp-compare-row-label", label));
        items.forEach(item => {
          const td = document.createElement("td");
          const value = get(item);
          if (index === 1 && item.price !== null && item.price === lowest) {
            td.classList.add("mp-compare-lowest");
            td.append(el("span", "mp-compare-lowest-tag", "أقل سعر مسجل"));
          }
          if (index === 3) {
            const a = el("a", "", "عرض المنتج");
            a.href = value;
            td.append(a);
          } else td.append(document.createTextNode(value || "غير متاح"));
          tr.append(td);
        });
        tbody.append(tr);
      });
    }
    function openDialog() {
      if (selected.size < 2) return;
      renderComparison();
      overlay.hidden = false;
      close.focus();
    }
    function closeDialog() {
      overlay.hidden = true;
      compare.focus();
    }
    search.addEventListener("input", renderResults);
    search.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        search.value = "";
        renderResults();
      }
    });
    compare.addEventListener("click", openDialog);
    close.addEventListener("click", closeDialog);
    overlay.addEventListener("click", event => {
      if (event.target === overlay) closeDialog();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !overlay.hidden) closeDialog();
    });
    clear.addEventListener("click", () => {
      selected.clear();
      search.value = "";
      search.placeholder = "اكتب اسم المنتج هنا…";
      render();
      search.focus();
    });
    render();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProductComparison, { once: true });
  } else initProductComparison();
})();