/* Owner/admin chooses employment_status: probation | permanent */
(function () {
  function isBm() { return APP.language === 'bm'; }
  function canEdit() {
    try { return typeof canManageHR === 'function' ? canManageHR() : true; } catch (e) { return true; }
  }
  function injectSelect() {
    var box = document.getElementById('prb-box');
    if (!box || document.getElementById('prb-status')) return;
    var badge = document.getElementById('prb-badge');
    var cur = 'probation';
    if (badge && /permanent|tetap/i.test(badge.textContent || '')) cur = 'permanent';
    var wrap = document.createElement('div');
    wrap.style.margin = '6px 0 10px';
    wrap.innerHTML =
      '<label class="form-label">' + (isBm() ? 'Status' : 'Status') + '</label>' +
      '<select id="prb-status" class="form-select" style="max-width:240px">' +
      '<option value="probation">' + (isBm() ? 'Percubaan (Probation)' : 'Probation') + '</option>' +
      '<option value="permanent">' + (isBm() ? 'Tetap (Permanent)' : 'Permanent') + '</option>' +
      '</select>' +
      '<div style="font-size:11px;color:var(--text-3);margin-top:4px">' +
      (isBm() ? 'Owner/Admin pilih. Simpan untuk kekal.' : 'Owner/Admin chooses. Save to keep.') +
      '</div>';
    if (badge && badge.parentNode) badge.parentNode.insertBefore(wrap, badge.nextSibling);
    else box.insertBefore(wrap, box.firstChild.nextSibling);
    document.getElementById('prb-status').value = cur;
    if (!canEdit()) document.getElementById('prb-status').disabled = true;
    document.getElementById('prb-status').addEventListener('change', function () {
      box.setAttribute('data-dirty', '1');
      if (badge) {
        badge.textContent = this.value === 'permanent'
          ? (isBm() ? 'Tetap' : 'Permanent')
          : (isBm() ? 'Percubaan' : 'Probation');
      }
      var btns = document.getElementById('prb-confirm');
      var ext = document.getElementById('prb-extend');
      var show = this.value === 'probation';
      if (btns) btns.style.display = show ? '' : 'none';
      if (ext) ext.style.display = show ? '' : 'none';
    });
  }
  var origFlags = null;
  function wrapSaveFlags() {
    if (typeof window._prbResolveEmpId !== 'function') return;
  }
  function wrapEmployeeSave() {
    var orig = window._employeeSave;
    if (typeof orig !== 'function' || orig._prbStatusSel) return;
    window._employeeSave = async function () {
      var sel = document.getElementById('prb-status');
      var eid = window._prbEditingId || (window._prbResolveEmpId && window._prbResolveEmpId.apply(this, arguments));
      var r = await orig.apply(this, arguments);
      if (sel && eid && window.sb) {
        var status = sel.value === 'permanent' ? 'permanent' : 'probation';
        var patch = { employment_status: status };
        if (status === 'permanent') patch.confirmed_at = new Date().toISOString();
        else patch.confirmed_at = null;
        var up = await sb.from('employees').update(patch).eq('id', eid).eq('tenant_id', APP.tenant.id);
        if (up.error && typeof showToast === 'function') showToast(up.error.message, 'error');
      }
      return r;
    };
    window._employeeSave._prbStatusSel = true;
  }
  function paintSelect(emp) {
    var sel = document.getElementById('prb-status');
    if (!sel || !emp) return;
    sel.value = emp.employment_status === 'permanent' ? 'permanent' : 'probation';
  }
  async function syncFromDb() {
    injectSelect();
    wrapEmployeeSave();
    var box = document.getElementById('prb-box');
    if (!box || box.getAttribute('data-dirty') === '1') return;
    if (!window.sb || !APP.tenant) return;
    var id = window._prbEditingId || box.getAttribute('data-emp-id');
    if (!id) return;
    var q = await sb.from('employees').select('employment_status').eq('id', id).maybeSingle();
    if (q.data) paintSelect(q.data);
  }
  function boot() {
    injectSelect();
    wrapEmployeeSave();
  }
  setInterval(boot, 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
