const CACHE='mcore-shell-v27'
self.addEventListener('install',e=>{e.waitUntil(self.skipWaiting())})
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim()))})
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url)
  if(url.origin!==self.location.origin||e.request.method!=='GET') return
  const isNav=e.request.mode==='navigate'||(e.request.headers.get('accept')||'').includes('text/html')
  if(isNav||/\/app\/?$/.test(url.pathname)||url.pathname.endsWith('/index.html')){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(async res=>{
      let html=await res.text()
      if(!html.includes('</body>')) return new Response(html)
      if(!html.includes('pdoc-customer-lock.js')) html=html.replace('</body>','<script src="./pdoc-customer-lock.js?v=5"></script></body>')
      else html=html.replace(/pdoc-customer-lock\.js\?v=\d+/g,'pdoc-customer-lock.js?v=5')
      return new Response(html,{status:res.status,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}})
    }).catch(()=>fetch(e.request)))
  }
})
