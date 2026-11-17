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
    groups.forEach(group => {
      const heading = group.querySelector("h2,h3");
      const category = heading ? heading.textContent.trim().replace(/\\s*\\(\\d+\\)\\s*$/, "") : "قسم آخر";
      group.querySelectorAll("li").forEach(li => {
        const link = li.querySelector("a[href*='/products/']");
        if (!link) return;
        const priceNode = li.querySelector(":scope > strong") || li.querySelector("strong");
        const dateNode = li.querySelector("small");
        const priceText = priceNode ? priceNode.textContent.trim() : "";
        const normalizedPrice = priceText.replace(/[^0-9٠-٩۰-۹.,]/g, "")
          .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
          .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/,/g, "");
        const price = Number(normalizedPrice);
        entries.push({
          id: link.getAttribute("href"), name: link.textContent.trim(), url: link.href,
          price: Number.isFinite(price) && price > 0 ? price : null,
          priceText: priceText || "غير مسجل",
          date: dateNode ? dateNode.textContent.trim() : "غير محدد",
          category
        });
      });
    });
    if (!entries.length) return;

    const selected = new Map();
    const categories = [...new Set(entries.map(item => item.category))];
    const picker = el("section", "mp-picker mp-picker-simple mp-picker-flow");
    picker.id = "compare-products";
    picker.setAttribute("aria-label", "اختيار المنتجات للمقارنة");

    const launcher = el("button", "mp-start-compare", "ابدأ المقارنة");
    launcher.type = "button";
    launcher.setAttribute("aria-expanded", "false");

    const panel = el("div", "mp-picker-panel");
    panel.hidden = true;
    const heading = el("h2", "mp-picker-title", "اختيار المنتجات للمقارنة");
    const hint = el("p", "mp-picker-hint", "اختار القسم الأول، وبعده اختار المنتج، ثم اضغط إضافة للمقارنة.");
    const controls = el("div", "mp-flow-controls");

    const categoryLabel = el("label", "mp-flow-label", "١. اختار القسم");
    const category = el("select", "mp-flow-select");
    category.setAttribute("aria-label", "اختيار القسم");
    const categoryPlaceholder = el("option", "", "اختار القسم");
    categoryPlaceholder.value = "";
    categoryPlaceholder.disabled = true;
    categoryPlaceholder.selected = true;
    category.append(categoryPlaceholder);
    categories.forEach(name => {
      const option = el("option", "", name);
      option.value = name;
      category.append(option);
    });

    const productLabel = el("label", "mp-flow-label", "٢. اختار المنتج");
    const product = el("select", "mp-flow-select");
    product.setAttribute("aria-label", "اختيار المنتج");
    product.disabled = true;
    const productPlaceholder = el("option", "", "اختار القسم الأول");
    productPlaceholder.value = "";
    productPlaceholder.selected = true;
    product.append(productPlaceholder);

    controls.append(categoryLabel, category, productLabel, product);
    const add = el("button", "mp-flow-add", "إضافة للمقارنة");
    add.type = "button";
    add.disabled = true;

    const selectedTitle = el("strong", "mp-picker-selection-label", "المنتجات المختارة");
    const chips = el("div", "mp-picker-chips");
    const footer = el("div", "mp-simple-footer mp-flow-footer");
    const count = el("span", "mp-simple-count", "لم يتم اختيار منتجات بعد");
    const compare = el("button", "mp-compare-open", "قارن المنتجات");
    compare.type = "button";
    compare.disabled = true;
    const clear = el("button", "mp-compare-clear", "مسح الاختيارات");
    clear.type = "button";
    footer.append(count, compare, clear);
    panel.append(heading, hint, controls, add, selectedTitle, chips, footer);
    picker.append(launcher, panel);
    groups[0].parentNode.insertBefore(picker, groups[0]);

    function fillProducts() {
      product.replaceChildren();
      const placeholder = el("option", "", category.value ? "اختار المنتج" : "اختار القسم الأول");
      placeholder.value = "";
      placeholder.selected = true;
      product.append(placeholder);
      product.disabled = !category.value;
      if (!category.value) return;
      entries.filter(item => item.category === category.value).forEach(item => {
        const option = el("option", "", item.name + " — " + item.priceText);
        option.value = item.id;
        product.append(option);
      });
      add.disabled = true;
    }

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
        chips.append(el("span", "mp-picker-empty", "لسه ما ضفتش أي منتج"));
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
          if (product.value === item.id) product.value = "";
        });
        chip.append(remove);
        chips.append(chip);
      });
    }
    function render() {
      renderChips();
      compare.disabled = selected.size < 2;
      add.disabled = !product.value || selected.has(product.value) || selected.size >= 4;
      if (selected.size >= 4) {
        count.textContent = "وصلت للحد الأقصى: ٤ منتجات";
      } else if (selected.size === 0) {
        count.textContent = "اختار منتجين على الأقل للمقارنة";
      } else {
        count.textContent = "تمت إضافة " + selected.size + " من ٤ منتجات";
      }
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

    launcher.addEventListener("click", () => {
      panel.hidden = false;
      launcher.hidden = true;
      launcher.setAttribute("aria-expanded", "true");
      category.focus();
    });
    category.addEventListener("change", fillProducts);
    product.addEventListener("change", render);
    add.addEventListener("click", () => {
      const item = entries.find(entry => entry.id === product.value);
      if (!item || selected.has(item.id) || selected.size >= 4) return;
      selected.set(item.id, item);
      product.value = "";
      render();
      product.focus();
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
      category.value = "";
      fillProducts();
      render();
      category.focus();
    });

    render();
    if (window.location.hash === "#compare-products") {
      panel.hidden = false;
      launcher.hidden = true;
      launcher.setAttribute("aria-expanded", "true");
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProductComparison, { once: true });
  } else initProductComparison();
})();