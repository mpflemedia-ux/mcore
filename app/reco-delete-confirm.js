(function () {
  function typedOk() {
    var el = document.getElementById('reco-delete-all-confirm-input');
    return String(el && el.value || '').trim().toUpperCase() === 'DELETE';
  }
  function softenInput() {
    var el = document.getElementById('reco-delete-all-confirm-input');
    if (!el) return;
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('spellcheck', 'false');
    el.style.textTransform = 'none';
  }
  function hookBtn() {
    var orig = window._recoDeleteAllUpdateBtn;
    if (typeof orig !== 'function' || orig._caseFix) return;
    window._recoDeleteAllUpdateBtn = function () {
      softenInput();
      var btn = document.getElementById('reco-delete-all-confirm-btn');
      if (btn) btn.disabled = !typedOk();
    };
    window._recoDeleteAllUpdateBtn._caseFix = true;
  }
  function hookDel() {
    var orig = window._recoDeleteAllBankReconData;
    if (typeof orig !== 'function' || orig._caseFix) return;
    window._recoDeleteAllBankReconData = function () {
      var el = document.getElementById('reco-delete-all-confirm-input');
      if (el && typedOk()) el.value = 'DELETE';
      return orig.apply(this, arguments);
    };
    window._recoDeleteAllBankReconData._caseFix = true;
  }
  function hookOpen() {
    var orig = window._recoOpenDeleteAllModal;
    if (typeof orig !== 'function' || orig._caseFix) return;
    window._recoOpenDeleteAllModal = function () {
      var r = orig.apply(this, arguments);
      setTimeout(softenInput, 0);
      return r;
    };
    window._recoOpenDeleteAllModal._caseFix = true;
  }
  function boot() { hookBtn(); hookDel(); hookOpen(); softenInput(); }
  boot();
  setTimeout(boot, 400);
})();
