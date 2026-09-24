(function () {
  function isBm() { return typeof APP !== 'undefined' && APP.language === 'bm'; }
  function canApproveClaims() {
    try {
      var r = String((APP.user && APP.user.role) || '').toLowerCase();
      if (r === 'owner' || r === 'admin' || r === 'platform_admin') return true;
    } catch (e) {}
    try { if (typeof isTenantAdmin === 'function' && isTenantAdmin()) return true; } catch (e2) {}
    try { if (typeof isPlatformAdmin === 'function' && isPlatformAdmin()) return true; } catch (e3) {}
    try { if (typeof canAccess === 'function' && canAccess('accounting')) return true; } catch (e4) {}
    return false;
  }
  function lockStatus() {
    var sel = document.getElementById('ef-status');
    if (!sel) return;
    if (canApproveClaims()) return;
    sel.value = 'pending';
    var wrap = sel.closest('.form-group') || sel.parentNode;
    if (!wrap) return;
    var label = isBm() ? 'Status' : 'Status';
    var val = isBm() ? 'Dihantar (menunggu kelulusan)' : 'Submitted (pending approval)';
    wrap.innerHTML = '<label class="form-label">' + label + '</label>' +
      '<input type="hidden" id="ef-status" value="pending">' +
      '<div class="form-input" style="opacity:.85">' + val + '</div>';
    var save = document.getElementById('ef-save');
    if (save && !save.dataset.staffApply) {
      save.dataset.staffApply = '1';
      save.innerHTML = '<i class="ti ti-send"></i> ' + (isBm() ? 'Hantar' : 'Apply');
    }
  }
  function wrapSave() {
    var orig = window._expSave;
    if (typeof orig !== 'function' || orig._staffApply) return;
    var w = async function () {
      if (!canApproveClaims()) {
        var sel = document.getElementById('ef-status');
        if (sel) sel.value = 'pending';
      }
      return orig.apply(this, arguments);
    };
    w._staffApply = true;
    window._expSave = w;
  }
  function wrapForm() {
    var orig = window.renderExpenseForm;
    if (typeof orig !== 'function' || orig._staffApply) return;
    var w = function () {
      var ret = orig.apply(this, arguments);
      var done = function () { lockStatus(); };
      if (ret && typeof ret.then === 'function') ret.then(done);
      else setTimeout(done, 0);
      return ret;
    };
    w._staffApply = true;
    window.renderExpenseForm = w;
  }
  function boot() {
    wrapForm();
    wrapSave();
    lockStatus();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 600);
  setInterval(lockStatus, 800);
})();
