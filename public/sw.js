// Clutched offline cache: network first, fall back to the last copy we saw.
// Bump VERSION to force phones to drop old caches after a big change.
const VERSION = "clutched-v5"
const BASE = new URL(self.registration.scope).pathname
const SHELL = ["", "manifest.webmanifest", "favicon.svg", "icon-192.png"].map((p) => BASE + p)

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  const url = new URL(req.url)
  // Same-origin files only (fonts are bundled with the app). Map tiles are left to the browser's own cache
  // (they arrive "opaque", which would eat storage quota if we stored them here).
  const cacheable = url.origin === self.location.origin
  // Leave video to the browser: it streams in byte ranges, which don't belong in this cache.
  if (req.method !== "GET" || !cacheable || req.headers.has("range") || /\.(mp4|webm)$/.test(url.pathname)) return
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          event.waitUntil(caches.open(VERSION).then((cache) => cache.put(req, copy)))
        }
        return res
      })
      .catch(async () => (await caches.match(req)) || (req.mode === "navigate" ? caches.match(BASE) : Response.error())),
  )
})
