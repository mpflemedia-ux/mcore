/* M-Core service worker — HTML always network; bump CACHE to drop bad shells */
const CACHE = 'mcore-shell-v11'
self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting())
})
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return
  if (e.request.method !== 'GET') return
  const isNav = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html')
  // Never serve stale index.html / SPA shell from cache
  if (isNav || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/app/') || url.pathname.endsWith('/app')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => caches.match('./index.html'))
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

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = (event.notification && event.notification.data && event.notification.data.url) || '/app/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url && c.url.includes('/app') && 'focus' in c) return c.focus()
      }
      if (clients.openWindow) return clients.openWindow(target)
    })
  )
})
