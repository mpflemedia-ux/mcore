(function(){
  if(!document.querySelector('link[data-ps-print]')){
    var l=document.createElement('link');
    l.rel='stylesheet';
    l.href='./payslip-print.css?v=1';
    l.setAttribute('data-ps-print','1');
    document.head.appendChild(l);
  }
  function apply(){
    if(!document.querySelector('.ps-stmt')) return;
    if(typeof _pdocSetPageOrientation==='function') _pdocSetPageOrientation('landscape', 8);
  }
  apply();
  setInterval(apply, 600);
  window.addEventListener('beforeprint', apply);
})();
