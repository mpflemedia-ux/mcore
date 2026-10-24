/* Booking Inbox core: tabs + proof + claim highlight. v4 */
(function () {
  if (window.BKINB) return;
  var I = window.BKINBI, V = window.BKPAYV, A = window.BKPAYA, P = window.PAYX;
  var B = window.BKINB = { tab: 'det', wantClaim: null };
  function t(k, v) { return (I && I.t) ? I.t(k, v) : k; }
  function esc(s) { return P && P.esc ? P.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function tid() { return (APP.tenant && APP.tenant.id) || (P && P.tid && P.tid()); }
  function money(n) { return P && P.money ? P.money(n) : ('RM ' + (Number(n) || 0).toFixed(2)); }
  function ago(v) { var m = Math.max(0, Math.round((Date.now() - new Date(v)) / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h'; }
  function toast(m, k) { if (P && P.toast) P.toast(m, k); else if (typeof showToast === 'function') showToast(m, k || 'success'); }
  B._t = t; B._esc = esc; B._tid = tid; B._money = money; B._ago = ago; B._toast = toast;

  function loadBk(id) {
    return sb.from('bookings').select('id,tenant_id,invoice_id,service_id,status,quote_ref,customer_name,customer_phone,customer_email,starts_at,notes,payment_channel,hold_until,created_at').eq('id', id).eq('tenant_id', tid()).maybeSingle().then(function (r) { return r.data; });
  }
  function loadInv(iid) {
    if (!iid) return Promise.resolve(null);
    return sb.from('invoices').select('id,ref_no,total,paid_amt,status,public_token,created_by,customer_name').eq('id', iid).eq('tenant_id', tid()).maybeSingle().then(function (r) { return r.data; });
  }
  function loadClaims(iid) {
    if (!iid) return Promise.resolve([]);
    return sb.from('payment_claims').select('id,amount,status,created_at,files,note,source,reject_reason,receipt_url,receipt_no,bank_ref,paid_on').eq('invoice_id', iid).eq('tenant_id', tid()).is('deleted_at', null).order('created_at', { ascending: false }).then(function (r) { return r.data || []; }, function () { return []; });
  }
  function loadSvc(bk) {
    if (!bk || !bk.service_id) return Promise.resolve(null);
    return sb.from('booking_services').select('id,name,deposit_pct').eq('id', bk.service_id).eq('tenant_id', tid()).maybeSingle().then(function (r) { return r.data || null; }, function () { return null; });
  }
  B._load = function (id) {
    return loadBk(id).then(function (bk) {
      if (!bk) return null;
      return Promise.all([loadInv(bk.invoice_id), loadClaims(bk.invoice_id), loadSvc(bk)]).then(function (a) {
        return { bk: bk, inv: a[0], claims: a[1], svc: a[2] };
      });
    });
  };

  function srcLabel(s) { return s === 'wa_staff' ? t('srcWa') : (s === 'cash_close' ? t('srcCash') : t('srcUpload')); }
  function stPill(st) {
    var cls = st === 'approved' ? 'ok' : (st === 'rejected' ? 'bad' : 'p');
    return '<span class="bkinb-pill ' + cls + '">' + esc(st === 'approved' ? t('approved') : (st === 'rejected' ? t('rejected') : t('pending'))) + '</span>';
  }
  function need(d) {
    return A && d.inv ? A.need({ total: d.inv.total, paid_amt: d.inv.paid_amt, deposit_pct: d.svc && d.svc.deposit_pct }) : { bal: 0 };
  }
  B._need = need; B._src = srcLabel; B._pill = stPill;

  function proofHtml(d) {
    if (!d.inv) return '<div class="bkinb-hint">' + esc(t('noInv')) + '</div>';
    var h = '', n = need(d);
    if (!d.claims.length) {
      return '<div class="bkinb-alert">' + esc(t('noClaim')) + '</div><p class="bkinb-hint">' + esc(t('waRecvHint')) + '</p><div class="bkinb-act"><button type="button" class="db-btn" data-bkinb="wa">' + esc(t('waRecv')) + '</button></div>';
    }
    var list = d.claims.slice();
    if (B.wantClaim) list.sort(function (a, b) { return (String(a.id) === String(B.wantClaim) ? 0 : 1) - (String(b.id) === String(B.wantClaim) ? 0 : 1); });
    list.forEach(function (c, i) {
      var hi = B.wantClaim && String(c.id) === String(B.wantClaim);
      var f0 = c.files && c.files[0];
      h += '<div class="bkinb-card' + (hi ? ' bkinb-hi' : '') + '" data-cid="' + esc(c.id) + '">' + stPill(c.status) + ' <span class="bkinb-meta">' + esc(srcLabel(c.source)) + '</span><div class="bkinb-amt">' + esc(money(c.amount)) + '</div><div class="bkinb-meta">' + esc(t('wait')) + ': ' + esc(ago(c.created_at)) + (c.note ? ' · ' + esc(c.note) : '') + (c.reject_reason ? '<br>' + esc(c.reject_reason) : '') + '</div>';
      if (f0 && f0.path) h += '<div class="bkinb-act"><a class="db-btn" href="#" role="button" data-slip-open="' + esc(f0.path) + '" data-slip-name="' + esc(f0.name || 'receipt') + '" data-slip-mime="' + esc(f0.mime || '') + '">' + esc(t('openSlip')) + '</a></div>';
      else if (c.source === 'cash_close') h += '<p class="bkinb-hint">' + esc(t('noSlipCash')) + '</p>';
      else if (c.source === 'wa_staff') h += '<p class="bkinb-hint">' + esc(t('noSlipWa')) + '</p>';
      if (c.status === 'pending' && (hi || i === 0)) h += '<div class="bkinb-act"><button type="button" class="db-btn" data-bkinb="ok" data-cid="' + esc(c.id) + '">' + esc(t('verify')) + '</button><button type="button" class="db-btn" data-bkinb="rj" data-cid="' + esc(c.id) + '">' + esc(t('reject')) + '</button></div>';
      if (c.status === 'approved') h += '<div class="bkinb-alert">' + esc(n.bal > 0.005 ? t('confBal') + ' · ' + t('balDue', { b: money(n.bal) }) : t('confFull')) + '</div>';
      h += '</div>';
    });
    if (!d.claims.some(function (c) { return c.status === 'pending'; }) && /^(hold|pending_payment|payment_failed)$/.test(d.bk.status || ''))
      h += '<div class="bkinb-act"><button type="button" class="db-btn" data-bkinb="wa">' + esc(t('waRecv')) + '</button></div><p class="bkinb-hint">' + esc(t('waRecvHint')) + '</p>';
    return h;
  }

  function shell(d, tab) {
    var tabs = [['det', 'tabDet'], ['proof', 'tabProof'], ['docs', 'tabDocs'], ['act', 'tabAct']];
    var bar = '<div class="bkinb-tabs" role="tablist">' + tabs.map(function (x) {
      return '<button type="button" class="bkinb-tab" role="tab" data-bkinb-tab="' + x[0] + '" aria-selected="' + (tab === x[0] ? 'true' : 'false') + '">' + esc(t(x[1])) + '</button>';
    }).join('') + '</div>';
    var docs = (B.docsHtml ? B.docsHtml(d) : ''), act = (B.actHtml ? B.actHtml(d) : '');
    return '<div class="bkinb" data-bkinb-root="' + esc(d.bk.id) + '">' + bar +
      '<div class="bkinb-pane' + (tab === 'det' ? ' on' : '') + '" data-pane="det">' + (d.rowDet || '') + '</div>' +
      '<div class="bkinb-pane' + (tab === 'proof' ? ' on' : '') + '" data-pane="proof">' + proofHtml(d) + '</div>' +
      '<div class="bkinb-pane' + (tab === 'docs' ? ' on' : '') + '" data-pane="docs">' + docs + '</div>' +
      '<div class="bkinb-pane' + (tab === 'act' ? ' on' : '') + '" data-pane="act">' + act + '</div></div>';
  }

  function buildX(d, cid) {
    var c = (d.claims || []).find(function (z) { return String(z.id) === String(cid); }) || d.claims[0];
    if (!c || !d.inv || !V || !A) return null;
    return { c: c, inv: d.inv, bk: d.bk, svc: d.svc, n: need(d), ai: null, ro: c.status !== 'pending' };
  }

  function bind(root, d) {
    root.querySelectorAll('[data-bkinb-tab]').forEach(function (b) {
      b.onclick = function () {
        var tab = b.getAttribute('data-bkinb-tab'); B.tab = tab;
        root.querySelectorAll('.bkinb-tab').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        root.querySelectorAll('.bkinb-pane').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-pane') === tab); });
      };
    });
    if (B.bindExtra) B.bindExtra(root, d, buildX);
    var hi = root.querySelector('.bkinb-hi');
    if (hi) try { hi.scrollIntoView({ block: 'nearest' }); } catch (e1) {}
    B.wantClaim = null;
  }

  function mount(host, bkId, tab) {
    if (!host || !bkId || !window.sb || !tid()) return;
    tab = tab || B.tab || 'det';
    if (!host.querySelector('[data-bkinb-keep]')) {
      var keep = document.createElement('div'); keep.setAttribute('data-bkinb-keep', '1'); keep.style.display = 'none';
      [].slice.call(host.childNodes).forEach(function (n) { if (!(n.nodeType === 1 && n.classList && n.classList.contains('bkinb'))) keep.appendChild(n); });
      host.insertBefore(keep, host.firstChild);
    }
    var detHtml = host.querySelector('[data-bkinb-keep]').innerHTML;
    return B._load(bkId).then(function (d) {
      if (!d) return; d.rowDet = detHtml;
      var old = host.querySelector('.bkinb'); if (old) old.remove();
      host.insertAdjacentHTML('beforeend', shell(d, tab));
      bind(host.querySelector('.bkinb'), d);
    });
  }
  B.mount = mount;
  B.open = function (bkId, tab, claimId) {
    B.tab = tab || 'proof'; if (claimId) B.wantClaim = String(claimId);
    window.__bkWantId = String(bkId); window.__bkWantTab = tab || 'proof';
    if (typeof openPage === 'function') openPage('dashboard', { bkid: bkId, bktab: tab || 'proof', claim: claimId || undefined });
    if (typeof window.__bkCardPaint === 'function') window.__bkCardPaint();
  };

  function enhance(details) {
    if (!details || details._bkinb) return; details._bkinb = 1;
    details.addEventListener('toggle', function () {
      if (!details.open) return;
      var id = details.getAttribute('data-bk-row');
      var tab = (window.__bkWantId && String(window.__bkWantId) === String(id)) ? (window.__bkWantTab || 'proof') : (B.tab || 'det');
      if (window.__bkWantId && String(window.__bkWantId) === String(id)) window.__bkWantTab = null;
      mount(details, id, tab);
    });
  }
  function scan() {
    document.querySelectorAll('#db-sec-booking details[data-bk-row]').forEach(enhance);
    var want = window.__bkWantId;
    if (want) {
      var row = document.querySelector('#db-sec-booking details[data-bk-row="' + String(want).replace(/"/g, '') + '"]');
      if (row && row.open) mount(row, want, window.__bkWantTab || 'proof');
    }
  }
  if (typeof window.openPage === 'function' && !window.openPage.__bkinb) {
    var op = window.openPage;
    window.openPage = function (page, params) {
      params = params || {};
      if (params.bkid) { window.__bkWantId = String(params.bkid); if (params.bktab) window.__bkWantTab = String(params.bktab); if (params.claim) B.wantClaim = String(params.claim); }
      return op.apply(this, arguments);
    };
    window.openPage.__bkinb = 1;
  }
  setInterval(scan, 1200);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();
