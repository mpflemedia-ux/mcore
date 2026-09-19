/* Keep Documents as last page so refresh does not jump to dashboard */
(function () {
  function save() {
    try { _lsSet('nexerp_last_page', 'docs'); _lsSet('nexerp_last_params', '{}'); }
    catch (e) {
      try { localStorage.setItem('nexerp_last_page', 'docs'); localStorage.setItem('nexerp_last_params', '{}'); } catch (e2) {}
    }
  }
  setInterval(function () {
    if (APP && APP.currentPage === 'docs') save();
  }, 400);
  document.addEventListener('click', function (ev) {
    var n = ev.target && ev.target.closest && ev.target.closest('#nav-docs');
    if (n) setTimeout(save, 0);
  }, true);
})();
