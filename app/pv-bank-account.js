/* PV bank account number — form + printed detail (v2: save race fixed; detail cards in pv-cards.js show it directly) */
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
  /* v2: the new PV id comes from _pvSave's own openPage('vouchers',{view:'pv-detail',id}) call (held until the
     account no. is saved, then navigated), not from "newest PV in the tenant" — that raced with other users' saves. */
  function wrapSave() {
    var orig = window._pvSave;
    if (typeof orig !== 'function' || orig._pvAccWrapped) return;
    var wrapped = async function (id) {
      var accEl = document.getElementById('pv-bank-acc');
      var acc = accEl ? (accEl.value.trim() || null) : undefined;
      if (acc === undefined || !window.sb) return orig.apply(this, arguments);
      var realOpen = window.openPage, held = null, t0 = new Date(Date.now() - 5000).toISOString();
      var payee = String((document.getElementById('pv-payee') || {}).value || '').trim();
      window.openPage = function (page, params) {
        if (page === 'vouchers' && params && params.view === 'pv-detail' && params.id && !held) { held = { page: page, params: params }; return; }
        return realOpen.apply(this, arguments);
      };
      var r;
      try { r = await orig.apply(this, arguments); } finally { if (window.openPage !== realOpen) window.openPage = realOpen; }
      var pvId = id || (held && held.params.id) || null;
      if (!pvId && payee) { // fallback: this user's PV just inserted for this payee
        var q = await sb.from('payment_vouchers').select('id').eq('tenant_id', APP.tenant.id).eq('payee_name', payee)
          .gte('created_at', t0).order('created_at', { ascending: false }).limit(1);
        pvId = q.data && q.data[0] && q.data[0].id;
      }
      if (pvId) {
        var up = await sb.from('payment_vouchers').update({ bank_account_no: acc }).eq('id', pvId).eq('tenant_id', APP.tenant.id);
        if (up.error) console.warn('pv bank acc', up.error.message);
      }
      if (held) realOpen(held.page, held.params);
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
      if (id && window.sb && document.querySelector('.pdoc-table tbody')) {
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
