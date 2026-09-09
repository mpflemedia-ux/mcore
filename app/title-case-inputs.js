(function(){
function titleCase(s){
  return String(s||'').replace(/[A-Za-z\u00C0-\u024F]+/g, function(w){
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
}
function skip(el){
  var t=String(el.type||'').toLowerCase();
  if(['email','tel','url','password','number','date','datetime-local','hidden','checkbox','radio','file','search'].indexOf(t)>=0) return true;
  if(el.tagName==='SELECT' || el.readOnly || el.disabled) return true;
  var id=String(el.id||'')+' '+String(el.name||'');
  if(/email|phone|tel|fax|postcode|zip|url|website|password|qty|price|amount|account|ssm|tin|qr|sku|search/i.test(id)) return true;
  if(/\bcf-code\b|\bref_no\b|\bif-/.test(id) && /code|ref/.test(id)) return true;
  var v=String(el.value||'');
  if(v.indexOf('@')>=0) return true;
  if(v && /^[\d\s+\-().\/]+$/.test(v)) return true;
  return false;
}
function apply(el){
  if(!el||skip(el)) return false;
  var n=titleCase(el.value);
  if(n===el.value) return false;
  el.value=n;
  try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
  return true;
}
function scan(){
  var nodes=document.querySelectorAll('input,textarea');
  for(var i=0;i<nodes.length;i++){
    var el=nodes[i];
    if(el===document.activeElement) continue;
    apply(el);
  }
}
document.addEventListener('blur', function(e){
  var el=e.target;
  if(!el||!/^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
  apply(el);
}, true);
scan();
setInterval(scan, 700);
})();
