const CACHE_NAME = "masrprices-v58";
const FILES_TO_CACHE = ["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./phones.json","./phone-model-index.json","./books.json","./construction.json","./market-rates.json","./cars.json","./appliances.json","./groceries.json","./household-cleaning.json","./stationery.json","./clothing.json","./furniture.json","./personal-care.json","./sports.json","./electrical.json","./tools.json","./pets.json","./plants.json","./telecom.json","./travel.json","./stocks.json","./electronics.json","./spare-parts.json","./services.json","./medicines.json","./robots.txt","./sitemap.xml"];

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
  // Keep API responses out of the offline cache so price comparisons stay current.
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      });
    })
  );
});
