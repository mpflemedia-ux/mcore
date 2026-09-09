(function(){
function linesOf(c){
  if(!c) return [];
  var addr=[c.address,[c.postcode,c.city].filter(Boolean).join(' '),c.state].filter(Boolean).join(', ');
  var out=[]; if(addr) out.push(addr);
  var pe=[c.phone,c.email].filter(Boolean).join(' \u00b7 '); if(pe) out.push(pe);
  return out;
}
function paintAll(c){
  var lines=linesOf(c); if(!lines.length) return;
  document.querySelectorAll('.pdoc-band').forEach(function(band){
    if(band.getAttribute('data-cust-locked')==='1') return;
    lines.forEach(function(t){
      var d=document.createElement('div');
      d.className='pdoc-band-sub';
      d.style.cssText='font-size:12px;color:#334155;margin-top:3px;font-weight:500';
      d.textContent=t; band.appendChild(d);
    });
    band.setAttribute('data-cust-locked','1');
  });
}
async function fillFromInvoice(id){
  if(!id||!window.sb||!window.APP||!APP.tenant) return;
  var invRes=await sb.from('invoices').select('customer_id,customer_name').eq('id',id).eq('tenant_id',APP.tenant.id).maybeSingle();
  var inv=invRes&&invRes.data; if(!inv) return;
  var c=null;
  if(inv.customer_id){
    var one=await sb.from('customers').select('name,email,phone,address,city,state,postcode').eq('id',inv.customer_id).maybeSingle();
    c=one&&one.data;
  }
  if(!c){
    var list=await sb.from('customers').select('name,email,phone,address,city,state,postcode').eq('tenant_id',APP.tenant.id).limit(500);
    var rows=list.data||[];
    var n=String(inv.customer_name||'').replace(/\s+/g,' ').trim().toLowerCase();
    c=rows.find(function(x){return String(x.name||'').replace(/\s+/g,' ').trim().toLowerCase()===n})||rows.find(function(x){return n.indexOf(String(x.name||'').toLowerCase())>=0||String(x.name||'').toLowerCase().indexOf(n.split(' - ')[0])>=0;})||null;
  }
  if(c) paintAll(c);
}
function wrap(){
  if(typeof window.renderInvDetail!=='function'||window.renderInvDetail._custWrap) return false;
  var orig=window.renderInvDetail;
  window.renderInvDetail=async function(id){
    var r=orig.apply(this,arguments);
    try{await r}catch(e){}
    try{await fillFromInvoice(id)}catch(e){}
    return r;
  };
  window.renderInvDetail._custWrap=true;
  return true;
}
var n=0; var t=setInterval(function(){ if(wrap()||++n>80) clearInterval(t); },200);
wrap();
})();
