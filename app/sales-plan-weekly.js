/* Sales Plan — phase 2b. Weekly Update tab (mockup 2): source switch, summary cards,
   editable weekly grid (manual) / M-Core actuals (auto). Events + save in sales-plan-weekly-save.js. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc, num = SP.num, d10 = SP.d10;
  var F = ['gmv', 'units', 'orders'];
  function s(v) { return v == null || v === '' ? '' : String(SP.r2(v)); }
  SP.wkInit = function () {
    var key = 'wk:' + st.plan.id;
    if (st.wk && st.wk.key === key) return st.wk;
    var vals = {};
    st.weeks.forEach(function (w) { vals[String(w.id)] = { gmv: s(w.gmv_manual), units: s(w.units_manual), orders: s(w.orders_manual) }; });
    st.wk = { key: key, vals: vals, orig: JSON.stringify(vals), dirty: false };
    return st.wk;
  };
  SP.wkEditable = function () { return !!st.canEdit && st.plan.sales_source !== 'auto' && st.plan.status !== 'archived'; };
  /* context with the unsaved grid values applied (manual mode) */
  SP.wkCtx = function () {
    var c = SP.ctx();
    if (st.plan.sales_source === 'auto' || !st.wk) return c;
    c.weeks = c.weeks.map(function (w) {
      var v = st.wk.vals[String(w.id)] || {}, o = Object.assign({}, w);
      F.forEach(function (f) { var x = v[f]; o[f + '_manual'] = x === '' || x == null || !isFinite(Number(x)) ? null : Number(x); });
      return o;
    });
    return c;
  };
  SP.fmtStamp = function (iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    var h = d.getHours(), m = d.getMinutes();
    return d.getDate() + ' ' + SP.mons()[d.getMonth()] + ', ' + ((h % 12) || 12) + ':' + SP.pad(m) + ' ' + (h < 12 ? 'AM' : 'PM');
  };
  function savedInfo() {
    var auto = st.plan.sales_source === 'auto', best = null;
    st.weeks.forEach(function (w) { var v = auto ? w.auto_synced_at : w.manual_saved_at; if (v && (!best || String(v) > String(best.v))) best = { v: v, by: w.manual_saved_by }; });
    if (!best) return auto ? t('Not synced yet', 'Belum disegerakkan') : t('Not saved yet', 'Belum disimpan');
    if (auto) return t('Synced ', 'Disegerakkan ') + SP.fmtStamp(best.v);
    var who = best.by ? SP.userName(best.by) : '';
    return t('Last saved ', 'Disimpan ') + SP.fmtStamp(best.v) + (who ? t(' by ', ' oleh ') + who : '');
  }
  function cell(w, f, v, label, edit) {
    if (!edit) return '<span class="sp-wval">' + (v === '' || v == null ? '<span class="sp-dash">—</span>' : esc(SP.fmtNum(v, f === 'gmv' && num(v) % 1 ? 2 : 0))) + '</span>';
    return '<input class="form-input sp-win" type="number" inputmode="decimal" min="0" step="any" data-wk="' + esc(w.id) + '" data-wf="' + f + '" value="' + esc(v) + '" placeholder="0" aria-label="' + esc(w.code + ' — ' + label) + '">';
  }
  SP.wkCalcCells = function (c, w) {
    var k = SP.weekCalc(c, w);
    return { ach: k.ach == null ? '<span class="sp-dash">—</span>' : '<span class="' + SP.achCls(k.status) + '">' + SP.pct1(k.ach) + '</span>',
      aov: k.aov == null ? '<span class="sp-dash">—</span>' : SP.fmtNum(k.aov, 2), st: SP.kpiBadge(k.status) };
  };
  SP.wkRowsHtml = function (c) {
    var edit = SP.wkEditable(), today = SP.todayISO(), auto = st.plan.sales_source === 'auto';
    var GA = t('GMV actual', 'GMV sebenar'), UA = t('Units actual', 'Unit sebenar'), OA = t('Orders actual', 'Order sebenar');
    var trs = '', cards = '';
    c.weeks.forEach(function (w) {
      var id = String(w.id), cw = d10(w.start_date) <= today && today <= d10(w.end_date), per = c.periods.find(function (p) { return SP.same(p.id, w.period_id); });
      var v = auto ? { gmv: s(SP.eff(c, w, 'gmv')), units: s(SP.eff(c, w, 'units')), orders: s(SP.eff(c, w, 'orders')) } : (st.wk.vals[id] || {});
      var k = SP.wkCalcCells(c, w), pill = cw ? ' <span class="sp-thisweek">' + esc(t('This week', 'Minggu ini')) + '</span>' : '';
      trs += '<tr class="' + (cw ? 'sp-cur' : '') + '" data-wrow="' + esc(id) + '"><td class="sp-wcode"><b>' + esc(w.code) + '</b>' + pill + '</td><td class="sp-t2">' + esc(per ? per.label : '—') + '</td><td class="sp-nowrap">' + esc(SP.shortRange(w.start_date, w.end_date)) + '</td>' +
        '<td class="sp-num">' + SP.fmtNum(w.gmv_target) + '</td><td class="sp-num">' + cell(w, 'gmv', v.gmv, GA, edit) + '</td><td class="sp-num" data-c="ach">' + k.ach + '</td>' +
        '<td class="sp-num sp-t2">' + SP.fmtNum(w.units_target) + '</td><td class="sp-num">' + cell(w, 'units', v.units, UA, edit) + '</td>' +
        '<td class="sp-num sp-t2">' + SP.fmtNum(w.orders_target) + '</td><td class="sp-num">' + cell(w, 'orders', v.orders, OA, edit) + '</td><td class="sp-num" data-c="aov">' + k.aov + '</td><td data-c="st">' + k.st + '</td></tr>';
      cards += '<div class="card sp-wcard' + (cw ? ' sp-cur' : '') + '" data-wrow="' + esc(id) + '"><div class="sp-wcard-h"><div><b>' + esc(w.code) + '</b>' + pill + '<div class="sp-hint">' + esc((per ? per.label + ' · ' : '') + SP.shortRange(w.start_date, w.end_date)) + '</div></div><span data-c="st">' + k.st + '</span></div>' +
        '<div class="sp-wcard-g"><label><span>' + esc(GA) + ' · ' + esc(t('target', 'sasaran')) + ' ' + SP.fmtNum(w.gmv_target) + '</span>' + cell(w, 'gmv', v.gmv, GA, edit) + '</label>' +
        '<label><span>' + esc(UA) + ' · ' + SP.fmtNum(w.units_target) + '</span>' + cell(w, 'units', v.units, UA, edit) + '</label>' +
        '<label><span>' + esc(OA) + ' · ' + SP.fmtNum(w.orders_target) + '</span>' + cell(w, 'orders', v.orders, OA, edit) + '</label></div>' +
        '<div class="sp-wcard-f"><span>' + esc(t('Ach', 'Capai')) + ' <b data-c="ach">' + k.ach + '</b></span><span>AOV <b data-c="aov">' + k.aov + '</b></span></div></div>';
    });
    return { trs: trs, cards: cards };
  };
  SP.tabs.weekly = function () {
    SP.wkInit();
    var c = SP.wkCtx(), auto = st.plan.sales_source === 'auto', admin = SP.isAdmin() && st.plan.status !== 'archived', edit = SP.wkEditable(), cur = c.plan.currency;
    var radio = function (v, label, sub) {
      var on = st.plan.sales_source === v;
      return '<button type="button" role="radio" aria-checked="' + on + '" class="sp-radio' + (on ? ' on' : '') + '" data-act="wk-src" data-v="' + v + '"' + (admin ? '' : ' disabled') + '><i aria-hidden="true"></i>' + esc(label) + (sub ? ' <span class="sp-hint">' + esc(sub) + '</span>' : '') + '</button>';
    };
    var R = SP.wkRowsHtml(c);
    var GA = t('GMV actual', 'GMV sebenar');
    var head = '<thead><tr><th>' + esc(t('Week', 'Minggu')) + '</th><th>' + esc(t('Period', 'Tempoh')) + '</th><th>' + esc(t('Dates', 'Tarikh')) + '</th><th class="sp-num">' + esc(t('GMV target', 'Sasaran GMV')) + '</th><th class="sp-num">' + esc(GA) + '</th><th class="sp-num">' + esc(t('Ach %', 'Capai %')) + '</th>' +
      '<th class="sp-num">' + esc(t('Units T', 'Unit S')) + '</th><th class="sp-num">' + esc(t('Units A', 'Unit B')) + '</th><th class="sp-num">' + esc(t('Orders T', 'Order S')) + '</th><th class="sp-num">' + esc(t('Orders A', 'Order B')) + '</th><th class="sp-num">AOV</th><th>' + esc(t('Status', 'Status')) + '</th></tr></thead>';
    var warn = st.autoErr ? '<div class="sp-warn sp-warn-top"><i class="ti ti-alert-triangle"></i><span>' + esc(t('Could not read M-Core sales: ', 'Gagal baca jualan M-Core: ') + SP.errMsg(st.autoErr)) + '</span></div>' : '';
    return warn + '<div class="card sp-srcbar"><span class="sp-srcbar-l">' + esc(t('Sales source:', 'Sumber jualan:')) + '</span><div class="sp-radios" role="radiogroup" aria-label="' + esc(t('Sales source', 'Sumber jualan')) + '">' +
      radio('manual', t('Manual entry', 'Taip sendiri')) + radio('auto', t('Auto from M-Core sales', 'Auto dari jualan M-Core'), t('(Invoice + POS)', '(Invois + POS)')) + '</div>' +
      '<span class="sp-hint sp-saved" id="sp-wk-saved"><i class="ti ti-history"></i> ' + esc(savedInfo()) + '</span><div class="sp-srcbar-r">' +
      (edit ? '<button type="button" class="btn btn-outline btn-sm" data-act="wk-import"><i class="ti ti-file-spreadsheet"></i>' + esc(t('Import Excel/CSV', 'Import Excel/CSV')) + '</button>' : '') +
      (auto && st.canEdit ? '<button type="button" class="btn btn-outline btn-sm" data-act="wk-sync"><i class="ti ti-refresh"></i>' + esc(t('Refresh from M-Core', 'Segar dari M-Core')) + '</button>' : '') +
      (edit ? '<button type="button" class="btn btn-primary btn-sm" data-act="wk-save"><i class="ti ti-device-floppy"></i>' + esc(t('Save', 'Simpan')) + '</button>' : '') + '</div></div>' +
      (!st.canEdit ? '<div class="sp-note"><i class="ti ti-eye"></i><span>' + esc(t('View only — only the plan PIC, Owner or Admin can update weekly actuals.', 'Lihat sahaja — hanya PIC pelan, Pemilik atau Admin boleh kemas kini jualan mingguan.')) + '</span></div>' : '') +
      (c.weeks.length ? '<div id="sp-wk-sum">' + SP.wkSummaryHtml(c) + '</div>' : '') +
      (c.weeks.length ? '<div class="card sp-table-card sp-wtable-card"><div class="sp-tscroll"><table class="sp-table sp-wtable">' + head + '<tbody>' + R.trs + '</tbody></table></div>' +
        '<div class="sp-wfoot"><span><i class="sp-edit-sw"></i>' + esc(auto ? t('Auto mode: actuals come from issued invoices + POS sales.', 'Mod auto: jualan sebenar dari invois dikeluarkan + jualan POS.') : t('Editable cells (PIC / Owner). Ach %, AOV and Status are calculated.', 'Sel boleh diubah (PIC / Pemilik). Capai %, AOV dan Status dikira.')) + ' ' + esc(t('Rule:', 'Peraturan:')) +
        ' <b class="sp-ok">≥' + num(c.plan.on_track_pct) + '%</b> ' + esc(SP.kpiLabel('on')) + ' · <b class="sp-wt">≥' + num(c.plan.watch_pct) + '%</b> ' + esc(SP.kpiLabel('watch')) + ' · <b class="sp-bad">' + esc('<') + num(c.plan.watch_pct) + '%</b> ' + esc(SP.kpiLabel('off')) + '</span><span class="sp-hint">' + esc(t(c.weeks.length + ' weeks', c.weeks.length + ' minggu')) + '</span></div></div>' +
        '<div class="sp-wcards">' + R.cards + '</div>' + (edit ? '<div class="sp-foot sp-wk-foot"><button type="button" class="btn btn-primary" data-act="wk-save"><i class="ti ti-device-floppy"></i>' + esc(t('Save weekly update', 'Simpan kemas kini mingguan')) + '</button></div>' : '')
        : SP.emptyCard('ti-calendar-off', t('No weeks yet', 'Belum ada minggu'), t('Set up periods and weeks in the Targets tab first.', 'Sediakan tempoh dan minggu dalam tab Sasaran dahulu.'), '<button type="button" class="btn btn-primary" data-act="tab" data-tab="targets">' + esc(t('Go to Targets', 'Pergi ke Sasaran')) + '</button>'));
  };
})();
