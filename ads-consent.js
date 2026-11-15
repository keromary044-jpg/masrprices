(function () {
  "use strict";
  const CLIENT = "ca-pub-7745184141725915";
  const KEY = "mp:ad-consent";

  function loadAds() {
    if (document.querySelector("script[data-mp-ads]")) return;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.mpAds = "1";
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + CLIENT;
    document.head.append(script);
  }

  let choice = null;
  try { choice = localStorage.getItem(KEY); } catch (_) {}
  if (choice === "accepted") { loadAds(); return; }
  if (choice === "rejected") return;

  function showConsent() {
    if (document.querySelector(".mp-consent")) return;
    const box = document.createElement("section");
    box.className = "mp-consent";
    box.setAttribute("aria-label", "اختيارات الإعلانات والخصوصية");
    const heading = document.createElement("strong");
    heading.textContent = "اختيارات الإعلانات والخصوصية";
    const message = document.createElement("p");
    message.textContent = "يمكنك السماح بتحميل إعلانات Google أو رفضها. اختيارك محفوظ على هذا الجهاز ويمكن تغييره لاحقًا.";
    const accept = document.createElement("button");
    accept.className = "mp-action";
    accept.type = "button";
    accept.textContent = "السماح بالإعلانات";
    const reject = document.createElement("button");
    reject.className = "mp-action";
    reject.type = "button";
    reject.textContent = "رفض الإعلانات";
    accept.addEventListener("click", function () {
      try { localStorage.setItem(KEY, "accepted"); } catch (_) {}
      box.remove();
      loadAds();
    });
    reject.addEventListener("click", function () {
      try { localStorage.setItem(KEY, "rejected"); } catch (_) {}
      box.remove();
    });
    box.append(heading, message, accept, reject);
    document.body.append(box);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showConsent, { once: true });
  } else {
    showConsent();
  }
})();