/* PV bank account number — form + printed detail */
(function () {
  function injectForm(v) {
    if (document.getElementById('pv-bank-acc')) return;
    var bank = document.getElementById('pv-bank');
    if (!bank) return;
    var group = bank.closest('.form-group') || bank.parentNode;
    var wrap = document.createElement('div');
    wrap.className = 'form-group';
    var isBm = APP.language === 'bm';
    wrap.innerHTML = '<label class="form-label">' + (isBm ? 'No. akaun bank' : 'Bank account no.') +
      '</label><input id="pv-bank-acc" class="form-input" placeholder="151-308-412-4" value="">';
    group.parentNode.insertBefore(wrap, group.nextSibling);
    if (v && v.bank_account_no) document.getElementById('pv-bank-acc').value = v.bank_account_no;
  }
  function showOnDoc(v) {
    if (!v || !v.bank_account_no) return;
    var table = document.querySelector('.pdoc-table tbody');
    if (!table || table.querySelector('[data-pv-acc]')) return;
    var bankRow = null;
    table.querySelectorAll('tr').forEach(function (tr) {
      var lab = (tr.cells[0] && tr.cells[0].textContent || '').trim().toLowerCase();
      if (lab === 'bank') bankRow = tr;
    });
    if (!bankRow) return;
    var tr = document.createElement('tr');
    tr.setAttribute('data-pv-acc', '1');
    var isBm = APP.language === 'bm';
    tr.innerHTML = '<td style="color:#64748B">' + (isBm ? 'No. akaun' : 'Account no.') +
      '</td><td style="font-weight:600">' + String(v.bank_account_no).replace(/</g, '') + '</td>';
    bankRow.parentNode.insertBefore(tr, bankRow.nextSibling);
  }
  function wrapForm() {
    var orig = window.renderPVForm || window.renderPvForm;
    if (typeof orig !== 'function' || orig._pvAccWrapped) return;
    var wrapped = async function (id) {
      var r = await orig.apply(this, arguments);
      var v = null;
      if (id && window.sb) {
        var q = await sb.from('payment_vouchers').select('*').eq('id', id).eq('tenant_id', APP.tenant.id).maybeSingle();
        v = q.data;
      }
      injectForm(v);
      return r;
    };
    wrapped._pvAccWrapped = true;
    if (window.renderPVForm) window.renderPVForm = wrapped;
    if (window.renderPvForm) window.renderPvForm = wrapped;
  }
  function wrapSave() {
    var orig = window._pvSave;
    if (typeof orig !== 'function' || orig._pvAccWrapped) return;
    var wrapped = async function (id) {
      var accEl = document.getElementById('pv-bank-acc');
      var acc = accEl ? (accEl.value.trim() || null) : undefined;
      var r = await orig.apply(this, arguments);
      if (acc === undefined || !window.sb) return r;
      var empId = id;
      if (!empId) {
        var q = await sb.from('payment_vouchers').select('id').eq('tenant_id', APP.tenant.id)
          .order('created_at', { ascending: false }).limit(1);
        empId = q.data && q.data[0] && q.data[0].id;
      }
      if (empId) {
        var up = await sb.from('payment_vouchers').update({ bank_account_no: acc }).eq('id', empId).eq('tenant_id', APP.tenant.id);
        if (up.error) console.warn('pv bank acc', up.error.message);
      }
      return r;
    };
    wrapped._pvAccWrapped = true;
    window._pvSave = wrapped;
  }
  function wrapDetail() {
    var orig = window.renderPVDetail;
    if (typeof orig !== 'function' || orig._pvAccWrapped) return;
    var wrapped = async function (id) {
      var r = await orig.apply(this, arguments);
      if (id && window.sb) {
        var q = await sb.from('payment_vouchers').select('*').eq('id', id).eq('tenant_id', APP.tenant.id).maybeSingle();
        showOnDoc(q.data);
      }
      return r;
    };
    wrapped._pvAccWrapped = true;
    window.renderPVDetail = wrapped;
  }
  function boot() {
    wrapForm();
    wrapSave();
    wrapDetail();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
