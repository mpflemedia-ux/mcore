/* Sales Plan — phase 2d. Import Excel/CSV: SheetJS is loaded from the CDN only when a file is read.
   Choose plan + file -> preview of every change -> Save (Owner/Admin). */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc;
  var CDN = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js', loading = null;
  SP.loadXlsx = function () {
    if (window.XLSX && window.XLSX.read) return Promise.resolve(window.XLSX);
    if (loading) return loading;
    loading = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = CDN; s.async = true;
      var to = setTimeout(function () { no(new Error('timeout')); }, 20000);
      s.onload = function () { clearTimeout(to); window.XLSX ? ok(window.XLSX) : no(new Error('no XLSX')); };
      s.onerror = function () { clearTimeout(to); no(new Error('load')); };
      document.head.appendChild(s);
    }).catch(function (e) { loading = null; throw e; });
    return loading;
  };
  SP.readSheets = async function (file) {
    var X = await SP.loadXlsx(), buf = await file.arrayBuffer(), csv = /\.csv$/i.test(file.name);
    var wb = csv ? X.read(new TextDecoder('utf-8').decode(buf).replace(/^\uFEFF/, ''), { type: 'string', raw: false }) : X.read(buf, { type: 'array' });
    var out = {};
    wb.SheetNames.forEach(function (n) { out[n] = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }); });
    return out;
  };
  var FL = { gmv_manual: ['GMV actual', 'GMV sebenar'], units_manual: ['Units actual', 'Unit sebenar'], orders_manual: ['Orders actual', 'Pesanan sebenar'], gmv_target: ['GMV target', 'Sasaran GMV'], units_target: ['Units target', 'Sasaran unit'], orders_target: ['Orders target', 'Sasaran pesanan'],
    pic_notes: ['Notes', 'Nota'], target_inbound: ['Target inbound', 'Sasaran masuk'], target_qty: ['Target qty', 'Sasaran kuantiti'], target_cost: ['Target cost', 'Sasaran kos'], target_due_date: ['Target due', 'Sasaran tamat'], actual_inbound: ['Inbound', 'Masuk'], actual_qty: ['Qty', 'Kuantiti'], actual_cost: ['Cost', 'Kos'],
    product_mix: ['Mix', 'Campuran'], financed_pct: ['Financed %', 'Dibiayai %'], fee_pct: ['Fee %', 'Fi %'], title: ['Title', 'Tajuk'], due_date: ['Due', 'Tarikh'], target: ['Target', 'Sasaran'], actual_manual: ['Actual', 'Sebenar'], owner_name: ['Owner', 'Pemilik'], metric: ['Metric', 'Metrik'] };
  var KIND = { week: ['Weeks', 'Minggu'], period: ['Monthly targets', 'Sasaran bulanan'], batch: ['Stock batches', 'Batch stok'], mile: ['Milestones', 'Milestone'] };
  function show(v) { return Array.isArray(v) ? SP.mixText ? SP.mixText({ product_mix: v }) : v.map(function (x) { return (x.qty || '') + ' ' + x.name; }).join(', ') : typeof v === 'number' ? SP.fmtNum(v, v % 1 ? 2 : 0) : String(v); }
  SP.previewHtml = function (R) {
    var n = R.items.length, cnt = {};
    R.items.forEach(function (i) { cnt[i.kind] = (cnt[i.kind] || 0) + 1; });
    var h = '<div class="sp-hint">' + esc(t('Sheets read: ', 'Helaian dibaca: ') + (R.found.length ? R.found.join(', ') : '—')) + '</div>';
    h += '<div class="sp-imp-c">' + Object.keys(KIND).map(function (k) { return '<span><b>' + (cnt[k] || 0) + '</b> ' + esc(t(KIND[k][0], KIND[k][1])) + '</span>'; }).join('') + '</div>';
    R.warn.forEach(function (w) { h += '<div class="sp-warn"><i class="ti ti-alert-triangle"></i>' + esc(w === 'auto' ? t('This plan uses Auto sales — actual sales columns were skipped.', 'Pelan ini guna jualan Auto — lajur jualan sebenar dilangkau.') : t('File currency is ' + w.slice(4) + ' but the plan is ' + st.plan.currency + '. Amounts are imported as-is.', 'Mata wang fail ' + w.slice(4) + ' tetapi pelan ' + st.plan.currency + '. Jumlah diimport seadanya.')) + '</div>'; });
    if (R.skipped.length) h += '<details class="sp-imp-sk"><summary>' + esc(t(R.skipped.length + ' row(s) skipped', R.skipped.length + ' baris dilangkau')) + '</summary><ul>' + R.skipped.slice(0, 30).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></details>';
    if (!n) return h + '<p class="sp-imp-e">' + esc(t('No changes found for this plan. Check that the sheet names / headers match the template.', 'Tiada perubahan untuk pelan ini. Semak nama helaian / tajuk lajur sama dengan templat.')) + '</p>';
    h += '<div class="sp-imp-l">' + R.items.slice(0, 80).map(function (i) {
      return '<div class="sp-imp-r"><b>' + esc(i.label) + (i.cur ? '' : ' · ' + t('new', 'baharu')) + '</b><span>' + Object.keys(i.row).filter(function (f) { return FL[f]; }).map(function (f) {
        var o = i.cur && i.cur[f] != null && i.cur[f] !== '' ? show(i.cur[f]) : null; return esc(t(FL[f][0], FL[f][1]) + ': ' + (o != null ? o + ' → ' : '') + show(i.row[f]));
      }).join(' · ') + '</span></div>';
    }).join('') + (n > 80 ? '<div class="sp-hint">' + esc(t('… and ' + (n - 80) + ' more', '… dan ' + (n - 80) + ' lagi')) + '</div>' : '') + '</div>';
    return h;
  };
  var TB = { week: 'sales_plan_weeks', period: 'sales_plan_periods', batch: 'sales_plan_batches', mile: 'sales_plan_milestones' };
  SP.impSave = async function (R) {
    var ok = 0, fail = [], pid = st.plan.id, tid = SP.tid(), so = { batch: st.batches.length, mile: st.miles.length };
    for (var i = 0; i < R.items.length; i++) {
      var it = R.items[i], res;
      try {
        if (it.cur) res = await sb.from(TB[it.kind]).update(it.row).eq('id', it.cur.id).eq('tenant_id', tid).eq('plan_id', pid);
        else res = await sb.from(TB[it.kind]).insert(Object.assign({ id: SP.uuid(), tenant_id: tid, plan_id: pid, sort_order: so[it.kind]++ }, it.kind === 'batch' ? { product_mix: [] } : { target: 0 }, it.row));
        if (res.error) throw res.error;
        ok++;
      } catch (e) { fail.push(it.label + ': ' + SP.errMsg(e)); }
    }
    return { ok: ok, fail: fail };
  };
  SP.importFlow = async function (planId, file) {
    st.busy = true;
    try {
      SP.toast(t('Reading file…', 'Membaca fail…'), 'info');
      var sheets = await SP.readSheets(file).catch(function (e) { throw new Error(/load|timeout|XLSX/.test(e.message) ? t('Could not load the Excel reader. Check your internet connection and try again.', 'Gagal memuat pembaca Excel. Semak sambungan internet dan cuba lagi.') : t('Could not read this file.', 'Fail ini tidak dapat dibaca.')); });
      await SP.loadPlan(planId); if (!st.plan) throw new Error(t('Plan not found', 'Pelan tidak dijumpai'));
      await SP.loadExtras(planId);
      var R = SP.impMap(sheets);
      st.busy = false;
      SP.openModal(t('Import preview — ', 'Pratonton import — ') + st.plan.name, SP.previewHtml(R), R.items.length ? t('Save ' + R.items.length + ' change(s)', 'Simpan ' + R.items.length + ' perubahan') : t('Close', 'Tutup'), async function (ov, btn) {
        if (!R.items.length) { SP.closeModal(); return; }
        if (st.busy) return; st.busy = true; btn.disabled = true;
        var r = await SP.impSave(R); st.busy = false; SP.closeModal();
        if (r.fail.length) SP.toast(t(r.ok + ' saved, ' + r.fail.length + ' failed — ', r.ok + ' disimpan, ' + r.fail.length + ' gagal — ') + r.fail[0], 'error');
        else SP.toast(t('Imported ' + r.ok + ' change(s)', r.ok + ' perubahan diimport'), 'success');
        SP.go({ view: 'detail', id: planId, tab: 'overview' });
      }).classList.add('sp-imp');
    } catch (e) { st.busy = false; SP.toast(SP.errMsg(e), 'error'); }
  };
  SP.csvTemplate = function () {
    var rows = ['week,gmv,units,orders,notes'];
    for (var i = 1; i <= 4; i++) rows.push('W0' + i + ',,,,');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + rows.join('\r\n') + '\r\n'], { type: 'text/csv' }));
    a.download = 'sales-plan-weekly-template.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  SP.actions['import'] = function () {
    if (!SP.isAdmin()) return;
    var plans = ((st.list && st.list.plans) || []).map(function (r) { return r.p; }).filter(function (p) { return p.status !== 'archived'; });
    if (!plans.length) { SP.toast(t('Create a plan first, then import its weekly data.', 'Cipta pelan dahulu, kemudian import data mingguannya.'), 'info'); return; }
    var body = '<div class="sp-hint">' + esc(t('Supports the KeraPlus workbook (Weekly Tracker, Monthly KPI, Inventory & Funding, Milestones) or the simple CSV template. You will see a preview before anything is saved.', 'Menyokong buku kerja KeraPlus (Weekly Tracker, Monthly KPI, Inventory & Funding, Milestones) atau templat CSV ringkas. Pratonton dipaparkan sebelum apa-apa disimpan.')) + '</div>' +
      '<div class="form-group"><label class="form-label" for="sp-imp-plan">' + esc(t('Import into plan', 'Import ke pelan')) + '</label><select id="sp-imp-plan" class="form-select">' + plans.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label class="form-label" for="sp-imp-file">' + esc(t('File (.xlsx or .csv)', 'Fail (.xlsx atau .csv)')) + '</label><input id="sp-imp-file" type="file" class="form-input" accept=".xlsx,.xls,.csv"></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="imp-tpl"><i class="ti ti-download"></i>' + esc(t('Download CSV template', 'Muat turun templat CSV')) + '</button>';
    var mo = SP.openModal(t('Import Excel / CSV', 'Import Excel / CSV'), body, t('Preview', 'Pratonton'), function (ov) {
      var f = ov.querySelector('#sp-imp-file').files[0], pid = ov.querySelector('#sp-imp-plan').value;
      if (!f) { SP.toast(t('Choose a file first.', 'Pilih fail dahulu.'), 'error'); return; }
      if (f.size > 10 * 1024 * 1024) { SP.toast(t('File is larger than 10 MB.', 'Fail melebihi 10 MB.'), 'error'); return; }
      SP.closeModal(); SP.importFlow(pid, f);
    });
    var tb = mo && mo.querySelector('[data-act="imp-tpl"]'); if (tb) tb.addEventListener('click', function () { SP.csvTemplate(); });
  };
})();
