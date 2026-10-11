/* Sales Plan — plan detail shell (header, tabs, status). v2 (phase 2b): tab bodies come from SP.tabs[id]
   (overview, weekly, milestones, stock), extras loaded via SP.loadExtras, weekly report via params.report. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc, d10 = SP.d10;
  var TABS = [
    { id: 'overview', icon: 'ti-chart-pie', en: 'Overview', bm: 'Ringkasan' },
    { id: 'targets', icon: 'ti-target', en: 'Targets', bm: 'Sasaran' },
    { id: 'weekly', icon: 'ti-pencil', en: 'Weekly Update', bm: 'Kemas Kini Mingguan', sen: 'Weekly', sbm: 'Mingguan' },
    { id: 'stock', icon: 'ti-building-bank', en: 'Stock & Financing', bm: 'Stok & Pembiayaan', sen: 'Stock', sbm: 'Stok', fin: true },
    { id: 'milestones', icon: 'ti-flag', en: 'Milestones', bm: 'Milestone' },
    { id: 'settings', icon: 'ti-settings', en: 'Settings', bm: 'Tetapan', admin: true }
  ];
  function tabsFor(p) { var admin = SP.isAdmin(); return TABS.filter(function (x) { return (!x.fin || p.financing_enabled) && (!x.admin || admin); }); }
  SP.tabs = SP.tabs || {}; SP.afterTab = SP.afterTab || {};

  SP.showDetail = async function (params, seq) {
    await SP.loadPlan(params.id);
    if (!SP.alive(seq)) return;
    if (!st.plan) { SP.paint(SP.notFoundHtml()); return; }
    if (SP.loadExtras) { await SP.loadExtras(st.plan.id); if (!SP.alive(seq)) return; }
    if (params.report && SP.showReport) { await SP.showReport(params, seq); return; }
    var tabs = tabsFor(st.plan), tab = params.tab || 'overview';
    if (!tabs.some(function (x) { return x.id === tab; })) tab = 'overview';
    st.tab = tab;
    if (tab === 'settings') { await SP.loadRefs(); if (!SP.alive(seq)) return; SP.initForm('edit:' + st.plan.id); }
    if (tab === 'targets') SP.initEdit();
    if ((tab === 'overview' || tab === 'weekly') && SP.loadAuto) { await SP.loadAuto(); if (!SP.alive(seq)) return; }
    if (tab === 'weekly' && SP.loadUsers) { await SP.loadUsers(); if (!SP.alive(seq)) return; }
    SP.paint(detailHtml(tabs, tab));
    if (tab === 'settings') SP.afterFormPaint();
    var tb = document.querySelector('#main .sp-tabs'), on = tb && tb.querySelector('.sp-tab.on');
    if (on && tb.scrollWidth > tb.clientWidth) tb.scrollLeft += on.getBoundingClientRect().left - tb.getBoundingClientRect().left - (tb.clientWidth - on.offsetWidth) / 2;
    if (SP.afterTab[tab]) SP.afterTab[tab](seq);
  };
  function headHtml(p) {
    var admin = SP.isAdmin(), n = st.weeks.length, cw = SP.weekOf(st.weeks, SP.todayISO());
    var wk = n ? (cw ? t(n + ' weeks · ' + cw.code + ' of ' + n, n + ' minggu · ' + cw.code + ' daripada ' + n) : t(n + ' weeks', n + ' minggu')) : t('No weeks yet', 'Belum ada minggu');
    var meta = [['ti-calendar', SP.fmtRange(p.start_date, p.end_date)], ['ti-clock', wk], ['ti-coin', p.currency || 'MYR'], ['ti-user', SP.picLabel(p)]];
    var btns = '<button type="button" class="btn btn-outline btn-sm" data-act="report"><i class="ti ti-file-text"></i>' + esc(t('Weekly report', 'Laporan mingguan')) + '</button>' +
      (admin ? '<button type="button" class="btn btn-outline btn-sm" data-act="save-tpl"><i class="ti ti-template"></i>' + esc(t('Save as template', 'Simpan sebagai templat')) + '</button>' : '') +
      ((admin || st.canEdit) && p.status !== 'archived' ? '<button type="button" class="btn btn-primary btn-sm" data-act="tab" data-tab="weekly"><i class="ti ti-pencil"></i>' + esc(t('Update this week', 'Kemas kini minggu ini')) + '</button>' : '');
    return '<div class="sp-dhead"><div class="sp-dhead-l"><button type="button" class="sp-iconbtn" data-act="list" aria-label="' + esc(t('Back to plans', 'Kembali ke senarai pelan')) + '"><i class="ti ti-arrow-left"></i></button>' +
      '<div class="sp-dhead-txt"><div class="sp-dtitle"><h1 class="page-title sp-dname">' + esc(p.name) + '</h1>' + SP.statusBadge(p.status) +
      '<button type="button" class="sp-src" data-act="tab" data-tab="weekly"><i class="ti ' + SP.srcIcon(p.sales_source) + '" aria-hidden="true"></i>' + esc(SP.srcLabel(p.sales_source)) + '</button></div>' +
      '<div class="sp-meta">' + meta.map(function (m) { return '<span><i class="ti ' + m[0] + '" aria-hidden="true"></i>' + esc(m[1]) + '</span>'; }).join('') + '</div></div></div>' +
      '<div class="sp-dhead-r">' + btns + '</div></div>';
  }
  function tabsHtml(tabs, cur) {
    return '<div class="sp-tabs" role="tablist">' + tabs.map(function (x) {
      var on = x.id === cur;
      return '<button type="button" role="tab" class="sp-tab' + (on ? ' on' : '') + '" aria-selected="' + on + '" data-act="tab" data-tab="' + x.id + '"><i class="ti ' + x.icon + '" aria-hidden="true"></i>' +
        '<span class="sp-tl">' + esc(t(x.en, x.bm)) + '</span><span class="sp-ts">' + esc(t(x.sen || x.en, x.sbm || x.bm)) + '</span></button>';
    }).join('') + '</div>';
  }
  SP.comingSoonHtml = function () {
    return '<div class="card sp-soon"><div class="empty-state"><i class="ti ti-hourglass" aria-hidden="true"></i><p class="sp-soon-t">' + esc(t('Coming in next update', 'Akan datang dalam kemas kini seterusnya')) + '</p>' +
      '<p class="sp-t2">' + esc(t('This section is part of the next Sales Plan release.', 'Bahagian ini termasuk dalam keluaran Pelan Jualan seterusnya.')) + '</p></div></div>';
  };
  function statusCard(p) {
    var b = function (to, icon, en, bm, cls) { return '<button type="button" class="btn ' + (cls || 'btn-outline') + '" data-act="status" data-to="' + to + '"><i class="ti ' + icon + '"></i>' + esc(t(en, bm)) + '</button>'; };
    var s = p.status, acts = '';
    if (s === 'draft') acts = b('active', 'ti-player-play', 'Activate', 'Aktifkan', 'btn-primary');
    else if (s === 'active') acts = b('completed', 'ti-circle-check', 'Mark completed', 'Tanda selesai');
    else if (s === 'completed') acts = b('active', 'ti-refresh', 'Reopen', 'Buka semula');
    else if (s === 'archived') acts = b('draft', 'ti-arrow-back-up', 'Restore to draft', 'Pulihkan ke draf');
    if (s !== 'archived') acts += b('archived', 'ti-archive', 'Archive', 'Arkibkan');
    return '<div class="card sp-form sp-status-card"><div class="card-title sp-sec-title"><i class="ti ti-flag-3"></i>' + esc(t('Plan status', 'Status pelan')) + '</div>' +
      '<div class="sp-hint sp-mb">' + esc(t('Current status: ', 'Status semasa: ')) + esc(t(SP.STATUS[s].en, SP.STATUS[s].bm)) + '. ' + esc(t('Archived plans are hidden from All but can be restored.', 'Pelan diarkib disembunyikan daripada Semua tetapi boleh dipulihkan.')) + '</div>' +
      '<div class="sp-btnrow">' + acts + '</div></div>';
  }
  function settingsHtml(p) {
    return '<div class="sp-settings sp-has-foot"><div class="card sp-form">' + SP.formFieldsHtml() + '</div>' + statusCard(p) +
      '<div class="sp-foot"><button type="button" class="btn btn-primary" data-act="setup-save" data-next="stay"><i class="ti ti-device-floppy"></i>' + esc(t('Save changes', 'Simpan perubahan')) + '</button></div></div>';
  }
  function detailHtml(tabs, tab) {
    var p = st.plan, body;
    if (tab === 'settings') body = settingsHtml(p);
    else if (tab === 'targets') body = '<div class="sp-has-foot" id="sp-teditor">' + SP.targetsEditorHtml(false) + '</div>';
    else body = SP.tabs[tab] ? SP.tabs[tab]() : SP.comingSoonHtml();
    return '<div class="sp-detail">' + headHtml(p) + tabsHtml(tabs, tab) + '<div class="sp-tabbody">' + body + '</div></div>';
  }

  var A = SP.actions;
  A.tab = function (b) {
    var to = b.getAttribute('data-tab'); if (to === st.tab) return;
    if (!SP.leaveOk()) return;
    SP.discard();
    SP.go({ view: 'detail', id: st.plan.id, tab: to });
  };
  A.status = async function (b) {
    if (st.busy) return;
    var p = st.plan, to = b.getAttribute('data-to');
    if (to === 'archived' && !window.confirm(t('Archive "' + p.name + '"? It will be hidden from the plan list (filter Archived to see it).', 'Arkibkan "' + p.name + '"? Ia akan disembunyikan daripada senarai (tapis Arkib untuk lihat).'))) return;
    if (to === 'active' && p.status === 'draft' && !st.weeks.length && !window.confirm(t('This plan has no weeks yet. Activate anyway?', 'Pelan ini belum ada minggu. Aktifkan juga?'))) return;
    if (!SP.leaveOk()) return;
    SP.setBusy(true);
    try {
      var res = await sb.from('sales_plans').update({ status: to }).eq('id', p.id).eq('tenant_id', SP.tid());
      if (res.error) throw res.error;
      SP.discard();
      SP.toast(t('Status updated', 'Status dikemas kini'), 'success');
      SP.go(to === 'archived' ? {} : { view: 'detail', id: p.id, tab: 'settings' });
    } catch (err) { SP.setBusy(false); SP.toast(SP.errMsg(err), 'error'); }
  };
  A['save-tpl'] = function () { SP.saveAsTemplate(st.plan); };
  A.report = function () { if (!SP.showReport) { SP.actions.soon(); return; } if (!SP.leaveOk()) return; SP.discard(); SP.go({ view: 'detail', id: st.plan.id, tab: st.tab || 'overview', report: 1 }); };
})();
