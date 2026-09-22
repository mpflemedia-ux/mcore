const CACHE='mcore-shell-v31'
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
      html=html.replace(/title-case-inputs\.js\?v=\d+/g,'title-case-inputs.js?v=3')
      html=html.replace(/docs-content-scan\.js\?v=\d+/g,'docs-content-scan.js?v=5')
      html=html.replace(/docs-classify\.js\?v=\d+/g,'docs-classify.js?v=8')
      html=html.replace(/docs-slot-fix\.js\?v=\d+/g,'docs-slot-fix.js?v=5')
      html=html.replace(/docs-seed\.js\?v=\d+/g,'docs-seed.js?v=8')
      html=html.replace(/doc-router-admin\.js\?v=\d+/g,'doc-router-admin.js?v=7')
      if(!html.includes('docs-letterhead-patch.js')) html=html.replace('</body>','<script src="./docs-letterhead-patch.js?v=1"></script></body>')
      else html=html.replace(/docs-letterhead-patch\.js\?v=\d+/g,'docs-letterhead-patch.js?v=1')
      return new Response(html,{status:res.status,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}})
    }).catch(()=>fetch(e.request)))
  }
})
