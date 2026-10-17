/* Only public resources enter Cache Storage. Never HTML/RSC/API/session data. */
const SHELL = "cofi-shell-v2";
const PUBLIC_FILES = ["/offline.html", "/offline.js", "/offline.css", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PUBLIC_FILES)));
  // An update waits. The user chooses when to reload from the app banner.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("cofi-shell-") && key !== SHELL).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "ACTIVATE_UPDATE") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
  // Exact public allowlist; query strings cannot turn RSC responses into assets.
  if (!url.search && PUBLIC_FILES.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Generic fallback. */ }
  // No private event details on a phone's lock screen.
  event.waitUntil(self.registration.showNotification("Centro Familiar", {
    body: "Tienes un aviso nuevo. Abre COFI para consultarlo.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    silent: true,
    tag: typeof payload.tag === "string" ? payload.tag.slice(0, 100) : "cofi-aviso",
    data: { url: "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const app = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (app) { await app.focus(); return; }
    await self.clients.openWindow("/");
  })());
});
