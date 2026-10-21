/* M-Core payment attachments - Phase 4: "No slip" tag + filter on the invoice list, slips ZIP (month / customer), per-tenant warning when a bank payment
   is saved without a slip (pay_settings, pay_attach_04.sql), Payment proof section in the Monthly Report Pack. Needs pay_attach_01.sql. v1 */
(function () {
  var P = window.PAYX; if (!P || P.rep) return;
  var E = P.esc, t = P.t, R = P.rep = { only: false, set: {} };
  P.add({ en: { nsTag: 'No slip', nsBtn: 'No slip ({n})', nsHint: 'Paid invoices with a payment that has no proof attached', zBtn: 'Slips ZIP', zTi: 'Download payment slips', zMonth: 'Month', zCust: 'Customer', zAll: 'All customers', zGo: 'Download ZIP', zProg: 'Downloading {i} of {n}…', zNone: 'No slips for this month.', zDone: 'ZIP ready: {n} file(s).', zSkip: '{n} file(s) could not be downloaded.', zMany: 'Too many files ({n}). Pick one customer or a shorter range.',
      wTi: 'Warn when a bank payment has no slip', wD: 'Bank transfer / online banking / DuitNow / e-wallet / cheque saved without a proof file asks for confirmation first. Applies to everyone in this business.', wQ: 'This bank payment has no slip attached. Save anyway?', wSaved: 'Setting saved.',
      pkTi: 'Payment proof', pkN: 'Payments received', pkW: 'With slip', pkO: 'Without slip', pkG: 'Online (gateway)', pkV: 'Voided', pkC: 'Customer slips (pending / approved / rejected)' },
    bm: { nsTag: 'Tiada slip', nsBtn: 'Tiada slip ({n})', nsHint: 'Invois dibayar yang ada bayaran tanpa bukti dilampirkan', zBtn: 'ZIP slip', zTi: 'Muat turun slip bayaran', zMonth: 'Bulan', zCust: 'Pelanggan', zAll: 'Semua pelanggan', zGo: 'Muat turun ZIP', zProg: 'Memuat turun {i} daripada {n}…', zNone: 'Tiada slip untuk bulan ini.', zDone: 'ZIP sedia: {n} fail.', zSkip: '{n} fail gagal dimuat turun.', zMany: 'Terlalu banyak fail ({n}). Pilih satu pelanggan atau julat lebih pendek.',
      wTi: 'Beri amaran jika bayaran bank tiada slip', wD: 'Pindahan bank / perbankan dalam talian / DuitNow / e-dompet / cek yang disimpan tanpa fail bukti akan minta pengesahan dahulu. Untuk semua dalam perniagaan ini.', wQ: 'Bayaran bank ini tiada slip dilampirkan. Simpan juga?', wSaved: 'Tetapan disimpan.',
      pkTi: 'Bukti bayaran', pkN: 'Bayaran diterima', pkW: 'Ada slip', pkO: 'Tiada slip', pkG: 'Dalam talian (gateway)', pkV: 'Dibatalkan', pkC: 'Slip pelanggan (menunggu / lulus / ditolak)' } });
  var css = document.createElement('style');
  css.textContent = '.payx-ns{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700;background:var(--warning-bg,rgba(245,158,11,.16));color:var(--text);border:1px solid var(--warning,#F59E0B);white-space:nowrap}' +
    '.payx-tg{display:flex;gap:12px;align-items:flex-start;margin-top:14px;padding-top:14px;border-top:1px solid var(--border)}.payx-tg input{width:20px;height:20px;margin-top:2px;flex:none}';
  document.head.appendChild(css);
  function gw(p) { return /toyyib|gateway/i.test((p.payment_method || '') + ' ' + (p.notes || '')); }
  /* invoice id -> true when one of its (non-gateway) payments has no proof */
  function noSlip(ids) {
    var tid = P.tid();
    return sb.from('payment_allocations').select('invoice_id,payment_id').eq('tenant_id', tid).in('invoice_id', ids).then(function (a) {
      var al = (a && a.data) || [], pids = al.map(function (x) { return x.payment_id; }).filter(Boolean); if (!pids.length) return {};
      return Promise.all([sb.from('payments').select('id,payment_method,notes').eq('tenant_id', tid).in('id', pids), P.list('inv', pids)]).then(function (r) {
        var pm = {}, out = {}; ((r[0] && r[0].data) || []).forEach(function (p) { pm[p.id] = p; });
        al.forEach(function (x) { var p = pm[x.payment_id]; if (p && !gw(p) && !(r[1][x.payment_id] || []).length) out[x.invoice_id] = true; });
        return out;
      });
    });
  }
  function rowsOf(wrap) { return [].slice.call(wrap.querySelectorAll('tbody tr')).map(function (tr) { var m = String(tr.getAttribute('onclick') || '').match(/id:'([^']+)'/); return m ? { tr: tr, id: m[1] } : null; }).filter(Boolean); }
  function apply(wrap, set) { rowsOf(wrap).forEach(function (r) { var on = !!set[r.id], c = r.tr.children[0];
    if (on && c && !c.querySelector('.payx-ns')) { var s = document.createElement('span'); s.className = 'payx-ns'; s.textContent = t('nsTag'); c.appendChild(s); }
    r.tr.style.display = R.only && !on ? 'none' : ''; }); }
  function bar(set) {
    var b = document.getElementById('inv-status-filters'); if (!b) return;
    var n = Object.keys(set).length, x = b.querySelector('.payx-nsb'), z = b.querySelector('.payx-zb');
    if (!x) { x = document.createElement('button'); x.type = 'button'; x.className = 'btn btn-sm payx-nsb'; x.style.borderRadius = '20px'; x.title = t('nsHint'); b.appendChild(x);
      x.onclick = function () { R.only = !R.only; scan(true); }; }
    x.className = 'btn btn-sm payx-nsb ' + (R.only ? 'btn-primary' : 'btn-outline'); x.innerHTML = '<i class="ti ti-file-alert"></i> ' + E(t('nsBtn', { n: n })); x.setAttribute('aria-pressed', R.only ? 'true' : 'false');
    if (!z) { z = document.createElement('button'); z.type = 'button'; z.className = 'btn btn-sm btn-outline payx-zb'; z.style.borderRadius = '20px'; z.innerHTML = '<i class="ti ti-file-zip"></i> ' + E(t('zBtn')); z.onclick = zipSheet; b.appendChild(z); }
  }
  function scan(force) {
    var wrap = document.getElementById('inv-list-wrap'); if (!wrap || !wrap.querySelector('tbody tr')) return;
    var rows = rowsOf(wrap), key = rows.map(function (r) { return r.id; }).join(','); if (!force && wrap.dataset.payns === key && wrap.querySelector('tbody tr[data-pns]')) return;
    wrap.dataset.payns = key; if (rows[0]) rows[0].tr.dataset.pns = '1';
    P.ready().then(function (ok) {
      if (!ok || !P.can('inv')) return;
      var cache = R.set[P.tid()]; if (cache && !force && cache.key === key) { bar(cache.s); apply(wrap, cache.s); return; }
      return noSlip(rows.map(function (r) { return r.id; })).then(function (s) { R.set[P.tid()] = { key: key, s: s }; bar(s); apply(wrap, s); });
    }).catch(function (e) { console.warn('[payx] no slip', e); });
  }
  /* ---- warning setting ---- */
  R.warn = function () { return P.has('pay_settings').then(function (ok) { return ok ? sb.from('pay_settings').select('warn_no_slip').eq('tenant_id', P.tid()).maybeSingle().then(function (r) { return !!(r.data && r.data.warn_no_slip); }) : null; }); };
  P.befores.push(function (kind) {
    var sel = document.getElementById(kind === 'bill' ? 'bill-pay-method' : 'pay-method'), v = sel ? sel.value : '';
    if (!/bank_transfer|online_banking/.test(v) || (P.pend[kind] || []).length || (kind === 'inv' && P.claims && P.claims.cur)) return true;
    return R.warn().then(function (on) { return !on || confirm(t('wQ')); });
  });
  function zipSheet() {
    var bg = document.createElement('div'); bg.className = 'payx-bg'; bg.id = 'payx-zip'; var m = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).slice(0, 7);
    bg.innerHTML = '<div class="payx-sh" role="dialog" aria-modal="true" aria-labelledby="payz-t"><div class="payx-grab"></div><div class="payx-hd"><div class="payx-ti" id="payz-t">' + E(t('zTi')) + '</div><button type="button" class="btn btn-outline btn-sm" data-x>' + E(t('close')) + '</button></div>' +
      '<label class="form-label" for="payz-m" style="margin-top:12px">' + E(t('zMonth')) + '</label><input id="payz-m" type="month" class="form-input" value="' + m + '" max="' + m + '" style="width:100%;box-sizing:border-box">' +
      '<label class="form-label" for="payz-c" style="margin-top:10px">' + E(t('zCust')) + '</label><select id="payz-c" class="form-input" style="width:100%;box-sizing:border-box"><option value="">' + E(t('zAll')) + '</option></select>' +
      '<div class="payx-msg" data-s role="status" style="margin-top:10px;min-height:20px"></div><button type="button" class="btn btn-primary" data-g style="width:100%;min-height:44px;margin-top:6px"><i class="ti ti-download"></i> ' + E(t('zGo')) + '</button><div data-w></div></div>';
    document.body.appendChild(bg);
    var close = function () { bg.remove(); }; bg.onclick = function (e) { if (e.target === bg) close(); }; bg.querySelector('[data-x]').onclick = close;
    sb.from('customers').select('id,name').eq('tenant_id', P.tid()).is('deleted_at', null).order('name').limit(500).then(function (r) { var s = bg.querySelector('#payz-c'); ((r && r.data) || []).forEach(function (c) { var o = document.createElement('option'); o.value = c.id; o.textContent = c.name; s.appendChild(o); }); });
    var St = bg.querySelector('[data-s]'), G = bg.querySelector('[data-g]');
    G.onclick = function () {
      var mm = bg.querySelector('#payz-m').value; if (!/^\d{4}-\d{2}$/.test(mm)) return; G.disabled = true;
      P.zipSlips(mm, bg.querySelector('#payz-c').value || null, function (s) { St.textContent = s; }).then(function (z) {
        if (!z.blob) { St.textContent = t('zNone'); return; }
        var u = URL.createObjectURL(z.blob), a = document.createElement('a'); a.href = u; a.download = z.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 5000);
        St.textContent = t('zDone', { n: z.n }) + (z.skipped ? ' ' + t('zSkip', { n: z.skipped }) : ''); P.audit('export', 'doc_attachments', P.tid());
      }).catch(function (e) { St.textContent = t('err') + ((e && e.message) || e); }).then(function () { G.disabled = false; });
    };
    if (P.owner() && !P.viewOnly()) R.warn().then(function (on) {
      if (on === null || !bg.isConnected) return;
      var w = bg.querySelector('[data-w]'); w.className = 'payx-tg';
      w.innerHTML = '<input type="checkbox" id="payz-w"' + (on ? ' checked' : '') + '><label for="payz-w"><b style="font-size:14px">' + E(t('wTi')) + '</b><div class="payx-hint">' + E(t('wD')) + '</div></label>';
      w.querySelector('input').onchange = function () { var v = this.checked;
        sb.from('pay_settings').upsert({ tenant_id: P.tid(), warn_no_slip: v, updated_by: P.isPA() ? null : P.uid(), updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' }).then(function (r) {
          if (r.error) return P.toast(t('err') + r.error.message, 'error'); P.audit('update', 'pay_settings', P.tid()); P.toast(t('wSaved')); }); };
    });
  }
  var tm = 0; new MutationObserver(function () { if (!tm) tm = setTimeout(function () { tm = 0; scan(); }, 200); }).observe(document.body, { childList: true, subtree: true });
})();
