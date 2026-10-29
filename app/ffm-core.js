/* M-Core — Flash Fulfillment (FFM) connector: shared client helpers.
   Keys never touch the client: credentials are write-only (posted to edge fn ffm-api), tables expose safe columns only.
   Depends on globals: sb, APP, showToast, openPage, canAccess, formatRM, formatDate. */
(function () {
  'use strict';
  if (window.FFM) return;
  var FFM = window.FFM = {};
  var t = FFM.t = function (en, bm) { return APP.language === 'bm' ? bm : en; };
  var esc = FFM.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  FFM.same = function (a, b) { return String(a) === String(b); };
  FFM.tid = function () { return APP && APP.tenant && APP.tenant.id; };
  // Tenant gate: platform admin always; otherwise only tenants enabled in ffm_tenant_access (platform-managed).
  var _gate = { tid: null, p: null };
  FFM.enabled = function () {
    if (typeof isPlatformAdmin === 'function' && isPlatformAdmin()) return Promise.resolve(true);
    var t = FFM.tid(); if (!t || typeof sb === 'undefined') return Promise.resolve(false);
    if (_gate.p && String(_gate.tid) === String(t)) return _gate.p;
    _gate.tid = t;
    _gate.p = sb.from('ffm_tenant_access').select('enabled').eq('tenant_id', t).is('deleted_at', null).maybeSingle()
      .then(function (r) { return !!(r && !r.error && r.data && r.data.enabled === true); }, function () { return false; });
    return _gate.p;
  };
  FFM.isAdmin = function () {
    var r = String((APP.user && APP.user.role) || '').toLowerCase();
    return r === 'owner' || r === 'admin' || r === 'platform_admin' || (typeof isPlatformAdmin === 'function' && isPlatformAdmin());
  };
  FFM.MY_STATES = (typeof MY_STATES !== 'undefined' && Array.isArray(MY_STATES)) ? MY_STATES : ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Labuan', 'Putrajaya'];
  FFM.CANCELLABLE = ['created', 'stock_out', 'verified', 'received', 'picked', 'withdrawn'];
  FFM.TERMINAL = ['delivered', 'rejected', 'cancelled', 'returned', 'failed'];

  var ST = {
    sending: ['Sending', 'Menghantar', 'yellow'], failed: ['Failed', 'Gagal', 'red'], created: ['Created', 'Dicipta', 'blue'], stock_out: ['Out of stock', 'Kehabisan stok', 'yellow'],
    withdrawn: ['Withdrawn', 'Ditarik balik', 'yellow'], verified: ['Verified', 'Disahkan', 'blue'], received: ['Warehouse received', 'Diterima gudang', 'blue'], picked: ['Picked', 'Dipilih', 'blue'],
    packed: ['Packed', 'Dibungkus', 'blue'], awaiting_pickup: ['Awaiting courier', 'Menunggu kurier', 'blue'], shipped: ['Shipped', 'Dihantar keluar', 'green'], exception: ['Exception', 'Masalah', 'yellow'],
    delivered: ['Delivered', 'Sampai', 'green'], rejected: ['Rejected', 'Ditolak', 'red'], cancelled: ['Cancelled', 'Dibatalkan', 'red'], returned: ['Returned', 'Dipulangkan', 'gray']
  };
  FFM.stLabel = function (s) { var x = ST[s]; return x ? t(x[0], x[1]) : String(s || '-'); };
  FFM.badge = function (s) { var x = ST[s]; return '<span class="badge badge-' + (x ? x[2] : 'gray') + '">' + esc(FFM.stLabel(s)) + '</span>'; };
  FFM.dt = function (v) { if (!v) return '-'; try { return new Date(v).toLocaleString(APP.language === 'bm' ? 'ms-MY' : 'en-MY', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(v); } };
  FFM.rm = function (n) { return typeof formatRM === 'function' ? formatRM(Number(n || 0)) : 'RM ' + Number(n || 0).toFixed(2); };

  /* Pack size: FFM qty is in FFM units; M-Core qty is pcs. 1 FFM unit = pcs_per_unit pcs (per account link). */
  FFM.ppu = function (v) { var n = Number(v); return n > 0 && Math.floor(n) === n ? n : 1; };
  FFM.qty = function (units, ppu) { var k = FFM.ppu(ppu), u = Number(units || 0); return u + ' ' + (k > 1 ? t('ctn', 'ktn') : 'unit') + ' (' + (u * k) + ' pcs)'; };
  FFM.barcodeOk = function (bc) { return /^[A-Za-z0-9]{1,40}$/.test(String(bc == null ? '' : bc).trim()); };
  FFM.ean13Ok = function (bc) {
    var s = String(bc == null ? '' : bc).trim(); if (!/^\d{13}$/.test(s)) return true;
    var sum = 0; for (var i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 ? 3 : 1);
    return (10 - (sum % 10)) % 10 === Number(s[12]);
  };

  /* Edge call — returns parsed JSON or throws Error(message from server). */
  FFM.api = async function (action, body) {
    var payload = Object.assign({ action: action, lang: APP.language === 'bm' ? 'bm' : 'en' }, body || {});
    var res = await sb.functions.invoke('ffm-api', { body: payload });
    if (res.error) {
      var msg = res.error.message || 'FFM error', st = res.error.context && res.error.context.status;
      if (res.error.name === 'FunctionsFetchError' || st === 404) msg = t('FFM service is not deployed yet (or no connection). Please try again later.', 'Servis FFM belum di-deploy (atau tiada sambungan). Sila cuba lagi kemudian.');
      try { var ctx = res.error.context; if (ctx && typeof ctx.json === 'function') { var j = await ctx.json(); if (j && j.error) msg = j.error; } } catch (e) { /* keep msg */ }
      throw new Error(msg);
    }
    return res.data || {};
  };

  FFM.loadAccounts = async function () {
    var r = await sb.from('ffm_accounts').select('id,label,mch_id_masked,has_api_key,has_webhook_secret,warehouse_id,store_code,order_source_platform,pay_mode,amount_multiplier,api_prefix,sign_mode,accept_language,source_from,auto_approve,low_stock_enabled,is_funded,sales_plan_id,fee_source,tracking_url_template,is_active,last_sync_at,last_error,last_error_at,base_url')
      .eq('tenant_id', FFM.tid()).is('deleted_at', null).order('created_at', { ascending: true });
    if (r.error) throw r.error;
    return r.data || [];
  };

  FFM.busy = function (btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.ffmHtml = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="ffm-spin"></span> ' + esc(label || t('Working…', 'Sedang proses…')); }
    else { btn.disabled = false; if (btn.dataset.ffmHtml != null) btn.innerHTML = btn.dataset.ffmHtml; }
  };
  FFM.err = function (e) { showToast((e && e.message) || String(e), 'error'); };

  /* Modal reusing .modal-overlay (openPage closes .modal-overlay.active). */
  function onKey(e) { if (e.key === 'Escape') FFM.closeModal(); }
  FFM.closeModal = function () { var o = document.getElementById('ffm-modal'); if (o) o.remove(); document.removeEventListener('keydown', onKey); };
  FFM.modal = function (title, bodyHtml, okLabel, onOk, wide) {
    FFM.closeModal();
    var ov = document.createElement('div');
    ov.id = 'ffm-modal'; ov.className = 'modal-overlay active ffm-root';
    ov.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" style="max-width:' + (wide ? 560 : 440) + 'px">' +
      '<div class="modal-box-header ffm-mh"><span>' + esc(title) + '</span><button type="button" class="btn btn-outline btn-sm" data-ffm="x" aria-label="' + esc(t('Close', 'Tutup')) + '"><i class="ti ti-x"></i></button></div>' +
      '<div class="modal-box-body">' + bodyHtml + '<div class="ffm-merr" id="ffm-merr" role="alert"></div></div>' +
      '<div class="modal-box-footer ffm-actions"><button type="button" class="btn btn-outline" data-ffm="x">' + esc(t('Cancel', 'Batal')) + '</button>' +
      (okLabel ? '<button type="button" class="btn btn-primary" data-ffm="ok">' + esc(okLabel) + '</button>' : '') + '</div></div>';
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { FFM.closeModal(); return; }
      var b = e.target.closest('[data-ffm]'); if (!b || b.disabled) return;
      if (b.getAttribute('data-ffm') === 'x') FFM.closeModal();
      else if (b.getAttribute('data-ffm') === 'ok' && onOk) onOk(ov, b);
    });
    document.body.appendChild(ov);
    document.addEventListener('keydown', onKey);
    var f = ov.querySelector('input,select,textarea'); if (f) try { f.focus(); } catch (e) { /* */ }
    return ov;
  };
  FFM.modalErr = function (msg) { var el = document.getElementById('ffm-merr'); if (el) el.innerHTML = msg ? esc(msg).replace(/\n/g, '<br>') : ''; };

  /* Download base64 label document. */
  FFM.openDoc = function (d, name) {
    try {
      var bin = atob(String(d.file || '').replace(/^data:[^,]+,/, '')), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      var mime = d.mimeType || 'application/pdf', url = URL.createObjectURL(new Blob([arr], { type: mime }));
      var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener';
      a.download = (name || 'ffm-label') + (/pdf/.test(mime) ? '.pdf' : /png/.test(mime) ? '.png' : '');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    } catch (e) { FFM.err(e); }
  };

  if (!document.getElementById('ffm-css')) {
    var css = document.createElement('style'); css.id = 'ffm-css';
    css.textContent = [
      '.ffm-root{min-width:0}',
      '.ffm-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.ffm-actions .btn{white-space:nowrap}',
      '.ffm-root .btn:disabled{opacity:.55;cursor:not-allowed}',
      '.ffm-spin{width:12px;height:12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;vertical-align:-2px}',
      '.ffm-mh{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.ffm-merr{color:var(--danger);font-size:13px}.ffm-merr:empty{display:none}',
      '.ffm-warn{color:var(--warning);font-size:13px}.ffm-warn:empty{display:none}',
      '.ffm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}',
      '.ffm-k{color:var(--text-3);font-size:12px}.ffm-v{font-weight:600;word-break:break-word}',
      '.ffm-muted{color:var(--text-3);font-size:12px}',
      '.ffm-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}',
      '.ffm-tab{white-space:nowrap}.ffm-tab.active{background:var(--primary);color:var(--on-primary);border-color:var(--primary)}',
      '.ffm-tbl{overflow-x:auto;-webkit-overflow-scrolling:touch}.ffm-tbl table{min-width:520px}',
      '.ffm-tbl td{padding:10px 12px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:top}',
      '.ffm-row{display:flex;flex-wrap:wrap;gap:12px}.ffm-row>.form-group{flex:1 1 160px;min-width:0}',
      '.ffm-root .form-input,.ffm-root .form-select{width:100%;min-width:0;box-sizing:border-box}',
      '.ffm-chk{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-2)}',
      '.ffm-steps{list-style:none;margin:0;padding:0;font-size:13px}.ffm-steps li{padding:6px 0;border-bottom:1px dashed var(--border)}',
      '.ffm-err{color:var(--danger);font-size:12px;word-break:break-word}',
      '.ffm-sec{font-weight:600;font-size:13px;color:var(--text-2);margin-top:4px}',
      '@media (max-width:600px){.ffm-actions .btn{flex:1 1 100%;justify-content:center}.ffm-page-head{flex-direction:column;align-items:stretch!important;gap:10px}}'
    ].join('\n');
    document.head.appendChild(css);
  }
})();
