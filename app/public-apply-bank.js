(function(){
function bm(){
  try{
    var q=new URLSearchParams(location.search).get('lang');
    if(q==='bm'||q==='ms') return true;
    if(q==='en') return false;
    if(window._pubApplyLang==='bm') return true;
    if(window.APP&&APP.language==='bm') return true;
  }catch(e){}
  return false;
}
function g(id){ var el=document.getElementById(id); return el?el.value:''; }
function inject(){
  var btn=document.getElementById('pub-apply-btn');
  if(!btn||document.getElementById('pub-bank-name')) return;
  var B=bm();
  var d=document.createElement('div');
  d.id='pub-bank-block';
  d.innerHTML='<div style="font-weight:700;margin:16px 0 8px">'+(B?'Maklumat Bank & Statutori':'Bank & Statutory')+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +'<div class="form-group"><label class="form-label">'+(B?'Nama Bank':'Bank Name')+'</label><input class="form-input" id="pub-bank-name"></div>'
    +'<div class="form-group"><label class="form-label">'+(B?'Nama Pemegang Akaun':'Account Name')+'</label><input class="form-input" id="pub-bank-acc-name"></div>'
    +'<div class="form-group" style="grid-column:1/-1"><label class="form-label">'+(B?'No. Akaun Bank':'Bank Account No.')+'</label><input class="form-input" id="pub-bank-acc-no" inputmode="numeric"></div>'
    +'<div class="form-group"><label class="form-label">'+(B?'No. EPF / KWSP':'EPF / KWSP No.')+'</label><input class="form-input" id="pub-epf"></div>'
    +'<div class="form-group"><label class="form-label">'+(B?'No. SOCSO / PERKESO':'SOCSO / PERKESO No.')+'</label><input class="form-input" id="pub-socso"></div>'
    +'</div>';
  var err=document.getElementById('pub-apply-err');
  btn.parentNode.insertBefore(d, err||btn);
}
var orig=window._pubApplySubmit;
window._pubApplySubmit=async function(token){
  if(typeof orig==='function'){
    var _rpc=window.sb&&sb.rpc.bind(sb);
    if(_rpc){
      sb.rpc=function(name,args){
        if(name==='submit_public_application'&&args&&args.p_payload){
          args.p_payload.bank_name=g('pub-bank-name');
          args.p_payload.bank_account_name=g('pub-bank-acc-name');
          args.p_payload.bank_account_no=g('pub-bank-acc-no');
          args.p_payload.epf_no=g('pub-epf');
          args.p_payload.socso_no=g('pub-socso');
        }
        return _rpc(name,args);
      };
    }
    try{ return await orig(token); }
    finally{ if(_rpc) sb.rpc=_rpc; }
  }
};
setInterval(inject,500);
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject);
else inject();
})();
