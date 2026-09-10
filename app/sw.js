const CACHE='mcore-shell-v29'
self.addEventListener('install',e=>{e.waitUntil(self.skipWaiting())})
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim()))})
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url)
  if(url.origin!==self.location.origin||e.request.method!=='GET') return
  if(url.searchParams.has('public_inv') && !url.pathname.includes('public.html')){
    const dest=new URL('./public.html', url.origin+url.pathname.replace(/index\.html$/,''))
    if(!dest.pathname.endsWith('public.html')) dest.pathname=url.pathname.replace(/\/app\/?$/,'/app/public.html')
    dest.search=url.search
    e.respondWith(Response.redirect(dest.toString(), 302))
    return
  }
  const isNav=e.request.mode==='navigate'||(e.request.headers.get('accept')||'').includes('text/html')
  if(isNav||/\/app\/?$/.test(url.pathname)||url.pathname.endsWith('/index.html')){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(async res=>{
      let html=await res.text()
      if(!html.includes('</body>')) return new Response(html)
      if(!html.includes('public-inv-scroll.js')) html=html.replace('</head>','<script src="./public-inv-scroll.js?v=4"></script></head>')
      if(!html.includes('public-apply.js')) html=html.replace('</body>','<script src="./public-apply.js?v=1"></script></body>')
      return new Response(html,{status:res.status,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}})
    }).catch(()=>fetch(e.request)))
  }
})
