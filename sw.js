const CACHE_NAME = "masrprices-v24";
const FILES_TO_CACHE = ["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./phones.json","./phone-model-index.json","./books.json","./construction.json","./market-rates.json","./cars.json","./appliances.json","./groceries.json","./stationery.json","./clothing.json","./furniture.json","./personal-care.json","./sports.json","./electrical.json","./tools.json","./pets.json","./plants.json","./telecom.json","./travel.json","./stocks.json"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith("masrprices-") && name !== CACHE_NAME).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => cached)));
});