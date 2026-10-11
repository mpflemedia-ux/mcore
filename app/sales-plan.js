/* Sales Plan / Pelan Jualan — phase 2a. File 1/12: namespace, constants, helpers.
   Load order: sales-plan.js, -core, -list, -list-ui, -setup, -setup-save, -targets, -targets-save, -detail, -tpl, -css, -css2.
   Entry: window.renderSalesPlan(params) (defined in sales-plan-core.js). */
(function () {
  'use strict';
  var SP = window.SP = window.SP || {};
  SP.NEW_PILL_UNTIL = '2026-12-15';
  SP.MAX_WEEKS = 156;
  SP.CURRENCIES = [
    { code: 'MYR', en: 'MYR — Ringgit (RM)', bm: 'MYR — Ringgit (RM)' },
    { code: 'SGD', en: 'SGD — Singapore dollar (S$)', bm: 'SGD — Dolar Singapura (S$)' },
    { code: 'USD', en: 'USD — US dollar ($)', bm: 'USD — Dolar AS ($)' },
    { code: 'BND', en: 'BND — Brunei dollar (B$)', bm: 'BND — Dolar Brunei (B$)' },
    { code: 'IDR', en: 'IDR — Indonesian rupiah (Rp)', bm: 'IDR — Rupiah Indonesia (Rp)' },
    { code: 'THB', en: 'THB — Thai baht (฿)', bm: 'THB — Baht Thai (฿)' }
  ];
  var MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MON_BM = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  SP.STATUS = {
    active: { en: 'Active', bm: 'Aktif', cls: 'badge-green' },
    draft: { en: 'Draft', bm: 'Draf', cls: 'badge-gray' },
    completed: { en: 'Completed', bm: 'Selesai', cls: 'badge-blue' },
    archived: { en: 'Archived', bm: 'Arkib', cls: 'badge-gray' }
  };
  SP.NUM_FIELDS = ['gmv_target', 'units_target', 'orders_target'];
  SP.state = {
    seq: 0, busy: false, list: null, filter: 'all', q: '',
    plan: null, periods: [], weeks: [], counts: { batches: 0, milestones: 0 }, employees: [],
    refs: null, form: null, formKey: '', formDirty: false, edit: null, params: {}, tab: ''
  };
  SP.bm = function () { return !!(window.APP && APP.language === 'bm'); };
  SP.t = function (en, ms) { return SP.bm() ? ms : en; };
  SP.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return '&' + ({ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": '#39' })[c] + ';';
    });
  };
  SP.tid = function () { return window.APP && APP.tenant && APP.tenant.id; };
  SP.same = function (a, b) { return String(a) === String(b); };
  SP.isAdmin = function () { try { return typeof isTenantAdmin === 'function' && !!isTenantAdmin(); } catch (e) { return false; } };
  SP.canView = function () { try { return typeof canAccess === 'function' && !!canAccess('sales_plan'); } catch (e) { return false; } };
  SP.toast = function (msg, type) { try { showToast(SP.esc(msg), type || 'info'); } catch (e) {} };
  SP.uuid = function () {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };
  function pad(x) { return String(x).padStart(2, '0'); }
  SP.pad = pad;
  SP.todayISO = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  SP.isoOk = function (s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0, 10))) return false;
    var p = String(s).slice(0, 10).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2];
  };
  SP.d10 = function (s) { return s ? String(s).slice(0, 10) : ''; };
  function toUTC(s) { var p = String(s).slice(0, 10).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  SP.fromUTC = function (ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  SP.addDays = function (s, k) { return SP.fromUTC(toUTC(s) + k * 86400000); };
  SP.diffDays = function (a, b) { return Math.round((toUTC(b) - toUTC(a)) / 86400000); };
  SP.dow = function (s) { return new Date(toUTC(s)).getUTCDay(); };
  SP.mons = function () { return SP.bm() ? MON_BM : MON_EN; };
  SP.fmtDate = function (s) {
    if (!SP.isoOk(s)) return '—';
    var p = SP.d10(s).split('-'); return (+p[2]) + ' ' + SP.mons()[+p[1] - 1] + ' ' + p[0];
  };
  SP.fmtRange = function (a, b) {
    if (!SP.isoOk(a) || !SP.isoOk(b)) return '—';
    var pa = SP.d10(a).split('-'), pb = SP.d10(b).split('-');
    if (pa[0] === pb[0]) return (+pa[2]) + ' ' + SP.mons()[+pa[1] - 1] + ' – ' + SP.fmtDate(b);
    return SP.fmtDate(a) + ' – ' + SP.fmtDate(b);
  };
  SP.num = function (v) { var x = Number(v); return isFinite(x) ? x : 0; };
  SP.fmtNum = function (v, dp) { return SP.num(v).toLocaleString('en-US', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 }); };
  SP.curSym = function (c) { return !c || c === 'MYR' ? 'RM' : String(c); };
  SP.money = function (v, cur) { return SP.curSym(cur) + ' ' + SP.fmtNum(Math.round(SP.num(v))); };
  SP.pct1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1) + '%'; };
  SP.r2 = function (v) { return Math.round(SP.num(v) * 100) / 100; };
  SP.isMissing = function (err) {
    var m = String((err && (err.message || err.details)) || ''), c = String((err && err.code) || '');
    return c === '42P01' || c === 'PGRST205' || /does not exist|could not find the table|schema cache/i.test(m);
  };
  SP.errMsg = function (err) {
    var m = String((err && err.message) || err || ''), c = String((err && err.code) || '');
    if (c === '42501' || /row-level security|permission denied|only owner\/admin/i.test(m)) return SP.t('You do not have permission for this action.', 'Anda tiada kebenaran untuk tindakan ini.');
    return m;
  };
  SP.main = function () { return document.getElementById('main'); };
  SP.alive = function (seq) { return seq === SP.state.seq && window.APP && APP.currentPage === 'sales_plan' && !!SP.main(); };
  SP.go = function (params) { if (typeof openPage === 'function') openPage('sales_plan', params || {}); };
  SP.statusBadge = function (s) { var x = SP.STATUS[s] || SP.STATUS.draft; return '<span class="badge ' + x.cls + '">' + SP.esc(SP.t(x.en, x.bm)) + '</span>'; };
  SP.srcLabel = function (s) { return s === 'auto' ? SP.t('Auto from M-Core', 'Auto dari M-Core') : SP.t('Manual entry', 'Taip sendiri'); };
  SP.srcIcon = function (s) { return s === 'auto' ? 'ti-refresh' : 'ti-keyboard'; };
  SP.weekOf = function (weeks, day) { return weeks.find(function (w) { return SP.d10(w.start_date) <= day && day <= SP.d10(w.end_date); }) || null; };
  SP.effGmv = function (w, src) { var v = src === 'auto' ? w.gmv_auto : w.gmv_manual; return v == null || v === '' ? null : SP.num(v); };
  SP.empName = function (id) {
    var st = SP.state, list = (st.refs && st.refs.employees && st.refs.employees.length) ? st.refs.employees : st.employees;
    var e = (list || []).find(function (x) { return SP.same(x.id, id); });
    return e ? (e.nickname || e.name || '') : '';
  };
  SP.picLabel = function (p) { return (p.pic_name && String(p.pic_name).trim()) || (p.pic_employee_id ? SP.empName(p.pic_employee_id) : '') || '—'; };
  SP.prodName = function (p) { return SP.bm() ? (p.name_bm || p.name_en || p.code || '') : (p.name_en || p.name_bm || p.code || ''); };
  SP.sortRows = function (a, b) { return (SP.num(a.sort_order) - SP.num(b.sort_order)) || String(a.start_date).localeCompare(String(b.start_date)); };
  SP.pick = function (src, keys) { var o = {}; keys.forEach(function (k) { if (src[k] !== undefined) o[k] = src[k]; }); return o; };
  SP.actions = SP.actions || {};
})();
