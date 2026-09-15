/* Sales Commission ledger — amend / delete */
(function () {
  function canEdit() {
    try {
      if (typeof isTenantAdmin === 'function' && isTenantAdmin()) return true;
      if (typeof canManageHR === 'function' && canManageHR()) return true;
    } catch (e) {}
    return false;
  }
  function fmtRM(n) {
    if (typeof formatRM === 'function') return formatRM(n);
    return 'RM ' + Number(n || 0).toFixed(2);
  }
  function removeModal() {
    var m = document.getElementById('sc-edit-modal');
    if (m) m.remove();
  }
  function openEdit(id) {
    var row = (window._scLedgerRaw || []).find(function (r) { return String(r.id) === String(id); });
    if (!row) return;
    removeModal();
    var isBm = APP.language === 'bm';
    var box = document.createElement('div');
    box.id = 'sc-edit-modal';
    box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    box.innerHTML = '<div class="card" style="width:min(440px,100%);padding:20px">' +
      '<div style="font-weight:700;margin-bottom:12px">' + (isBm ? 'Pinda komisyen' : 'Amend commission') + '</div>' +
      '<div class="form-group"><label class="form-label">' + (isBm ? 'Jumlah jualan (RM)' : 'Sale amount (RM)') + '</label>' +
      '<input id="sc-ed-amt" type="number" step="0.01" class="form-input" value="' + Number(row.sale_amount || 0) + '"></div>' +
      '<div class="form-group"><label class="form-label">' + (isBm ? 'Kadar (%)' : 'Rate (%)') + '</label>' +
      '<input id="sc-ed-rate" type="number" step="0.01" class="form-input" value="' + Number(row.rate_applied || 0) + '"></div>' +
      '<div class="form-group"><label class="form-label">' + (isBm ? 'Komisyen (RM)' : 'Commission (RM)') + '</label>' +
      '<input id="sc-ed-comm" type="number" step="0.01" class="form-input" value="' + Number(row.commission_amount || 0) + '"></div>' +
      '<div style="font-size:11px;color:var(--text-3);margin:-4px 0 12px">' +
      (isBm ? 'Kadar × jualan akan isi komisyen auto. Boleh edit manual.' : 'Rate × sale auto-fills commission. Override if needed.') + '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn btn-outline" id="sc-ed-cancel">' + (isBm ? 'Batal' : 'Cancel') + '</button>' +
      '<button class="btn btn-primary" id="sc-ed-save">' + (isBm ? 'Simpan' : 'Save') + '</button></div></div>';
    document.body.appendChild(box);
    function recalc() {
      var amt = Number(document.getElementById('sc-ed-amt').value || 0);
      var rate = Number(document.getElementById('sc-ed-rate').value || 0);
      document.getElementById('sc-ed-comm').value = (Math.round(amt * rate) / 100).toFixed(2);
    }
    document.getElementById('sc-ed-amt').addEventListener('input', recalc);
    document.getElementById('sc-ed-rate').addEventListener('input', recalc);
    document.getElementById('sc-ed-cancel').onclick = removeModal;
    box.addEventListener('click', function (e) { if (e.target === box) removeModal(); });
    document.getElementById('sc-ed-save').onclick = async function () {
      var amt = Number(document.getElementById('sc-ed-amt').value || 0);
      var rate = Number(document.getElementById('sc-ed-rate').value || 0);
      var comm = Number(document.getElementById('sc-ed-comm').value || 0);
      var { error } = await sb.from('sales_commissions').update({
        sale_amount: amt, rate_applied: rate, commission_amount: comm, updated_at: new Date().toISOString()
      }).eq('id', id).eq('tenant_id', APP.tenant.id);
      if (error) { showToast(error.message, 'error'); return; }
      showToast(isBm ? 'Komisyen dikemaskini' : 'Commission updated', 'success');
      removeModal();
      if (typeof _scLoadLedger === 'function') _scLoadLedger();
    };
  }
  async function delRow(id) {
    var isBm = APP.language === 'bm';
    if (!confirm(isBm ? 'Padam rekod komisyen ini?' : 'Delete this commission record?')) return;
    var { error } = await sb.from('sales_commissions').update({
      deleted_at: new Date().toISOString()
    }).eq('id', id).eq('tenant_id', APP.tenant.id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(isBm ? 'Rekod dipadam' : 'Record deleted', 'success');
    if (typeof _scLoadLedger === 'function') _scLoadLedger();
  }
  window._scEditLedger = openEdit;
  window._scDeleteLedger = delRow;
  function decorate() {
    if (!canEdit()) return;
    var wrap = document.getElementById('sc-ledger-wrap');
    if (!wrap) return;
    var table = wrap.querySelector('table');
    if (!table) return;
    if (table.querySelector('th[data-sc-act]')) return;
    var head = table.querySelector('thead tr');
    var th = document.createElement('th');
    th.setAttribute('data-sc-act', '1');
    th.textContent = APP.language === 'bm' ? 'Tindakan' : 'Actions';
    head.appendChild(th);
    var rows = table.querySelectorAll('tbody tr');
    var raw = window._scLedgerRaw || [];
    rows.forEach(function (tr, i) {
      var r = raw[i];
      if (!r || !r.id) return;
      var td = document.createElement('td');
      td.innerHTML = '<button class="btn btn-outline btn-sm" title="Amend" onclick="_scEditLedger(\'' + r.id + '\')"><i class="ti ti-pencil"></i></button> ' +
        '<button class="btn btn-outline btn-sm" title="Delete" onclick="_scDeleteLedger(\'' + r.id + '\')"><i class="ti ti-trash"></i></button>';
      tr.appendChild(td);
    });
  }
  function wrapLedger() {
    var orig = window._scRenderLedgerTable;
    if (typeof orig !== 'function' || orig._scEditWrapped) return;
    var wrapped = function () {
      var r = orig.apply(this, arguments);
      setTimeout(decorate, 0);
      return r;
    };
    wrapped._scEditWrapped = true;
    window._scRenderLedgerTable = wrapped;
  }
  function boot() {
    wrapLedger();
    decorate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 800);
})();
