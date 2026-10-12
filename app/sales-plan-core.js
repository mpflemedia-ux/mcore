/* Sales Plan — File 2/12: data loading, paint, router, events, modal, nav pill. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc;

  SP.fetchAll = async function (table, cols, apply) {
    var out = [], from = 0, size = 1000;
    for (var guard = 0; guard < 50; guard++) {
      var q = sb.from(table).select(cols).eq('tenant_id', SP.tid()).is('deleted_at', null);
      if (apply) q = apply(q);
      var res = await q.order('id').range(from, from + size - 1);
      if (res.error) throw res.error;
      var rows = res.data || [];
      out = out.concat(rows);
      if (rows.length < size) break;
      from += size;
    }
    return out;
  };
  SP.loadEmployees = async function () {
    try { return await SP.fetchAll('employees', 'id,name,nickname'); } catch (e) { return []; }
  };
  SP.loadRefs = async function () {
    var none = function () { return []; };
    var r = await Promise.all([
      SP.fetchAll('products', 'id,code,name_en,name_bm').catch(none),
      SP.loadEmployees(),
      SP.fetchAll('chart_of_accounts', 'id,code,name_en,account_type,is_active').catch(none),
      sb.from('default_account_mappings').select('mapping_key,account_id').eq('tenant_id', SP.tid()).then(function (x) { return x.error ? [] : (x.data || []); }, none)
    ]);
    var maps = {};
    (r[3] || []).forEach(function (m) { if (m && m.mapping_key) maps[m.mapping_key] = m.account_id; });
    st.refs = {
      products: r[0].slice().sort(function (a, b) { return SP.prodName(a).localeCompare(SP.prodName(b)); }),
      employees: r[1].slice().sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); }),
      accounts: r[2].filter(function (a) { return a.is_active !== false; }).sort(function (a, b) { return String(a.code || '').localeCompare(String(b.code || '')); }),
      maps: maps
    };
  };
  SP.loadPlan = async function (id) {
    var pr = await sb.from('sales_plans').select('*').eq('id', id).eq('tenant_id', SP.tid()).is('deleted_at', null).maybeSingle();
    if (pr.error) throw pr.error;
    st.plan = pr.data && !pr.data.is_template ? pr.data : null;
    if (!st.plan) return;
    var byPlan = function (q) { return q.eq('plan_id', id); }, none = function () { return []; };
    var r = await Promise.all([
      SP.fetchAll('sales_plan_periods', 'id,plan_id,kind,label,start_date,end_date,gmv_target,units_target,orders_target,sort_order', byPlan),
      SP.fetchAll('sales_plan_weeks', 'id,plan_id,period_id,code,start_date,end_date,gmv_target,units_target,orders_target,gmv_manual,units_manual,orders_manual,gmv_auto,sort_order', byPlan),
      SP.fetchAll('sales_plan_batches', 'id', byPlan).catch(none),
      SP.fetchAll('sales_plan_milestones', 'id', byPlan).catch(none)
    ]);
    st.periods = r[0].sort(SP.sortRows);
    st.weeks = r[1].sort(SP.sortRows);
    st.counts = { batches: r[2].length, milestones: r[3].length };
    if (!st.employees || !st.employees.length) st.employees = await SP.loadEmployees();
  };

  /* ---------- paint + shared states ---------- */
  SP.paint = function (html) {
    var m = SP.main(); if (!m) return;
    m.innerHTML = '<style>' + SP.css() + '</style><div class="sp-root">' + html + '</div>';
    var root = m.querySelector('.sp-root');
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', function (e) { if (e.target.tagName === 'SELECT' || e.target.type === 'date') onInput(e); });
    root.addEventListener('keydown', onKey);
  };
  SP.emptyCard = function (icon, title, sub, actions) {
    return '<div class="card"><div class="empty-state sp-empty"><i class="ti ' + icon + '"></i><h3>' + esc(title) + '</h3>' +
      (sub ? '<p>' + esc(sub) + '</p>' : '') + (actions ? '<div class="sp-empty-actions">' + actions + '</div>' : '') + '</div></div>';
  };
  function backBtn() { return '<button type="button" class="btn btn-outline" data-act="list"><i class="ti ti-arrow-left"></i>' + esc(t('Back to plans', 'Kembali ke senarai pelan')) + '</button>'; }
  function retryBtn() { return '<button type="button" class="btn btn-outline" data-act="retry"><i class="ti ti-refresh"></i>' + esc(t('Retry', 'Cuba semula')) + '</button>'; }
  SP.needsSqlHtml = function () {
    return '<div class="page-header"><div><div class="page-title">' + esc(t('Sales Plans', 'Pelan Jualan')) + '</div></div></div>' +
      SP.emptyCard('ti-database-off', t('Sales Plan needs the SQL migration', 'Pelan Jualan perlukan migrasi SQL'),
        t('Ask the owner to run sales_plan_schema.sql in Supabase, then retry.', 'Minta pemilik jalankan sales_plan_schema.sql dalam Supabase, kemudian cuba semula.'), retryBtn());
  };
  SP.viewOnlyHtml = function () {
    return SP.emptyCard('ti-lock', t('View only', 'Lihat sahaja'), t('Only the Owner or Admin can create or edit sales plans.', 'Hanya Pemilik atau Admin boleh cipta atau ubah pelan jualan.'), backBtn());
  };
  SP.notFoundHtml = function () {
    return SP.emptyCard('ti-file-off', t('Plan not found', 'Pelan tidak dijumpai'), t('It may have been removed or belongs to another company.', 'Pelan mungkin telah dibuang atau milik syarikat lain.'), backBtn());
  };

  /* ---------- router ---------- */
  window.renderSalesPlan = async function (params) {
    params = params || {};
    var seq = ++st.seq;
    st.params = params; st.busy = false;
    SP.closeModal();
    if (!SP.canView()) { if (typeof renderAccessDenied === 'function') renderAccessDenied(); return; }
    if (!SP.tid()) { SP.paint(SP.emptyCard('ti-building', t('No company selected', 'Tiada syarikat dipilih'), '')); return; }
    var view = params.view || 'list';
    try {
      if (view === 'setup') await SP.showSetup(params, seq);
      else if (view === 'detail' && params.id) await SP.showDetail(params, seq);
      else await SP.showList(seq);
    } catch (err) {
      if (!SP.alive(seq)) return;
      try { console.error('sales plan', err); } catch (e) {}
      SP.paint(SP.isMissing(err) ? SP.needsSqlHtml() : SP.emptyCard('ti-alert-triangle', t('Could not load Sales Plan', 'Gagal memuatkan Pelan Jualan'), SP.errMsg(err), retryBtn()));
    }
  };

  /* ---------- events (handlers registered by other files in SP.actions / SP.inputs) ---------- */
  SP.inputs = SP.inputs || [];
  SP.leaveOk = function () {
    var dirty = (st.formDirty && st.form) || (st.edit && st.edit.dirty && !st.edit.generated);
    return !dirty || window.confirm(t('Discard unsaved changes?', 'Buang perubahan yang belum disimpan?'));
  };
  SP.discard = function () { st.form = null; st.formKey = ''; st.formDirty = false; st.edit = null; };
  SP.actions.retry = function () { SP.go(st.params); };
  SP.actions.list = function () { if (SP.leaveOk()) { SP.discard(); SP.go({}); } };
  SP.actions.soon = function () { SP.toast(t('Coming in next update', 'Akan datang dalam kemas kini seterusnya'), 'info'); };
  function onClick(e) {
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var fn = SP.actions[b.getAttribute('data-act')]; if (fn) fn(b, e);
  }
  function onInput(e) { for (var i = 0; i < SP.inputs.length; i++) if (SP.inputs[i](e.target, e)) return; }
  function onKey(e) {
    var el = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && el && el.getAttribute && el.getAttribute('data-act') === 'open' && el.tagName !== 'BUTTON') { e.preventDefault(); onClick(e); }
  }
  SP.setBusy = function (on) {
    st.busy = on;
    document.querySelectorAll('.sp-root [data-act^="setup-"],.sp-root [data-act^="tg-"],.sp-root [data-act="status"],.sp-root [data-act="modal-ok"]').forEach(function (b) { b.disabled = !!on; });
  };

  /* ---------- modal (reuses .modal-overlay so openPage/_clearUiOverlays hides it) ---------- */
  function modalKey(e) { if (e.key === 'Escape') SP.closeModal(); }
  SP.closeModal = function () { var o = document.getElementById('sp-modal-overlay'); if (o) o.remove(); document.removeEventListener('keydown', modalKey); };
  SP.openModal = function (title, body, okLabel, onOk, onModalInput) {
    SP.closeModal();
    var ov = document.createElement('div');
    ov.id = 'sp-modal-overlay'; ov.className = 'modal-overlay active sp-root sp-modal';
    ov.innerHTML = '<div class="modal-box sp-modal-box" role="dialog" aria-modal="true" aria-labelledby="sp-modal-t"><div class="modal-box-header sp-modal-h"><span id="sp-modal-t">' + esc(title) + '</span>' +
      '<button type="button" class="sp-iconbtn" data-act="modal-close" aria-label="' + esc(t('Close', 'Tutup')) + '"><i class="ti ti-x"></i></button></div>' +
      '<div class="modal-box-body">' + body + '</div><div class="modal-box-footer sp-modal-f">' +
      '<button type="button" class="btn btn-outline" data-act="modal-close">' + esc(t('Cancel', 'Batal')) + '</button>' +
      (okLabel ? '<button type="button" class="btn btn-primary" data-act="modal-ok">' + esc(okLabel) + '</button>' : '') + '</div></div>';
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { SP.closeModal(); return; }
      var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-act');
      if (a === 'modal-close') SP.closeModal();
      else if (a === 'modal-ok' && onOk) onOk(ov, b);
      else if (a === 'use-template') { SP.closeModal(); SP.useTemplate(b.getAttribute('data-id')); }
    });
    if (onModalInput) ov.addEventListener('input', function () { onModalInput(ov); });
    document.body.appendChild(ov);
    document.addEventListener('keydown', modalKey);
    var first = ov.querySelector('input,select,button.btn'); if (first) { try { first.focus(); } catch (e) {} }
    return ov;
  };
})();
