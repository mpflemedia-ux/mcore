(function(){
function norm(s){return String(s||'').replace(/\s+/g,' ').trim().toLowerCase()}
function linesOf(c){
  if(!c) return [];
  var addr=[c.address,[c.postcode,c.city].filter(Boolean).join(' '),c.state].filter(Boolean).join(', ');
  var out=[]; if(addr) out.push(addr);
  var pe=[c.phone,c.email].filter(Boolean).join(' \u00b7 '); if(pe) out.push(pe);
  return out;
}
function paint(band,c){
  if(!band||!c||band.getAttribute('data-cust-locked')==='1') return;
  var lines=linesOf(c); if(!lines.length) return;
  lines.forEach(function(t){
    var d=document.createElement('div');
    d.className='pdoc-band-sub pdoc-cust-lock';
    d.style.cssText='font-size:12px;color:#334155;margin-top:3px;font-weight:500';
    d.textContent=t; band.appendChild(d);
  });
  band.setAttribute('data-cust-locked','1');
}
var cache=null;
async function allCust(){
  if(cache) return cache;
  if(!window.sb||!window.APP||!APP.tenant||!APP.tenant.id) return [];
  var rows=[];
  try{
    var r=await sb.from('customers').select('name,email,phone,address,city,state,postcode').eq('tenant_id',APP.tenant.id).limit(500);
    if(!r.error) rows=r.data||[];
  }catch(e){}
  cache=rows; return rows;
}
function match(name, rows){
  var n=norm(name); if(!n) return null;
  var hit=rows.find(function(x){return norm(x.name)===n});
  if(hit) return hit;
  hit=rows.find(function(x){return n.indexOf(norm(x.name))>=0 || norm(x.name).indexOf(n)>=0});
  if(hit) return hit;
  var first=n.split(' - ')[0];
  return rows.find(function(x){return norm(x.name).indexOf(first)>=0 || first.indexOf(norm(x.name))>=0;})||null;
}
async function run(){
  var rows=await allCust();
  document.querySelectorAll('.pdoc-band').forEach(function(band){
    var nameEl=band.querySelector('.pdoc-band-name');
    paint(band, match(nameEl&&nameEl.textContent, rows));
  });
}
run(); setInterval(run, 700);
})();
