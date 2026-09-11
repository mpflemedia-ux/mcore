(function(){
function isPayslip(doc){
  return /payslip|slip gaji|net pay/i.test(doc.textContent||'');
}
function fix(doc){
  var g=doc.querySelector('.pdoc-band-grid');
  if(!g||g.dataset.aligned==='1') return;
  var items=[].slice.call(g.querySelectorAll(':scope > .pdoc-band-item'));
  if(!items.length) return;
  var left=document.createElement('div');
  var right=document.createElement('div');
  right.className='pdoc-band-right';
  right.style.cssText='text-align:right';
  items.forEach(function(it){
    var lab=((it.childNodes[0]&&it.childNodes[0].textContent)||it.textContent||'').trim();
    if(/bank account no|no\.\s*akaun bank|period|tempoh/i.test(lab)) right.appendChild(it);
    else left.appendChild(it);
  });
  g.innerHTML='';
  g.appendChild(left);
  g.appendChild(right);
  g.dataset.aligned='1';
}
function run(){
  document.querySelectorAll('.pdoc').forEach(function(doc){
    if(isPayslip(doc)) fix(doc);
  });
}
run();
setInterval(run,800);
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
})();
