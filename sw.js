const CACHE_NAME = "masrprices-hide-category-pages-10";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./site-enhancements.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./about.html",
  "./contact.html",
  "./privacy.html",
  "./terms.html",
  "./products/",
  "./catalog/",
  "./catalog.js",
  "./products-directory.js",
  "./product.html",
  "./phones.json",
  "./phone-model-index.json",
  "./books.json",
  "./construction.json",
  "./market-rates.json",
  "./cars.json",
  "./appliances.json",
  "./groceries.json",
  "./household-cleaning.json",
  "./computers-laptops.json",
  "./printers-ink.json",
  "./gaming-devices.json",
  "./networking-internet.json",
  "./security-cameras.json",
  "./solar-energy.json",
  "./car-tires.json",
  "./car-batteries.json",
  "./motorcycles-scooters.json",
  "./car-oils-lubricants.json",
  "./kitchen-tools-utensils.json",
  "./mattresses-home-linen.json",
  "./bathroom-fixtures.json",
  "./eyewear-lenses.json",
  "./watches.json",
  "./bags-luggage.json",
  "./perfumes.json",
  "./maternity.json",
  "./agriculture-irrigation.json",
  "./water-filters.json",
  "./home-medical-devices.json",
  "./stationery.json",
  "./clothing.json",
  "./furniture.json",
  "./personal-care.json",
  "./sports.json",
  "./electrical.json",
  "./tools.json",
  "./pets.json",
  "./plants.json",
  "./telecom.json",
  "./travel.json",
  "./electronics.json",
  "./spare-parts.json",
  "./services.json",
  "./real-estate.json",
  "./medicines.json",
  "./robots.txt",
  "./sitemap.xml"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(FILES_TO_CACHE.map(file => cache.add(file))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names
        .filter(name => name.startsWith("masrprices-") && name !== CACHE_NAME)
        .map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // API responses must always bypass the offline cache.
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          // Cache each visited URL under its own key; never replace the home page
          // with the last HTML page the visitor happened to open.
          await cache.put(event.request, response.clone());
          if (url.pathname === "/" || url.pathname === "/index.html") {
            await cache.put("./index.html", response.clone());
          }
        }
        return response;
      } catch {
        const cachedPage = await caches.match(event.request);
        if (cachedPage) return cachedPage;

        if (url.pathname === "/" || url.pathname === "/index.html") {
          const homePage = await caches.match("./index.html");
          if (homePage) return homePage;
        }

        return new Response("أنت غير متصل بالإنترنت. افتح الصفحة الرئيسية بعد عودة الاتصال لتحديث المحتوى.", {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store"
          }
        });
      }
    })());
    return;
  }

  // Refresh catalog and market JSON from the network first so automatic price
  // updates are not hidden behind an old cache. Keep the last good copy offline.
  if (url.pathname.endsWith(".json")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const freshRequest = new Request(event.request, { cache: "no-cache" });
        const response = await fetch(freshRequest);
        if (response && response.ok) {
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cachedData = await cache.match(event.request);
        if (cachedData) return cachedData;

        return new Response(JSON.stringify({ error: "البيانات غير متاحة دون اتصال." }), {
          status: 503,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
          }
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;

    const response = await fetch(event.request);
    if (response && response.ok) {
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
