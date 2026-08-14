/* NexERP service worker — network-first; bump CACHE to invalidate old shells */
const CACHE = 'nexerp-shell-v4'
const ASSETS = ['./', './index.html', './manifest.webmanifest']
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  )
})
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return
  if (e.request.method !== 'GET') return
  // Always prefer network for HTML / app shell so invite UX and fixes go live without Incognito
  const isNav = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html')
  if (isNav) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(res => {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {})
        return res
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    )
    return
  }
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone()
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {})
      return res
    }).catch(() => caches.match(e.request))
  )
})
