/* Sales Plan — File 7/12: periods & weekly targets editor (step 2/2 + Targets tab). */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc, num = SP.num, d10 = SP.d10;

  SP.initEdit = function () {
    var key = 'edit:' + st.plan.id;
    if (st.edit && st.edit.key === key && st.edit.dirty) return;
    var P = st.periods.map(function (p) { return { id: p.id, kind: p.kind === 'custom' ? 'custom' : 'month', label: p.label || '', start_date: d10(p.start_date), end_date: d10(p.end_date), gmv_target: String(num(p.gmv_target)), units_target: String(num(p.units_target)), orders_target: String(num(p.orders_target)) }; });
    var W = st.weeks.map(function (w) { return { id: w.id, code: w.code, period_id: w.period_id, start_date: d10(w.start_date), end_date: d10(w.end_date), gmv_target: String(num(w.gmv_target)), units_target: String(num(w.units_target)), orders_target: String(num(w.orders_target)), hasActual: w.gmv_manual != null || w.units_manual != null || w.orders_manual != null || w.gmv_auto != null }; });
    var E = st.edit = { key: key, periods: P, weeks: W, removedP: [], removedW: [], dirty: false, generated: false, orig: {}, origPeriod: {} };
    P.concat(W).forEach(function (x) { E.orig[x.id] = SP.sig(x); });
    W.forEach(function (w) { E.origPeriod[w.id] = w.period_id || null; });
    if (SP.isAdmin()) {
      if (!P.length) { E.periods = SP.genMonths(d10(st.plan.start_date), d10(st.plan.end_date)); E.generated = E.dirty = true; }
      if (!W.length) { E.weeks = SP.genWeeks(d10(st.plan.start_date), d10(st.plan.end_date)); E.generated = E.dirty = true; }
    }
  };
  SP.sumOf = function (rows, f) { return rows.reduce(function (s, r) { return s + num(r[f]); }, 0); };
  function totals(rows, extra) {
    var cur = st.plan.currency;
    return '<td colspan="4"><b>' + esc(t('Total', 'Jumlah')) + '</b></td><td class="sp-num"><b>' + esc(SP.money(SP.sumOf(rows, 'gmv_target'), cur)) + '</b></td><td class="sp-num"><b>' + esc(SP.fmtNum(SP.sumOf(rows, 'units_target'))) + '</b></td><td class="sp-num"><b>' + esc(SP.fmtNum(SP.sumOf(rows, 'orders_target'))) + '</b></td>' + (extra || '');
  }
  function warningsHtml() {
    var E = st.edit, out = [], cur = st.plan.currency, i;
    var ps = E.periods.slice().sort(function (a, b) { return String(a.start_date).localeCompare(String(b.start_date)); });
    for (i = 1; i < ps.length; i++) if (ps[i].start_date && ps[i - 1].end_date && ps[i].start_date <= ps[i - 1].end_date) { out.push(t('Some periods overlap — the plan total counts both.', 'Ada tempoh bertindih — jumlah pelan mengira kedua-duanya.')); break; }
    var dp = SP.sumOf(E.periods, 'gmv_target'), dw = SP.sumOf(E.weeks, 'gmv_target');
    if (E.weeks.length && dp > 0 && Math.abs(dp - dw) >= 1) out.push(t('Weekly GMV total differs from period total by ', 'Jumlah GMV mingguan berbeza daripada jumlah tempoh sebanyak ') + SP.money(Math.abs(dp - dw), cur) + '.');
    if (E.weeks.some(function (w) { return !SP.periodFor(w, E.periods); })) out.push(t('Some weeks are outside every period.', 'Ada minggu di luar semua tempoh.'));
    var a = d10(st.plan.start_date), b = d10(st.plan.end_date);
    if (E.weeks.length && (E.weeks[0].start_date !== a || E.weeks[E.weeks.length - 1].end_date !== b)) out.push(t('Weeks do not match the plan dates (' + SP.fmtRange(a, b) + '). Use Regenerate weeks if the dates changed.', 'Minggu tidak sepadan dengan tarikh pelan (' + SP.fmtRange(a, b) + '). Guna Jana semula minggu jika tarikh berubah.'));
    return out.map(function (m) { return '<div class="sp-warn"><i class="ti ti-alert-triangle" aria-hidden="true"></i><span>' + esc(m) + '</span></div>'; }).join('');
  }
  SP.refreshTotals = function () {
    var E = st.edit, a = document.getElementById('sp-ptot'), b = document.getElementById('sp-wtot'), c = document.getElementById('sp-twarn');
    if (a) a.innerHTML = totals(E.periods, '<td></td>');
    if (b) b.innerHTML = totals(E.weeks);
    if (c) c.innerHTML = warningsHtml();
    document.querySelectorAll('.sp-root [data-wper]').forEach(function (td) { var w = E.weeks[+td.getAttribute('data-wper')], p = w && SP.periodFor(w, E.periods); td.textContent = p ? p.label : '—'; });
  };
  function fld(kind, i, f, v, ro, label, type) {
    var isNum = type === 'number';
    return '<input class="form-input sp-tin' + (type === 'date' ? ' sp-tdate' : '') + '" type="' + type + '"' + (isNum ? ' inputmode="decimal" min="0" step="any"' : type === 'text' ? ' maxlength="40" data-no-titlecase="1"' : '') +
      ' data-tk="' + kind + '" data-i="' + i + '" data-tf="' + f + '" value="' + esc(v) + '"' + (ro ? ' disabled' : '') + ' aria-label="' + esc(label) + '">';
  }
  function heads(first, second, cur, extra) {
    return '<thead><tr><th>' + esc(first) + '</th><th>' + esc(second) + '</th><th>' + esc(t('Start', 'Mula')) + '</th><th>' + esc(t('End', 'Tamat')) + '</th><th class="sp-num">' + esc(t('GMV target', 'Sasaran GMV')) + ' (' + esc(SP.curSym(cur)) + ')</th><th class="sp-num">' + esc(t('Units target', 'Sasaran unit')) + '</th><th class="sp-num">' + esc(t('Orders target', 'Sasaran order')) + '</th>' + (extra || '') + '</tr></thead>';
  }
  function btn(act, icon, label) { return '<button type="button" class="btn btn-outline btn-sm" data-act="' + act + '"><i class="ti ' + icon + '"></i>' + esc(label) + '</button>'; }
  function numCells(k, i, r, ro, code) {
    return ['gmv_target', 'units_target', 'orders_target'].map(function (f, j) {
      return '<td>' + fld(k, i, f, r[f], ro, code + ' — ' + [t('GMV target', 'Sasaran GMV'), t('Units target', 'Sasaran unit'), t('Orders target', 'Sasaran order')][j], 'number') + '</td>';
    }).join('');
  }
  SP.targetsEditorHtml = function (pageMode) {
    var E = st.edit, admin = SP.isAdmin(), ro = !admin, cur = st.plan.currency, S = t('Start date', 'Tarikh mula'), N = t('End date', 'Tarikh tamat');
    var pRows = E.periods.map(function (p, i) {
      return '<tr><td>' + (ro ? esc(p.label) : fld('p', i, 'label', p.label, ro, t('Period name', 'Nama tempoh'), 'text')) + '</td>' +
        '<td><span class="badge ' + (p.kind === 'custom' ? 'badge-blue' : 'badge-gray') + '">' + esc(p.kind === 'custom' ? t('Custom', 'Khas') : t('Month', 'Bulan')) + '</span></td>' +
        '<td>' + fld('p', i, 'start_date', p.start_date, ro, p.label + ' — ' + S, 'date') + '</td><td>' + fld('p', i, 'end_date', p.end_date, ro, p.label + ' — ' + N, 'date') + '</td>' +
        numCells('p', i, p, ro, p.label) + '<td>' + (ro ? '' : '<button type="button" class="sp-iconbtn sp-del" data-act="tg-del-period" data-i="' + i + '" aria-label="' + esc(t('Remove period', 'Buang tempoh')) + '" title="' + esc(t('Remove period', 'Buang tempoh')) + '"><i class="ti ti-trash"></i></button>') + '</td></tr>';
    }).join('') || '<tr><td colspan="8" class="sp-t2">' + esc(t('No periods yet.', 'Belum ada tempoh.')) + '</td></tr>';
    var wRows = E.weeks.map(function (w, i) {
      var p = SP.periodFor(w, E.periods);
      return '<tr><td><b>' + esc(w.code) + '</b></td><td class="sp-t2" data-wper="' + i + '">' + esc(p ? p.label : '—') + '</td>' +
        '<td>' + fld('w', i, 'start_date', w.start_date, ro, w.code + ' — ' + S, 'date') + '</td><td>' + fld('w', i, 'end_date', w.end_date, ro, w.code + ' — ' + N, 'date') + '</td>' + numCells('w', i, w, ro, w.code) + '</tr>';
    }).join('') || '<tr><td colspan="7" class="sp-t2">' + esc(t('No weeks yet.', 'Belum ada minggu.')) + '</td></tr>';
    var foot = '';
    if (admin) {
      var draft = st.plan.status === 'draft';
      foot = '<div class="sp-foot">' + (pageMode ? '<button type="button" class="btn btn-outline" data-act="tg-back">' + esc(t('Back', 'Kembali')) + '</button>' : '') +
        '<button type="button" class="btn ' + (draft ? 'btn-outline' : 'btn-primary') + '" data-act="tg-save"><i class="ti ti-device-floppy"></i>' + (draft ? '<span class="sp-tl">' + esc(t('Save as draft', 'Simpan sebagai draf')) + '</span><span class="sp-ts">' + esc(t('Save draft', 'Simpan draf')) + '</span>' : esc(t('Save', 'Simpan'))) + '</button>' +
        (draft ? '<button type="button" class="btn btn-primary" data-act="tg-save" data-activate="1"><i class="ti ti-player-play"></i>' + esc(t('Activate', 'Aktifkan')) + '</button>' : '') + '</div>';
    }
    var note = function (icon, txt) { return '<div class="sp-note"><i class="ti ' + icon + '" aria-hidden="true"></i><span>' + esc(txt) + '</span></div>'; };
    return (E.generated ? note('ti-sparkles', t('Months and weeks were generated from the plan dates. Enter targets, then save.', 'Bulan dan minggu dijana daripada tarikh pelan. Isi sasaran, kemudian simpan.')) : '') +
      (ro ? note('ti-eye', t('View only — only the Owner or Admin can change targets.', 'Lihat sahaja — hanya Pemilik atau Admin boleh ubah sasaran.')) : '') +
      '<div class="card sp-tcard"><div class="sp-tcard-h"><div class="card-title sp-sec-title"><i class="ti ti-calendar-stats"></i>' + esc(t('Periods & targets', 'Tempoh & sasaran')) + '</div>' +
      (admin ? '<div class="sp-tactions">' + btn('tg-add-period', 'ti-plus', t('Add custom period', 'Tambah tempoh khas')) + btn('tg-regen-months', 'ti-refresh', t('Regenerate months', 'Jana semula bulan')) + '</div>' : '') + '</div>' +
      '<div class="sp-hint sp-mb">' + esc(t('Months follow the plan dates. Add custom periods (e.g. Raya Sprint) with their own dates.', 'Bulan ikut tarikh pelan. Tambah tempoh khas (cth. Raya Sprint) dengan tarikh sendiri.')) + '</div>' +
      '<div class="sp-tscroll"><table class="sp-ttable sp-ttable-p">' + heads(t('Period', 'Tempoh'), t('Type', 'Jenis'), cur, '<th><span class="sp-sr">' + esc(t('Actions', 'Tindakan')) + '</span></th>') +
      '<tbody>' + pRows + '</tbody><tfoot><tr id="sp-ptot">' + totals(E.periods, '<td></td>') + '</tr></tfoot></table></div></div>' +
      '<div class="card sp-tcard"><div class="sp-tcard-h"><div class="card-title sp-sec-title"><i class="ti ti-calendar-week"></i>' + esc(t('Weekly targets', 'Sasaran mingguan')) + '</div>' +
      (admin ? '<div class="sp-tactions">' + btn('tg-distribute', 'ti-arrows-split', t('Split period targets into weeks', 'Bahagi sasaran tempoh ikut minggu')) + btn('tg-regen-weeks', 'ti-refresh', t('Regenerate weeks', 'Jana semula minggu')) + '</div>' : '') + '</div>' +
      '<div class="sp-hint sp-mb">' + esc(t('Weeks run Monday–Sunday, cut at the plan start and end. Dates can be edited.', 'Minggu bermula Isnin–Ahad, dipotong pada tarikh mula dan tamat pelan. Tarikh boleh diubah.')) + '</div>' +
      '<div class="sp-tscroll"><table class="sp-ttable sp-ttable-w">' + heads(t('Week', 'Minggu'), t('Period', 'Tempoh'), cur) +
      '<tbody>' + wRows + '</tbody><tfoot><tr id="sp-wtot">' + totals(E.weeks) + '</tr></tfoot></table></div>' +
      '<div id="sp-twarn">' + warningsHtml() + '</div></div>' + foot;
  };
  SP.targetsPageHtml = function () {
    return '<div class="sp-setup sp-setup-wide sp-has-foot">' +
      '<div class="sp-step-head"><button type="button" class="sp-iconbtn" data-act="tg-back" aria-label="' + esc(t('Back', 'Kembali')) + '"><i class="ti ti-arrow-left"></i></button>' +
      '<div class="sp-step-txt"><div class="sp-step-title">' + esc(st.plan.name) + '</div><div class="sp-hint">' + esc(t('Step 2 / 2 · Periods & targets', 'Langkah 2 / 2 · Tempoh & sasaran')) + '</div></div></div>' +
      '<div id="sp-teditor" data-page="1">' + SP.targetsEditorHtml(true) + '</div></div>';
  };
})();
