const CACHE='mcore-shell-v25'
self.addEventListener('install',e=>{e.waitUntil(self.skipWaiting())})
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim()))})
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url)
  if(url.origin!==self.location.origin) return
  if(e.request.method!=='GET') return
  const isNav=e.request.mode==='navigate'||(e.request.headers.get('accept')||'').includes('text/html')
  if(isNav||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/app/')||url.pathname.endsWith('/app')){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(async res=>{
      const ct=res.headers.get('content-type')||''
      if(!ct.includes('html')&&!url.pathname.endsWith('.html')&&!url.pathname.endsWith('/app/')&&!url.pathname.endsWith('/app')) return res
      let html=await res.text()
      const tags=['pvd-four-roles.js?v=1','pdoc-invoice-terms.js?v=3','pdoc-customer-lock.js?v=2']
      tags.forEach(src=>{
        if(html.includes('</body>')&&!html.includes(src.split('?')[0])) html=html.replace('</body>','<script src="./'+src+'"></script>\n</body>')
      })
      return new Response(html,{status:res.status,statusText:res.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})
    }).catch(()=>caches.match('./index.html')))
    return
  }
  e.respondWith(fetch(e.request).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put(e.request,c)).catch(()=>{});return res}).catch(()=>caches.match(e.request)))
})
