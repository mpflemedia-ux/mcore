/* Sales Plan — File 4/12: plans list markup (header, stat tiles, chips, search, table + mobile cards). */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc;

  function dash() { return '<span class="sp-dash">—</span>'; }
  function statCard(color, icon, value, label, filter) {
    var open = filter ? '<button type="button" data-act="filter" data-f="' + filter + '"' : '<div';
    return open + ' class="stat-card sp-stat"><div class="stat-icon ' + color + '"><i class="ti ' + icon + '"></i></div><div class="sp-stat-txt"><div class="stat-value">' + esc(value) + '</div><div class="stat-label">' + esc(label) + '</div></div></' + (filter ? 'button' : 'div') + '>';
  }
  function chipsHtml(c) {
    return [['all', t('All', 'Semua')], ['active', t('Active', 'Aktif')], ['draft', t('Draft', 'Draf')], ['completed', t('Completed', 'Selesai')], ['archived', t('Archived', 'Arkib')]].map(function (x) {
      var on = st.filter === x[0];
      return '<button type="button" role="tab" aria-selected="' + on + '" class="sp-chip' + (on ? ' on' : '') + '" data-act="filter" data-f="' + x[0] + '">' + esc(x[1]) + ' ' + (c[x[0]] || 0) + '</button>';
    }).join('');
  }
  SP.resultsHtml = function () {
    var rows = SP.filtered();
    if (!rows.length) return SP.emptyCard('ti-search', t('No plans match', 'Tiada pelan sepadan'), t('Try another filter or search word.', 'Cuba tapisan atau carian lain.'));
    var H = [t('Plan', 'Pelan'), t('Period', 'Tempoh'), t('Sales source', 'Sumber jualan'), t('GMV target', 'Sasaran GMV'), t('GMV actual', 'GMV sebenar'), t('Progress', 'Kemajuan'), t('Status', 'Status'), t('PIC', 'PIC')];
    var th = '<thead><tr>' + H.map(function (h, i) { return '<th' + (i === 3 || i === 4 ? ' class="sp-num"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead>';
    var tb = rows.map(function (r) {
      var p = r.p;
      return '<tr class="sp-row" tabindex="0" data-act="open" data-id="' + esc(p.id) + '">' +
        '<td class="sp-c-plan"><div class="sp-pname">' + esc(p.name) + '</div><div class="sp-hint">' + esc(SP.subLine(r)) + '</div></td>' +
        '<td class="sp-nowrap">' + esc(SP.fmtRange(p.start_date, p.end_date)) + '</td>' +
        '<td><span class="sp-srccell"><i class="ti ' + SP.srcIcon(p.sales_source) + '" aria-hidden="true"></i>' + esc(SP.srcLabel(p.sales_source)) + '</span></td>' +
        '<td class="sp-num">' + (r.target > 0 ? esc(SP.money(r.target, p.currency)) : dash()) + '</td>' +
        '<td class="sp-num">' + (r.actual != null ? esc(SP.money(r.actual, p.currency)) : dash()) + '</td>' +
        '<td class="sp-c-prog">' + SP.progressHtml(r) + '</td>' +
        '<td>' + SP.statusBadge(p.status) + '</td>' +
        '<td class="sp-nowrap sp-t2">' + esc(SP.picLabel(p)) + '</td></tr>';
    }).join('');
    var cards = rows.map(function (r) {
      var p = r.p;
      var cell = function (label, val) { return '<div><span>' + esc(label) + '</span><b>' + val + '</b></div>'; };
      return '<div class="card sp-pcard" tabindex="0" role="button" data-act="open" data-id="' + esc(p.id) + '">' +
        '<div class="sp-pcard-top"><div class="sp-pcard-name"><div class="sp-pname">' + esc(p.name) + '</div><div class="sp-hint">' + esc(SP.subLine(r)) + '</div></div>' + SP.statusBadge(p.status) + '</div>' +
        '<div class="sp-pcard-grid">' +
        cell(t('Period', 'Tempoh'), esc(SP.fmtRange(p.start_date, p.end_date))) +
        cell(t('Sales source', 'Sumber jualan'), '<i class="ti ' + SP.srcIcon(p.sales_source) + '" aria-hidden="true"></i> ' + esc(SP.srcLabel(p.sales_source))) +
        cell(t('GMV target', 'Sasaran GMV'), r.target > 0 ? esc(SP.money(r.target, p.currency)) : '—') +
        cell(t('GMV actual', 'GMV sebenar'), r.actual != null ? esc(SP.money(r.actual, p.currency)) : '—') +
        '</div><div class="sp-pcard-foot">' + SP.progressHtml(r) + '<span class="sp-pcard-pic"><i class="ti ti-user" aria-hidden="true"></i>' + esc(SP.picLabel(p)) + '</span></div></div>';
    }).join('');
    return '<div class="card sp-table-card"><div class="sp-tscroll"><table class="sp-table">' + th + '<tbody>' + tb + '</tbody></table></div></div><div class="sp-cards">' + cards + '</div>';
  };
  SP.refreshResults = function () {
    var box = document.getElementById('sp-results'); if (box) box.innerHTML = SP.resultsHtml();
    var ch = document.getElementById('sp-chips'); if (ch) ch.innerHTML = chipsHtml(SP.counts());
  };
  SP.paintList = function () {
    var admin = SP.isAdmin(), L = st.list, c = SP.counts();
    var fin = L.plans.reduce(function (s, r) { return r.p.status === 'active' ? s + r.outstanding : s; }, 0);
    var head = '<div class="page-header sp-list-head"><div><div class="page-title">' + esc(t('Sales Plans', 'Pelan Jualan')) + '</div>' +
      '<div class="page-subtitle">' + esc(t('Campaign targets, weekly KPI, stock financing & milestones', 'Sasaran kempen, KPI mingguan, pembiayaan stok & pencapaian')) + '</div></div>' +
      (admin ? '<div class="sp-head-actions">' +
        '<button type="button" class="btn btn-outline" data-act="from-template"><i class="ti ti-template"></i>' + esc(t('From template', 'Daripada templat')) + '</button>' +
        '<button type="button" class="btn btn-outline" data-act="import"><i class="ti ti-file-spreadsheet"></i>' + esc(t('Import Excel', 'Import Excel')) + '</button>' +
        '<button type="button" class="btn btn-primary" data-act="new"><i class="ti ti-plus"></i>' + esc(t('New plan', 'Pelan baharu')) + '</button></div>' : '') +
      '</div>';
    var body;
    if (!L.plans.length) {
      body = SP.emptyCard('ti-target-arrow', t('No sales plans yet', 'Belum ada pelan jualan'),
        admin ? t('Create your first campaign plan or start from a template.', 'Cipta pelan kempen pertama atau mula dari templat.') : t('Plans created by the owner will appear here.', 'Pelan yang dicipta oleh pemilik akan dipaparkan di sini.'),
        admin ? '<button type="button" class="btn btn-primary" data-act="new"><i class="ti ti-plus"></i>' + esc(t('New plan', 'Pelan baharu')) + '</button>' : '');
    } else {
      body = '<div class="sp-stats">' +
        statCard('blue', 'ti-target-arrow', String(c.active), c.active === 1 ? t('Active plan', 'Pelan aktif') : t('Active plans', 'Pelan aktif'), 'active') +
        statCard('yellow', 'ti-pencil', String(c.draft), c.draft === 1 ? t('Draft', 'Draf') : t('Drafts', 'Draf'), 'draft') +
        statCard('green', 'ti-circle-check', String(c.completed), t('Completed', 'Selesai'), 'completed') +
        statCard('red', 'ti-building-bank', SP.money(fin, 'MYR'), t('Financing outstanding', 'Baki pembiayaan'), '') +
        '</div><div class="sp-toolbar"><div class="sp-chips" role="tablist" aria-label="' + esc(t('Filter plans', 'Tapis pelan')) + '" id="sp-chips">' + chipsHtml(c) + '</div>' +
        '<label class="sp-search"><i class="ti ti-search" aria-hidden="true"></i><input id="sp-q" type="search" autocomplete="off" placeholder="' + esc(t('Search plans...', 'Cari pelan...')) + '" aria-label="' + esc(t('Search plans', 'Cari pelan')) + '" value="' + esc(st.q) + '"></label></div>' +
        '<div id="sp-results">' + SP.resultsHtml() + '</div>';
    }
    SP.paint(head + body + SP.templatesHtml(admin));
  };
})();
