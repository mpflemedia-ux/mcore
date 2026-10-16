/* M-Core back-office support - PA cross-tenant work dashboard (page "bo_work", Platform menu). Tap a row = silent PA enter + open the document. PA only. v1 */
(function () {
  if (!window.BO || BO.dash) return;
  var B = BO, E = B.esc, t = B.t, ST = { ty: 'all', tn: '', rows: null, tens: {}, err: null }, LIM = 300;
  var TYPES = ['od', 'aw', 'bk', 'sd', 'op'];
  function today() { return B.day(); }
  function tomorrow(n) { var d = new Date(today() + 'T00:00:00+08:00'); d.setDate(d.getDate() + (n || 1)); return d.toISOString(); }
  function bal(i) { return Number(i.total || 0) - Number(i.paid_amt || 0); }
  function unpaid(i) { return !/cancel|draft|void/i.test(i.status || '') && bal(i) > 0.005; }
  function late(d) { return Math.max(0, Math.round((new Date(today() + 'T00:00:00Z') - new Date(String(d).slice(0, 10) + 'T00:00:00Z')) / 864e5)); }
  function q(p) { return Promise.resolve(p).then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || []; }); }
  function load() {
    var ago = new Date(Date.now() - 3 * 864e5).toISOString(), x = function () { return []; };
    return Promise.all([
      q(sb.from('tenants').select('id,name').is('deleted_at', null).order('name').limit(1000)).catch(x),
      q(sb.from('invoices').select('id,tenant_id,ref_no,customer_name,total,paid_amt,due_date,status').is('deleted_at', null).lt('due_date', today()).neq('status', 'paid').order('due_date', { ascending: true }).limit(LIM)),
      q(sb.from('quotations').select('id,tenant_id,ref_no,customer_name,total,valid_until,status,customer_response').is('deleted_at', null).eq('status', 'sent').is('customer_response', null).order('created_at', { ascending: false }).limit(LIM)),
      q(sb.from('bookings').select('id,tenant_id,customer_name,starts_at,status').gte('starts_at', tomorrow(1)).lt('starts_at', tomorrow(2)).order('starts_at', { ascending: true }).limit(LIM)),
      q(sb.from('service_requests').select('id,tenant_id,ref_no,title,status,priority,created_at').in('status', ['submitted', 'triaged', 'in_progress', 'waiting_client', 'revision']).is('deleted_at', null).order('created_at', { ascending: true }).limit(LIM)).catch(x),
      q(sb.from('doc_views').select('doc_id,tenant_id,viewed_at').eq('doc_type', 'inv').lt('viewed_at', ago).order('viewed_at', { ascending: true }).limit(1000)).catch(x)
    ]).then(function (a) {
      ST.tens = {}; a[0].forEach(function (r) { ST.tens[r.id] = r.name; });
      var rows = [];
      a[1].filter(unpaid).forEach(function (i) { rows.push({ ty: 'od', id: i.id, tid: i.tenant_id, l1: (i.ref_no || '-') + ' · ' + (i.customer_name || '-'), l2: t('late', { n: late(i.due_date) }), amt: B.money(bal(i)), k: late(i.due_date) }); });
      a[2].forEach(function (r) { rows.push({ ty: 'aw', id: r.id, tid: r.tenant_id, l1: (r.ref_no || '-') + ' · ' + (r.customer_name || '-'), l2: r.valid_until ? t('valid', { d: B.date(r.valid_until) }) : '', amt: B.money(r.total) }); });
      a[3].filter(function (b) { return !/cancel/i.test(b.status || ''); }).forEach(function (b) { rows.push({ ty: 'bk', id: b.id, tid: b.tenant_id, l1: b.customer_name || '-', l2: t('at', { t: B.date(b.starts_at) + ' ' + B.time(b.starts_at) }), amt: '' }); });
      a[4].forEach(function (r) { rows.push({ ty: 'sd', id: r.id, tid: r.tenant_id, l1: (r.ref_no || '') + ' · ' + (r.title || '-'), l2: String(r.status || '').replace(/_/g, ' ') + (r.priority ? ' · ' + r.priority : ''), amt: '' }); });
      var first = {}; a[5].forEach(function (v) { if (!first[v.doc_id]) first[v.doc_id] = v.viewed_at; });
      var ids = Object.keys(first).slice(0, 200);
      return (ids.length ? q(sb.from('invoices').select('id,tenant_id,ref_no,customer_name,total,paid_amt,due_date,status').in('id', ids).is('deleted_at', null)).catch(function () { return []; }) : Promise.resolve([])).then(function (inv) {
        inv.filter(unpaid).forEach(function (i) { rows.push({ ty: 'op', id: i.id, tid: i.tenant_id, l1: (i.ref_no || '-') + ' · ' + (i.customer_name || '-'), l2: t('opened', { d: B.date(first[i.id]) }), amt: B.money(bal(i)) }); });
        ST.rows = rows; ST.err = null;
      });
    }).catch(function (e) { ST.err = (e && e.message) || String(e); ST.rows = []; });
  }
  function counts() { var c = { all: 0 }; TYPES.forEach(function (k) { c[k] = 0; }); (ST.rows || []).forEach(function (r) { if (ST.tn && r.tid !== ST.tn) return; c[r.ty]++; c.all++; }); return c; }
  function paint() {
    var m = document.getElementById('main'); if (!m || APP.currentPage !== 'bo_work') return;
    var root = m.querySelector('.bo-root'); if (!root) return;
    var c = counts(), tl = Object.keys(ST.tens).map(function (k) { return [k, ST.tens[k]]; }).sort(function (a, b) { return String(a[1]).localeCompare(String(b[1])); });
    var used = {}; (ST.rows || []).forEach(function (r) { used[r.tid] = 1; });
    var h = '<div class="bo-f"><select class="form-input form-select" id="bo-tn" aria-label="' + E(t('tenant')) + '"><option value="">' + E(t('allT')) + '</option>' +
      tl.filter(function (x) { return used[x[0]]; }).map(function (x) { return '<option value="' + E(x[0]) + '"' + (ST.tn === x[0] ? ' selected' : '') + '>' + E(x[1]) + '</option>'; }).join('') + '</select>' +
      '<button class="btn btn-outline btn-sm" id="bo-rf"><i class="ti ti-refresh"></i> ' + E(t('refresh')) + '</button></div>' +
      '<div class="bo-chips" role="tablist">' + ['all'].concat(TYPES).map(function (k) { return '<button class="bo-chip' + (ST.ty === k ? ' on' : '') + '" role="tab" aria-selected="' + (ST.ty === k) + '" data-ty="' + k + '">' + E(t(k)) + '<b>' + c[k] + '</b></button>'; }).join('') + '</div>';
    if (ST.err) h += '<div class="bo-note" style="color:var(--danger)">' + E(t('err') + ST.err) + '</div>';
    var list = (ST.rows || []).filter(function (r) { return (ST.ty === 'all' || r.ty === ST.ty) && (!ST.tn || r.tid === ST.tn); });
    h += list.length ? '<div class="bo-list">' + list.slice(0, 400).map(function (r, i) {
      return '<button type="button" class="bo-row" data-i="' + i + '"><div class="bo-m"><div class="bo-tn"><span class="bo-p bo-' + r.ty + '">' + E(t(r.ty)) + '</span>' + E(ST.tens[r.tid] || '-') + '</div><div class="bo-l1">' + E(r.l1) + '</div>' +
        (r.l2 ? '<div class="bo-l2">' + E(r.l2) + '</div>' : '') + '</div>' + (r.amt ? '<div class="bo-a">' + E(r.amt) + '</div>' : '') + '<i class="ti ti-chevron-right" aria-hidden="true" style="color:var(--text-3)"></i></button>';
    }).join('') + '</div>' : '<div class="card bo-empty">' + E(ST.rows ? t('none') : t('load')) + '</div>';
    var host = root.querySelector('#bo-body'); host.innerHTML = h;
    host.querySelector('#bo-tn').onchange = function () { ST.tn = this.value; paint(); };
    host.querySelector('#bo-rf').onclick = function () { ST.rows = null; paint(); load().then(paint); };
    host.querySelectorAll('[data-ty]').forEach(function (b) { b.onclick = function () { ST.ty = b.dataset.ty; paint(); }; });
    host.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { go(list[+b.dataset.i]); }; });
  }
  function target(r) {
    if (r.ty === 'od' || r.ty === 'op') return function () { openPage('sales', { view: 'inv-detail', id: r.id }); };
    if (r.ty === 'aw') return function () { openPage('sales', { view: 'quo-form', id: r.id }); };
    return function () { openPage('dashboard'); var n = 0; (function s() { if (document.getElementById('db-sec-booking') && typeof _dbScrollToSec === 'function') return _dbScrollToSec('db-sec-booking'); if (++n < 40) setTimeout(s, 150); })(); };
  }
  function go(r) {
    if (!r) return;
    if (r.ty === 'sd') return openPage('admin', { view: 'sd_desk', id: r.id });
    var s = window.PAE && PAE.sess && PAE.sess(), here = B.inS() && s && String(s.tid || B.tid()) === String(r.tid);
    if (here) return target(r)();
    B.toast(t('entering', { t: ST.tens[r.tid] || '' }), 'info');
    Promise.resolve(window.PAE && PAE.enter(r.tid, true)).then(function () { setTimeout(target(r), 300); });
  }
  B.dash = function () {
    var m = document.getElementById('main'); if (!m) return;
    m.innerHTML = '<div class="bo-root"><div class="page-header"><div><div class="page-title">' + E(t('title')) + '</div><div style="font-size:13px;color:var(--text-3);margin-top:2px">' + E(t('sub')) + '</div></div></div><div id="bo-body"></div><div id="bo-sum"></div></div>';
    var h = document.getElementById('header-title'); if (h) h.textContent = t('title');
    paint();
    load().then(paint);
    if (B.sum) B.sum(document.getElementById('bo-sum'));
  };
  function prep() {
    try { _clearUiOverlays(); } catch (e) {} try { _closeMobileSidebar(); } catch (e) {} try { closeUserDropdown(); } catch (e) {}
    try { _lsSet('nexerp_last_page', 'bo_work'); _lsSet('nexerp_last_params', '{}'); } catch (e) {}
    APP.currentPage = 'bo_work'; try { _navPushHistory('bo_work', {}); } catch (e) {}
    document.querySelectorAll('.nav-item').forEach(function (el) { el.classList.toggle('active', el.dataset.page === 'nv_bo_work'); });
  }
  function wrap() {
    var o = window.openPage; if (typeof o !== 'function' || o._bo) return;
    var w = function (page) {
      if (page !== 'bo_work') return o.apply(this, arguments);
      if (!B.isPA()) return o.call(window, 'dashboard', {});
      prep(); ST.rows = null; return B.readyA().then(function (ok) { if (!ok) { document.getElementById('main').innerHTML = '<div class="card bo-empty">' + E(t('noSql')) + '</div>'; return; } B.dash(); });
    };
    w._bo = 1; window.openPage = w;
  }
  function nav() {
    var N = window.NV; if (!N || !N.EXTRA || N._bo) return;
    N._bo = 1; N.MAP.nv_bo_work = 'platform';
    var i = N.ORDER.indexOf('nv_sd_contracts'); N.ORDER.splice(i < 0 ? N.ORDER.length : i + 1, 0, 'nv_bo_work');
    N.EXTRA.push({ id: 'nv_bo_work', ic: 'ti-briefcase', en: S('en'), ms: S('bm'), ok: function () { return B.isPA() && !!B._ok; }, go: function () { window.openPage('bo_work', {}); } });
    B.readyA().then(function (ok) { B._ok = ok; if (ok) try { buildSidebar(); } catch (e) {} });
  }
  function S(l) { return B.t('nav', null, l); }
  var n = 0, iv = setInterval(function () { wrap(); if (window.sb && B.tid()) nav(); if (++n > 60) clearInterval(iv); }, 500);
  wrap();
})();
