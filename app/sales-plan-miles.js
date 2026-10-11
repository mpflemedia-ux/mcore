/* Sales Plan — phase 2b. Milestones tab: list, CRUD (Owner/Admin), PIC updates actual + notes.
   Status computed: Achieved / At Risk (plan.at_risk_days, default 7) / Overdue / Pending. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc, num = SP.num, d10 = SP.d10;
  var LINKS = [
    ['manual', 'Manual (typed by PIC)', 'Manual (ditaip PIC)'], ['period_gmv', 'Period GMV', 'GMV tempoh'], ['period_units', 'Period units', 'Unit tempoh'],
    ['period_orders', 'Period orders', 'Order tempoh'], ['plan_gmv', 'Whole plan GMV', 'GMV seluruh pelan'], ['rolling_30d_gmv', 'Rolling 30-day GMV', 'GMV 30 hari bergerak'],
    ['batch_principal', 'Batch funding drawn', 'Pembiayaan batch dikeluarkan'], ['batch_qty', 'Batch inbound qty', 'Kuantiti masuk batch']
  ];
  var METRICS = [['rm', 'RM / currency', 'RM / mata wang'], ['units', 'Units', 'Unit'], ['orders', 'Orders', 'Order'], ['custom', 'Custom', 'Lain-lain']];
  function linkText(m) {
    var L = LINKS.find(function (x) { return x[0] === (m.link_type || 'manual'); }) || LINKS[0], s = t(L[1], L[2]);
    if (m.link_period_id) { var p = st.periods.find(function (x) { return SP.same(x.id, m.link_period_id); }); if (p) s += ' · ' + p.label; }
    if (m.link_batch_id) { var b = (st.batches || []).find(function (x) { return SP.same(x.id, m.link_batch_id); }); if (b) s += ' · ' + (b.label || 'Batch ' + b.code); }
    return s;
  }
  function owner(m) { return (m.owner_name && String(m.owner_name).trim()) || (m.owner_employee_id ? SP.empName(m.owner_employee_id) : '') || SP.picLabel(st.plan); }
  function actBtns(m) {
    var admin = SP.isAdmin(), b = '';
    if (st.canEdit && st.plan.status !== 'archived') b += '<button type="button" class="btn btn-outline btn-sm" data-act="ms-edit" data-id="' + esc(m.id) + '"><i class="ti ti-pencil"></i>' + esc(admin ? t('Edit', 'Ubah') : t('Update', 'Kemas kini')) + '</button>';
    if (admin && st.plan.status !== 'archived') b += '<button type="button" class="sp-iconbtn sp-del" data-act="ms-del" data-id="' + esc(m.id) + '" aria-label="' + esc(t('Delete milestone ', 'Padam milestone ') + m.code) + '" title="' + esc(t('Delete', 'Padam')) + '"><i class="ti ti-trash"></i></button>';
    return b;
  }
  SP.tabs.milestones = function () {
    var c = SP.ctx(), admin = SP.isAdmin() && st.plan.status !== 'archived';
    var rows = '', cards = '';
    st.miles.forEach(function (m) {
      var k = SP.mileCalc(c, m), when = k.days == null ? '' : k.status === 'ach' ? '' : k.days < 0 ? t(-k.days + 'd overdue', 'lewat ' + (-k.days) + 'h') : k.days === 0 ? t('today', 'hari ini') : t('in ' + k.days + 'd', 'dalam ' + k.days + 'h');
      var notes = m.pic_notes ? '<div class="sp-hint sp-mnote"><i class="ti ti-message"></i> ' + esc(m.pic_notes) + '</div>' : '';
      rows += '<tr><td class="sp-mcode">' + esc(m.code) + '</td><td><div class="sp-pname">' + esc(m.title) + '</div><div class="sp-hint">' + esc(owner(m)) + '</div>' + notes + '</td>' +
        '<td class="sp-nowrap">' + esc(SP.fmtDate(m.due_date)) + (when ? '<div class="sp-hint">' + esc(when) + '</div>' : '') + '</td><td class="sp-num">' + esc(SP.mileFmt(c, m, k.target)) + '</td>' +
        '<td class="sp-num">' + esc(SP.mileFmt(c, m, k.actual)) + (k.pct != null ? '<div class="sp-hint">' + SP.pct1(k.pct) + '</div>' : '') + '</td><td class="sp-t2">' + esc(linkText(m)) + '</td><td>' + SP.kpiBadge(k.status) + '</td><td class="sp-acts">' + actBtns(m) + '</td></tr>';
      cards += '<div class="card sp-pcard sp-mcard"><div class="sp-pcard-top"><div class="sp-pcard-name"><span class="sp-mcode">' + esc(m.code) + '</span> <b>' + esc(m.title) + '</b><div class="sp-hint">' + esc(owner(m) + ' · ' + linkText(m)) + '</div></div>' + SP.kpiBadge(k.status) + '</div>' +
        '<div class="sp-pcard-grid"><div><span>' + esc(t('Due', 'Tarikh')) + '</span><b>' + esc(SP.fmtDate(m.due_date)) + (when ? ' · ' + esc(when) : '') + '</b></div><div><span>' + esc(t('Target / actual', 'Sasaran / sebenar')) + '</span><b>' + esc(SP.mileFmt(c, m, k.target) + ' / ' + SP.mileFmt(c, m, k.actual)) + '</b></div></div>' + notes +
        '<div class="sp-mcard-a">' + actBtns(m) + '</div></div>';
    });
    var add = admin ? '<button type="button" class="btn btn-primary btn-sm" data-act="ms-add"><i class="ti ti-plus"></i>' + esc(t('Add milestone', 'Tambah milestone')) + '</button>' : '';
    if (!st.miles.length) return SP.emptyCard('ti-flag', t('No milestones yet', 'Belum ada milestone'), t('Milestones track key dates such as stock inbound, funding drawn or monthly GMV.', 'Milestone jejak tarikh penting seperti stok masuk, pembiayaan dikeluarkan atau GMV bulanan.'), add);
    return '<div class="sp-mhead"><div class="sp-hint">' + esc(t('Status rule: Achieved when actual ≥ target · At Risk within ' + num(st.plan.at_risk_days != null ? st.plan.at_risk_days : 7) + ' days of due · Overdue after due date.', 'Peraturan: Dicapai bila sebenar ≥ sasaran · Berisiko dalam ' + num(st.plan.at_risk_days != null ? st.plan.at_risk_days : 7) + ' hari sebelum tarikh · Lewat selepas tarikh.')) + '</div>' + add + '</div>' +
      '<div class="card sp-table-card"><div class="sp-tscroll"><table class="sp-table sp-mstable"><thead><tr><th>' + esc(t('ID', 'ID')) + '</th><th>' + esc(t('Milestone', 'Milestone')) + '</th><th>' + esc(t('Due', 'Tarikh')) + '</th><th class="sp-num">' + esc(t('Target', 'Sasaran')) + '</th><th class="sp-num">' + esc(t('Actual', 'Sebenar')) + '</th><th>' + esc(t('Linked to', 'Dipaut ke')) + '</th><th>' + esc(t('Status', 'Status')) + '</th><th><span class="sp-sr">' + esc(t('Actions', 'Tindakan')) + '</span></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="sp-cards">' + cards + '</div>';
  };
  /* ---------- modal ---------- */
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (SP.same(v, sel) ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function fg(id, label, html, cls) { return '<div class="form-group ' + (cls || '') + '" id="' + id + '-g"><label class="form-label" for="' + id + '">' + esc(label) + '</label>' + html + '</div>'; }
  function nextCode() { var n = 0; st.miles.forEach(function (m) { var x = /^M(\d+)$/i.exec(m.code || ''); if (x) n = Math.max(n, +x[1]); }); return 'M' + SP.pad(n + 1); }
  function toggle(ov) {
    var lt = ov.querySelector('#sp-ms-link'), mt = ov.querySelector('#sp-ms-metric'); if (!lt) return;
    var v = lt.value, show = function (id, on) { var g = ov.querySelector('#' + id + '-g'); if (g) g.hidden = !on; };
    show('sp-ms-period', /^period_/.test(v)); show('sp-ms-batch', /^batch_/.test(v)); show('sp-ms-actual', v === 'manual');
    if (mt) show('sp-ms-mlabel', mt.value === 'custom');
  }
  SP.mileModal = function (m) {
    var admin = SP.isAdmin(), isNew = !m; m = m || { code: nextCode(), metric: 'rm', link_type: 'manual', due_date: d10(st.plan.end_date), target: '' };
    var txt = function (id, v, extra) { return '<input id="' + id + '" class="form-input" data-no-titlecase="1" value="' + esc(v == null ? '' : v) + '"' + (extra || '') + '>'; };
    var numIn = function (id, v) { return '<input id="' + id + '" class="form-input" type="number" inputmode="decimal" min="0" step="any" value="' + esc(v == null ? '' : v) + '">'; };
    var body = '';
    if (admin) {
      body += '<div class="form-row">' + fg('sp-ms-code', t('ID', 'ID'), txt('sp-ms-code', m.code, ' maxlength="12"')) + fg('sp-ms-due', t('Due date', 'Tarikh'), '<input id="sp-ms-due" type="date" class="form-input" value="' + esc(d10(m.due_date)) + '">') + '</div>' +
        fg('sp-ms-title', t('Milestone', 'Milestone'), txt('sp-ms-title', m.title, ' maxlength="120"')) +
        '<div class="form-row">' + fg('sp-ms-metric', t('Metric', 'Metrik'), '<select id="sp-ms-metric" class="form-select">' + METRICS.map(function (x) { return opt(x[0], t(x[1], x[2]), m.metric); }).join('') + '</select>') + fg('sp-ms-target', t('Target', 'Sasaran'), numIn('sp-ms-target', m.target)) + '</div>' +
        fg('sp-ms-mlabel', t('Custom unit label', 'Label unit'), txt('sp-ms-mlabel', m.metric_label, ' maxlength="30"')) +
        fg('sp-ms-link', t('Actual comes from', 'Sebenar diambil dari'), '<select id="sp-ms-link" class="form-select">' + LINKS.map(function (x) { return opt(x[0], t(x[1], x[2]), m.link_type || 'manual'); }).join('') + '</select>') +
        fg('sp-ms-period', t('Period', 'Tempoh'), '<select id="sp-ms-period" class="form-select"><option value="">—</option>' + st.periods.map(function (p) { return opt(p.id, p.label, m.link_period_id); }).join('') + '</select>') +
        fg('sp-ms-batch', t('Batch', 'Batch'), '<select id="sp-ms-batch" class="form-select"><option value="">—</option>' + (st.batches || []).map(function (b) { return opt(b.id, b.label || 'Batch ' + b.code, m.link_batch_id); }).join('') + '</select>') +
        '<div class="form-row">' + fg('sp-ms-emp', t('Owner (staff)', 'Pemilik (staf)'), '<select id="sp-ms-emp" class="form-select"><option value="">—</option>' + (st.employees || []).map(function (e) { return opt(e.id, e.nickname || e.name, m.owner_employee_id); }).join('') + '</select>') + fg('sp-ms-owner', t('Owner label', 'Label pemilik'), txt('sp-ms-owner', m.owner_name, ' maxlength="60" placeholder="' + esc(SP.picLabel(st.plan)) + '"')) + '</div>';
    } else {
      body += '<div class="sp-note"><i class="ti ti-flag"></i><span><b>' + esc(m.code + ' · ' + m.title) + '</b><br>' + esc(t('Due ', 'Tarikh ') + SP.fmtDate(m.due_date) + ' · ' + t('target ', 'sasaran ') + SP.mileFmt(SP.ctx(), m, num(m.target))) + '</span></div>';
    }
    body += fg('sp-ms-actual', t('Actual (manual)', 'Sebenar (manual)'), numIn('sp-ms-actual', m.actual_manual)) +
      fg('sp-ms-notes', t('PIC notes', 'Nota PIC'), '<textarea id="sp-ms-notes" class="form-input" rows="2" maxlength="500" data-no-titlecase="1">' + esc(m.pic_notes || '') + '</textarea>');
    var ov = SP.openModal(isNew ? t('Add milestone', 'Tambah milestone') : (admin ? t('Edit milestone', 'Ubah milestone') : t('Update milestone', 'Kemas kini milestone')), body, t('Save', 'Simpan'), function (o, b) { SP.mileSave(o, b, isNew ? null : m); }, toggle);
    toggle(ov);
    if (!admin && m.link_type !== 'manual') { var g = ov.querySelector('#sp-ms-actual-g'); if (g) { g.hidden = false; var i = g.querySelector('input'); i.disabled = true; i.value = SP.mileActual(SP.ctx(), m) == null ? '' : SP.mileActual(SP.ctx(), m); g.insertAdjacentHTML('beforeend', '<div class="sp-hint">' + esc(t('Calculated from ', 'Dikira dari ') + linkText(m)) + '</div>'); } }
  };
})();
