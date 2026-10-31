/* PAYROLL_RECON_V3 — Reconciliation as a full HR page (no modal), built like Salary Disbursement.
 * openPage('hr',{view:'payroll-recon',month,year})  ->  renderHR wrap renders the page.
 *  - month/year selector, stat cards, one accordion card per employee (one open at a time), status chips
 *  - bulk Mark as paid (only when the month's SD batch is Approved) + per-card Record payment (partials)
 *  - rows settled through an SD PVD line are read-only ("Paid via PVD-xxx")
 *  - statutory (KWSP/SOCSO/EIS/PCB) remitted status from paid statutory PV / PVD lines, period per item
 *  - arrears repayment plan per employee; Run Payroll applies it (payroll_arrears_apply RPC)
 *  - arrears line on the payslip and on the SD card; dashboard card; monthly HR bell (counts only)
 * SQL: supabase/migrations/20261101020000_payroll_recon_core.sql, 20261101020100_payroll_arrears.sql
 */
(function () {
  if (window.PAYROLL_RECON_V3) return;
  window.PAYROLL_RECON_V3 = true;

  var HR_ROLES = ['owner', 'admin', 'platform_admin', 'manager', 'hr'];
  var MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MON_BM = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];

  function isBm() { try { return !!(window.APP && APP.language === 'bm'); } catch (e) { return false; } }
  function L(en, bm) { return isBm() ? bm : en; }
  function fmt(n) { return typeof formatRM === 'function' ? formatRM(n) : ('RM ' + Number(n || 0).toFixed(2)); }
  function r2(n) { return Math.round(Number(n || 0) * 100) / 100; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tid() { return window.APP && APP.tenant && APP.tenant.id; }
  function uid() { return window.APP && APP.user && APP.user.id; }
  function isHR() { try { return typeof canManageHR === 'function' ? !!canManageHR() : false; } catch (e) { return false; } }
  function toast(m, t) { try { if (typeof showToast === 'function') showToast(esc(m), t || 'info'); } catch (e) {} }
  function mon(m, y) { return (isBm() ? MON_BM : MON_EN)[(Number(m) || 1) - 1] + ' ' + y; }
  function per(m, y) { return Number(y) * 12 + Number(m); }
  function nowMY() { var d = new Date(Date.now() + 8 * 3600000); return { m: d.getUTCMonth() + 1, y: d.getUTCFullYear(), iso: d.toISOString().slice(0, 10) }; }
  function bal(r) { return r2(r.balance_outstanding); }
  function paidOf(r) { return r2(Number(r.net_pay || 0) - bal(r)); }
  function statOf(r) { return r2(Number(r.epf_employee || 0) + Number(r.socso_employee || 0) + Number(r.eis_employee || 0) + Number(r.pcb || 0)); }
  function grossOf(r) { return r2(Number(r.net_pay || 0) + statOf(r)); }
  function $(id) { return document.getElementById(id); }
  window._prcUtil = { L: L, fmt: fmt, r2: r2, esc: esc, mon: mon, per: per, nowMY: nowMY, bal: bal, paidOf: paidOf, statOf: statOf, grossOf: grossOf, isHR: isHR, HR_ROLES: HR_ROLES };

  /* ---------- CSS (SD card look; tokens only) ---------- */
  (function css() {
    var old = $('prc-css'); if (old) old.remove();
    var s = document.createElement('style'); s.id = 'prc-css';
    s.textContent =
      '.prc-back{font-size:13px;color:var(--text-3);margin-top:2px;cursor:pointer;white-space:nowrap}' +
      '.prc-hacts{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.prc-hacts .btn{white-space:nowrap}' +
      '.prc-period{max-width:400px;padding:16px;margin-bottom:16px}.prc-period .prc-pf{display:flex;gap:16px;flex-wrap:wrap}' +
      '.prc-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 12px}' +
      '@media (min-width:901px){.prc-stats{grid-template-columns:repeat(5,minmax(0,1fr))}}' +
      '.prc-stat{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;min-width:0;color:var(--text)}' +
      '.prc-stat .k{font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.prc-stat .v{font-family:"Space Grotesk",sans-serif;font-size:17px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.prc-stat.warn .v{color:var(--warning)}.prc-stat.bad .v{color:var(--danger)}.prc-stat.ok .v{color:var(--success)}' +
      '.prc-stat.wide{grid-column:1/-1}@media (min-width:901px){.prc-stat.wide{grid-column:auto}}' +
      '.prc-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;margin:0 0 10px;color:var(--text)}' +
      '.prc-bar .msg{flex:1 1 220px;min-width:0;font-size:12px;color:var(--text-2);line-height:1.35}' +
      '.prc-acts{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.prc-acts .btn{white-space:nowrap}' +
      '.prc-form{display:none;flex-wrap:wrap;gap:8px;align-items:flex-end;width:100%;padding-top:8px;border-top:1px dashed var(--border);margin-top:4px}' +
      '.prc-form.on{display:flex}.prc-form .form-group{margin:0;flex:1 1 140px;min-width:0}.prc-form .form-input,.prc-form .form-select{width:100%;min-width:0}' +
      '.prc-form .prc-acts{flex:1 1 100%;justify-content:flex-end}' +
      '.prc-wrap{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}' +
      '.prc-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;color:var(--text)}' +
      '.prc-card.prc-open{border-color:var(--primary)}' +
      '.prc-head{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;text-align:left;color:var(--text);min-height:48px;cursor:pointer;background:none;border:0;font:inherit}' +
      '.prc-who{flex:1;min-width:0}.prc-name{font-size:13px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}' +
      '.prc-sub{display:block;font-size:11px;color:var(--text-3);line-height:1.3;overflow-wrap:anywhere}' +
      '.prc-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}.prc-chips:empty{display:none}' +
      '.prc-chip{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;line-height:1;padding:3px 7px;border-radius:999px;white-space:nowrap;border:1px solid currentColor}' +
      '.prc-chip.paid{color:var(--success)}.prc-chip.partial{color:var(--warning)}.prc-chip.out{color:var(--danger)}.prc-chip.stat{color:var(--danger)}.prc-chip.up{color:var(--text-3)}.prc-chip.pvd{color:var(--primary)}' +
      '.prc-net{font-family:"Space Grotesk",sans-serif;font-size:14px;font-weight:700;white-space:nowrap;color:var(--text);text-align:right}' +
      '.prc-net small{display:block;font-family:inherit;font-size:10px;font-weight:600;color:var(--danger)}' +
      '.prc-chev{color:var(--text-3);font-size:16px;transition:transform var(--transition)}.prc-open .prc-chev{transform:rotate(180deg)}' +
      '.prc-body{display:none;padding:2px 12px 10px;border-top:1px solid var(--border)}.prc-open .prc-body{display:block}' +
      '.prc-cap{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);margin:10px 0 2px}' +
      '.prc-row{display:flex;align-items:center;gap:8px;min-height:30px}' +
      '.prc-row>.k{flex:1;min-width:0;font-size:12px;color:var(--text-2);line-height:1.25}' +
      '.prc-row>.v{font-size:12px;font-weight:600;white-space:nowrap;color:var(--text);text-align:right}' +
      '.prc-row>.v.neg{color:var(--danger)}.prc-row>.v.pos{color:var(--success)}' +
      '.prc-netrow{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:12px;color:var(--text-2)}' +
      '.prc-netrow b{font-family:"Space Grotesk",sans-serif;font-size:15px;color:var(--danger);white-space:nowrap}.prc-netrow b.ok{color:var(--success)}' +
      '.prc-link{color:var(--primary);cursor:pointer;font-weight:600;text-decoration:none;white-space:nowrap}' +
      '.prc-cacts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.prc-cacts .btn{white-space:nowrap}' +
      '.prc-note{font-size:11px;color:var(--text-3);line-height:1.35;margin-top:4px}' +
      '.prc-stl{display:flex;flex-direction:column;gap:6px;width:100%}' +
      '.prc-sti{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px}' +
      '.prc-sti .t{flex:1 1 160px;min-width:0;overflow-wrap:anywhere}.prc-sti .form-select{width:auto;min-width:0;height:32px;padding:4px 8px;font-size:12px}' +
      '.prc-sti .form-input{width:84px;height:32px;padding:4px 8px;font-size:12px}' +
      '.prc-empty{padding:30px 10px;text-align:center;color:var(--text-3);font-size:13px}' +
      '@media screen and (min-width:901px){.prc-wrap{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px;align-items:start}.prc-card.prc-open{grid-column:1/-1}}' +
      '@media print{.prc-bar,.prc-wrap,.prc-stats,.prc-period{display:none!important}}' +
      '#db-sec-prc .prc-dash{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer}' +
      '#db-sec-prc .prc-dn{font-family:"Space Grotesk",sans-serif;font-size:22px;font-weight:700;white-space:nowrap}' +
      '.sdc-row.prc-sd-arr .sdc-v{color:var(--success)}';
    (document.head || document.documentElement).appendChild(s);
  })();

  /* ---------- state ---------- */
  var S = { month: 0, year: 0, rows: [], emps: {}, sd: null, pvd: {}, statOk: false, statItems: [], prev: {}, plans: {}, open: null, loading: false };
  window._prcState = S;

  function statKey(m, y) { return y + '-' + m; }
  function statPaidFor(m, y) {
    return S.statItems.filter(function (s) { return s.paid && Number(s.period_month) === Number(m) && Number(s.period_year) === Number(y); });
  }
  function statusOf(r) {
    var cur = nowMY();
    var b = bal(r), p = paidOf(r);
    if (b <= 0.01) return 'paid';
    if (per(r.month, r.year) >= per(cur.m, cur.y) && p <= 0.01) return 'upcoming';
    if (p > 0.01) return 'partial';
    return 'out';
  }
  function statMissing(r) {
    if (!S.statOk || statOf(r) <= 0) return false;
    if (per(r.month, r.year) >= per(nowMY().m, nowMY().y)) return false;
    return statPaidFor(r.month, r.year).length === 0;
  }
  function chipHtml(k) {
    var T = {
      paid: ['paid', 'ti-circle-check', L('Paid', 'Dibayar')],
      partial: ['partial', 'ti-progress', L('Partial', 'Separa')],
      out: ['out', 'ti-alert-circle', L('Outstanding', 'Tertunggak')],
      stat: ['stat', 'ti-building-bank', L('Statutory not remitted', 'Berkanun belum diremit')],
      upcoming: ['up', 'ti-clock', L('Upcoming', 'Akan datang')]
    }[k];
    return T ? '<span class="prc-chip ' + T[0] + '"><i class="ti ' + T[1] + '"></i>' + esc(T[2]) + '</span>' : '';
  }

  /* ---------- data ---------- */
  async function latestMonth() {
    var cur = nowMY();
    try {
      var q = await sb.from('payroll_records').select('month,year').eq('tenant_id', tid())
        .order('year', { ascending: false }).order('month', { ascending: false }).limit(24);
      var hit = (q.data || []).filter(function (r) { return per(r.month, r.year) <= per(cur.m, cur.y); })[0];
      if (hit) return { m: Number(hit.month), y: Number(hit.year) };
    } catch (e) {}
    return { m: cur.m, y: cur.y };
  }

  async function load() {
    var t = tid(), m = S.month, y = S.year;
    var res = await Promise.all([
      sb.from('payroll_records').select('*').eq('tenant_id', t).eq('month', m).eq('year', y),
      sb.from('employees').select('*').eq('tenant_id', t),
      sb.from('salary_disbursement_batches').select('id,status,month,year').eq('tenant_id', t).eq('month', m).eq('year', y).is('deleted_at', null).limit(1),
      sb.rpc('payroll_recon_statutory_items', { p_since: null }),
      sb.from('payroll_records').select('id,employee_id,month,year,net_pay,balance_outstanding').eq('tenant_id', t).gt('balance_outstanding', 0.01),
      sb.from('payroll_arrears_plans').select('*').eq('tenant_id', t).is('deleted_at', null).order('created_at', { ascending: false })
    ]);
    if (res[0].error) throw res[0].error;
    S.rows = res[0].data || [];
    S.emps = {};
    (res[1].data || []).forEach(function (e) { S.emps[e.id] = e; });
    S.sd = (res[2].data || [])[0] || null;
    S.statOk = !res[3].error;
    S.statItems = res[3].error ? [] : (res[3].data || []);
    S.prev = {};
    (res[4].data || []).forEach(function (r) { (S.prev[r.employee_id] = S.prev[r.employee_id] || []).push(r); });
    Object.keys(S.prev).forEach(function (k) { S.prev[k].sort(function (a, b) { return per(a.month, a.year) - per(b.month, b.year); }); });
    S.plans = {};
    S.planOk = !res[5].error;
    (res[5].data || []).forEach(function (p) { if (!S.plans[p.employee_id]) S.plans[p.employee_id] = p; });
    S.pvd = {};
    var ids = S.rows.map(function (r) { return r.id; });
    if (ids.length) {
      var lq = await sb.from('payment_voucher_batch_lines').select('id,batch_id,source_ref,pay_status,amount').eq('source', 'sd').in('source_ref', ids);
      var lines = lq.data || [];
      var bids = lines.map(function (l) { return l.batch_id; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
      if (bids.length) {
        var bq = await sb.from('payment_voucher_batches').select('id,ref_no,status').in('id', bids).is('deleted_at', null);
        var bm = {};
        (bq.data || []).forEach(function (b) { bm[b.id] = b; });
        lines.forEach(function (l) { if (bm[l.batch_id]) S.pvd[l.source_ref] = { batch: bm[l.batch_id], line: l }; });
      }
    }
    S.rows.sort(function (a, b) {
      var ea = S.emps[a.employee_id] || {}, eb = S.emps[b.employee_id] || {};
      return String(ea.name || '').localeCompare(String(eb.name || ''));
    });
  }

  /* ---------- page ---------- */
  async function renderPage(params) {
    params = params || {};
    var main = $('main'); if (!main) return;
    if (!isHR()) { main.innerHTML = '<div class="empty-state"><i class="ti ti-lock"></i><h3>' + esc(L('HR managers only', 'Pengurus HR sahaja')) + '</h3></div>'; return; }
    var m = Number(params.month), y = Number(params.year);
    if (!(m >= 1 && m <= 12 && y > 2000)) { var lm = await latestMonth(); m = lm.m; y = lm.y; }
    S.month = m; S.year = y; S.open = params.emp || null;
    var reload = "openPage('hr',{view:'payroll-recon',month:Number(document.getElementById('prc-month').value),year:Number(document.getElementById('prc-year').value)})";
    main.innerHTML =
      '<div class="page-header no-print"><div>' +
        '<div class="page-title">' + esc(L('Reconciliation', 'Rekonsiliasi')) + '</div>' +
        '<div class="prc-back" onclick="openPage(\'hr\',{})">← ' + esc(L('HR & Payroll', 'HR & Gaji')) + '</div>' +
      '</div><div class="prc-hacts">' +
        '<button class="btn btn-outline btn-sm" onclick="openPage(\'hr\',{view:\'salary-disbursement\',month:' + m + ',year:' + y + '})"><i class="ti ti-file-dollar"></i> ' + esc(L('Salary Disbursement', 'Penyaluran Gaji')) + '</button>' +
      '</div></div>' +
      '<div class="card no-print prc-period"><div class="prc-pf">' +
        '<div class="form-group" style="margin-bottom:0"><label class="form-label">' + esc(L('Month', 'Bulan')) + '</label>' +
        '<select id="prc-month" class="form-select" onchange="' + reload + '">' +
          Array.from({ length: 12 }, function (_, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === m ? ' selected' : '') + '>' + (i + 1) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="form-group" style="margin-bottom:0"><label class="form-label">' + esc(L('Year', 'Tahun')) + '</label>' +
        '<input id="prc-year" type="number" class="form-input" style="width:100px" value="' + y + '" onchange="' + reload + '"></div>' +
      '</div></div>' +
      '<div id="prc-body"><div class="prc-empty">' + esc(L('Loading…', 'Memuatkan…')) + '</div></div>';
    try { await load(); } catch (e) {
      var b0 = $('prc-body'); if (b0) b0.innerHTML = '<div class="prc-empty" style="color:var(--danger)">' + esc(L('Error', 'Ralat')) + ': ' + esc(e.message || e) + '</div>';
      return;
    }
    if (S.month !== m || S.year !== y) return;
    paint();
  }

  function paint() {
    var body = $('prc-body'); if (!body) return;
    var rows = S.rows, m = S.month, y = S.year;
    var net = 0, paid = 0, out = 0, staffOut = 0, statMiss = 0;
    rows.forEach(function (r) {
      net += Number(r.net_pay || 0); paid += paidOf(r); out += bal(r);
      if (bal(r) > 0.01 && statusOf(r) !== 'upcoming') staffOut++;
      if (statMissing(r)) statMiss++;
    });
    var html = '<div class="prc-stats">' +
      stat(L('Net pay total', 'Jumlah gaji bersih'), fmt(net), '') +
      stat(L('Paid', 'Dibayar'), fmt(paid), 'ok') +
      stat(L('Outstanding', 'Tertunggak'), fmt(out), out > 0.01 ? 'bad' : '') +
      stat(L('Staff outstanding', 'Staf tertunggak'), String(staffOut), staffOut ? 'warn' : '') +
      stat(L('Statutory not remitted', 'Berkanun belum diremit'), S.statOk ? String(statMiss) : '—', statMiss ? 'bad' : '', 'wide') +
      '</div>';
    html += sdBar() + statBar();
    if (!rows.length) {
      html += '<div class="prc-empty">' + esc(L('No payroll records for ', 'Tiada rekod gaji untuk ') + mon(m, y)) + '</div>';
    } else {
      html += '<div class="prc-wrap" id="prc-wrap">' + rows.map(cardHtml).join('') + '</div>';
    }
    body.innerHTML = html;
  }
  function stat(k, v, cls, extra) { return '<div class="prc-stat ' + (cls || '') + ' ' + (extra || '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div></div>'; }

  function sdBar() {
    var m = S.month, y = S.year;
    var approved = S.sd && S.sd.status === 'approved';
    var todo = S.rows.filter(function (r) { return bal(r) > 0.01 && !S.pvd[r.id]; }).length;
    var msg;
    if (!S.sd) msg = L('Mark as paid opens after the Salary Disbursement for ' + mon(m, y) + ' is created and Approved.', 'Tandakan dibayar dibuka selepas Penyaluran Gaji ' + mon(m, y) + ' dibuat dan Diluluskan.');
    else if (!approved) msg = L('Salary Disbursement ' + mon(m, y) + ' is ' + String(S.sd.status || 'draft') + ' — Mark as paid opens once it is Approved.', 'Penyaluran Gaji ' + mon(m, y) + ' berstatus ' + String(S.sd.status || 'draft') + ' — Tandakan dibayar dibuka selepas Diluluskan.');
    else if (!todo) msg = L('Salary Disbursement approved. Nothing left to mark as paid for this month.', 'Penyaluran Gaji diluluskan. Tiada lagi untuk ditandakan dibayar bulan ini.');
    else msg = L('Salary Disbursement approved. ' + todo + ' staff not marked paid yet.', 'Penyaluran Gaji diluluskan. ' + todo + ' staf belum ditandakan dibayar.');
    var dis = (!approved || !todo) ? ' disabled' : '';
    return '<div class="prc-bar no-print" id="prc-sdbar"><div class="msg"><i class="ti ' + (approved ? 'ti-circle-check" style="color:var(--success)' : 'ti-info-circle') + '"></i> ' + esc(msg) + '</div>' +
      '<div class="prc-acts"><button class="btn btn-primary btn-sm" id="prc-mark-btn"' + dis + ' onclick="_prcMarkForm(true)"><i class="ti ti-checks"></i> ' + esc(L('Mark as paid', 'Tandakan dibayar')) + '</button></div>' +
      '<div class="prc-form" id="prc-mark-form">' +
        '<div class="form-group"><label class="form-label">' + esc(L('Paid date', 'Tarikh bayar')) + '</label><input type="date" class="form-input" id="prc-mark-date" value="' + nowMY().iso + '"></div>' +
        '<div class="form-group"><label class="form-label">' + esc(L('Bank reference', 'Rujukan bank')) + '</label><input class="form-input" id="prc-mark-ref" maxlength="120" placeholder="' + esc(L('e.g. bulk transfer ref', 'cth. rujukan pindahan pukal')) + '"></div>' +
        '<div class="prc-acts"><button class="btn btn-outline btn-sm" onclick="_prcMarkForm(false)">' + esc(L('Cancel', 'Batal')) + '</button>' +
        '<button class="btn btn-primary btn-sm" id="prc-mark-go" onclick="_prcMarkPaid()"><i class="ti ti-checks"></i> ' + esc(L('Confirm', 'Sahkan')) + ' (' + todo + ')</button></div>' +
        '<div class="prc-note">' + esc(L('Sets paid = net pay and balance 0 for staff still outstanding this month. Staff paid through a PVD are skipped. No journal is posted.', 'Tetapkan dibayar = gaji bersih dan baki 0 untuk staf yang masih tertunggak bulan ini. Staf yang dibayar melalui PVD dilangkau. Tiada jurnal dipos.')) + '</div>' +
      '</div></div>';
  }

  function statBar() {
    if (!S.statOk) return '';
    var m = S.month, y = S.year;
    var paid = statPaidFor(m, y);
    var anyStat = S.rows.some(function (r) { return statOf(r) > 0; });
    if (!anyStat) return '';
    var upcoming = per(m, y) >= per(nowMY().m, nowMY().y);
    var msg = paid.length
      ? L('Statutory for ' + mon(m, y) + ': remitted via ', 'Berkanun ' + mon(m, y) + ': diremit melalui ') + paid.map(function (s) { return s.ref_no; }).join(', ')
      : (upcoming ? L('Statutory for ' + mon(m, y) + ': not due yet.', 'Berkanun ' + mon(m, y) + ': belum tiba masa.')
        : L('Statutory for ' + mon(m, y) + ': no paid KWSP / SOCSO payment found for this month.', 'Berkanun ' + mon(m, y) + ': tiada bayaran KWSP / SOCSO berbayar untuk bulan ini.'));
    return '<div class="prc-bar no-print" id="prc-statbar"><div class="msg"><i class="ti ti-building-bank" style="color:' + (paid.length ? 'var(--success)' : (upcoming ? 'var(--text-3)' : 'var(--danger)')) + '"></i> ' + esc(msg) + '</div>' +
      '<div class="prc-acts"><button class="btn btn-outline btn-sm" onclick="_prcStatForm()"><i class="ti ti-link"></i> ' + esc(L('Statutory payments', 'Bayaran berkanun')) + '</button></div>' +
      '<div class="prc-form" id="prc-stat-form"></div></div>';
  }

  function cardHtml(r) {
    var e = S.emps[r.employee_id] || {};
    var st = statusOf(r), b = bal(r), p = paidOf(r), pv = S.pvd[r.id];
    var chips = chipHtml(st) + (statMissing(r) ? chipHtml('stat') : '');
    var open = S.open && String(S.open) === String(r.employee_id);
    var sub = [e.staff_code, e.position].filter(Boolean).join(' · ');
    var prev = (S.prev[r.employee_id] || []).filter(function (x) { return per(x.month, x.year) < per(r.month, r.year); });
    var prevTot = prev.reduce(function (s, x) { return s + bal(x); }, 0);
    var plan = S.plans[r.employee_id];
    var stPaid = statPaidFor(r.month, r.year);
    var h = '<div class="prc-card' + (open ? ' prc-open' : '') + '" data-row="' + esc(r.id) + '" data-emp="' + esc(r.employee_id) + '">' +
      '<button type="button" class="prc-head" onclick="_prcToggle(this)">' +
        '<div class="prc-who"><div class="prc-name">' + esc(e.name || '—') + '</div>' + (sub ? '<span class="prc-sub">' + esc(sub) + '</span>' : '') +
        '<div class="prc-chips">' + chips + '</div></div>' +
        '<div class="prc-net">' + esc(fmt(r.net_pay)) + (b > 0.01 && st !== 'upcoming' ? '<small>' + esc(L('Bal ', 'Baki ') + fmt(b)) + '</small>' : '') + '</div>' +
        '<i class="ti ti-chevron-down prc-chev"></i>' +
      '</button><div class="prc-body">' +
      '<div class="prc-cap">' + esc(L('Pay', 'Gaji') + ' · ' + mon(r.month, r.year)) + '</div>' +
      row(L('Gross (net + statutory)', 'Kasar (bersih + berkanun)'), fmt(grossOf(r))) +
      row(L('Statutory deducted (EPF/SOCSO/EIS/PCB)', 'Potongan berkanun (KWSP/PERKESO/SIP/PCB)'), '− ' + fmt(statOf(r)), 'neg') +
      row(L('Net pay', 'Gaji bersih'), fmt(r.net_pay)) +
      (Number(r.arrears_paid || 0) > 0 ? row(L('Arrears payment', 'Bayaran tunggakan'), '+ ' + fmt(r.arrears_paid), 'pos') : '') +
      row(L('Paid', 'Dibayar'), fmt(p), 'pos') +
      (r.paid_date ? row(L('Paid date', 'Tarikh bayar'), esc(r.paid_date)) : '') +
      (r.pay_ref ? row(L('Reference', 'Rujukan'), esc(r.pay_ref)) : '') +
      (pv ? '<div class="prc-row"><span class="k">' + esc(L('Paid via', 'Dibayar melalui')) + '</span><a class="prc-link" onclick="openPage(\'vouchers\',{view:\'pvd-detail\',id:\'' + esc(pv.batch.id) + '\'})"><i class="ti ti-external-link"></i> ' + esc(pv.batch.ref_no || 'PVD') + '</a></div>' : '') +
      '<div class="prc-netrow"><span>' + esc(L('Balance outstanding', 'Baki tertunggak')) + '</span><b class="' + (b <= 0.01 ? 'ok' : '') + '">' + esc(fmt(b)) + '</b></div>';
    if (statOf(r) > 0 && S.statOk) {
      h += '<div class="prc-cap">' + esc(L('Statutory', 'Berkanun')) + '</div>' +
        row(stPaid.length ? L('Remitted', 'Diremit') : L('Not remitted', 'Belum diremit'), stPaid.length ? esc(stPaid.map(function (s) { return s.ref_no; }).join(', ')) : '—', stPaid.length ? 'pos' : 'neg');
    }
    if (prev.length) {
      h += '<div class="prc-cap">' + esc(L('Earlier months outstanding', 'Baki bulan terdahulu')) + '</div>' +
        prev.slice(0, 6).map(function (x) { return row(mon(x.month, x.year), fmt(bal(x)), 'neg'); }).join('') +
        (prev.length > 6 ? '<div class="prc-note">+' + (prev.length - 6) + ' ' + esc(L('more', 'lagi')) + '</div>' : '') +
        row(L('Total earlier outstanding', 'Jumlah baki terdahulu'), fmt(prevTot), 'neg');
    }
    if (S.planOk) {
      h += '<div class="prc-cap">' + esc(L('Repayment plan', 'Pelan bayaran balik')) + '</div>';
      if (plan && plan.status !== 'cancelled') {
        h += row(L('Instalment', 'Ansuran'), fmt(plan.instalment) + ' / ' + L('month', 'bulan')) +
          row(L('From', 'Mula'), mon(plan.start_month, plan.start_year)) +
          row(L('Status', 'Status'), planStatus(plan, prevTot + (bal(r) > 0.01 && statusOf(r) !== 'upcoming' ? 0 : 0)));
      } else {
        h += '<div class="prc-note">' + esc(L('No plan. Set one to add an Arrears payment line on the next payroll runs.', 'Tiada pelan. Tetapkan untuk tambah baris Bayaran tunggakan pada larian gaji seterusnya.')) + '</div>';
      }
      h += '<div class="prc-form" data-f="plan">' +
        '<div class="form-group"><label class="form-label">' + esc(L('Instalment (RM / month)', 'Ansuran (RM / bulan)')) + '</label><input type="number" min="1" step="0.01" class="form-input" data-i="inst" value="' + esc(plan && plan.status !== 'cancelled' ? plan.instalment : '') + '"></div>' +
        '<div class="form-group"><label class="form-label">' + esc(L('From month', 'Mula bulan')) + '</label><select class="form-select" data-i="sm">' + monthOpts(plan ? plan.start_month : nextM().m) + '</select></div>' +
        '<div class="form-group"><label class="form-label">' + esc(L('Year', 'Tahun')) + '</label><input type="number" class="form-input" data-i="sy" value="' + (plan ? plan.start_year : nextM().y) + '"></div>' +
        '<div class="prc-acts">' +
          (plan && plan.status === 'active' ? '<button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="_prcPlanSave(this,\'cancelled\')">' + esc(L('Stop plan', 'Hentikan pelan')) + '</button>' : '') +
          '<button class="btn btn-outline btn-sm" onclick="_prcForm(this,\'plan\',false)">' + esc(L('Cancel', 'Batal')) + '</button>' +
          '<button class="btn btn-primary btn-sm" onclick="_prcPlanSave(this,\'active\')">' + esc(L('Save', 'Simpan')) + '</button></div>' +
        '<div class="prc-note">' + esc(L('Paid with each salary from that month as a separate line (no EPF/SOCSO/PCB), oldest month first. Applied when you Run Payroll.', 'Dibayar bersama gaji mulai bulan itu sebagai baris berasingan (tiada KWSP/PERKESO/PCB), bulan paling lama dahulu. Digunakan semasa Jalankan Gaji.')) + '</div>' +
      '</div>';
    }
    if (!pv && b > 0.01) {
      h += '<div class="prc-form" data-f="pay">' +
        '<div class="form-group"><label class="form-label">' + esc(L('Amount (RM)', 'Amaun (RM)')) + '</label><input type="number" min="0.01" step="0.01" class="form-input" data-i="amt" value="' + b.toFixed(2) + '"></div>' +
        '<div class="form-group"><label class="form-label">' + esc(L('Paid date', 'Tarikh bayar')) + '</label><input type="date" class="form-input" data-i="date" value="' + nowMY().iso + '"></div>' +
        '<div class="form-group"><label class="form-label">' + esc(L('Reference', 'Rujukan')) + '</label><input class="form-input" data-i="ref" maxlength="120"></div>' +
        '<div class="prc-acts"><button class="btn btn-outline btn-sm" onclick="_prcForm(this,\'pay\',false)">' + esc(L('Cancel', 'Batal')) + '</button>' +
        '<button class="btn btn-primary btn-sm" onclick="_prcPaySave(this)">' + esc(L('Save', 'Simpan')) + '</button></div></div>';
    }
    h += '<div class="prc-cacts">' +
      (!pv && b > 0.01 ? '<button class="btn btn-outline btn-sm" onclick="_prcForm(this,\'pay\',true)"><i class="ti ti-cash"></i> ' + esc(L('Record payment', 'Rekod bayaran')) + '</button>' : '') +
      (S.planOk ? '<button class="btn btn-outline btn-sm" onclick="_prcForm(this,\'plan\',true)"><i class="ti ti-calendar-repeat"></i> ' + esc(plan && plan.status === 'active' ? L('Edit plan', 'Ubah pelan') : L('Set plan', 'Tetapkan pelan')) + '</button>' : '') +
      '<button class="btn btn-outline btn-sm" onclick="openPage(\'hr\',{view:\'payroll-recon-report\',emp:\'' + esc(r.employee_id) + '\',month:' + S.month + ',year:' + S.year + '})"><i class="ti ti-file-text"></i> ' + esc(L('Report', 'Laporan')) + '</button>' +
      '</div></div></div>';
    return h;
  }
  function row(k, v, cls) { return '<div class="prc-row"><span class="k">' + esc(k) + '</span><span class="v ' + (cls || '') + '">' + (String(v).indexOf('<') >= 0 ? v : esc(v)) + '</span></div>'; }
  function monthOpts(sel) { return Array.from({ length: 12 }, function (_, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === Number(sel) ? ' selected' : '') + '>' + mon(i + 1, '').trim() + '</option>'; }).join(''); }
  function nextM() { var c = nowMY(); return c.m === 12 ? { m: 1, y: c.y + 1 } : { m: c.m + 1, y: c.y }; }
  function planStatus(p, prevTot) {
    if (p.status === 'active' && prevTot <= 0.01) return L('Completed (no arrears left)', 'Selesai (tiada tunggakan)');
    return { active: L('Active', 'Aktif'), paused: L('Paused', 'Ditangguh'), completed: L('Completed', 'Selesai'), cancelled: L('Stopped', 'Dihentikan') }[p.status] || p.status;
  }

  /* ---------- actions ---------- */
  window._prcToggle = function (btn) {
    var card = btn.closest('.prc-card'); if (!card) return;
    var was = card.classList.contains('prc-open');
    document.querySelectorAll('#prc-wrap .prc-card.prc-open').forEach(function (c) { c.classList.remove('prc-open'); });
    if (!was) { card.classList.add('prc-open'); S.open = card.getAttribute('data-emp'); } else S.open = null;
  };
  window._prcForm = function (el, f, on) {
    var card = el.closest('.prc-card'); if (!card) return;
    card.querySelectorAll('.prc-form').forEach(function (x) { x.classList.toggle('on', on && x.getAttribute('data-f') === f); });
    if (on) { var fm = card.querySelector('.prc-form[data-f="' + f + '"] input'); if (fm) try { fm.focus(); } catch (e) {} }
  };
  window._prcMarkForm = function (on) { var f = $('prc-mark-form'); if (f) f.classList.toggle('on', !!on); };

  async function afterPaid(prevOut) {
    try { await load(); } catch (e) {}
    paint();
    var left = S.rows.filter(function (r) { return bal(r) > 0.01; }).length;
    if (prevOut > 0 && left === 0 && S.rows.length) notifyFullyPaid();
  }
  function notifyFullyPaid() {
    var NT = window.NT;
    if (!NT || typeof NT.notify !== 'function') return;
    var m = S.month, y = S.year;
    Promise.resolve(sb.from('user_profiles').select('id,role').eq('tenant_id', tid())).then(function (q) {
      var me = String(uid() || '');
      var ids = ((q && q.data) || []).filter(function (u) { return HR_ROLES.indexOf(String(u.role || '').toLowerCase()) >= 0 && String(u.id) !== me; }).map(function (u) { return u.id; });
      if (!ids.length) return;
      return NT.notify({
        users: ids, kind: 'for_you', type: 'approval.payroll',
        title: L('Payroll fully paid · ', 'Gaji dibayar sepenuhnya · ') + mon(m, y),
        body: L('All staff salaries for ' + mon(m, y) + ' are marked paid.', 'Semua gaji staf ' + mon(m, y) + ' telah ditandakan dibayar.'),
        ref_table: 'payroll_records', ref_id: y + '-' + m,
        group_key: 'prc:paid:' + tid() + ':' + y + '-' + m,
        link: { page: 'hr', params: { view: 'payroll-recon', month: m, year: y }, icon: 'ti-circle-check' }
      });
    }).catch(function () {});
  }

  window._prcMarkPaid = async function () {
    var go = $('prc-mark-go'); if (go && go.disabled) return;
    var d = ($('prc-mark-date') || {}).value || nowMY().iso, ref = (($('prc-mark-ref') || {}).value || '').trim();
    if (go) go.disabled = true;
    var prevOut = S.rows.filter(function (r) { return bal(r) > 0.01; }).length;
    try {
      var q = await sb.rpc('payroll_recon_mark_paid', { p_month: S.month, p_year: S.year, p_paid_date: d, p_ref: ref || null, p_ids: null });
      if (q.error) throw q.error;
      try { if (typeof auditLog === 'function') auditLog('update', 'payroll_records', S.year + '-' + S.month, undefined, { action: 'recon_mark_paid', paid_date: d, ref: ref, updated: q.data && q.data.updated }); } catch (e) {}
      toast(L('Marked as paid: ', 'Ditandakan dibayar: ') + ((q.data && q.data.updated) || 0) + L(' staff', ' staf'), 'success');
      await afterPaid(prevOut);
    } catch (e) {
      toast((e && e.message) || String(e), 'error');
      if (go) go.disabled = false;
    }
  };

  window._prcPaySave = async function (btn) {
    var card = btn.closest('.prc-card'); if (!card) return;
    var f = card.querySelector('.prc-form[data-f="pay"]');
    var amt = Number(f.querySelector('[data-i="amt"]').value), d = f.querySelector('[data-i="date"]').value, ref = f.querySelector('[data-i="ref"]').value.trim();
    if (!(amt > 0)) { toast(L('Enter an amount', 'Masukkan amaun'), 'warning'); return; }
    btn.disabled = true;
    var prevOut = S.rows.filter(function (r) { return bal(r) > 0.01; }).length;
    try {
      var q = await sb.rpc('payroll_recon_record_payment', { p_record: card.getAttribute('data-row'), p_amount: amt, p_paid_date: d || null, p_ref: ref || null });
      if (q.error) throw q.error;
      try { if (typeof auditLog === 'function') auditLog('update', 'payroll_records', card.getAttribute('data-row'), undefined, { action: 'recon_record_payment', amount: amt, paid_date: d, ref: ref }); } catch (e) {}
      toast(L('Payment recorded', 'Bayaran direkod'), 'success');
      S.open = card.getAttribute('data-emp');
      await afterPaid(prevOut);
    } catch (e) { toast((e && e.message) || String(e), 'error'); btn.disabled = false; }
  };

  window._prcPlanSave = async function (btn, status) {
    var card = btn.closest('.prc-card'); if (!card) return;
    var emp = card.getAttribute('data-emp');
    var f = card.querySelector('.prc-form[data-f="plan"]');
    var inst = Number(f.querySelector('[data-i="inst"]').value), sm = Number(f.querySelector('[data-i="sm"]').value), sy = Number(f.querySelector('[data-i="sy"]').value);
    var cur = S.plans[emp];
    if (status === 'active' && !(inst > 0)) { toast(L('Enter the instalment amount', 'Masukkan amaun ansuran'), 'warning'); return; }
    if (status === 'active' && !(sm >= 1 && sm <= 12 && sy > 2000)) { toast(L('Pick the start month', 'Pilih bulan mula'), 'warning'); return; }
    btn.disabled = true;
    try {
      var q;
      if (cur && cur.status === 'active') {
        var upd = status === 'active' ? { instalment: r2(inst), start_month: sm, start_year: sy, updated_at: new Date().toISOString() } : { status: status, updated_at: new Date().toISOString() };
        q = await sb.from('payroll_arrears_plans').update(upd).eq('id', cur.id).eq('tenant_id', tid());
      } else if (status === 'active') {
        q = await sb.from('payroll_arrears_plans').insert({ tenant_id: tid(), employee_id: emp, instalment: r2(inst), start_month: sm, start_year: sy, status: 'active', created_by: uid() });
      } else { btn.disabled = false; return; }
      if (q.error) throw q.error;
      try { if (typeof auditLog === 'function') auditLog(cur ? 'update' : 'create', 'payroll_arrears_plans', cur ? cur.id : emp, undefined, { instalment: inst, start_month: sm, start_year: sy, status: status }); } catch (e) {}
      toast(status === 'active' ? L('Plan saved — applied on the next Run Payroll', 'Pelan disimpan — digunakan pada Jalankan Gaji seterusnya') : L('Plan stopped', 'Pelan dihentikan'), 'success');
      S.open = emp;
      await load(); paint();
    } catch (e) { toast((e && e.message) || String(e), 'error'); btn.disabled = false; }
  };

  window._prcStatForm = function () {
    var f = $('prc-stat-form'); if (!f) return;
    if (f.classList.contains('on')) { f.classList.remove('on'); return; }
    var items = S.statItems.slice(0, 40);
    var yrs = [S.year - 1, S.year, S.year + 1];
    f.innerHTML = '<div class="prc-stl">' + (items.length ? items.map(function (s) {
      return '<div class="prc-sti" data-k="' + esc(s.kind) + '" data-id="' + esc(s.id) + '">' +
        '<span class="t"><b>' + esc(s.ref_no || '—') + '</b> · ' + esc(s.label || '') + ' · ' + esc(fmt(s.amount)) + ' · ' +
          '<span style="color:' + (s.paid ? 'var(--success)' : 'var(--text-3)') + '">' + esc(s.paid ? L('Paid', 'Dibayar') : L('Not paid', 'Belum dibayar')) + '</span>' +
          (s.period_month ? '' : ' · <span style="color:var(--danger)">' + esc(L('period unknown', 'tempoh tidak diketahui')) + '</span>') + '</span>' +
        '<select class="form-select" data-i="m"><option value="">—</option>' + monthOpts(s.period_month) + '</select>' +
        '<select class="form-select" data-i="y">' + yrs.concat(s.period_year && yrs.indexOf(Number(s.period_year)) < 0 ? [Number(s.period_year)] : []).map(function (y) { return '<option' + (Number(s.period_year || S.year) === y ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>' +
        '<button class="btn btn-outline btn-sm" style="white-space:nowrap" onclick="_prcStatSave(this)">' + esc(L('Save', 'Simpan')) + '</button></div>';
    }).join('') : '<div class="prc-note">' + esc(L('No statutory payment vouchers yet. Create a PV / PVD line with category Statutory (e.g. "KWSP Oct 2026").', 'Tiada baucar bayaran berkanun lagi. Cipta PV / baris PVD dengan kategori Berkanun (cth. "KWSP Okt 2026").')) + '</div>') +
      '<div class="prc-note">' + esc(L('A paid statutory PV / PVD line marks that month as remitted. The month is read from the description (e.g. "KWSP Oct 2026"); set it here when it is missing.', 'PV / baris PVD berkanun yang dibayar menandakan bulan itu diremit. Bulan dibaca dari keterangan (cth. "KWSP Okt 2026"); tetapkan di sini jika tiada.')) + '</div></div>';
    f.classList.add('on');
  };
  window._prcStatSave = async function (btn) {
    var it = btn.closest('.prc-sti'); if (!it) return;
    var m = Number(it.querySelector('[data-i="m"]').value) || null, y = Number(it.querySelector('[data-i="y"]').value) || null;
    btn.disabled = true;
    try {
      var q = await sb.rpc('payroll_recon_link_statutory', { p_kind: it.getAttribute('data-k'), p_id: it.getAttribute('data-id'), p_month: m, p_year: m ? y : null });
      if (q.error) throw q.error;
      toast(L('Saved', 'Disimpan'), 'success');
      await load(); paint();
    } catch (e) { toast((e && e.message) || String(e), 'error'); btn.disabled = false; }
  };

  /* ---------- routing: renderHR wrap ---------- */
  function wrapHR() {
    var o = window.renderHR;
    if (typeof o !== 'function' || o._prcV3) return;
    var w = function (params) {
      var v = params && params.view;
      if (v === 'payroll-recon') return renderPage(params);
      if (v === 'payroll-recon-report' && window.PRC_REPORT && typeof PRC_REPORT.renderView === 'function') return PRC_REPORT.renderView(params);
      return o.apply(this, arguments);
    };
    for (var k in o) { try { w[k] = o[k]; } catch (e) {} }
    w._prcV3 = true;
    window.renderHR = w;
  }
  window.renderPayrollRecon = function (p) { if (typeof openPage === 'function') openPage('hr', Object.assign({ view: 'payroll-recon' }, p || {})); };

  /* ---------- header button on HR & Payroll ---------- */
  function injectBtn() {
    var old = $('btn-payroll-recon');
    if (!window.APP || APP.currentPage !== 'hr' || !isHR()) { if (old) old.remove(); return; }
    if (old) return;
    var bar = document.querySelector('#main > .page-header > div:last-child');
    if (!bar || !$('emp-list-wrap')) return;
    var btn = document.createElement('button');
    btn.id = 'btn-payroll-recon'; btn.type = 'button'; btn.className = 'btn btn-outline btn-sm'; btn.style.whiteSpace = 'nowrap';
    btn.innerHTML = '<i class="ti ti-scale"></i> ' + esc(L('Reconciliation', 'Rekonsiliasi'));
    btn.onclick = function () { window.renderPayrollRecon(); };
    var add = bar.querySelector('.btn-primary');
    bar.insertBefore(btn, add || null);
  }
  function wrapList() {
    var o = window.renderEmployeeList;
    if (typeof o !== 'function' || o._prcV3) return;
    var w = function () {
      var r = o.apply(this, arguments);
      try { injectBtn(); } catch (e) {}
      if (r && typeof r.then === 'function') r.then(function () { try { injectBtn(); } catch (e) {} });
      return r;
    };
    for (var k in o) { try { w[k] = o[k]; } catch (e) {} }
    w._prcV3 = true; window.renderEmployeeList = w;
  }
  try { var oldRoot = $('payroll-recon-root'); if (oldRoot) oldRoot.remove(); } catch (e) {}

  /* ---------- Run Payroll: apply arrears plans after the run ---------- */
  function wrapRun() {
    var o = window._payrollRunExecute;
    if (typeof o !== 'function' || o._prcArrears) return;
    var w = async function () {
      var m = Number(($('payroll-month') || {}).value), y = Number(($('payroll-year') || {}).value);
      var res = await o.apply(this, arguments);
      if (m >= 1 && m <= 12 && y > 2000 && isHR() && window.sb) {
        try {
          var q = await sb.rpc('payroll_arrears_apply', { p_month: m, p_year: y });
          if (!q.error && q.data && Number(q.data.records) > 0) toast(L('Arrears payment added for ', 'Bayaran tunggakan ditambah untuk ') + q.data.records + L(' staff', ' staf'), 'success');
        } catch (e) { console.warn('[payroll-recon] arrears apply', e); }
      }
      return res;
    };
    for (var k in o) { try { w[k] = o[k]; } catch (e) {} }
    w._prcArrears = true;
    window._payrollRunExecute = w;
  }

  /* ---------- payslip: Arrears payment line after Net Pay ---------- */
  function wrapPayslip() {
    var o = window._pdocPayslipHtml;
    if (typeof o !== 'function' || o._prcArrears) return;
    var w = function (rec) {
      var html = o.apply(this, arguments);
      try {
        var a = rec && Number(rec.arrears_paid || 0);
        if (!(a > 0) || /prc-ps-arrears/.test(html)) return html;
        var bm = arguments[3] === true || isBm();
        var blk = '<div class="pdoc-section-title prc-ps-arrears">' + (bm ? 'Bayaran Tunggakan' : 'Arrears Payment') + '</div>' +
          '<table class="pdoc-table"><tbody>' +
          '<tr><td>' + (bm ? 'Bayaran tunggakan (bukan tertakluk KWSP/PERKESO/PCB)' : 'Arrears payment (not subject to EPF/SOCSO/PCB)') + '</td><td style="text-align:right;color:#16A34A">+ ' + fmt(a) + '</td></tr>' +
          '<tr class="pdoc-total-row"><td>' + (bm ? 'Jumlah dibayar bulan ini' : 'Total paid this month') + '</td><td style="text-align:right">' + fmt(Number(rec.net_pay || 0) + a) + '</td></tr>' +
          '</tbody></table>';
        var i = html.indexOf('class="pdoc-net-bar"');
        if (i < 0) return html + blk;
        var j = html.indexOf('</div>', i);
        return j < 0 ? html + blk : html.slice(0, j + 6) + blk + html.slice(j + 6);
      } catch (e) { return html; }
    };
    for (var k in o) { try { w[k] = o[k]; } catch (e) {} }
    w._prcArrears = true;
    window._pdocPayslipHtml = w;
  }

  /* ---------- SD cards: Arrears payment row ---------- */
  var sdArr = { key: '', map: {}, busy: false };
  function sdCards() {
    var wrap = $('sdc-wrap'); if (!wrap || !window.sb || !tid()) return;
    var m = Number(($('sd-month') || {}).value), y = Number(($('sd-year') || {}).value);
    if (!(m >= 1 && y > 2000)) return;
    var key = tid() + ':' + y + '-' + m;
    if (sdArr.key !== key) {
      if (sdArr.busy) return;
      sdArr.busy = true;
      Promise.resolve(sb.from('payroll_records').select('id,arrears_paid').eq('tenant_id', tid()).eq('month', m).eq('year', y).gt('arrears_paid', 0)).then(function (q) {
        sdArr.map = {}; ((q && q.data) || []).forEach(function (r) { sdArr.map[r.id] = Number(r.arrears_paid || 0); });
        sdArr.key = key; sdArr.busy = false; sdCards();
      }, function () { sdArr.busy = false; sdArr.key = key; });
      return;
    }
    Object.keys(sdArr.map).forEach(function (id) {
      var card = wrap.querySelector('.sdc-card[data-row="' + id + '"]'); if (!card) return;
      var body = card.querySelector('.sdc-body'); if (!body || body.querySelector('.prc-sd-arr')) return;
      var d = document.createElement('div');
      d.className = 'sdc-row prc-sd-arr';
      d.innerHTML = '<span class="sdc-k">' + esc(L('Arrears payment (paid with salary)', 'Bayaran tunggakan (dibayar bersama gaji)')) + '</span><span class="sdc-v">+ ' + esc(fmt(sdArr.map[id])) + '</span>';
      var net = body.querySelector('.sdc-netrow');
      if (net) body.insertBefore(d, net); else body.appendChild(d);
    });
  }

  /* ---------- dashboard card + monthly reminder ---------- */
  var dash = { at: 0, busy: false, data: null };
  function placeDash(card) {
    card.style.margin = '0'; card.style.width = '100%'; card.style.gridColumn = '1 / -1';
    var after = $('db-sec-probation') || document.querySelector('.db-people-row-2');
    if (!after) { var tr = $('db-att-tracker'); after = tr && tr.closest('.db-card'); }
    if (after && after.parentNode) { if (card.previousElementSibling !== after) after.parentNode.insertBefore(card, after.nextSibling); return; }
    var w = $('dashboard-wrap'); if (w && !card.parentNode) w.appendChild(card);
  }
  async function dashData() {
    if (dash.data && Date.now() - dash.at < 60000) return dash.data;
    if (dash.busy) return null;
    dash.busy = true;
    try {
      var cur = nowMY();
      var q = await sb.from('payroll_records').select('employee_id,month,year,balance_outstanding,epf_employee,socso_employee,eis_employee,pcb').eq('tenant_id', tid()).gt('balance_outstanding', 0.01);
      var emps = {};
      (q.data || []).forEach(function (r) { if (per(r.month, r.year) < per(cur.m, cur.y)) emps[r.employee_id] = 1; });
      var statMiss = 0;
      var sq = await sb.rpc('payroll_recon_statutory_items', { p_since: null });
      if (!sq.error) {
        var paidSet = {};
        (sq.data || []).forEach(function (s) { if (s.paid && s.period_month) paidSet[s.period_year + '-' + s.period_month] = 1; });
        var lo = per(cur.m, cur.y) - 3;
        var pq = await sb.from('payroll_records').select('month,year,epf_employee,socso_employee,eis_employee,pcb').eq('tenant_id', tid()).gte('year', Math.floor((lo - 1) / 12));
        var mm = {};
        (pq.data || []).forEach(function (r) {
          var p = per(r.month, r.year);
          if (p >= lo && p < per(cur.m, cur.y) && statOf(r) > 0 && !paidSet[r.year + '-' + r.month]) mm[r.year + '-' + r.month] = 1;
        });
        statMiss = Object.keys(mm).length;
      }
      dash.data = { staff: Object.keys(emps).length, stat: statMiss, statOk: !sq.error };
      dash.at = Date.now();
      return dash.data;
    } catch (e) { return null; } finally { dash.busy = false; }
  }
  async function renderDash() {
    if (!$('dashboard-wrap') || !window.sb || !tid() || !isHR()) return;
    var d = await dashData();
    var card = $('db-sec-prc');
    if (!d || (!d.staff && !d.stat)) { if (card) card.remove(); return; }
    if (!$('dashboard-wrap')) return;
    var sig = d.staff + ':' + d.stat + ':' + (isBm() ? 'bm' : 'en');
    if (card && card.getAttribute('data-sig') === sig) { placeDash(card); return; }
    if (!card) { card = document.createElement('div'); card.className = 'db-card'; card.id = 'db-sec-prc'; }
    card.setAttribute('data-sig', sig);
    card.innerHTML = '<div class="db-card-title"><i class="ti ti-scale"></i> ' + esc(L('Payroll reconciliation', 'Rekonsiliasi gaji')) + '</div>' +
      '<div class="prc-dash" onclick="openPage(\'hr\',{view:\'payroll-recon\'})" role="button">' +
        '<div style="display:flex;gap:18px;flex-wrap:wrap">' +
          '<div><div class="prc-dn" style="color:' + (d.staff ? 'var(--danger)' : 'inherit') + '">' + d.staff + '</div><div style="font-size:12px;color:var(--db-text3)">' + esc(L('staff outstanding', 'staf tertunggak')) + '</div></div>' +
          (d.statOk ? '<div><div class="prc-dn" style="color:' + (d.stat ? 'var(--danger)' : 'inherit') + '">' + d.stat + '</div><div style="font-size:12px;color:var(--db-text3)">' + esc(L('month(s) statutory not remitted', 'bulan berkanun belum diremit')) + '</div></div>' : '') +
        '</div><i class="ti ti-chevron-right" style="color:var(--db-text3);font-size:18px"></i></div>';
    placeDash(card);
  }
  function remind() {
    if (window._prcReminded || !window.sb || !tid() || !isHR()) return;
    window._prcReminded = true;
    try { Promise.resolve(sb.rpc('payroll_recon_monthly_remind')).catch(function () {}); } catch (e) {}
  }
  function wrapDash() {
    ['renderDashboard', 'loadDashboardData'].forEach(function (name) {
      var o = window[name];
      if (typeof o !== 'function' || o._prcDash) return;
      var w = async function () { var r = await o.apply(this, arguments); setTimeout(function () { renderDash(); remind(); }, 250); return r; };
      for (var k in o) { try { w[k] = o[k]; } catch (e) {} }
      w._prcDash = true; window[name] = w;
    });
  }

  function boot() { wrapHR(); wrapList(); wrapRun(); wrapPayslip(); wrapDash(); try { injectBtn(); } catch (e) {} }
  boot(); setTimeout(boot, 400); setTimeout(boot, 1500); setTimeout(boot, 4000);
  setInterval(function () {
    try { if ($('dashboard-wrap')) { renderDash(); remind(); } } catch (e) {}
    try { if ($('sdc-wrap')) sdCards(); } catch (e) {}
    try { injectBtn(); } catch (e) {}
  }, 2000);
})();

/* Theme-aware letterhead logo: transparent bg in dark mode */
(function () {
  var css = document.createElement('style');
  css.textContent = 
    '[data-theme="dark"] .pdoc-header, [data-theme="dark"] .pdoc-logo-row, ' +
    '[data-theme="dark"] .letterhead, [data-theme="dark"] .doc-header { background: transparent !important; } ' +
    '[data-theme="dark"] .pdoc-header img, [data-theme="dark"] .pdoc-logo-row img { background: transparent !important; }';
  document.head.appendChild(css);
})();
