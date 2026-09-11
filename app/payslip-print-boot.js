(function(){
  var href='./payslip-print.css?v=2';
  var el=document.querySelector('link[data-ps-print]');
  if(!el){
    el=document.createElement('link');
    el.rel='stylesheet';
    el.setAttribute('data-ps-print','1');
    document.head.appendChild(el);
  }
  el.href=href;
  function apply(){
    if(!document.querySelector('.ps-stmt')) return;
    if(typeof _pdocSetPageOrientation==='function') _pdocSetPageOrientation('landscape', 8);
  }
  apply();
  setInterval(apply, 800);
  window.addEventListener('beforeprint', apply);
})();
