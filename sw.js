// Service worker: makes the calendar installable and usable offline.
// Network first, so updates always show up when online; the cache is only
// a fallback when there is no connection.
const CACHE = 'advent-2026-v2';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'script.js',
  'manifest.webmanifest',
  'images/favicon.svg',
  'fonts/great-vibes-latin.woff2',
  'fonts/cormorant-garamond-latin.woff2',
  'fonts/cormorant-garamond-italic-latin.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== 'advent-2026-state').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: request.mode === 'navigate' }))
  );
});

// ---------- daily "new door" notification ----------

const YEAR = 2026;
const TOTAL = 24;
const STATE = 'advent-2026-state';
const LAST_KEY = 'last-notified-day';

// Door that opened today (1–24 in December), otherwise null
function currentDoor(date = new Date()) {
  if (date.getFullYear() !== YEAR || date.getMonth() !== 11) return null;
  return date.getDate() <= TOTAL ? date.getDate() : null;
}

async function getLastNotified() {
  const res = await (await caches.open(STATE)).match(LAST_KEY);
  return res ? parseInt(await res.text(), 10) || 0 : 0;
}

async function setLastNotified(day) {
  await (await caches.open(STATE)).put(LAST_KEY, new Response(String(day)));
}

async function notifyNewDoor(day = currentDoor()) {
  if (!day || Notification.permission !== 'granted') return;
  if (day <= await getLastNotified()) return; // already announced
  await setLastNotified(day);
  await self.registration.showNotification(`Door ${day} is open! ✨`, {
    body: day === TOTAL
      ? 'The last heart of the Music Advent Calendar is waiting for you. Merry Christmas!'
      : 'A new heart is waiting behind today\'s door.',
    icon: 'images/icons/icon-192.png',
    badge: 'images/icons/icon-192.png',
    tag: 'advent-new-door',
    data: { url: self.registration.scope },
  });
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'new-door') event.waitUntil(notifyNewDoor());
});

self.addEventListener('message', (event) => {
  const { type, day } = event.data || {};
  if (type === 'check') event.waitUntil(notifyNewDoor(day));
  if (type === 'seen' && day) {
    event.waitUntil(getLastNotified().then((last) => (day > last ? setLastNotified(day) : null)));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => c.url.startsWith(self.registration.scope));
      return open ? open.navigate(url).then((c) => c && c.focus()) : self.clients.openWindow(url);
    })
  );
});
