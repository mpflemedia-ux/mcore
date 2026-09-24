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
  function pickStaffClaimOption(sel) {
    if (!sel || !sel.options) return null;
    var i, opt, t;
    for (i = 0; i < sel.options.length; i++) {
      opt = sel.options[i];
      t = String(opt.text || '').toLowerCase();
      if (/^\s*5300\b/.test(t) || /staff claim|reimbursement/.test(t)) return opt;
    }
    for (i = 0; i < sel.options.length; i++) {
      opt = sel.options[i];
      t = String(opt.text || '').toLowerCase();
      if (/general expense|5000/.test(t) && opt.value) return opt;
    }
    return null;
  }
  function lockCategory() {
    var sel = document.getElementById('ef-category');
    if (!sel) return;
    var picked = pickStaffClaimOption(sel);
    if (picked && !sel.value) sel.value = picked.value;
    if (canApproveClaims()) return;
    if (!picked) return;
    sel.value = picked.value;
    var wrap = sel.closest('.form-group') || sel.parentNode;
    if (!wrap || wrap.dataset.catLocked) return;
    wrap.dataset.catLocked = '1';
    wrap.innerHTML = '<label class="form-label">' + (isBm() ? 'Kategori' : 'Category') + '</label>' +
      '<input type="hidden" id="ef-category" value="' + picked.value + '">' +
      '<div class="form-input" style="opacity:.85">' + picked.text + '</div>';
  }
  function lockStatus() {
    var sel = document.getElementById('ef-status');
    if (!sel) return;
    if (canApproveClaims()) return;
    sel.value = 'pending';
    var wrap = sel.closest('.form-group') || sel.parentNode;
    if (!wrap || wrap.dataset.statusLocked) return;
    wrap.dataset.statusLocked = '1';
    wrap.innerHTML = '<label class="form-label">Status</label>' +
      '<input type="hidden" id="ef-status" value="pending">' +
      '<div class="form-input" style="opacity:.85">' +
      (isBm() ? 'Dihantar (menunggu kelulusan)' : 'Submitted (pending approval)') +
      '</div>';
    var save = document.getElementById('ef-save');
    if (save && !save.dataset.staffApply) {
      save.dataset.staffApply = '1';
      save.innerHTML = '<i class="ti ti-send"></i> ' + (isBm() ? 'Hantar' : 'Apply');
    }
  }
  function lockForm() {
    lockStatus();
    lockCategory();
  }
  function wrapSave() {
    var orig = window._expSave;
    if (typeof orig !== 'function' || orig._staffApply) return;
    var w = async function () {
      if (!canApproveClaims()) {
        var st = document.getElementById('ef-status');
        if (st) st.value = 'pending';
        var cat = document.getElementById('ef-category');
        if (cat && !cat.value) {
          var fake = document.createElement('select');
          fake.id = 'tmp';
        }
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
      var done = function () { lockForm(); };
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
    lockForm();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 600);
  setInterval(lockForm, 800);
})();
