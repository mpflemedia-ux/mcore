/* M-Core service worker */
const CACHE = 'mcore-shell-v22'
self.addEventListener('install', e => { e.waitUntil(self.skipWaiting()) })
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return
  if (e.request.method !== 'GET') return
  const isNav = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html')
  if (isNav || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/app/') || url.pathname.endsWith('/app')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(async res => {
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('html') && !url.pathname.endsWith('.html') && !url.pathname.endsWith('/app/') && !url.pathname.endsWith('/app')) return res
        let html = await res.text()
        if (html.includes('</body>') && !html.includes('pvd-four-roles.js')) {
          html = html.replace('</body>', '<script src="./pvd-four-roles.js?v=1"></script>\n</body>')
        }
        if (html.includes('</body>') && !html.includes('pdoc-invoice-terms.js')) {
          html = html.replace('</body>', '<script src="./pdoc-invoice-terms.js?v=2"></script>\n</body>')
        }
        if (html.includes('</head>') && !html.includes('public-inv-scroll.js')) {
          html = html.replace('</head>', '<script src="./public-inv-scroll.js?v=3"></script></head>')
        }
        return new Response(html, {
          status: res.status,
          statusText: res.statusText,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
        })
      }).catch(() => caches.match('./index.html'))
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
