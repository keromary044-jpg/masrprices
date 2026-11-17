"use strict";
(function () {
  function initProductComparison() {
    const page = document.querySelector("body.products-directory-page");
    if (!page || page.dataset.compareReady === "1") return;
    const groups = Array.from(page.querySelectorAll(".group"));
    if (!groups.length) return;

    const make = (tag, className, value) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (value !== undefined) node.textContent = value;
      return node;
    };
    const normalize = value => String(value || "")
      .toLocaleLowerCase("ar")
      .normalize("NFD")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim();
    const toNumber = value => {
      const digits = String(value || "")
        .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
        .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
      const cleaned = digits.replace(/[^\d.,]/g, "").replace(/,/g, "");
      const number = Number(cleaned);
      return Number.isFinite(number) && number > 0 ? number : null;
    };

    const entries = [];
    groups.forEach(group => {
      const heading = group.querySelector("h2,h3");
      const categoryName = heading
        ? heading.textContent.trim().replace(/\s*\(\d+\)\s*$/, "")
        : "قسم آخر";
      group.querySelectorAll("li").forEach(li => {
        const link = li.querySelector("a[href*='/products/']");
        if (!link) return;
        const priceNode = li.querySelector(":scope > strong") || li.querySelector("strong");
        const dateNode = li.querySelector("small");
        const priceText = priceNode ? priceNode.textContent.trim() : "غير مسجل";
        entries.push({
          id: link.getAttribute("href"),
          name: link.textContent.trim(),
          url: link.href,
          category: categoryName,
          price: toNumber(priceText),
          priceText,
          date: dateNode ? dateNode.textContent.trim() : "غير محدد"
        });
      });
    });
    if (!entries.length) return;
    page.dataset.compareReady = "1";

    const selected = new Map();
    const categories = [...new Set(entries.map(item => item.category))];
    const picker = make("section", "mp-picker mp-picker-one-button");
    picker.id = "compare-products";
    picker.setAttribute("aria-label", "إضافة منتجات للمقارنة");

    const launch = make("button", "mp-one-launch", "إضافة منتج للمقارنة");
    launch.type = "button";
    launch.setAttribute("aria-expanded", "false");

    const panel = make("div", "mp-one-panel");
    panel.hidden = true;
    const title = make("h2", "mp-one-title", "اختار القسم وابحث عن المنتج");
    const hint = make("p", "mp-one-hint", "اكتب حرفًا واحدًا أو أكثر، وستظهر المنتجات المطابقة فورًا.");
    const categoryLabel = make("label", "mp-one-label", "القسم");
    const category = make("select", "mp-one-category");
    category.setAttribute("aria-label", "اختيار القسم");
    const allOption = make("option", "", "كل الأقسام");
    allOption.value = "";
    category.append(allOption);
    categories.forEach(name => {
      const option = make("option", "", name);
      option.value = name;
      category.append(option);
    });
    categoryLabel.append(category);

    const searchLabel = make("label", "mp-one-label", "اسم المنتج");
    const search = make("input", "mp-one-search");
    search.type = "search";
    search.autocomplete = "off";
    search.enterKeyHint = "search";
    search.placeholder = "اكتب اسم المنتج هنا...";
    search.setAttribute("aria-label", "البحث باسم المنتج");
    searchLabel.append(search);

    const results = make("div", "mp-one-results");
    results.setAttribute("role", "listbox");
    results.setAttribute("aria-label", "نتائج البحث عن المنتجات");
    results.hidden = true;

    const selectedTitle = make("h3", "mp-one-selected-title", "المنتجات المضافة");
    const selectedList = make("div", "mp-one-selected-list");
    const compareArea = make("div", "mp-one-comparison");
    panel.append(title, hint, categoryLabel, searchLabel, results, selectedTitle, selectedList, compareArea);
    picker.append(launch, panel);
    groups[0].parentNode.insertBefore(picker, groups[0]);

    function filteredEntries() {
      const query = normalize(search.value);
      const categoryValue = category.value;
      return entries.filter(item => {
        if (selected.has(item.id)) return false;
        if (categoryValue && item.category !== categoryValue) return false;
        return !query || normalize(item.name).includes(query);
      }).slice(0, 30);
    }

    function showResults() {
      results.replaceChildren();
      const matches = filteredEntries();
      if (!search.value.trim() && !category.value) {
        results.hidden = true;
        return;
      }
      if (!matches.length) {
        results.append(make("p", "mp-one-empty", "لا توجد منتجات مطابقة. جرّب كتابة جزء آخر من الاسم أو غيّر القسم."));
      } else {
        matches.forEach(item => {
          const option = make("button", "mp-one-result", "");
          option.type = "button";
          option.setAttribute("role", "option");
          option.append(
            make("span", "mp-one-result-name", item.name),
            make("span", "mp-one-result-meta", item.category + " · " + item.priceText)
          );
          option.addEventListener("click", () => {
            if (selected.size >= 4 || selected.has(item.id)) return;
            selected.set(item.id, item);
            search.value = "";
            render();
            search.focus();
          });
          results.append(option);
        });
      }
      results.hidden = false;
    }

    function renderSelected() {
      selectedList.replaceChildren();
      if (!selected.size) {
        selectedList.append(make("p", "mp-one-empty-selected", "لم تضف أي منتج بعد."));
        return;
      }
      selected.forEach(item => {
        const row = make("div", "mp-one-chip");
        row.append(make("span", "mp-one-chip-name", item.name + " — " + item.category));
        const remove = make("button", "mp-one-remove", "×");
        remove.type = "button";
        remove.setAttribute("aria-label", "حذف " + item.name + " من المقارنة");
        remove.addEventListener("click", () => {
          selected.delete(item.id);
          render();
        });
        row.append(remove);
        selectedList.append(row);
      });
    }

    function renderComparison() {
      compareArea.replaceChildren();
      if (selected.size < 2) {
        if (selected.size === 1) {
          compareArea.append(make("p", "mp-one-progress", "أضف منتجًا ثانيًا لعرض المقارنة تلقائيًا."));
        }
        return;
      }
      const items = [...selected.values()];
      const tableWrap = make("div", "mp-one-table-wrap");
      const table = make("table", "mp-one-table");
      const head = document.createElement("thead");
      const body = document.createElement("tbody");
      const headRow = document.createElement("tr");
      headRow.append(make("th", "", "البيان"));
      items.forEach(item => headRow.append(make("th", "", item.name)));
      head.append(headRow);
      table.append(head, body);
      const priced = items.filter(item => item.price !== null).map(item => item.price);
      const lowest = priced.length ? Math.min(...priced) : null;
      [
        ["القسم", item => item.category],
        ["السعر", item => item.priceText],
        ["تاريخ السعر", item => item.date],
        ["صفحة المنتج", item => item.url]
      ].forEach(([label, get], rowIndex) => {
        const tr = document.createElement("tr");
        tr.append(make("th", "mp-one-row-label", label));
        items.forEach(item => {
          const td = document.createElement("td");
          if (rowIndex === 1 && item.price !== null && item.price === lowest) {
            td.classList.add("mp-one-lowest");
            td.append(make("small", "mp-one-lowest-tag", "أقل سعر مسجل"));
          }
          if (rowIndex === 3) {
            const a = make("a", "", "عرض المنتج");
            a.href = get(item);
            td.append(a);
          } else {
            td.append(document.createTextNode(get(item) || "غير متاح"));
          }
          tr.append(td);
        });
        body.append(tr);
      });
      tableWrap.append(table);
      compareArea.append(make("h3", "mp-one-compare-title", "المقارنة بين المنتجات"), tableWrap);
    }

    function render() {
      renderSelected();
      renderComparison();
      showResults();
      if (selected.size >= 4) {
        hint.textContent = "وصلت للحد الأقصى (٤ منتجات). احذف منتجًا لإضافة غيره.";
      } else {
        hint.textContent = "اكتب حرفًا واحدًا أو أكثر، وستظهر المنتجات المطابقة فورًا.";
      }
    }

    launch.addEventListener("click", () => {
      panel.hidden = false;
      launch.hidden = true;
      launch.setAttribute("aria-expanded", "true");
      search.focus();
    });
    category.addEventListener("change", showResults);
    search.addEventListener("input", showResults);
    search.addEventListener("search", showResults);

    if (window.location.hash === "#compare-products") {
      panel.hidden = false;
      launch.hidden = true;
      launch.setAttribute("aria-expanded", "true");
    }
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProductComparison, { once: true });
  } else {
    initProductComparison();
  }
})();