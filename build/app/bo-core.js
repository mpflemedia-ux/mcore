/* M-Core back-office support - core: EN/BM strings (LANG.*.boSup), PA helpers, probes, WhatsApp "sign off as company" setting. Needs bo_support_01.sql. v1 */
(function () {
  if (window.BO) return;
  var B = window.BO = {}, rd = {}, setCache = {};
  var S = {
    en: { nav: 'Support work (all tenants)', title: 'Support work', sub: 'Across all tenants · tap a row to open it inside that tenant', all: 'All', allT: 'All tenants', tenant: 'Tenant', type: 'Type',
      od: 'Overdue', aw: 'Awaiting answer', bk: 'Bookings tomorrow', sd: 'Service Desk', op: 'Opened, unpaid >3 days', none: 'Nothing here. All caught up.', load: 'Loading…', more: 'Showing first {n}',
      late: '{n} days late', valid: 'valid until {d}', at: 'at {t}', opened: 'opened {d}', bal: 'balance {a}', refresh: 'Refresh', err: 'Could not load: ', entering: 'Opening {t}…',
      sum: 'Monthly support summary', sumD: 'Work done by the M-Core support team inside each tenant (from WhatsApp share logs and the PA audit log).', month: 'Month', csv: 'Export CSV',
      cShares: 'Shares', cRem: 'Reminders', cAct: 'Support actions', cSes: 'Sessions', total: 'Total', noSum: 'No support work recorded this month.',
      signT: 'Sign off as the company', signD: 'WhatsApp messages end with “– {co}” instead of the sender’s name. Platform support always signs as the company.', saved: 'Saved', noSql: 'Run supabase/bo_support_01.sql to enable this.',
      opBtn: 'Opened, unpaid', opTitle: 'Opened but unpaid (>3 days)', opSub: 'Customers opened these invoices more than 3 days ago and have not paid yet.', close: 'Close', firstOpen: 'first opened {d}', remind: 'Remind' },
    bm: { nav: 'Kerja sokongan (semua tenant)', title: 'Kerja sokongan', sub: 'Semua tenant · tekan baris untuk buka dalam tenant itu', all: 'Semua', allT: 'Semua tenant', tenant: 'Tenant', type: 'Jenis',
      od: 'Tertunggak', aw: 'Menunggu jawapan', bk: 'Tempahan esok', sd: 'Service Desk', op: 'Dibuka, belum bayar >3 hari', none: 'Tiada apa-apa. Semua beres.', load: 'Memuat…', more: 'Papar {n} pertama',
      late: 'lewat {n} hari', valid: 'sah hingga {d}', at: 'pada {t}', opened: 'dibuka {d}', bal: 'baki {a}', refresh: 'Muat semula', err: 'Gagal memuat: ', entering: 'Membuka {t}…',
      sum: 'Ringkasan sokongan bulanan', sumD: 'Kerja yang dibuat oleh pasukan sokongan M-Core dalam setiap tenant (dari log kongsi WhatsApp dan log audit PA).', month: 'Bulan', csv: 'Eksport CSV',
      cShares: 'Kongsi', cRem: 'Peringatan', cAct: 'Tindakan sokongan', cSes: 'Sesi', total: 'Jumlah', noSum: 'Tiada kerja sokongan direkod bulan ini.',
      signT: 'Tandatangan sebagai syarikat', signD: 'Mesej WhatsApp diakhiri “– {co}”, bukan nama penghantar. Sokongan platform sentiasa tandatangan sebagai syarikat.', saved: 'Disimpan', noSql: 'Jalankan supabase/bo_support_01.sql untuk aktifkan.',
      opBtn: 'Dibuka, belum bayar', opTitle: 'Dibuka tetapi belum bayar (>3 hari)', opSub: 'Pelanggan buka invois ini lebih 3 hari lalu dan belum bayar.', close: 'Tutup', firstOpen: 'mula dibuka {d}', remind: 'Ingatkan' }
  };
  B.S = S;
  B.add = function (o) { ['en', 'bm'].forEach(function (l) { Object.keys(o[l] || {}).forEach(function (k) { if (S[l][k] == null) S[l][k] = o[l][k]; }); }); };
  try { if (window.LANG) ['en', 'bm'].forEach(function (l) { if (LANG[l] && !LANG[l].boSup) LANG[l].boSup = S[l]; }); } catch (e) {}
  B.bm = function () { return window.APP && APP.language === 'bm'; };
  B.t = function (k, v, lang) {
    var l = lang || (B.bm() ? 'bm' : 'en'), d = (window.LANG && LANG[l] && LANG[l].boSup) || S[l], s = d[k] != null ? d[k] : (S[l][k] != null ? S[l][k] : (S.en[k] || k));
    return v ? String(s).replace(/\{(\w+)\}/g, function (m, x) { return v[x] != null ? v[x] : m; }) : s;
  };
  B.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  B.isPA = function () { try { return typeof isPlatformAdmin === 'function' && !!isPlatformAdmin(); } catch (e) { return false; } };
  B.inS = function () { try { return !!(window.PAE && PAE.inSupport()); } catch (e) { return false; } };
  B.tid = function () { return window.APP && APP.tenant && APP.tenant.id; };
  B.uid = function () { return window.APP && APP.user && APP.user.id; };
  B.role = function () { return String((window.APP && APP.user && APP.user.role) || '').toLowerCase(); };
  B.owner = function () { var r = B.role(); return r === 'owner' || r === 'admin' || r === 'platform_admin'; };
  B.money = function (n) { return 'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  B.day = function (v) { return new Date(v || Date.now()).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); };
  B.date = function (v) { if (!v) return '-'; var x = new Date(String(v).length <= 10 ? v + 'T00:00:00+08:00' : v); return isNaN(x) ? '-' : x.toLocaleDateString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: '2-digit', year: 'numeric' }); };
  B.time = function (v) { var x = new Date(v); return isNaN(x) ? '' : x.toLocaleTimeString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit' }); };
  B.toast = function (m, k) { try { showToast(m, k || 'success'); } catch (e) {} };
  /* probe: a table that only exists after the phase SQL ran (cached per table) */
  B.has = function (tbl) {
    if (!window.sb) return Promise.resolve(false);
    if (!rd[tbl]) rd[tbl] = Promise.resolve(sb.from(tbl).select('id').limit(1)).then(function (r) { if (r && r.error) { console.info('[bo] hidden until SQL for ' + tbl + ' is run'); return false; } return true; }, function () { return false; });
    return rd[tbl];
  };
  B.readyA = function () { return B.has('wa_settings'); };
  /* ---- "sign off as company" (default on). Off: "– Name · Company". PA support sessions always sign as the company. ---- */
  B.signCo = function () { var t = B.tid(); return !t || setCache[t] == null ? true : setCache[t]; };
  B.loadSet = function () {
    var t = B.tid(); if (!t) return Promise.resolve(true);
    return B.readyA().then(function (ok) {
      if (!ok) return true;
      return sb.from('wa_settings').select('id,sign_as_company').eq('tenant_id', t).is('deleted_at', null).maybeSingle().then(function (r) { setCache[t] = r.data ? r.data.sign_as_company !== false : true; B.setRow = r.data || null; return setCache[t]; }, function () { return true; });
    });
  };
  B.saveSet = function (on) {
    var t = B.tid(), row = B.setRow, now = new Date().toISOString();
    var q = row ? sb.from('wa_settings').update({ sign_as_company: !!on, updated_by: B.uid(), updated_at: now }).eq('id', row.id).select('id,sign_as_company').single()
      : sb.from('wa_settings').insert({ tenant_id: t, sign_as_company: !!on }).select('id,sign_as_company').single();
    return Promise.resolve(q).then(function (r) { if (r.error) throw r.error; B.setRow = r.data; setCache[t] = !!on; return r.data; });
  };
  function me() { return (window.APP && APP.user && (APP.user.full_name || APP.user.name)) || ''; }
  B.wrapTpl = function () {
    var W = window.WAD; if (!W || !W.tpl || W.tpl._bo) return;
    var o = W.tpl, w = function (k, lang, c) {
      var out = o.apply(this, arguments), co = c && c.co, nm = me();
      if (!out || !co || B.signCo() || B.inS() || B.isPA() || !nm) return out;
      var i = out.lastIndexOf('– ' + co); return i < 0 ? out : out.slice(0, i) + '– ' + nm + ' · ' + co + out.slice(i + 2 + co.length);
    };
    w._bo = 1; W.tpl = w;
  };
  var css = document.createElement('style');
  css.textContent = '.bo-root{max-width:1100px}.bo-f{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}.bo-f select{min-height:38px;max-width:100%}' +
    '.bo-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}.bo-chip{border:1px solid var(--border-2,var(--border));background:var(--bg-card);color:var(--text);border-radius:99px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;min-height:34px}' +
    '.bo-chip b{font-weight:700;margin-left:4px;color:var(--text-2)}.bo-chip.on{background:var(--primary);border-color:var(--primary);color:#fff}.bo-chip.on b{color:#fff}' +
    '[data-theme="dark"] .bo-chip.on{color:#06202a}[data-theme="dark"] .bo-chip.on b{color:#06202a}' +
    '.bo-list{display:flex;flex-direction:column;gap:8px}.bo-row{display:flex;gap:12px;align-items:center;width:100%;text-align:left;font:inherit;color:var(--text);background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:11px 12px;cursor:pointer;box-sizing:border-box}' +
    '.bo-row:hover{border-color:var(--primary)}.bo-row .bo-m{min-width:0;flex:1}.bo-row .bo-a{font-weight:700;white-space:nowrap;font-size:14px}.bo-l1{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.bo-l2{font-size:12.5px;color:var(--text-2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bo-tn{font-size:12px;font-weight:700;color:var(--text-2)}' +
    '.bo-p{display:inline-block;font-size:11px;font-weight:700;border-radius:99px;padding:2px 8px;margin-right:6px;vertical-align:1px}' +
    '.bo-od{background:rgba(220,38,38,.14);color:#B91C1C}.bo-aw{background:rgba(217,119,6,.16);color:#92400E}.bo-bk{background:rgba(22,163,74,.15);color:#166534}.bo-sd{background:var(--primary-light);color:#155E75}.bo-op{background:rgba(124,58,237,.14);color:#5B21B6}' +
    '[data-theme="dark"] .bo-od{color:#F87171}[data-theme="dark"] .bo-aw{color:#FBBF24}[data-theme="dark"] .bo-bk{color:#4ADE80}[data-theme="dark"] .bo-sd{color:var(--primary)}[data-theme="dark"] .bo-op{color:#C4B5FD}' +
    '.bo-empty{padding:24px;text-align:center;color:var(--text-2);font-size:14px}.bo-note{font-size:12.5px;color:var(--text-2);margin:6px 0}' +
    '@media(max-width:640px){.bo-f select{flex:1 1 140px}}@media print{.bo-root{display:none}}';
  document.head.appendChild(css);
  var last = '';
  setInterval(function () { B.wrapTpl(); var t = B.tid(); if (t && t !== last && window.sb) { last = t; B.loadSet(); } }, 1500);
})();
