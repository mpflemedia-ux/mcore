const CACHE='mcore-shell-v38'
self.addEventListener('install',e=>{e.waitUntil(self.skipWaiting())})
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim()))})
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url)
  if(url.origin!==self.location.origin||e.request.method!=='GET') return
  // Public invoice deep-link → public.html (keep redirect only; do not buffer HTML)
  if(url.searchParams.has('public_inv') && !url.pathname.includes('public.html')){
    const dest=new URL('./public.html', url.origin+url.pathname.replace(/index\.html$/,''))
    if(!dest.pathname.endsWith('public.html')) dest.pathname=url.pathname.replace(/\/app\/?$/,'/app/public.html')
    dest.search=url.search
    e.respondWith(Response.redirect(dest.toString(), 302))
    return
  }
  // Navigate/HTML: pass-through. Buffering full index.html (~2MB) before first byte
  // caused a blank dark screen until the whole shell downloaded (felt like needing 2 refreshes).
  // Script/CSS pins stay baked into index.html via CI bake scripts.
})
