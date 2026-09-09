(function(){
  var token=new URLSearchParams(location.search).get('public_inv');
  if(!token) return;
  if(location.pathname.indexOf('public.html')===-1){
    location.replace('/app/public.html?public_inv='+encodeURIComponent(token));
    return;
  }
})();
