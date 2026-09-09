(function(){
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}
function fromApp(){
  var t=window.APP&&APP.tenant; if(!t) return '';
  var cfg=t.config||{};
  var cp=cfg.company_profile||{};
  return String(t.invoice_terms||cp.invoice_terms||'').trim();
}
var cached='';
function paint(){
  var txt=cached||fromApp();
  if(!txt) return;
  document.querySelectorAll('.pdoc').forEach(function(doc){
    if(doc.querySelector('.pdoc-inv-terms')) return;
    var el=document.createElement('div');
    el.className='pdoc-inv-terms';
    el.style.cssText='padding:12px 24px 0;font-size:12px;line-height:1.55;color:#334155;white-space:pre-wrap';
    el.textContent=txt;
    var note=null;
    var divs=doc.querySelectorAll('div');
    for(var i=0;i<divs.length;i++){
      var t=(divs[i].textContent||'').trim();
      if(/computer generated|dijana oleh komputer/i.test(t) && t.length<120){ note=divs[i]; break; }
    }
    if(note) note.parentNode.insertBefore(el, note);
    else {
      var foot=doc.querySelector('.pdoc-footer-note');
      if(foot) doc.insertBefore(el, foot);
      else doc.appendChild(el);
    }
  });
}
async function hydrate(){
  cached=cached||fromApp();
  if(cached){ paint(); return; }
  if(!window.sb||!window.APP||!APP.tenant) return;
  try{
    var r=await sb.from('tenants').select('config').eq('id',APP.tenant.id).maybeSingle();
    var cfg=(r.data&&r.data.config)||{};
    if(typeof cfg==='string'){ try{cfg=JSON.parse(cfg)}catch(e){cfg={}} }
    cached=String((cfg.company_profile&&cfg.company_profile.invoice_terms)||'').trim();
    if(cached && APP.tenant){
      APP.tenant.config=APP.tenant.config||{};
      APP.tenant.config.company_profile=Object.assign({},APP.tenant.config.company_profile||{},{invoice_terms:cached});
    }
  }catch(e){}
  paint();
}
hydrate();
setInterval(function(){ hydrate(); paint(); }, 900);
new MutationObserver(function(){ paint(); }).observe(document.documentElement,{childList:true,subtree:true});
})();
