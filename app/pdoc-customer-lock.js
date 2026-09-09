(function(){
function linesOf(c){
  if(!c) return [];
  var addr=[c.address_line1||c.address,[c.postcode,c.city].filter(Boolean).join(' '),c.state].filter(Boolean).join(', ');
  var out=[]; if(addr) out.push(addr);
  var pe=[c.phone,c.email].filter(Boolean).join(' \u00b7 '); if(pe) out.push(pe);
  return out;
}
function paint(band,c){
  if(!band||!c||band.getAttribute('data-cust-locked')==='1') return;
  var lines=linesOf(c); if(!lines.length) return;
  lines.forEach(function(t){
    var d=document.createElement('div');
    d.className='pdoc-band-sub';
    d.style.cssText='font-size:12px;color:#334155;margin-top:3px;font-weight:600';
    d.textContent=t; band.appendChild(d);
  });
  band.setAttribute('data-cust-locked','1');
}
async function lookup(name){
  if(!window.sb||!window.APP||!APP.tenant||!name) return null;
  var raw=String(name).replace(/\s+/g,' ').trim();
  var token=raw.split(/[\s\-\u2013\u2014]+/)[0];
  if(token.length<3) token=raw.slice(0,12);
  try{
    var q=await sb.from('customers').select('name,email,phone,address_line1,city,state,postcode').eq('tenant_id',APP.tenant.id).ilike('name','%'+token+'%').limit(20);
    if(q.error){
      q=await sb.from('customers').select('name,email,phone').eq('tenant_id',APP.tenant.id).ilike('name','%'+token+'%').limit(20);
    }
    var rows=q.data||[];
    if(!rows.length){
      q=await sb.from('customers').select('name,email,phone,address_line1,city,state,postcode').eq('tenant_id',APP.tenant.id).limit(200);
      if(q.error) q=await sb.from('customers').select('name,email,phone').eq('tenant_id',APP.tenant.id).limit(200);
      rows=q.data||[];
    }
    var n=raw.toLowerCase();
    return rows.find(function(x){return String(x.name||'').replace(/\s+/g,' ').trim().toLowerCase()===n;})
      || rows.find(function(x){return String(x.name||'').toLowerCase().indexOf(token.toLowerCase())>=0;})
      || rows[0]||null;
  }catch(e){ return null; }
}
async function scan(){
  var bands=document.querySelectorAll('.pdoc-band');
  for(var i=0;i<bands.length;i++){
    var band=bands[i];
    if(band.getAttribute('data-cust-locked')==='1') continue;
    var nameEl=band.querySelector('.pdoc-band-name');
    var name=nameEl&&nameEl.textContent;
    if(!name||name==='-') continue;
    var c=await lookup(name);
    if(c) paint(band,c);
  }
}
scan();
setInterval(scan,800);
new MutationObserver(function(){scan();}).observe(document.documentElement,{childList:true,subtree:true});
})();
