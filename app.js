const searchInput = document.getElementById("searchInput");
const categoryCards = document.querySelectorAll(".category-card");
const noResults = document.getElementById("noResults");

if (searchInput) {
  searchInput.addEventListener("input", function () {
    const searchTerm = this.value.trim().toLowerCase();
    let visibleCount = 0;

    categoryCards.forEach(function (card) {
      const text = card.textContent.toLowerCase();
      const keywords = (card.dataset.search || "").toLowerCase();

      const matches =
        text.includes(searchTerm) ||
        keywords.includes(searchTerm);

      card.hidden = !matches;

      if (matches) visibleCount++;
    });

    if (noResults) {
      noResults.hidden = visibleCount !== 0;
    }
  });
}

// تشغيل الموقع كتطبيق قابل للتثبيت
let deferredPrompt;

const installBtn = document.getElementById("installBtn");

window.addEventListener("beforeinstallprompt", function (event) {
  event.preventDefault();
  deferredPrompt = event;

  if (installBtn) {
    installBtn.hidden = false;
  }
});

if (installBtn) {
  installBtn.addEventListener("click", async function () {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    deferredPrompt = null;
    installBtn.hidden = true;
  });
}

// تشغيل العمل دون إنترنت عند توفر الخدمة
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  });
}
