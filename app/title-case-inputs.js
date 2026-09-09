(function(){
function titleCase(s){
  return String(s||'').replace(/[A-Za-z\u00C0-\u024F]+/g, function(w){
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
}
function skip(el){
  var t=String(el.type||'').toLowerCase();
  if(['email','tel','url','password','number','date','datetime-local','hidden','checkbox','radio','file'].indexOf(t)>=0) return true;
  if(el.tagName==='SELECT' || el.readOnly || el.disabled) return true;
  var id=String(el.id||'')+' '+String(el.name||'')+' '+String(el.autocomplete||'');
  if(/email|phone|tel|fax|postcode|zip|url|website|password|qty|price|amount|account|ssm|tin|qr|ref|code|sku/i.test(id)) return true;
  var v=String(el.value||'');
  if(v.indexOf('@')>=0) return true;
  if(v && /^[\d\s+\-().\/]+$/.test(v)) return true;
  return false;
}
function apply(el){
  if(!el||skip(el)) return;
  var n=titleCase(el.value);
  if(n!==el.value){
    el.value=n;
    try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
  }
}
document.addEventListener('blur', function(e){
  var el=e.target;
  if(!el||!/^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
  apply(el);
}, true);
document.addEventListener('submit', function(e){
  (e.target.querySelectorAll('input,textarea')||[]).forEach(apply);
}, true);
})();
