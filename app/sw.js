const CACHE='mcore-shell-v57'
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
// Phone alerts (Web Push). Payload built by supabase/functions/push-send (tag mcore-n-<id> matches in-app alerts, so they collapse).
self.addEventListener('push',e=>{
  let d={}
  try{d=e.data?e.data.json():{}}catch(_){d={title:'M-Core',body:e.data?e.data.text():''}}
  const title=String(d.title||'M-Core').slice(0,80)
  const opts={body:String(d.body||'').slice(0,240),icon:'/app/icons/icon-192.png',badge:'/app/icons/badge-96.png',tag:d.tag||'mcore-push',renotify:!!d.renotify||(d.prio>=1),
    requireInteraction:!!d.requireInteraction,vibrate:d.vibrate||[120],timestamp:Date.now(),actions:(d.actions||[]).slice(0,2),
    data:{url:d.url||'/app/',nid:d.nid||null,uid:d.uid||null,fn:d.fn||null,rt:d.rt||null}}
  e.waitUntil((async()=>{
    if(Array.isArray(d.replaces)&&d.replaces.length){try{const old=await self.registration.getNotifications();old.forEach(n=>{if(d.replaces.indexOf(n.tag)>=0)n.close()})}catch(_){}}
    await self.registration.showNotification(title,opts)
    // app-icon badge: exact count when the payload carries one, else a dot; open tabs then recompute the real unread count
    try{const nav=self.navigator;if(nav&&nav.setAppBadge){if(typeof d.badge==='number')await(d.badge>0?nav.setAppBadge(d.badge):nav.clearAppBadge());else await nav.setAppBadge()}}catch(_){}
    try{const cs=await self.clients.matchAll({type:'window',includeUncontrolled:true});cs.forEach(c=>{try{c.postMessage({type:'mcore-nt-refresh'})}catch(_){}})}catch(_){}
  })())
})
self.addEventListener('notificationclick',e=>{
  const n=e.notification,d=n.data||{}
  n.close()
  if(e.action==='read'){
    if(d.fn&&d.nid&&d.uid&&d.rt) e.waitUntil(fetch(d.fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'read',id:d.nid,uid:d.uid,t:d.rt})}).catch(()=>{}))
    return
  }
  if(e.action==='deliver'){
    if(d.fn&&d.nid&&d.uid&&d.rt) e.waitUntil(fetch(d.fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'deliver',id:d.nid,uid:d.uid,t:d.rt})}).then(r=>r.json()).then(r=>{if(r&&r.ok)return self.registration.showNotification('M-Core',{body:(r.ref_no||'SR')+' · Dihantar kepada client / Sent to client',icon:'/app/icons/icon-192.png',tag:'mcore-deliver-'+d.nid})}).catch(()=>{}))
    return
  }
  const url=new URL(d.url||'/app/',self.location.origin).href
  e.waitUntil((async()=>{
    const all=await self.clients.matchAll({type:'window',includeUncontrolled:true})
    const c=all.find(w=>new URL(w.url).pathname.indexOf('/app')===0)
    if(c){try{await c.focus()}catch(_){}c.postMessage({type:'mcore-open',url});return}
    if(self.clients.openWindow) await self.clients.openWindow(url)
  })())
})
// Browser rotated the subscription: re-subscribe; the app saves the new endpoint on next open (old one is cleaned up on 410).
self.addEventListener('pushsubscriptionchange',e=>{
  const key=e.oldSubscription&&e.oldSubscription.options&&e.oldSubscription.options.applicationServerKey
  if(key) e.waitUntil(self.registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key}).catch(()=>{}))
})
