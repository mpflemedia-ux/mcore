/* svc-commission.js — Part-time service commission payroll (window.SVC).
   - Per-employee scheme (svc_comm_settings): service % per head with a cap, eligible client status (NM) + lead sources (TT/ADS),
     product sales %, KPI bonus (Owner toggles per month).
   - Service Log page: openPage('hr',{view:'my-payslips', svc:'log', emp, m, y}) — rides the existing 'my-payslips' view so
     RBAC (hr_attendance) lets staff in. Month cards by week, add / edit / delete (soft), CSV paste import, flags, totals,
     payslip lines preview, Submit → Approve (server recompute, locks logs) → Reopen. A4 statement print + PDF via DKD.
   - Payroll: APPROVED commission_total is added to _scCommissionTotal() payout mode → Salary Disbursement commission → net pay,
     UNLESS scheme flag pay_via_pv ("Bayar via PV") or a source=svc PV already exists for that emp-month (then SD is skipped — no double pay).
   - Payment Voucher (svc_commission_04.sql): after Approve, HR Buat PV → ONE draft PV for full part-time pay
     (basic + commission breakdown = slip Total), category=other, source=svc, source_ref=svc_comm_months.id.
   - Payslip: the commission line is split into Komisen servis / Komisen produk / Bonus when an approved month exists.
   - Signatures + WhatsApp (svc_commission_02.sql, same concept as SD): Prepared by + Approved by (free-text names like SD, svc_commission_03.sql), draw pad in app or
     public-svc.html?svc_sign=<token> via the shared WAD sheet; signed names / dates / PNGs on the A4 statement + PDF (dk-doc v5).
   v4 (20261115200000_svc_commission_all_services_pv_suite.sql): scheme option svc_all (10% of ALL services, no lead/cap),
     itemised products (svc_product_logs → product sales = sum), per-tenant code list (svc_price_codes; code autofills name + price,
     rows without a code = "needs review"), DATE/PRODUK/RM/SERVICE/RM sheet import without AI, commission-only = no basic,
     closed month (PV paid → locked; Owner reopens with a reason). PV for all staff / PVD / PV description / receipt / source file
     live in app/svc-comm-pv.js (window.SVCPV) and plug in through S.ext.
   Soft-fails before supabase/svc_commission_01.sql (and _02 for signatures) is run. EN/BM, existing tokens only. */
(function () {
  if (window.SVC) return;
  var S = window.SVC = { v: 4, ext: {} };
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }
  function tid() { try { return APP.tenant.id; } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? String(el.value || '').trim() : ''; }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }
  function rm(n) { try { return formatRM(n); } catch (e) { return 'RM ' + Number(n || 0).toFixed(2); } }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function uuid(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || '')); }
  function canHR() { try { return (typeof canManageHR === 'function' && canManageHR()) || (typeof isPlatformAdmin === 'function' && isPlatformAdmin()); } catch (e) { return false; } }
  function missing(err) { var m = String((err && (err.code + ' ' + err.message + ' ' + (err.details || ''))) || ''); return /42P01|PGRST205|PGRST202|42883|does not exist|schema cache/i.test(m); }
  function errMsg(e) { var m = String((e && (e.message || e.details)) || e || ''); if (/not allowed|42501|row-level security|permission denied/i.test(m)) return L('Not allowed for your role.', 'Tidak dibenarkan untuk peranan anda.'); if (/already approved/i.test(m)) return L('This month is already approved.', 'Bulan ini sudah diluluskan.'); if (/Approve the month first/i.test(m)) return L('Approve the month first.', 'Luluskan bulan ini dahulu.'); if (/Amount must be greater than 0/i.test(m)) return L('Amount must be greater than 0.', 'Amaun mesti lebih daripada 0.'); if (/No access to Payment Vouchers/i.test(m)) return L('No access to Payment Vouchers.', 'Tiada akses ke Baucar Bayaran.'); if (/Only HR managers can create the payment voucher/i.test(m)) return L('Only Owner/HR can create the payment voucher.', 'Hanya Owner/HR boleh buat baucar bayaran.'); return m; }
  var MEN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MBM = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  function mlabel(m, y) { return (bm() ? MBM : MEN)[m - 1] + ' ' + y; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function dmy(s) { var p = String(s || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : String(s || ''); }
  function dayName(s) { try { return new Date(s + 'T00:00:00').toLocaleDateString(bm() ? 'ms-MY' : 'en-MY', { weekday: 'short' }); } catch (e) { return ''; } }
  function weekOf(r) { var w = num(r.week_no); if (w >= 1) return w; var d = num(String(r.log_date || '').slice(8, 10)) || 1; return Math.min(5, Math.ceil(d / 7)); }

  /* ---------- calc (twin of public.svc__calc; cents-exact) ---------- */
  var DEF = { svc_rate_pct: 5, svc_cap: 10, eligible_status: 'NM', eligible_leads: ['TT', 'ADS'], prod_rate_pct: 5, bonus_amount: 100, svc_all: false };
  function rates(cfg) {
    cfg = cfg || {}; var r = {};
    Object.keys(DEF).forEach(function (k) { r[k] = cfg[k] === undefined ? DEF[k] : cfg[k]; });
    r.svc_rate_pct = num(r.svc_rate_pct); r.prod_rate_pct = num(r.prod_rate_pct); r.bonus_amount = num(r.bonus_amount);
    r.svc_cap = (r.svc_cap === null || r.svc_cap === '') ? null : num(r.svc_cap);
    r.eligible_status = String(r.eligible_status || 'NM').toUpperCase();
    r.eligible_leads = (Array.isArray(r.eligible_leads) ? r.eligible_leads : String(r.eligible_leads || '').split(/[,\s]+/)).map(function (x) { return String(x).trim().toUpperCase(); }).filter(Boolean);
    r.svc_all = r.svc_all === true || r.svc_all === 'true';
    return r;
  }
  function cents(x) { return Math.round(Number((x).toFixed(6))); }
  // code list (svc_price_codes) per tenant: { service: { HC: {code,name,default_price} }, product: {...} }
  var CODES = { service: {}, product: {}, t: null };
  S.codes = CODES;
  function codeOf(kind, v) { var k = String(v || '').trim().toUpperCase(); return k && CODES[kind] && CODES[kind][k] ? CODES[kind][k] : null; }
  S.codeOf = codeOf;
  // all-services scheme: a log without a known code is "needs review" (still paid — never blocked)
  function needsReview(row, r) { return !!(r.svc_all && !row.code && !codeOf('service', row.service)); }
  function itemReview(it) { return !it.code && !String(it.name || '').trim() && !codeOf('product', it.name); }
  S.needsReview = needsReview; S.itemReview = itemReview;
  function rowCalc(row, r) {
    var price = row.price === null || row.price === undefined || row.price === '' ? null : num(row.price);
    if (r.svc_all) {
      var okA = price !== null && price > 0;
      return { ok: okA, cents: okA ? cents(price * r.svc_rate_pct) : 0, flag: price === null ? 'noprice' : (price === 0 ? 'zero' : null), review: needsReview(row, r) };
    }
    var st = row.client_status ? String(row.client_status).toUpperCase() : null;
    var lead = row.lead_source ? String(row.lead_source).toUpperCase() : null;
    var flag = null;
    if (price === null) flag = 'noprice'; else if (price === 0) flag = 'zero'; else if (!st) flag = 'nostatus';
    else if (st === r.eligible_status && (!lead || r.eligible_leads.indexOf(lead) < 0)) flag = 'nolead';
    var ok = st === r.eligible_status && !!lead && r.eligible_leads.indexOf(lead) >= 0 && price !== null && price > 0;
    var c = 0;
    if (ok) { c = cents(price * r.svc_rate_pct); if (r.svc_cap !== null) c = Math.min(c, cents(r.svc_cap * 100)); }
    return { ok: ok, cents: c, flag: flag };
  }
  // month.items = product items (svc_product_logs): when present, product sales = their sum (same rule as svc__calc)
  S.calc = function (rows, cfg, month) {
    var r = rates(cfg); month = month || {};
    var heads = 0, svcC = 0, flags = 0, review = 0, items = Array.isArray(month.items) ? month.items : [];
    (rows || []).forEach(function (x) { var c = rowCalc(x, r); if (c.ok) { heads++; svcC += c.cents; } if (c.flag) flags++; if (c.review) review++; });
    var itemC = 0; items.forEach(function (it) { itemC += Math.round(num(it.amount) * 100); if (itemReview(it)) review++; });
    var sales = items.length ? itemC / 100 : num(month.product_sales), prodC = cents(sales * r.prod_rate_pct), bonC = month.bonus_on ? cents(r.bonus_amount * 100) : 0;
    return { rows: (rows || []).length, heads: heads, svc_commission: svcC / 100, flags: flags, review: review, product_items: items.length, product_sales: sales, prod_commission: prodC / 100,
      bonus: bonC / 100, commission_total: (svcC + prodC + bonC) / 100, rates: r };
  };
  S.rowCalc = function (row, cfg) { return rowCalc(row, rates(cfg)); };
  function flagText(f) {
    return { noprice: L('No price — no commission', 'Tiada harga — tiada komisen'), zero: L('Price RM0', 'Harga RM0'),
      nostatus: L('No client status (M / NM)', 'Tiada status pelanggan (M / NM)'), nolead: L('NM but no TT / ADS lead', 'NM tapi tiada lead TT / ADS'),
      nocode: L('Needs review — no code', 'Perlu semak — tiada kod'), noname: L('Needs review — no product name', 'Perlu semak — tiada nama produk') }[f] || f;
  }

  /* ---------- styles (tokens only) ---------- */
  function css() {
    if ($('svc-css')) return;
    var s = document.createElement('style'); s.id = 'svc-css';
    s.textContent = '.svc-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.svc-bar .btn{white-space:nowrap;flex:0 0 auto}.svc-docbar .btn{flex:1 1 0;min-width:130px;max-width:260px;justify-content:center}' +
      '.svc-bar select.form-input{width:auto;min-width:0;max-width:100%;flex:1 1 180px;padding:7px 10px;font-size:13px}' +
      '.svc-mon{display:flex;align-items:center;gap:6px;flex:0 0 auto}.svc-mon b{min-width:84px;text-align:center;font-size:14px;color:var(--text);white-space:nowrap}' +
      '.svc-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px}' +
      '.svc-stat{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;min-width:0}' +
      '.svc-stat .k{font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.03em}.svc-stat .v{font-size:18px;font-weight:700;color:var(--text);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.svc-stat .s{font-size:11px;color:var(--text-2);margin-top:2px}.svc-stat.g .v{color:var(--success)}' +
      '.svc-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;overflow:hidden}' +
      '.svc-hd{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border);font-weight:600;font-size:13px;color:var(--text)}' +
      '.svc-hd .m{font-weight:500;font-size:12px;color:var(--text-2);white-space:nowrap}' +
      '.svc-row{display:flex;gap:10px;align-items:center;padding:9px 14px;border-bottom:1px solid var(--border);min-width:0}.svc-row:last-child{border-bottom:0}' +
      '.svc-row .d{flex:0 0 46px;font-size:12px;color:var(--text-2);line-height:1.25}.svc-row .d b{display:block;color:var(--text);font-size:13px}' +
      '.svc-row .x{flex:1 1 auto;min-width:0}.svc-row .n{font-size:13px;font-weight:600;color:var(--text);overflow-wrap:anywhere}' +
      '.svc-row .t{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px;align-items:center}.svc-row .a{flex:0 0 auto;text-align:right;font-size:12px;color:var(--text-2);white-space:nowrap}' +
      '.svc-row .a b{display:block;font-size:13px;color:var(--text)}.svc-row .a .c{color:var(--success);font-weight:600}' +
      '.svc-row .o{display:flex;gap:4px;flex:0 0 auto}.svc-row .o .btn{white-space:nowrap;padding:4px 8px}' +
      '.svc-chip{display:inline-flex;align-items:center;padding:1px 7px;border-radius:99px;font-size:10.5px;font-weight:600;border:1px solid var(--border);color:var(--text-2);white-space:nowrap}' +
      '.svc-chip.ok{border-color:var(--success);color:var(--success)}.svc-chip.w{border-color:var(--warning);color:var(--warning)}.svc-chip.p{border-color:var(--primary);color:var(--primary)}' +
      '.svc-flag{font-size:11px;color:var(--warning)}' +
      '.svc-slip{display:flex;flex-direction:column}.svc-slip .ln{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:8px 14px;border-bottom:1px solid var(--border);font-size:13px;color:var(--text)}.svc-slip .ln .r{text-align:right;white-space:nowrap;font-weight:600;flex-shrink:0}.svc-slip .ln .l{min-width:0}' +
      '.svc-slip .ln .s{display:block;font-size:11px;color:var(--text-3);font-weight:400}.svc-slip .ln.tot{font-weight:700;border-bottom:0;border-top:2px solid var(--border)}' +
      '.svc-body{padding:12px 14px}.svc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}' +
      '.svc-hint{font-size:11px;color:var(--text-3);margin-top:4px}.svc-act{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.svc-act .btn{white-space:nowrap;flex:0 0 auto}' +
      '.svc-tog{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--text);white-space:nowrap}' +
      '.svc-empty{padding:28px 14px;text-align:center;color:var(--text-3);font-size:13px}' +
      '.svc-sgr .o{flex-wrap:wrap;justify-content:flex-end}.svc-sgu{flex-wrap:wrap}.svc-sgu .x{flex:1 1 100%}.svc-sgu .n{display:block}.svc-sgu .o{width:100%;justify-content:flex-end}.svc-sgn{width:100%;margin-top:6px;box-sizing:border-box}.svc-sgn-ro{padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--text);overflow-wrap:anywhere}.svc-sgi{flex:0 0 auto;height:40px;max-width:120px;object-fit:contain;background:white;border:1px solid var(--border);border-radius:6px;padding:2px}' +
      '.svc-pad{display:block;width:100%;height:160px;border:1px solid var(--border);border-radius:8px;background:white;touch-action:none;cursor:crosshair}' +
      '.svc-modal .modal-box{max-width:460px}.svc-modal textarea.form-input{min-height:150px;font-family:monospace;font-size:12px}' +
      '@media(max-width:480px){.svc-row{flex-wrap:wrap}.svc-row .x{flex-basis:calc(100% - 140px)}.svc-row .o{width:100%;justify-content:flex-end}.svc-stat .v{font-size:16px}}';
    document.head.appendChild(s);
  }

  /* ---------- data ---------- */
  var ST = { emp: null, m: null, y: null, emps: [], cfg: null, cfgRow: null, logs: [], items: [], prev: null, v4: true, mon: null, basic: null, hr: false, self: null, ready: true };
  S._st = ST;
  function prevMY(m, y) { return m === 1 ? [12, y - 1] : [m - 1, y]; }
  function isOwner() { try { var r = String((APP.user && APP.user.role) || '').toLowerCase(); return r === 'owner' || (typeof isPlatformAdmin === 'function' && isPlatformAdmin()); } catch (e) { return false; } }
  async function loadCodes() {
    var t = tid(); if (CODES.t === t) return;
    var r = await sb.from('svc_price_codes').select('id,kind,code,name,default_price').eq('tenant_id', t).is('deleted_at', null).order('code');
    CODES.service = {}; CODES.product = {}; CODES.list = [];
    if (r.error) { if (!missing(r.error)) console.warn('[svc] codes', r.error); CODES.t = t; return; }
    CODES.list = r.data || [];
    CODES.list.forEach(function (x) { (CODES[x.kind] || (CODES[x.kind] = {}))[String(x.code).toUpperCase()] = x; });
    CODES.t = t;
  }
  S.loadCodes = function (force) { if (force) CODES.t = null; return loadCodes(); };
  function monthRange(m, y) { var nm = m === 12 ? 1 : m + 1, ny = m === 12 ? y + 1 : y; return [iso(y, m, 1), iso(ny, nm, 1)]; }
  async function load() {
    var t = tid(), e = ST.emp, r = monthRange(ST.m, ST.y);
    var q1 = sb.from('svc_comm_settings').select('*').eq('tenant_id', t).eq('employee_id', e).is('deleted_at', null).maybeSingle();
    var q2 = sb.from('svc_logs').select('id,log_date,week_no,service,price,client_status,lead_source,notes,source,created_at').eq('tenant_id', t).eq('employee_id', e)
      .is('deleted_at', null).gte('log_date', r[0]).lt('log_date', r[1]).order('log_date', { ascending: true }).order('created_at', { ascending: true });
    var q3 = sb.from('svc_comm_months').select('*').eq('tenant_id', t).eq('employee_id', e).eq('month', ST.m).eq('year', ST.y).is('deleted_at', null).maybeSingle();
    var q4 = sb.from('employees').select('id,name,position,basic_salary,phone').eq('tenant_id', t).eq('id', e).maybeSingle();
    var pmy = prevMY(ST.m, ST.y);
    var q5 = sb.from('svc_product_logs').select('id,log_date,code,name,qty,amount,notes,source,created_at').eq('tenant_id', t).eq('employee_id', e)
      .is('deleted_at', null).gte('log_date', r[0]).lt('log_date', r[1]).order('log_date', { ascending: true }).order('created_at', { ascending: true });
    var q6 = sb.from('svc_comm_months').select('id,month,year,status,svc_commission,prod_commission,commission_total').eq('tenant_id', t).eq('employee_id', e)
      .eq('month', pmy[0]).eq('year', pmy[1]).is('deleted_at', null).maybeSingle();
    var res = await Promise.all([q1, q2, q3, q4, q5, q6, loadCodes().catch(function () {})]);
    for (var i = 0; i < 3; i++) if (res[i].error) { if (missing(res[i].error)) { ST.ready = false; return; } throw res[i].error; }
    ST.ready = true; ST.cfgRow = res[0].data || null; ST.cfg = rates(ST.cfgRow || {}); ST.logs = res[1].data || []; ST.mon = res[2].data || null;
    ST.v4 = !res[4].error; ST.items = res[4].error ? [] : (res[4].data || []); ST.prev = res[5].error ? null : (res[5].data || null);
    var em = res[3].data; ST.basic = em && em.basic_salary != null ? num(em.basic_salary) : null; ST.empRow = em || ST.empRow || null;
    if (ST.cfgRow && ST.cfgRow.pay_basis === 'commission_only') ST.basic = null; // commission only: no basic on slip / PV
    ST.pv = null;
    try {
      if (ST.mon && ST.mon.id) {
        var pr = await sb.from('payment_vouchers').select('id,ref_no,amount,status,description').eq('tenant_id', t).eq('source', 'svc').eq('source_ref', ST.mon.id).is('deleted_at', null).neq('status', 'void').maybeSingle();
        if (pr.error) { if (!missing(pr.error)) console.warn('[svc] pv', pr.error); }
        else ST.pv = pr.data || null;
      }
    } catch (e) { console.warn('[svc] pv', e); }
    try { await loadSigs(); } catch (e) { console.warn('[svc] signatures', e); }
    if (S.ext.load) { try { await S.ext.load(ST); } catch (e) { console.warn('[svc] ext', e); } }
  }
  function locked() { return !!(ST.mon && ST.mon.status === 'approved'); }
  function closed() { return !!(ST.mon && ST.mon.closed_at); }
  S.closed = closed;
  function monArg() { var mon = ST.mon || {}; return { product_sales: mon.product_sales, bonus_on: mon.bonus_on, items: ST.items }; }
  S.monArg = monArg;
  // G) comparison with last month: "Sep 2026 RM900.00 · +11.1%"
  function compare(cur, prev, pm, py, lang) {
    if (!prev || prev.commission_total == null) return '';
    var p = num(prev.commission_total), c = num(cur), en = lang ? lang !== 'bm' : !bm();
    var lbl = (en ? MEN : MBM)[pm - 1] + ' ' + py, pct = p > 0 ? ((c - p) / p) * 100 : null;
    return lbl + ' ' + rm(p) + (pct === null ? '' : ' · ' + (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%');
  }
  S.compare = function (cur, lang) { var pmy = prevMY(ST.m, ST.y); return compare(cur, ST.prev, pmy[0], pmy[1], lang); };
  function canEditLogs() { return !locked() && (ST.hr || (ST.self && String(ST.self.id) === String(ST.emp))); }

  /* ---------- page ---------- */
  S.open = async function (params) {
    params = params || {}; css();
    var now = new Date(); ST.hr = canHR();
    ST.m = Math.min(12, Math.max(1, parseInt(params.m, 10) || (ST.m || now.getMonth() + 1)));
    ST.y = parseInt(params.y, 10) || ST.y || now.getFullYear();
    ST.wantSig = params.sig === 'prepared' || params.sig === 'approved' ? params.sig : null;
    var M = $('main'); if (!M) return;
    M.innerHTML = '<div class="page-header"><div><div class="page-title">' + esc(L('Service Commission', 'Komisen Servis')) + '</div>' +
      '<div style="font-size:13px;color:var(--text-3);margin-top:2px;cursor:pointer" id="svc-back">← ' + esc(ST.hr ? L('HR & Payroll', 'SDM & Gaji') : L('My Payroll History', 'Sejarah Gaji Saya')) + '</div></div></div>' +
      '<div id="svc-wrap"><div class="card"><div class="empty-state" style="padding:40px"><div class="spinner"></div></div></div></div>';
    $('svc-back').onclick = function () { openPage('hr', ST.hr ? {} : { view: 'my-payslips' }); };
    var W = $('svc-wrap');
    try {
      ST.self = await (typeof _hrResolveSelfEmployee === 'function' ? _hrResolveSelfEmployee() : null);
      if (ST.hr) {
        var er = await sb.from('employees').select('id,name,position').eq('tenant_id', tid()).is('deleted_at', null).order('name');
        ST.emps = er.data || [];
        var sr = await sb.from('svc_comm_settings').select('employee_id,enabled').eq('tenant_id', tid()).is('deleted_at', null);
        if (sr.error && missing(sr.error)) { ST.ready = false; return paintMissing(W); }
        var on = {}; (sr.data || []).forEach(function (x) { if (x.enabled) on[x.employee_id] = 1; });
        ST.emps.sort(function (a, b) { return (on[b.id] || 0) - (on[a.id] || 0) || String(a.name).localeCompare(String(b.name)); });
        ST.on = on;
        var want = uuid(params.emp) && ST.emps.some(function (x) { return String(x.id) === String(params.emp); }) ? params.emp : null;
        ST.emp = want || (ST.emp && ST.emps.some(function (x) { return String(x.id) === String(ST.emp); }) ? ST.emp : null) || (Object.keys(on)[0]) || (ST.emps[0] && ST.emps[0].id) || null;
      } else {
        if (!ST.self) { W.innerHTML = '<div class="card"><div class="svc-empty">' + esc(L('Your login is not linked to an employee record. Ask HR to set the same email on your employee profile.', 'Akaun anda belum dipautkan ke rekod pekerja. Minta HR tetapkan e-mel yang sama pada profil pekerja.')) + '</div></div>'; return; }
        ST.emp = ST.self.id; ST.emps = [ST.self];
      }
      if (!ST.emp) { W.innerHTML = '<div class="card"><div class="svc-empty">' + esc(L('No employees yet.', 'Tiada pekerja lagi.')) + '</div></div>'; return; }
      await load();
      if (!ST.ready) return paintMissing(W);
      paint();
    } catch (e) {
      console.warn('[svc] open', e);
      W.innerHTML = '<div class="card"><div class="svc-empty" style="color:var(--danger)">' + esc(errMsg(e)) + '</div></div>';
    }
  };
  function paintMissing(W) {
    W.innerHTML = '<div class="card"><div class="svc-empty">' + esc(L('Service commission is not set up yet. Run supabase/svc_commission_01.sql in Supabase first.', 'Komisen servis belum disediakan. Jalankan supabase/svc_commission_01.sql di Supabase dahulu.')) + '</div></div>';
  }
  function go(dm) { var m = ST.m + dm, y = ST.y; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } openPage('hr', { view: 'my-payslips', svc: 'log', emp: ST.emp, m: m, y: y }); }
  function statusChip(st) {
    var map = { draft: ['', L('Draft', 'Draf')], submitted: ['w', L('Submitted', 'Dihantar')], approved: ['ok', L('Approved', 'Diluluskan')] };
    var x = map[st || 'draft'] || map.draft; return '<span class="svc-chip ' + x[0] + '">' + esc(x[1]) + '</span>';
  }
  function empName() { var e = ST.emps.filter(function (x) { return String(x.id) === String(ST.emp); })[0]; return (e && e.name) || (ST.empRow && ST.empRow.name) || ''; }
  function schemeText(r) {
    if (r.svc_all) return L(r.svc_rate_pct + '% of all services, no cap', r.svc_rate_pct + '% semua servis, tiada had');
    return L(r.svc_rate_pct + '% per head' + (r.svc_cap !== null ? ', max ' + rm(r.svc_cap) + '/head' : ''), r.svc_rate_pct + '% sekepala' + (r.svc_cap !== null ? ', maks ' + rm(r.svc_cap) + '/kepala' : ''));
  }
  function paint() {
    var W = $('svc-wrap'); if (!W) return;
    var r = ST.cfg, mon = ST.mon || {}, c = S.calc(ST.logs, ST.cfgRow || {}, monArg());
    S.last = c; var lk = locked(), edit = canEditLogs(), st = mon.status || 'draft';
    var h = '<div class="svc-bar">';
    if (ST.hr) h += '<select class="form-input" id="svc-emp" aria-label="' + esc(L('Employee', 'Pekerja')) + '">' + ST.emps.map(function (e) {
      return '<option value="' + esc(e.id) + '"' + (String(e.id) === String(ST.emp) ? ' selected' : '') + '>' + esc(e.name || '-') + (ST.on && ST.on[e.id] ? ' ✓' : '') + '</option>'; }).join('') + '</select>';
    h += '<div class="svc-mon"><button type="button" class="btn btn-outline btn-sm" id="svc-prev" aria-label="prev"><i class="ti ti-chevron-left"></i></button><b>' + esc(mlabel(ST.m, ST.y)) + '</b>' +
      '<button type="button" class="btn btn-outline btn-sm" id="svc-next" aria-label="next"><i class="ti ti-chevron-right"></i></button></div>' + statusChip(st) + sigChip() + '</div>';
    if (ST.cfgRow && ST.cfgRow.enabled === false) h += '<div class="svc-card"><div class="svc-body svc-flag">' + esc(L('Service commission is switched off for this employee.', 'Komisen servis dimatikan untuk pekerja ini.')) + '</div></div>';
    if (!ST.cfgRow && ST.hr) h += '<div class="svc-card"><div class="svc-body svc-hint" style="margin:0">' + esc(L('No scheme saved for this employee yet — default rates shown. Save the scheme below.', 'Tiada skim disimpan untuk pekerja ini — kadar lalai ditunjukkan. Simpan skim di bawah.')) + '</div></div>';
    h += '<div class="svc-stats">' +
      stat(r.svc_all ? L('Heads', 'Kepala') : L('NM heads', 'Kepala NM'), String(c.heads), L(c.rows + ' logs', c.rows + ' log')) +
      stat(L('Service comm.', 'Komisen servis'), rm(c.svc_commission), schemeText(r)) +
      stat(L('Product comm.', 'Komisen produk'), rm(c.prod_commission), r.prod_rate_pct + '% × ' + rm(c.product_sales)) +
      stat(L('KPI bonus', 'Bonus KPI'), rm(c.bonus), mon.bonus_on ? L('On', 'Aktif') : L('Off', 'Tidak aktif')) +
      stat(L('Total commission', 'Jumlah komisen'), rm(c.commission_total), c.review ? L(c.review + ' need review', c.review + ' perlu semak') : (c.flags ? L(c.flags + ' flagged', c.flags + ' ditanda') : L('No flags', 'Tiada tanda')), 'g') + '</div>';
    h += slipCard(c);
    h += actionCard(c, st, lk);
    if (S.ext.card) { try { h += S.ext.card(ST, c) || ''; } catch (e) { console.warn('[svc] ext card', e); } }
    h += sigCard();
    if (edit) h += '<div class="svc-bar"><button type="button" class="btn btn-primary btn-sm" id="svc-add"><i class="ti ti-plus"></i> ' + esc(L('Add log', 'Tambah log')) + '</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="svc-imp"><i class="ti ti-clipboard-text"></i> ' + esc(L('Paste CSV', 'Tampal CSV')) + '</button>' +
      (typeof _invokeAiProxy === 'function' ? '<button type="button" class="btn btn-outline btn-sm" id="svc-ai"><i class="ti ti-sparkles"></i> ' + esc(L('Import from doc', 'Import dari dokumen')) + '</button>' : '') + '</div>';
    // statement row: PDF (A4 statement) + WhatsApp, equal width (the separate Statement/print button was removed — PDF covers it)
    h += '<div class="svc-bar svc-docbar"><button type="button" class="btn btn-outline btn-sm" id="svc-pdf"><i class="ti ti-file-download"></i> ' + esc(L('PDF statement', 'PDF penyata')) + '</button>' +
      (ST.hr && SG.ready ? '<button type="button" class="btn btn-outline btn-sm" id="svc-wa"><i class="ti ti-brand-whatsapp"></i> WhatsApp</button>' : '') + '</div>';
    if (closed()) h += '<div class="svc-hint" style="margin:-4px 0 10px"><i class="ti ti-lock"></i> ' + esc(L('Closed — the PV is paid. Logs and product items are locked. Only the Owner can reopen (with a reason).', 'Ditutup — PV sudah dibayar. Log dan item produk dikunci. Hanya Owner boleh buka semula (dengan sebab).')) + '</div>';
    else if (lk) h += '<div class="svc-hint" style="margin:-4px 0 10px">' + esc(L('Approved — logs are locked. Owner/HR can reopen to change.', 'Diluluskan — log dikunci. Owner/HR boleh buka semula untuk ubah.')) + '</div>';
    h += weeksHtml(edit);
    if (ST.hr) h += settingsCard();
    if (ST.hr && ST.v4) h += codesCard();
    W.innerHTML = h; wire(c); wireSig(); if (S.ext.wire) { try { S.ext.wire(ST, c); } catch (e) { console.warn('[svc] ext wire', e); } }
  }
  function stat(k, v, s, cls) { return '<div class="svc-stat ' + (cls || '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div><div class="s">' + esc(s || '') + '</div></div>'; }
  function slipCard(c) {
    var r = c.rates, rows = [];
    if (ST.basic !== null) rows.push([L('Basic pay', 'Gaji asas'), '', ST.basic]);
    rows.push([L('Service commission', 'Komisen servis'), (r.svc_all ? L(c.heads + ' heads, ', c.heads + ' kepala, ') : L(c.heads + ' heads NM, ', c.heads + ' kepala NM, ')) + schemeText(r), c.svc_commission]);
    rows.push([L('Product commission', 'Komisen produk'), r.prod_rate_pct + '% × ' + rm(c.product_sales), c.prod_commission]);
    if (!(r.svc_all && !(c.bonus > 0) && !(r.bonus_amount > 0))) rows.push([L('Conversion bonus', 'Bonus conversion'), c.bonus > 0 ? L('KPI met', 'KPI dicapai') : L('Not awarded', 'Tidak diberi'), c.bonus]);
    var tot = (ST.basic || 0) + c.commission_total, cmp = S.compare(c.commission_total);
    return '<div class="svc-card"><div class="svc-hd"><span>' + esc(L('Payslip lines', 'Baris slip gaji')) + '</span><span class="m">' + esc(empName()) + ' · ' + esc(mlabel(ST.m, ST.y)) + '</span></div>' +
      '<div class="svc-slip">' + rows.map(function (x) { return '<div class="ln"><div class="l">' + esc(x[0]) + (x[1] ? '<span class="s">' + esc(x[1]) + '</span>' : '') + '</div><div class="r">' + esc(rm(x[2])) + '</div></div>'; }).join('') +
      '<div class="ln tot"><div class="l">' + esc(L('Total', 'Jumlah')) + (ST.basic === null ? '<span class="s">' + esc(L('Commission only — basic pay not visible', 'Komisen sahaja — gaji asas tidak dipaparkan')) + '</span>' : '') + (cmp ? '<span class="s">' + esc(L('Last month: ', 'Bulan lepas: ') + cmp) + '</span>' : '') + '</div><div class="r">' + esc(rm(tot)) + '</div></div></div>' +
      '<div class="svc-body svc-hint" style="margin:0;padding-top:8px">' + esc((ST.cfgRow && ST.cfgRow.pay_via_pv) || ST.pv
        ? L('Bayar via PV — full part-time pay goes to a Payment Voucher (not Salary Disbursement), so there is no double pay.', 'Bayar via PV — gaji separuh masa penuh masuk Baucar Bayaran (bukan Penyaluran Gaji), jadi tiada bayaran berganda.')
        : L('Statutory deductions (EPF/SOCSO/EIS/PCB) are applied in Salary Disbursement. Only an APPROVED month flows into payroll.', 'Potongan berkanun (KWSP/PERKESO/EIS/PCB) dikira di Penyaluran Gaji. Hanya bulan yang DILULUSKAN masuk payroll.')) + '</div></div>';
  }
  function actionCard(c, st, lk) {
    var mon = ST.mon || {}, isSelf = ST.self && String(ST.self.id) === String(ST.emp), b = '';
    var canSales = ST.hr && !lk;
    b += '<div class="svc-card"><div class="svc-hd"><span>' + esc(L('Product sales & approval', 'Jualan produk & kelulusan')) + '</span><span class="m">' + statusChip(st) + ' ' + sigChip() + '</span></div><div class="svc-body">';
    var hasItems = ST.v4 && ST.items.length > 0;
    if (ST.v4 && (hasItems || canSales)) b += itemsHtml(c, canSales);
    if (canSales && !hasItems) {
      b += '<div class="svc-grid"><div><label class="form-label" for="svc-ps">' + esc(L('Product sales (RM)', 'Jualan produk (RM)')) + '</label><input class="form-input" id="svc-ps" type="number" min="0" step="0.01" inputmode="decimal" value="' + esc(mon.product_sales == null ? '' : mon.product_sales) + '"></div>' +
        '<div><label class="form-label" for="svc-pn">' + esc(L('Products (note)', 'Produk (nota)')) + '</label><input class="form-input" id="svc-pn" maxlength="300" value="' + esc(mon.product_note || '') + '" placeholder="' + esc(L('e.g. Moisturizer x7', 'cth. Moisturizer x7')) + '"></div></div>' +
        '<div class="svc-act" style="margin-top:10px"><label class="svc-tog"><input type="checkbox" id="svc-bon"' + (mon.bonus_on ? ' checked' : '') + '> ' + esc(L('KPI bonus', 'Bonus KPI')) + ' (' + esc(rm(c.rates.bonus_amount)) + ')</label>' +
        '<button type="button" class="btn btn-outline btn-sm" id="svc-saveps"><i class="ti ti-device-floppy"></i> ' + esc(L('Save', 'Simpan')) + '</button></div>' +
        '<div class="svc-hint">' + esc(L('Entered manually (not linked to POS) so it is never double-counted with Sales Commission.', 'Diisi manual (tidak dipaut ke POS) supaya tidak dikira dua kali dengan Komisen Jualan.')) + '</div>';
    } else if (canSales) {
      b += '<div class="svc-act" style="margin-top:10px"><label class="svc-tog"><input type="checkbox" id="svc-bon"' + (mon.bonus_on ? ' checked' : '') + '> ' + esc(L('KPI bonus', 'Bonus KPI')) + ' (' + esc(rm(c.rates.bonus_amount)) + ')</label>' +
        '<button type="button" class="btn btn-outline btn-sm" id="svc-saveps"><i class="ti ti-device-floppy"></i> ' + esc(L('Save', 'Simpan')) + '</button></div>';
    } else if (hasItems) {
      b += '';
    } else {
      b += '<div class="svc-hint" style="margin:0 0 8px">' + esc(L('Product sales: ', 'Jualan produk: ')) + esc(rm(mon.product_sales || 0)) + (mon.product_note ? ' · ' + esc(mon.product_note) : '') + '</div>';
    }
    b += '<div class="svc-act" style="margin-top:12px">';
    if (!lk && st !== 'submitted' && (isSelf || ST.hr)) b += '<button type="button" class="btn btn-outline btn-sm" id="svc-submit"><i class="ti ti-send"></i> ' + esc(L('Submit for approval', 'Hantar untuk kelulusan')) + '</button>';
    if (ST.hr && !lk) b += '<button type="button" class="btn btn-primary btn-sm" id="svc-approve"><i class="ti ti-check"></i> ' + esc(L('Approve', 'Luluskan')) + '</button>';
    if (ST.hr && lk && (!closed() || isOwner())) b += '<button type="button" class="btn btn-outline btn-sm" id="svc-reopen"><i class="ti ti-lock-open"></i> ' + esc(L('Reopen', 'Buka semula')) + '</button>';
    if (ST.hr && lk) {
      if (ST.pv && ST.pv.id) b += '<button type="button" class="btn btn-primary btn-sm" id="svc-open-pv"><i class="ti ti-file-invoice"></i> ' + esc(L('Open PV', 'Buka PV')) + ' ' + esc(ST.pv.ref_no || '') + '</button>';
      else b += '<button type="button" class="btn btn-primary btn-sm" id="svc-buat-pv"><i class="ti ti-file-invoice"></i> ' + esc(L('Create PV', 'Buat PV')) + '</button>';
    }
    if (ST.hr && ST.v4 && S.ext.createAll) b += '<button type="button" class="btn btn-outline btn-sm" id="svc-pv-all"><i class="ti ti-files"></i> ' + esc(L('Create PV for all staff this month', 'Buat PV semua staff bulan ini')) + '</button>';
    b += '</div>';
    if (mon.status === 'submitted' && mon.submitted_at) b += '<div class="svc-hint">' + esc(L('Submitted ', 'Dihantar ')) + esc(fdt(mon.submitted_at)) + '</div>';
    if (lk && mon.approved_at) {
      var payTot = (ST.basic || 0) + num(mon.commission_total);
      b += '<div class="svc-hint">' + esc(L('Approved ', 'Diluluskan ')) + esc(fdt(mon.approved_at)) + ' · ' + esc(L('slip total ', 'jumlah slip ')) + esc(rm(payTot));
      if (ST.pv && ST.pv.id) b += ' · PV ' + esc(ST.pv.ref_no || '') + ' (' + esc(rm(ST.pv.amount)) + ')';
      else if (ST.cfgRow && ST.cfgRow.pay_via_pv) b += ' · ' + esc(L('pay via PV', 'bayar via PV'));
      b += '</div>';
    }
    return b + '</div></div>';
  }
  // B) product items list (svc_product_logs)
  function itemsHtml(c, canEdit) {
    var h = '<div class="svc-hd" style="padding:0 0 6px;border-bottom:0"><span>' + esc(L('Product items', 'Item produk')) + '</span><span class="m">' + esc(rm(c.product_sales)) + ' · ' + esc(c.rates.prod_rate_pct + '% = ' + rm(c.prod_commission)) + '</span></div>';
    if (!ST.items.length) h += '<div class="svc-hint" style="margin:0 0 8px">' + esc(L('No product items yet — add each product sold, or type one total below.', 'Belum ada item produk — tambah setiap produk dijual, atau taip satu jumlah di bawah.')) + '</div>';
    else h += '<div style="border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px">' + ST.items.map(function (it) {
      var cd = codeOf('product', it.code), nm = it.name || (cd && cd.name) || it.code || '', rv = itemReview(it);
      return '<div class="svc-row"><div class="d"><b>' + esc(dmy(it.log_date)) + '</b>' + esc(dayName(it.log_date)) + '</div><div class="x"><div class="n">' + esc(nm || L('No name', 'Tanpa nama')) + '</div><div class="t">' +
        (it.code && nm !== it.code ? '<span class="svc-chip">' + esc(it.code) + '</span>' : '') + (num(it.qty) !== 1 ? '<span class="svc-chip">×' + esc(num(it.qty)) + '</span>' : '') +
        (rv ? '<span class="svc-flag"><i class="ti ti-alert-triangle"></i> ' + esc(flagText('noname')) + '</span>' : '') + (it.notes ? '<span class="svc-hint" style="margin:0">' + esc(it.notes) + '</span>' : '') + '</div></div>' +
        '<div class="a"><b>' + esc(rm(it.amount)) + '</b></div>' +
        (canEdit ? '<div class="o"><button type="button" class="btn btn-outline btn-sm" data-svc-ied="' + esc(it.id) + '" aria-label="' + esc(L('Edit', 'Sunting')) + '"><i class="ti ti-pencil"></i></button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-svc-idel="' + esc(it.id) + '" aria-label="' + esc(L('Delete', 'Padam')) + '"><i class="ti ti-trash"></i></button></div>' : '') + '</div>';
    }).join('') + '</div>';
    if (canEdit) h += '<div class="svc-act" style="margin-bottom:10px"><button type="button" class="btn btn-outline btn-sm" id="svc-iadd"><i class="ti ti-plus"></i> ' + esc(L('Add product', 'Tambah produk')) + '</button></div>';
    return h;
  }
  // C) code list card (Owner/HR)
  function codesCard() {
    var list = CODES.list || [];
    var row = function (x) {
      return '<div class="svc-row"><div class="x"><div class="n">' + esc(x.code) + (x.name ? ' · ' + esc(x.name) : '') + '</div><div class="t"><span class="svc-chip ' + (x.kind === 'product' ? 'p' : '') + '">' + esc(x.kind === 'product' ? L('Product', 'Produk') : L('Service', 'Servis')) + '</span></div></div>' +
        '<div class="a"><b>' + (x.default_price == null ? '—' : esc(rm(x.default_price))) + '</b></div><div class="o"><button type="button" class="btn btn-outline btn-sm" data-svc-ced="' + esc(x.id) + '" aria-label="' + esc(L('Edit', 'Sunting')) + '"><i class="ti ti-pencil"></i></button></div></div>';
    };
    return '<div class="svc-card"><div class="svc-hd"><span>' + esc(L('Price / code list', 'Senarai kod / harga')) + '</span><span class="m">' + esc(L(list.length + ' codes', list.length + ' kod')) + '</span></div>' +
      (list.length ? list.map(row).join('') : '<div class="svc-empty">' + esc(L('No codes yet.', 'Belum ada kod.')) + '</div>') +
      '<div class="svc-body"><div class="svc-hint" style="margin:0 0 8px">' + esc(L('Typing a code in a log fills its name and price. Logs without a code are marked "needs review" (still counted).', 'Taip kod dalam log untuk isi nama dan harga. Log tanpa kod ditanda "perlu semak" (tetap dikira).')) + '</div>' +
      '<div class="svc-act"><button type="button" class="btn btn-outline btn-sm" id="svc-cadd"><i class="ti ti-plus"></i> ' + esc(L('Add code', 'Tambah kod')) + '</button></div></div></div>';
  }
  function fdt(s) { try { return new Date(s).toLocaleString(bm() ? 'ms-MY' : 'en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(s || ''); } }
  function weeksHtml(edit) {
    if (!ST.logs.length) return '<div class="svc-card"><div class="svc-empty">' + esc(L('No service logs this month yet.', 'Belum ada log servis bulan ini.')) + '</div></div>';
    var g = {}; ST.logs.forEach(function (x) { var w = weekOf(x); (g[w] = g[w] || []).push(x); });
    return Object.keys(g).sort(function (a, b) { return a - b; }).map(function (w) {
      var rows = g[w], c = S.calc(rows, ST.cfgRow || {}, {}), sum = rows.reduce(function (s, x) { return s + num(x.price); }, 0), hl = ST.cfg.svc_all ? L(' heads', ' kepala') : L(' NM heads', ' kepala NM');
      return '<div class="svc-card"><div class="svc-hd"><span>' + esc(L('Week ', 'Minggu ')) + w + '</span><span class="m">' + esc(L(rows.length + ' logs · ' + c.heads + hl + ' · sales ', rows.length + ' log · ' + c.heads + hl + ' · jualan ')) + esc(rm(sum)) + ' · <b style="color:var(--success)">' + esc(rm(c.svc_commission)) + '</b></span></div>' +
        rows.map(function (x) { return rowHtml(x, edit); }).join('') + '</div>';
    }).join('');
  }
  function rowHtml(x, edit) {
    var rc = S.rowCalc(x, ST.cfgRow || {}), st = x.client_status, ld = x.lead_source;
    return '<div class="svc-row"><div class="d"><b>' + esc(dmy(x.log_date)) + '</b>' + esc(dayName(x.log_date)) + '</div>' +
      '<div class="x"><div class="n">' + esc(x.service) + '</div><div class="t">' +
      (st ? '<span class="svc-chip ' + (st === ST.cfg.eligible_status ? 'p' : '') + '">' + esc(st) + '</span>' : '') + (ld ? '<span class="svc-chip">' + esc(ld) + '</span>' : '') +
      (x.code && x.code !== String(x.service || '').toUpperCase() ? '<span class="svc-chip">' + esc(x.code) + '</span>' : '') +
      (rc.flag ? '<span class="svc-flag"><i class="ti ti-alert-triangle"></i> ' + esc(flagText(rc.flag)) + '</span>' : '') +
      (rc.review ? '<span class="svc-flag"><i class="ti ti-alert-triangle"></i> ' + esc(flagText('nocode')) + '</span>' : '') +
      (x.notes ? '<span class="svc-hint" style="margin:0">' + esc(x.notes) + '</span>' : '') + '</div></div>' +
      '<div class="a"><b>' + (x.price == null ? '—' : esc(rm(x.price))) + '</b>' + (rc.ok ? '<span class="c">+' + esc(rm(rc.cents / 100)) + '</span>' : '<span>—</span>') + '</div>' +
      (edit ? '<div class="o"><button type="button" class="btn btn-outline btn-sm" data-svc-ed="' + esc(x.id) + '" aria-label="' + esc(L('Edit', 'Sunting')) + '"><i class="ti ti-pencil"></i></button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-svc-del="' + esc(x.id) + '" aria-label="' + esc(L('Delete', 'Padam')) + '"><i class="ti ti-trash"></i></button></div>' : '') + '</div>';
  }
  function settingsCard() {
    var s = ST.cfgRow || {}, r = ST.cfg;
    function opt(v, cur, lbl) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + esc(lbl) + '</option>'; }
    return '<div class="svc-card"><div class="svc-hd"><span>' + esc(L('Commission scheme', 'Skim komisen')) + '</span><span class="m">' + esc(empName()) + '</span></div><div class="svc-body">' +
      '<div class="svc-act" style="margin-bottom:10px;flex-wrap:wrap"><label class="svc-tog"><input type="checkbox" id="svc-s-en"' + (s.enabled === false ? '' : ' checked') + '> ' + esc(L('Enabled', 'Aktif')) + '</label>' +
      '<label class="svc-tog"><input type="checkbox" id="svc-s-pv"' + (s.pay_via_pv ? ' checked' : '') + '> ' + esc(L('Pay via PV', 'Bayar via PV')) + '</label></div>' +
      (ST.v4 ? '<div class="svc-act" style="margin-bottom:6px"><label class="svc-tog" style="white-space:normal"><input type="checkbox" id="svc-s-all"' + (r.svc_all ? ' checked' : '') + '> ' + esc(L('Commission on all services (no lead/cap conditions)', 'Komisen semua servis (tanpa syarat lead / had)')) + '</label></div>' +
        '<div class="svc-hint" style="margin:0 0 10px">' + esc(L('On: every log with a price earns service % — no M/NM, TT/ADS or cap. Off: only eligible status + lead, capped per head.', 'Aktif: setiap log yang ada harga dapat % servis — tiada syarat M/NM, TT/ADS atau had. Tidak aktif: hanya status + lead layak, ada had sekepala.')) + '</div>' : '') +
      '<div class="svc-hint" style="margin:0 0 10px">' + esc(L('Bayar via PV: after Approve, HR creates one Payment Voucher for full part-time pay (basic + commissions). That month is skipped in Salary Disbursement.', 'Bayar via PV: selepas Lulus, HR buat satu Baucar Bayaran untuk gaji separuh masa penuh (asas + komisen). Bulan itu dilangkau di Penyaluran Gaji.')) + '</div>' +
      '<div class="svc-grid">' +
      '<div><label class="form-label" for="svc-s-pb">' + esc(L('Pay basis', 'Asas gaji')) + '</label><select class="form-input" id="svc-s-pb">' + opt('monthly_fixed', s.pay_basis || 'monthly_fixed', L('Monthly fixed', 'Tetap bulanan')) + opt('daily', s.pay_basis, L('Daily', 'Harian')) + opt('hourly', s.pay_basis, L('Hourly', 'Jam')) + opt('commission_only', s.pay_basis, L('Commission only', 'Komisen sahaja')) + '</select></div>' +
      '<div><label class="form-label" for="svc-s-wm">' + esc(L('Work mode', 'Mod kerja')) + '</label><select class="form-input" id="svc-s-wm">' + opt('wfh', s.work_mode || 'wfh', 'WFH') + opt('onsite', s.work_mode, L('On-site', 'Di premis')) + opt('hybrid', s.work_mode, 'Hybrid') + '</select></div>' +
      '<div><label class="form-label" for="svc-s-rate">' + esc(L('Service % per head', '% servis sekepala')) + '</label><input class="form-input" id="svc-s-rate" type="number" min="0" max="100" step="0.01" value="' + esc(r.svc_rate_pct) + '"></div>' +
      '<div><label class="form-label" for="svc-s-cap">' + esc(L('Cap per head (RM, blank = none)', 'Had sekepala (RM, kosong = tiada)')) + '</label><input class="form-input" id="svc-s-cap" type="number" min="0" step="0.01" value="' + esc(r.svc_cap == null ? '' : r.svc_cap) + '"></div>' +
      '<div><label class="form-label" for="svc-s-st">' + esc(L('Eligible status', 'Status layak')) + '</label><select class="form-input" id="svc-s-st">' + opt('NM', r.eligible_status, 'NM') + opt('M', r.eligible_status, 'M') + '</select></div>' +
      '<div><label class="form-label" for="svc-s-ld">' + esc(L('Eligible leads', 'Lead layak')) + '</label><input class="form-input" id="svc-s-ld" value="' + esc(r.eligible_leads.join(', ')) + '" placeholder="TT, ADS"></div>' +
      '<div><label class="form-label" for="svc-s-pr">' + esc(L('Product %', '% produk')) + '</label><input class="form-input" id="svc-s-pr" type="number" min="0" max="100" step="0.01" value="' + esc(r.prod_rate_pct) + '"></div>' +
      '<div><label class="form-label" for="svc-s-bo">' + esc(L('KPI bonus (RM)', 'Bonus KPI (RM)')) + '</label><input class="form-input" id="svc-s-bo" type="number" min="0" step="0.01" value="' + esc(r.bonus_amount) + '"></div>' +
      '</div><div style="margin-top:10px"><label class="form-label" for="svc-s-no">' + esc(L('Notes', 'Nota')) + '</label><input class="form-input" id="svc-s-no" maxlength="300" value="' + esc(s.notes || '') + '"></div>' +
      '<div class="svc-hint">' + esc(L('Basic pay stays on the employee record (Gaji Pokok). ' + (r.eligible_status === 'M' ? 'NM' : 'M') + ' heads and rows without a price earn nothing.', 'Gaji asas kekal di rekod pekerja (Gaji Pokok). Kepala ' + (r.eligible_status === 'M' ? 'NM' : 'M') + ' dan baris tanpa harga tiada komisen.')) + '</div>' +
      '<div class="svc-act" style="margin-top:10px"><button type="button" class="btn btn-primary btn-sm" id="svc-s-save"><i class="ti ti-device-floppy"></i> ' + esc(L('Save scheme', 'Simpan skim')) + '</button></div></div></div>';
  }

  /* ---------- actions ---------- */
  function busy(b, p) { if (b) b.disabled = true; return Promise.resolve(p).finally(function () { if (b && b.isConnected) b.disabled = false; }); }
  async function refresh() { await load(); paint(); }
  function wire(c) {
    var on = function (id, fn) { var el = $(id); if (el) el.onclick = function () { fn(el); }; };
    var se = $('svc-emp'); if (se) se.onchange = function () { openPage('hr', { view: 'my-payslips', svc: 'log', emp: se.value, m: ST.m, y: ST.y }); };
    on('svc-prev', function () { go(-1); }); on('svc-next', function () { go(1); });
    on('svc-add', function () { editModal(null); }); on('svc-imp', function () { importModal(); }); on('svc-ai', aiImportModal);
    on('svc-pdf', function (b) { busy(b, statement('pdf')); });
    on('svc-saveps', function (b) { busy(b, saveMonth().then(function (ok) { if (ok) { toast(L('Saved', 'Disimpan')); return refresh(); } })); });
    on('svc-submit', function (b) { busy(b, rpc('svc_comm_submit', {}, L('Submitted to Owner/HR', 'Dihantar kepada Owner/HR'))); });
    on('svc-approve', function (b) {
      if (c.flags && !confirm(L(c.flags + ' row(s) are flagged and earn no commission. Approve anyway?', c.flags + ' baris ditanda dan tiada komisen. Luluskan juga?'))) return;
      busy(b, (async function () {
        var ps = $('svc-ps'), extra = {};
        if (ps) { var v = ps.value === '' ? 0 : Number(ps.value); if (!(v >= 0)) return toast(L('Product sales must be 0 or more', 'Jualan produk mesti 0 atau lebih'), 'error'); extra.p_product_sales = v; }
        var bo = $('svc-bon'); if (bo) extra.p_bonus_on = !!bo.checked;
        var pn = $('svc-pn'); if (pn && ST.mon && String(pn.value || '') !== String(ST.mon.product_note || '')) await saveMonth();
        else if (pn && !ST.mon && pn.value) await saveMonth();
        var viaPv = !!(ST.cfgRow && ST.cfgRow.pay_via_pv);
        return rpc('svc_comm_approve', extra, viaPv
          ? L('Approved — create a Payment Voucher (Buat PV) to pay', 'Diluluskan — buat Baucar Bayaran (Buat PV) untuk bayar')
          : L('Approved — flows into Salary Disbursement', 'Diluluskan — masuk ke Penyaluran Gaji'));
      })());
    });
    on('svc-reopen', function (b) {
      if (closed()) {
        var why = window.prompt(L('This month is closed (PV paid). Reason for reopening:', 'Bulan ini ditutup (PV dibayar). Sebab buka semula:'), '');
        if (why === null) return;
        if (String(why).trim().length < 3) return toast(L('Reason required', 'Sebab diperlukan'), 'error');
        return busy(b, rpc('svc_comm_reopen_closed', { p_reason: String(why).trim() }, L('Reopened', 'Dibuka semula')));
      }
      var msg = L('Reopen this month? Payroll stops adding it until approved again.', 'Buka semula bulan ini? Payroll tidak akan masukkan sehingga diluluskan semula.');
      if (ST.pv && ST.pv.id) msg += '\n\n' + L('A Payment Voucher already exists (' + (ST.pv.ref_no || '') + '). Reopening does not void it.', 'Baucar Bayaran sudah wujud (' + (ST.pv.ref_no || '') + '). Buka semula tidak membatalkan baucar itu.');
      if (!confirm(msg)) return;
      busy(b, rpc('svc_comm_reopen', {}, L('Reopened', 'Dibuka semula')));
    });
    on('svc-buat-pv', function (b) { busy(b, createPv()); });
    on('svc-open-pv', function () { if (ST.pv && ST.pv.id) openPage('vouchers', { view: 'pv-detail', id: ST.pv.id }); });
    on('svc-s-save', function (b) { busy(b, saveSettings()); });
    on('svc-iadd', function () { itemModal(null); }); on('svc-cadd', function () { codeModal(null); });
    on('svc-pv-all', function (b) { if (S.ext.createAll) busy(b, S.ext.createAll(ST.m, ST.y)); });
    var W = $('svc-wrap');
    W.querySelectorAll('[data-svc-ed]').forEach(function (el) { el.onclick = function () { editModal(ST.logs.filter(function (x) { return String(x.id) === el.getAttribute('data-svc-ed'); })[0]); }; });
    W.querySelectorAll('[data-svc-del]').forEach(function (el) { el.onclick = function () { delLog(el.getAttribute('data-svc-del'), el); }; });
    W.querySelectorAll('[data-svc-ied]').forEach(function (el) { el.onclick = function () { itemModal(ST.items.filter(function (x) { return String(x.id) === el.getAttribute('data-svc-ied'); })[0]); }; });
    W.querySelectorAll('[data-svc-idel]').forEach(function (el) { el.onclick = function () { delItem(el.getAttribute('data-svc-idel'), el); }; });
    W.querySelectorAll('[data-svc-ced]').forEach(function (el) { el.onclick = function () { codeModal((CODES.list || []).filter(function (x) { return String(x.id) === el.getAttribute('data-svc-ced'); })[0]); }; });
  }
  async function rpc(fn, extra, ok) {
    var args = Object.assign({ p_emp: ST.emp, p_month: ST.m, p_year: ST.y }, extra || {});
    var r = await sb.rpc(fn, args);
    if (r.error) { toast(errMsg(r.error), 'error'); return; }
    PAY.clear(); toast(ok); await refresh();
  }
  async function createPv() {
    var tot = (ST.basic || 0) + num(ST.mon && ST.mon.commission_total);
    if (!(tot > 0)) return toast(L('Amount must be greater than 0.', 'Amaun mesti lebih daripada 0.'), 'error');
    var co = ST.basic === null && ST.cfgRow && ST.cfgRow.pay_basis === 'commission_only';
    if (!confirm(co ? L('Create one Payment Voucher for ' + rm(tot) + ' (commission only) for ' + mlabel(ST.m, ST.y) + '?', 'Buat satu Baucar Bayaran ' + rm(tot) + ' (komisen sahaja) untuk ' + mlabel(ST.m, ST.y) + '?')
      : L('Create one Payment Voucher for ' + rm(tot) + ' (basic + commissions) for ' + mlabel(ST.m, ST.y) + '?', 'Buat satu Baucar Bayaran ' + rm(tot) + ' (asas + komisen) untuk ' + mlabel(ST.m, ST.y) + '?'))) return;
    var args = { p_emp: ST.emp, p_month: ST.m, p_year: ST.y };
    if (ST.v4 && S.ext.desc) { var dsc = S.ext.desc(ST); if (dsc) args.p_desc = dsc; }
    var r = await sb.rpc('svc_create_pv', args);
    if (r.error) {
      if (missing(r.error)) return toast(L('Run supabase/svc_commission_04.sql in Supabase first.', 'Jalankan supabase/svc_commission_04.sql di Supabase dahulu.'), 'error');
      return toast(errMsg(r.error), 'error');
    }
    PAY.clear();
    var d = r.data || {};
    toast(d.existing
      ? L('Payment Voucher already exists — opening it', 'Baucar Bayaran sudah wujud — dibuka')
      : L('Payment Voucher created', 'Baucar Bayaran dicipta') + (d.ref_no ? ' · ' + d.ref_no : ''));
    if (d.id) { openPage('vouchers', { view: 'pv-detail', id: d.id }); return; }
    await refresh();
  }
  async function saveMonth() {
    var ps = $('svc-ps'), pn = $('svc-pn'), bo = $('svc-bon');
    var v = ps && ps.value !== '' ? Number(ps.value) : 0;
    if (!(v >= 0)) { toast(L('Product sales must be 0 or more', 'Jualan produk mesti 0 atau lebih'), 'error'); return false; }
    var row = { product_sales: Math.round(v * 100) / 100, product_note: pn ? (pn.value || '').trim() || null : null, bonus_on: !!(bo && bo.checked) };
    var r = ST.mon ? await sb.from('svc_comm_months').update(row).eq('id', ST.mon.id).eq('tenant_id', tid())
      : await sb.from('svc_comm_months').insert(Object.assign({ tenant_id: tid(), employee_id: ST.emp, month: ST.m, year: ST.y }, row));
    if (r.error) { toast(errMsg(r.error), 'error'); return false; }
    return true;
  }
  async function saveSettings() {
    var n = function (id) { var v = val(id); return v === '' ? null : Number(v); };
    var rate = n('svc-s-rate'), cap = n('svc-s-cap'), pr = n('svc-s-pr'), bo = n('svc-s-bo');
    if (rate === null || !(rate >= 0 && rate <= 100) || pr === null || !(pr >= 0 && pr <= 100)) return toast(L('Rates must be between 0 and 100', 'Kadar mesti antara 0 dan 100'), 'error');
    if ((cap !== null && !(cap >= 0)) || bo === null || !(bo >= 0)) return toast(L('Amounts must be 0 or more', 'Amaun mesti 0 atau lebih'), 'error');
    var leads = val('svc-s-ld').toUpperCase().split(/[,\s]+/).filter(function (x) { return /^[A-Z0-9_]{1,16}$/.test(x); });
    var row = { enabled: !!($('svc-s-en') && $('svc-s-en').checked), pay_via_pv: !!($('svc-s-pv') && $('svc-s-pv').checked), pay_basis: val('svc-s-pb') || 'monthly_fixed', work_mode: val('svc-s-wm') || 'wfh',
      svc_rate_pct: rate, svc_cap: cap, eligible_status: val('svc-s-st') || 'NM', eligible_leads: leads, prod_rate_pct: pr, bonus_amount: bo, notes: val('svc-s-no') || null };
    if ($('svc-s-all')) row.svc_all = !!$('svc-s-all').checked;
    var r = ST.cfgRow ? await sb.from('svc_comm_settings').update(row).eq('id', ST.cfgRow.id).eq('tenant_id', tid())
      : await sb.from('svc_comm_settings').insert(Object.assign({ tenant_id: tid(), employee_id: ST.emp }, row));
    if (r.error) return toast(errMsg(r.error), 'error');
    toast(L('Scheme saved', 'Skim disimpan')); await refresh();
  }
  async function delLog(id, b) {
    if (!confirm(L('Delete this log?', 'Padam log ini?'))) return;
    await busy(b, (async function () {
      var r = await sb.from('svc_logs').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', tid());
      if (r.error) return toast(errMsg(r.error), 'error');
      toast(L('Log deleted', 'Log dipadam')); await refresh();
    })());
  }

  async function delItem(id, b) {
    if (!confirm(L('Delete this product item?', 'Padam item produk ini?'))) return;
    await busy(b, (async function () {
      var r = await sb.from('svc_product_logs').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', tid());
      if (r.error) return toast(errMsg(r.error), 'error');
      toast(L('Deleted', 'Dipadam')); await refresh();
    })());
  }
  function codeOpts(kind) { return (CODES.list || []).filter(function (x) { return x.kind === kind; }).map(function (x) { return '<option value="' + esc(x.code) + '">' + esc((x.name || x.code) + (x.default_price != null ? ' · ' + rm(x.default_price) : '')) + '</option>'; }).join(''); }
  // code typed → fill name / price if empty (never overwrites what HR typed)
  function autoFill(o, kind, codeId, nameId, priceId) {
    var ci = o.querySelector('#' + codeId); if (!ci) return;
    ci.addEventListener('change', function () {
      ci.value = String(ci.value || '').trim().toUpperCase(); var k = codeOf(kind, ci.value); if (!k) return;
      var ni = nameId && o.querySelector('#' + nameId), pi = priceId && o.querySelector('#' + priceId);
      if (ni && !ni.value) ni.value = k.name || k.code;
      if (pi && !pi.value && k.default_price != null) pi.value = k.default_price;
    });
  }
  var CODE_RX = /^[A-Z0-9][A-Z0-9 ._\/&+-]{0,23}$/;
  function itemModal(x) {
    x = x || {}; var r = monthRange(ST.m, ST.y), last = new Date(ST.y, ST.m, 0).getDate(), today = new Date();
    var d0 = x.log_date || (today.getMonth() + 1 === ST.m && today.getFullYear() === ST.y ? iso(ST.y, ST.m, today.getDate()) : r[0]);
    var body = '<div><label class="form-label" for="svc-i-d">' + esc(L('Date', 'Tarikh')) + '</label><input class="form-input" id="svc-i-d" type="date" min="' + r[0] + '" max="' + iso(ST.y, ST.m, last) + '" value="' + esc(String(d0).slice(0, 10)) + '"></div>' +
      '<div class="svc-grid"><div><label class="form-label" for="svc-i-c">' + esc(L('Code', 'Kod')) + '</label><input class="form-input" id="svc-i-c" maxlength="24" autocapitalize="characters" list="svc-dl-pc" value="' + esc(x.code || '') + '"><datalist id="svc-dl-pc">' + codeOpts('product') + '</datalist></div>' +
      '<div><label class="form-label" for="svc-i-n">' + esc(L('Product', 'Produk')) + '</label><input class="form-input" id="svc-i-n" maxlength="120" value="' + esc(x.name || '') + '"></div></div>' +
      '<div class="svc-grid"><div><label class="form-label" for="svc-i-q">' + esc(L('Qty', 'Kuantiti')) + '</label><input class="form-input" id="svc-i-q" type="number" min="1" step="1" inputmode="numeric" value="' + esc(x.qty || 1) + '"></div>' +
      '<div><label class="form-label" for="svc-i-a">' + esc(L('Amount (RM)', 'Amaun (RM)')) + '</label><input class="form-input" id="svc-i-a" type="number" min="0" step="0.01" inputmode="decimal" value="' + esc(x.amount == null ? '' : x.amount) + '"></div></div>' +
      '<div><label class="form-label" for="svc-i-no">' + esc(L('Notes', 'Nota')) + '</label><input class="form-input" id="svc-i-no" maxlength="300" value="' + esc(x.notes || '') + '"></div>' +
      '<div class="svc-hint">' + esc(L('Amount is the line total (qty × price). Without a code or name the item is marked "needs review" (still counted).', 'Amaun ialah jumlah baris (kuantiti × harga). Tanpa kod atau nama, item ditanda "perlu semak" (tetap dikira).')) + '</div>';
    var o = modal(x.id ? L('Edit product', 'Sunting produk') : L('Add product', 'Tambah produk'), body, L('Save', 'Simpan'), async function () {
      var d = val('svc-i-d'), c = val('svc-i-c').toUpperCase(), n = val('svc-i-n'), q = Number(val('svc-i-q') || 1), a = val('svc-i-a');
      if (!d || d < r[0] || d >= r[1]) { toast(L('Pick a date in ', 'Pilih tarikh dalam ') + mlabel(ST.m, ST.y), 'error'); return false; }
      if (c && !CODE_RX.test(c)) { toast(L('Code: letters/numbers only (max 24)', 'Kod: huruf/nombor sahaja (maks 24)'), 'error'); return false; }
      if (!(q >= 1) || Math.round(q) !== q) { toast(L('Qty must be 1 or more', 'Kuantiti mesti 1 atau lebih'), 'error'); return false; }
      if (a === '' || !(Number(a) >= 0)) { toast(L('Amount must be 0 or more', 'Amaun mesti 0 atau lebih'), 'error'); return false; }
      var row = { log_date: d, code: c || null, name: n ? n.slice(0, 120) : null, qty: q, amount: Math.round(Number(a) * 100) / 100, notes: val('svc-i-no') || null };
      var res = x.id ? await sb.from('svc_product_logs').update(row).eq('id', x.id).eq('tenant_id', tid())
        : await sb.from('svc_product_logs').insert(Object.assign({ tenant_id: tid(), employee_id: ST.emp, source: 'manual' }, row));
      if (res.error) { toast(errMsg(res.error), 'error'); return false; }
      toast(L('Saved', 'Disimpan')); await refresh(); return true;
    });
    autoFill(o, 'product', 'svc-i-c', 'svc-i-n', 'svc-i-a');
  }
  function codeModal(x) {
    x = x || {};
    var body = '<div class="svc-grid"><div><label class="form-label" for="svc-c-k">' + esc(L('Type', 'Jenis')) + '</label><select class="form-input" id="svc-c-k"><option value="service"' + (x.kind !== 'product' ? ' selected' : '') + '>' + esc(L('Service', 'Servis')) + '</option><option value="product"' + (x.kind === 'product' ? ' selected' : '') + '>' + esc(L('Product', 'Produk')) + '</option></select></div>' +
      '<div><label class="form-label" for="svc-c-c">' + esc(L('Code', 'Kod')) + '</label><input class="form-input" id="svc-c-c" maxlength="24" autocapitalize="characters" value="' + esc(x.code || '') + '"></div></div>' +
      '<div class="svc-grid"><div><label class="form-label" for="svc-c-n">' + esc(L('Name', 'Nama')) + '</label><input class="form-input" id="svc-c-n" maxlength="120" value="' + esc(x.name || '') + '"></div>' +
      '<div><label class="form-label" for="svc-c-p">' + esc(L('Price (RM)', 'Harga (RM)')) + '</label><input class="form-input" id="svc-c-p" type="number" min="0" step="0.01" inputmode="decimal" value="' + esc(x.default_price == null ? '' : x.default_price) + '"></div></div>' +
      (x.id ? '<div class="svc-act" style="margin-top:8px"><button type="button" class="btn btn-outline btn-sm" id="svc-c-del"><i class="ti ti-trash"></i> ' + esc(L('Delete', 'Padam')) + '</button></div>' : '');
    var o = modal(x.id ? L('Edit code', 'Sunting kod') : L('Add code', 'Tambah kod'), body, L('Save', 'Simpan'), async function () {
      var c = val('svc-c-c').toUpperCase(), p = val('svc-c-p');
      if (!CODE_RX.test(c)) { toast(L('Code: letters/numbers only (max 24)', 'Kod: huruf/nombor sahaja (maks 24)'), 'error'); return false; }
      if (p !== '' && !(Number(p) >= 0)) { toast(L('Price must be 0 or more', 'Harga mesti 0 atau lebih'), 'error'); return false; }
      var row = { kind: val('svc-c-k') === 'product' ? 'product' : 'service', code: c, name: val('svc-c-n') || null, default_price: p === '' ? null : Math.round(Number(p) * 100) / 100 };
      var res = x.id ? await sb.from('svc_price_codes').update(row).eq('id', x.id).eq('tenant_id', tid()) : await sb.from('svc_price_codes').insert(Object.assign({ tenant_id: tid() }, row));
      if (res.error) { toast(errMsg(res.error), 'error'); return false; }
      CODES.t = null; toast(L('Saved', 'Disimpan')); await refresh(); return true;
    });
    var del = o.querySelector('#svc-c-del');
    if (del) del.onclick = async function () {
      if (!confirm(L('Delete this code? Existing logs keep their code.', 'Padam kod ini? Log sedia ada kekal dengan kod.'))) return;
      var res = await sb.from('svc_price_codes').update({ deleted_at: new Date().toISOString() }).eq('id', x.id).eq('tenant_id', tid());
      if (res.error) return toast(errMsg(res.error), 'error');
      o.remove(); CODES.t = null; toast(L('Deleted', 'Dipadam')); await refresh();
    };
  }

  /* ---------- modals ---------- */
  function modal(title, body, okLbl, onOk) {
    var o = document.createElement('div'); o.className = 'modal-overlay active svc-modal';
    o.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true"><div class="modal-box-header">' + esc(title) + '</div><div class="modal-box-body">' + body + '</div>' +
      '<div class="modal-box-footer" style="justify-content:flex-end;flex-wrap:wrap"><button type="button" class="btn btn-outline btn-sm" data-x style="white-space:nowrap">' + esc(L('Cancel', 'Batal')) + '</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-ok style="white-space:nowrap">' + esc(okLbl) + '</button></div></div>';
    var close = function () { o.remove(); };
    o.addEventListener('click', function (e) { if (e.target === o) close(); });
    o.querySelector('[data-x]').onclick = close;
    var ok = o.querySelector('[data-ok]');
    ok.onclick = function () { ok.disabled = true; Promise.resolve(onOk(o)).then(function (done) { if (done) close(); else ok.disabled = false; }, function (e) { ok.disabled = false; toast(errMsg(e), 'error'); }); };
    document.body.appendChild(o); var f = o.querySelector('input,select,textarea'); if (f) try { f.focus(); } catch (e) {}
    return o;
  }
  function editModal(x) {
    x = x || {}; var r = monthRange(ST.m, ST.y), today = new Date(), d0 = x.log_date || (today.getMonth() + 1 === ST.m && today.getFullYear() === ST.y ? iso(ST.y, ST.m, today.getDate()) : r[0]);
    var leads = ST.cfg.eligible_leads.slice(); if (x.lead_source && leads.indexOf(x.lead_source) < 0) leads.push(x.lead_source);
    var last = new Date(ST.y, ST.m, 0).getDate();
    var body = '<div><label class="form-label" for="svc-f-d">' + esc(L('Date', 'Tarikh')) + '</label><input class="form-input" id="svc-f-d" type="date" min="' + r[0] + '" max="' + iso(ST.y, ST.m, last) + '" value="' + esc(String(d0).slice(0, 10)) + '"></div>' +
      (ST.v4 ? '<div><label class="form-label" for="svc-f-c">' + esc(L('Code', 'Kod')) + '</label><input class="form-input" id="svc-f-c" maxlength="24" autocapitalize="characters" list="svc-dl-sc" value="' + esc(x.code || '') + '"><datalist id="svc-dl-sc">' + codeOpts('service') + '</datalist></div>' : '') +
      '<div><label class="form-label" for="svc-f-s">' + esc(L('Service', 'Servis')) + '</label><input class="form-input" id="svc-f-s" maxlength="120" value="' + esc(x.service || '') + '" placeholder="' + esc(L('e.g. HAIRCUT', 'cth. HAIRCUT')) + '" list="svc-dl"><datalist id="svc-dl">' +
      uniq(ST.logs.map(function (l) { return l.service; })).slice(0, 40).map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist></div>' +
      '<div class="svc-grid"><div><label class="form-label" for="svc-f-p">' + esc(L('Price (RM)', 'Harga (RM)')) + '</label><input class="form-input" id="svc-f-p" type="number" min="0" step="0.01" inputmode="decimal" value="' + esc(x.price == null ? '' : x.price) + '"></div>' +
      '<div><label class="form-label" for="svc-f-st">' + esc(L('Client', 'Pelanggan')) + '</label><select class="form-input" id="svc-f-st"><option value="">—</option><option value="NM"' + (x.client_status === 'NM' ? ' selected' : '') + '>' + esc(L('NM (new)', 'NM (baru)')) + '</option><option value="M"' + (x.client_status === 'M' ? ' selected' : '') + '>' + esc(L('M (member)', 'M (ahli)')) + '</option></select></div>' +
      '<div><label class="form-label" for="svc-f-l">Lead</label><select class="form-input" id="svc-f-l"><option value="">—</option>' + leads.map(function (l) { return '<option' + (l === x.lead_source ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '<option value="OTHER"' + (x.lead_source === 'OTHER' ? ' selected' : '') + '>' + esc(L('Other', 'Lain')) + '</option></select></div></div>' +
      '<div><label class="form-label" for="svc-f-n">' + esc(L('Notes', 'Nota')) + '</label><input class="form-input" id="svc-f-n" maxlength="300" value="' + esc(x.notes || '') + '"></div>' +
      '<div class="svc-hint">' + (ST.cfg.svc_all ? esc(L('All services with a price earn commission. No code = "needs review".', 'Semua servis yang ada harga dapat komisen. Tiada kod = "perlu semak".'))
        : esc(L('Commission counts only for ', 'Komisen dikira hanya untuk ')) + esc(ST.cfg.eligible_status + ' + ' + ST.cfg.eligible_leads.join('/')) + esc(L(' with a price.', ' yang ada harga.'))) + '</div>';
    var mo = modal(x.id ? L('Edit service log', 'Sunting log servis') : L('Add service log', 'Tambah log servis'), body, L('Save', 'Simpan'), async function () {
      var d = val('svc-f-d'), s = val('svc-f-s'), p = val('svc-f-p'), cd = $('svc-f-c') ? val('svc-f-c').toUpperCase() : undefined;
      if (cd && !CODE_RX.test(cd)) { toast(L('Code: letters/numbers only (max 24)', 'Kod: huruf/nombor sahaja (maks 24)'), 'error'); return false; }
      if (!s && cd) s = (codeOf('service', cd) || {}).name || cd;
      if (!d || d < r[0] || d >= r[1]) { toast(L('Pick a date in ', 'Pilih tarikh dalam ') + mlabel(ST.m, ST.y), 'error'); return false; }
      if (!s) { toast(L('Service is required', 'Servis diperlukan'), 'error'); return false; }
      if (p !== '' && !(Number(p) >= 0)) { toast(L('Price must be 0 or more', 'Harga mesti 0 atau lebih'), 'error'); return false; }
      var row = { log_date: d, service: s.slice(0, 120), price: p === '' ? null : Math.round(Number(p) * 100) / 100, client_status: val('svc-f-st') || null, lead_source: val('svc-f-l') || null, notes: val('svc-f-n') || null };
      if (cd !== undefined) row.code = cd || null;
      if (!x.id || String(x.log_date).slice(0, 10) !== d) row.week_no = null;
      var q = x.id ? sb.from('svc_logs').update(row).eq('id', x.id).eq('tenant_id', tid())
        : sb.from('svc_logs').insert(Object.assign({ tenant_id: tid(), employee_id: ST.emp, source: 'manual' }, row));
      var res = await q; if (res.error) { toast(errMsg(res.error), 'error'); return false; }
      toast(L('Saved', 'Disimpan')); await refresh(); return true;
    });
    autoFill(mo, 'service', 'svc-f-c', 'svc-f-s', 'svc-f-p');
  }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { x = String(x || '').trim(); if (x && !s[x]) { s[x] = 1; o.push(x); } }); return o; }
  /* CSV / sheet paste: date, service, price, status, lead — date may be blank (carries forward), D/M, D/M/YYYY or YYYY-MM-DD */
  S.parseCsv = function (text, m, y) {
    var out = [], bad = [], lastD = null, last = new Date(y, m, 0).getDate();
    String(text || '').split(/\r?\n/).forEach(function (line, i) {
      if (!line.trim()) return;
      var c = line.indexOf('\t') >= 0 ? line.split('\t') : line.split(/[,;]/);
      c = c.map(function (x) { return String(x || '').trim().replace(/^"|"$/g, ''); });
      if (i === 0 && /date|tarikh/i.test(c[0]) && /serv/i.test(c[1] || '')) return;
      var ds = c[0], d = null, mm;
      if (!ds) d = lastD;
      else if ((mm = ds.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) d = (+mm[1] === y && +mm[2] === m) ? +mm[3] : -1;
      else if ((mm = ds.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/))) { var yy = mm[3] ? (+mm[3] < 100 ? 2000 + +mm[3] : +mm[3]) : y; d = (+mm[2] === m && yy === y) ? +mm[1] : -1; }
      else if (/^\d{1,2}$/.test(ds)) d = +ds;
      else d = -1;
      var svc = (c[1] || '').toUpperCase().slice(0, 120), pr = (c[2] || '').replace(/^RM\s*/i, '').replace(/,/g, ''), st = (c[3] || '').toUpperCase(), ld = (c[4] || '').toUpperCase();
      if (!d || d < 1 || d > last || !svc || (pr && !(Number(pr) >= 0)) || (st && st !== 'M' && st !== 'NM') || (ld && !/^[A-Z0-9_]{1,16}$/.test(ld))) { bad.push(i + 1); return; }
      lastD = d;
      out.push({ log_date: iso(y, m, d), service: svc, price: pr === '' ? null : Math.round(Number(pr) * 100) / 100, client_status: st || null, lead_source: ld || null });
    });
    return { rows: out, bad: bad };
  };
  function importModal(prefill) {
    var body = '<div class="svc-hint" style="margin:0">' + esc(L('One row per line: date, service, price, status (M/NM), lead (TT/ADS). Blank date = same as the row above. Copy straight from the sheet (tabs work too).', 'Satu baris setiap log: tarikh, servis, harga, status (M/NM), lead (TT/ADS). Tarikh kosong = sama dengan baris atas. Boleh salin terus dari sheet (tab pun boleh).')) + '</div>' +
      '<textarea class="form-input" id="svc-csv" placeholder="1/' + ST.m + ',HAIRCUT,25,NM,TT&#10;,SCALP + KERATIN,180,M,">' + esc(prefill || '') + '</textarea><div class="svc-hint" id="svc-csv-p" style="margin:0"></div>';
    var o = modal(L('Paste service logs', 'Tampal log servis'), body, L('Import', 'Import'), async function () {
      var p = S.parseCsv(val('svc-csv'), ST.m, ST.y);
      if (p.bad.length) { toast(L('Fix line(s) ', 'Betulkan baris ') + p.bad.join(', '), 'error'); return false; }
      if (!p.rows.length) { toast(L('Nothing to import', 'Tiada untuk diimport'), 'error'); return false; }
      var rows = p.rows.map(function (x) { return Object.assign({ tenant_id: tid(), employee_id: ST.emp, source: 'import' }, x); });
      var res = await sb.from('svc_logs').insert(rows); if (res.error) { toast(errMsg(res.error), 'error'); return false; }
      toast(L(rows.length + ' logs imported', rows.length + ' log diimport')); await refresh(); return true;
    });
    var ta = o.querySelector('#svc-csv'), pv = o.querySelector('#svc-csv-p');
    ta.oninput = function () { var p = S.parseCsv(ta.value, ST.m, ST.y), c = S.calc(p.rows, ST.cfgRow || {}, {}); pv.textContent = L(p.rows.length + ' ok · ' + c.heads + ' NM heads · ' + rm(c.svc_commission), p.rows.length + ' ok · ' + c.heads + ' kepala NM · ' + rm(c.svc_commission)) + (p.bad.length ? L(' · bad lines: ', ' · baris salah: ') + p.bad.join(', ') : ''); };
    if (prefill) ta.oninput();
  }

  /* ---------- AI "Import from doc": Excel/CSV/PDF/photo of a service-log sheet -> ai-proxy
     action doc_to_svc_logs -> fills the Paste CSV textarea above (still goes through the same
     S.parseCsv validation and explicit Import click — nothing is saved by the AI step itself). */
  var xlsxLoading = null;
  function loadXlsx() {
    if (window.XLSX && window.XLSX.read) return Promise.resolve(window.XLSX);
    if (xlsxLoading) return xlsxLoading;
    xlsxLoading = new Promise(function (ok, no) {
      var el = document.createElement('script'); el.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'; el.async = true;
      var to = setTimeout(function () { no(new Error('timeout')); }, 20000);
      el.onload = function () { clearTimeout(to); window.XLSX ? ok(window.XLSX) : no(new Error('no XLSX')); };
      el.onerror = function () { clearTimeout(to); no(new Error('load')); };
      document.head.appendChild(el);
    }).catch(function (e) { xlsxLoading = null; throw e; });
    return xlsxLoading;
  }
  async function sheetToText(file) {
    var X = await loadXlsx(), buf = await file.arrayBuffer(), isCsv = /\.(csv|txt)$/i.test(file.name || '');
    var wb = isCsv ? X.read(new TextDecoder('utf-8').decode(buf).replace(/^﻿/, ''), { type: 'string', raw: true })
      : X.read(buf, { type: 'array', cellDates: true });
    var lines = [];
    wb.SheetNames.forEach(function (name) {
      var rows = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '' });
      lines.push('--- ' + file.name + ' · ' + name + ' ---');
      rows.forEach(function (r) {
        var vals = r.map(function (v) { return v == null ? '' : String(v); });
        if (vals.some(function (v) { return v.trim(); })) lines.push(vals.join('\t'));
      });
    });
    return lines.join('\n');
  }
  /* Deterministic sheet layout (no AI): header row DATE | PRODUK | RM | SERVICE | RM (any columns, any order), date
     carries down, stops at TOTAL. Product cell = code if it looks like one, else a name. Blank code/name rows are kept
     and marked "needs review". Returns null when the sheet has no such header. */
  function cellDate(v, m, y) {
    if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) { var t = new Date(v.getTime() + 12 * 3600e3); return t.getFullYear() === y && t.getMonth() + 1 === m ? t.getDate() : -1; }
    var s = String(v == null ? '' : v).trim(), mm; if (!s) return 0;
    if ((mm = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return (+mm[1] === y && +mm[2] === m) ? +mm[3] : -1;
    if ((mm = s.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/))) { var yy = mm[3] ? (+mm[3] < 100 ? 2000 + +mm[3] : +mm[3]) : y; return (+mm[2] === m && yy === y) ? +mm[1] : -1; }
    return null;
  }
  function amt(v) { if (v == null || v === '') return null; var n = typeof v === 'number' ? v : Number(String(v).replace(/^RM\s*/i, '').replace(/,/g, '')); return isFinite(n) ? Math.round(n * 100) / 100 : NaN; }
  S.parseSheet = function (rows, m, y) {
    var H = null, hi = -1, U = function (v) { return String(v == null ? '' : v).trim().toUpperCase(); };
    for (var i = 0; i < Math.min(rows.length, 15) && !H; i++) {
      var r = rows[i] || [], dc = -1, pc = -1, sc = -1;
      r.forEach(function (v, j) { var u = U(v); if (dc < 0 && /^(DATE|TARIKH)$/.test(u)) dc = j; else if (pc < 0 && /^(PRODUK|PRODUCT|PRODUCTS)$/.test(u)) pc = j; else if (sc < 0 && /^(SERVICE|SERVIS|SERVICES)$/.test(u)) sc = j; });
      if (dc >= 0 && sc >= 0) { H = { d: dc, p: pc, s: sc }; hi = i; }
    }
    if (!H) return null;
    var last = new Date(y, m, 0).getDate(), d = null, svc = [], prod = [], bad = [];
    for (var k = hi + 1; k < rows.length; k++) {
      var r2 = rows[k] || [], dv = r2[H.d];
      if (/^TOTAL/.test(U(dv)) || /^TOTAL/.test(U(r2[H.s])) || (H.p >= 0 && /^TOTAL/.test(U(r2[H.p])))) break;
      var nd = cellDate(dv, m, y);
      if (nd === -1 || (nd && (nd < 1 || nd > last))) { bad.push(k + 1); continue; }
      if (nd) d = nd;
      if (H.p >= 0) {
        var pt = String(r2[H.p] == null ? '' : r2[H.p]).trim(), pa = amt(r2[H.p + 1]);
        if (pt || pa !== null) {
          if (!d || pa === null || isNaN(pa) || pa < 0) bad.push(k + 1);
          else { var pu = pt.toUpperCase(), isCode = CODE_RX.test(pu) && (codeOf('product', pu) || !/\s/.test(pu)); prod.push({ log_date: iso(y, m, d), code: pt && isCode ? pu : null, name: pt && !isCode ? pt.slice(0, 120) : null, qty: 1, amount: pa }); }
        }
      }
      var st = String(r2[H.s] == null ? '' : r2[H.s]).trim(), sa = amt(r2[H.s + 1]);
      if (st || sa !== null) {
        if (!d || (sa !== null && (isNaN(sa) || sa < 0))) bad.push(k + 1);
        else { var su = st.toUpperCase(); svc.push({ log_date: iso(y, m, d), service: su ? su.slice(0, 120) : '—', code: su && CODE_RX.test(su) ? su : null, price: sa }); }
      }
    }
    return { svc: svc, prod: prod, bad: bad };
  };
  async function readBook(file) {
    var X = await loadXlsx(), buf = await file.arrayBuffer(), isCsv = /\.(csv|txt)$/i.test(file.name || '');
    var wb = isCsv ? X.read(new TextDecoder('utf-8').decode(buf).replace(/^\ufeff/, ''), { type: 'string', raw: true }) : X.read(buf, { type: 'array', cellDates: true });
    return wb.SheetNames.map(function (n) { return { name: n, rows: X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) }; });
  }
  function sheetImportModal(file, sheets) {
    var ok = sheets.map(function (sh) { return { name: sh.name, p: S.parseSheet(sh.rows, ST.m, ST.y) }; }).filter(function (x) { return x.p && (x.p.svc.length || x.p.prod.length); });
    if (!ok.length) return false;
    var en = String(empName() || '').toUpperCase(), pre = 0;
    ok.forEach(function (x, i) { var n = String(x.name).trim().toUpperCase(); if (n && en.indexOf(n) >= 0) pre = i; });
    var body = '<div><label class="form-label" for="svc-sh">' + esc(L('Sheet', 'Helaian')) + '</label><select class="form-input" id="svc-sh">' + ok.map(function (x, i) { return '<option value="' + i + '"' + (i === pre ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="svc-hint" id="svc-sh-p"></div>' +
      (S.ext.attach ? '<label class="svc-tog" style="margin-top:6px"><input type="checkbox" id="svc-sh-att" checked> ' + esc(L('Attach the source file to this month', 'Lampirkan fail asal pada bulan ini')) + '</label>' : '') +
      ((ST.logs.length || ST.items.length) ? '<div class="svc-hint" style="color:var(--warning)"><i class="ti ti-alert-triangle"></i> ' + esc(L('This month already has ' + ST.logs.length + ' logs / ' + ST.items.length + ' products — import adds more.', 'Bulan ini sudah ada ' + ST.logs.length + ' log / ' + ST.items.length + ' produk — import akan tambah lagi.')) + '</div>' : '');
    var cur = function (o) { return ok[Number(o.querySelector('#svc-sh').value) || 0].p; };
    var o = modal(L('Import from doc', 'Import dari dokumen') + ' · ' + mlabel(ST.m, ST.y), body, L('Import', 'Import'), async function (ov) {
      var p = cur(ov);
      if (p.bad.length) { toast(L('Fix line(s) ', 'Betulkan baris ') + p.bad.join(', '), 'error'); return false; }
      var base = { tenant_id: tid(), employee_id: ST.emp, source: 'import' };
      if (p.svc.length) { var r1 = await sb.from('svc_logs').insert(p.svc.map(function (x) { return Object.assign({}, base, x); })); if (r1.error) { toast(errMsg(r1.error), 'error'); return false; } }
      if (p.prod.length) { var r2 = await sb.from('svc_product_logs').insert(p.prod.map(function (x) { return Object.assign({}, base, x); })); if (r2.error) { toast(errMsg(r2.error), 'error'); await refresh(); return false; } }
      var att = ov.querySelector('#svc-sh-att');
      if (att && att.checked && S.ext.attach) { try { await S.ext.attach(file); } catch (e) { console.warn('[svc] attach', e); } }
      toast(L(p.svc.length + ' logs + ' + p.prod.length + ' products imported', p.svc.length + ' log + ' + p.prod.length + ' produk diimport')); await refresh(); return true;
    });
    var sel = o.querySelector('#svc-sh'), pv = o.querySelector('#svc-sh-p');
    var show = function () {
      var p = cur(o), c = S.calc(p.svc, ST.cfgRow || {}, { items: p.prod });
      pv.textContent = L(p.svc.length + ' services · ' + rm(p.svc.reduce(function (a, x) { return a + num(x.price); }, 0)) + ' → ' + rm(c.svc_commission) + ' | ' + p.prod.length + ' products · ' + rm(c.product_sales) + ' → ' + rm(c.prod_commission) + ' | total ' + rm(c.commission_total) + (c.review ? ' · ' + c.review + ' need review' : ''),
        p.svc.length + ' servis · ' + rm(p.svc.reduce(function (a, x) { return a + num(x.price); }, 0)) + ' → ' + rm(c.svc_commission) + ' | ' + p.prod.length + ' produk · ' + rm(c.product_sales) + ' → ' + rm(c.prod_commission) + ' | jumlah ' + rm(c.commission_total) + (c.review ? ' · ' + c.review + ' perlu semak' : '')) +
        (p.bad.length ? L(' · bad lines: ', ' · baris salah: ') + p.bad.join(', ') : '');
    };
    sel.onchange = show; show();
    return true;
  }
  function isSheet(f) { return /\.(xlsx|xls|csv|txt)$/i.test(f.name || ''); }
  function isPdfFile(f) { return /pdf/i.test(f.type || '') || /\.pdf$/i.test(f.name || ''); }
  function isImgFile(f) { return /^image\//i.test(f.type || '') || /\.(png|jpe?g|webp|heic)$/i.test(f.name || ''); }
  async function readAiFiles(files, status) {
    var text = [], images = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (isSheet(f)) { status(L('Reading sheet: ', 'Membaca helaian: ') + f.name); text.push(await sheetToText(f)); }
      else if (isPdfFile(f)) {
        status(L('Reading PDF: ', 'Membaca PDF: ') + f.name);
        if (typeof _loadPdfJs !== 'function') throw new Error(L('PDF reader is not available on this page.', 'Pembaca PDF tiada pada halaman ini.'));
        var lib = await _loadPdfJs(), pdf = await lib.getDocument({ data: await f.arrayBuffer() }).promise;
        for (var p = 1; p <= Math.min(pdf.numPages, 20); p++) {
          var page = await pdf.getPage(p), tc = await page.getTextContent();
          var s = tc.items.map(function (it) { return it.str; }).join(' ').replace(/\s+/g, ' ').trim();
          if (s.length >= 20) { text.push('--- ' + f.name + ' · page ' + p + ' ---\n' + s); continue; }
          if (images.length >= 5) continue;
          var vp = page.getViewport({ scale: 1 }), sc = Math.min(2, 1280 / vp.width), v2 = page.getViewport({ scale: sc });
          var cv = document.createElement('canvas'); cv.width = Math.round(v2.width); cv.height = Math.round(v2.height);
          await page.render({ canvasContext: cv.getContext('2d'), viewport: v2 }).promise;
          var u = cv.toDataURL('image/jpeg', 0.7); images.push({ base64: u.split(',')[1], mime: 'image/jpeg' });
        }
      } else if (isImgFile(f)) {
        if (images.length >= 5) continue;
        status(L('Preparing photo: ', 'Sedia gambar: ') + f.name);
        if (typeof _compressImageToBase64 !== 'function') throw new Error(L('Image reader is not available on this page.', 'Pembaca gambar tiada pada halaman ini.'));
        var im = await _compressImageToBase64(f); images.push({ base64: im.base64, mime: im.mimeType || 'image/jpeg' });
      }
    }
    return { text: text.join('\n\n'), images: images };
  }
  function aiImportModal() {
    if (typeof _invokeAiProxy !== 'function') { toast(L('AI is not available on this page.', 'AI tiada pada halaman ini.'), 'error'); return; }
    var files = [];
    var body = '<div class="svc-hint" style="margin:0">' + esc(L('Upload an Excel/CSV sheet, PDF, or a photo of the service log. AI reads it and fills the Paste CSV box — nothing is saved until you review and press Import there.', 'Muat naik helaian Excel/CSV, PDF, atau gambar log servis. AI baca dan isi kotak Tampal CSV — tiada apa disimpan sehingga kau semak dan tekan Import di situ.')) + '</div>' +
      '<div class="svc-act" style="margin-top:8px"><label class="btn btn-outline btn-sm" style="cursor:pointer;white-space:nowrap"><i class="ti ti-upload"></i> ' + esc(L('Choose file', 'Pilih fail')) + '<input type="file" id="svc-ai-f" accept=".xlsx,.xls,.csv,.pdf,image/*" style="display:none"></label>' +
      '<label class="btn btn-outline btn-sm" style="cursor:pointer;white-space:nowrap"><i class="ti ti-camera"></i> ' + esc(L('Take photo', 'Ambil gambar')) + '<input type="file" id="svc-ai-cam" accept="image/*" capture="environment" style="display:none"></label></div>' +
      '<div class="svc-hint" id="svc-ai-fn" style="margin-top:6px"></div>';
    var o = modal(L('Import from doc', 'Import dari dokumen'), body, L('Read document', 'Baca dokumen'), async function (ov) {
      if (!files.length) { toast(L('Choose a file first', 'Pilih fail dahulu'), 'error'); return false; }
      if (ST.v4 && isSheet(files[0])) {
        try { var book = await readBook(files[0]); if (sheetImportModal(files[0], book)) return true; } catch (e) { console.warn('[svc] sheet parse', e); }
      }
      var fn = ov.querySelector('#svc-ai-fn');
      var setMsg = function (m) { if (fn) fn.textContent = m; };
      var got;
      try {
        setMsg(L('Reading document…', 'Membaca dokumen…'));
        got = await readAiFiles(files, setMsg);
      } catch (e) { toast(errMsg(e), 'error'); setMsg(''); return false; }
      if (!got.text.trim() && !got.images.length) { toast(L('No readable text or image found in this file.', 'Tiada teks atau gambar yang boleh dibaca dalam fail ini.'), 'error'); setMsg(''); return false; }
      setMsg(L('AI is reading the logs… (10-40 seconds)', 'AI sedang baca log… (10-40 saat)'));
      var res = await _invokeAiProxy({ action: 'doc_to_svc_logs', language: bm() ? 'bm' : 'en', text: got.text, images: got.images, month: ST.m, year: ST.y, file_names: files.map(function (f) { return f.name; }) });
      var payload = res && res.data && res.data.success ? res.data.data : null;
      if (!payload) { toast((res && res.data && res.data.error) || (res && res.error && res.error.message) || L('AI did not return any data.', 'AI tidak pulangkan data.'), 'error'); setMsg(''); return false; }
      if (!payload.logs || !payload.logs.length) { toast(L('AI found no service rows in this document.', 'AI tidak jumpa baris servis dalam dokumen ini.'), 'error'); setMsg(''); return false; }
      var csv = payload.logs.map(function (r) { return [r.log_date, r.service, r.price == null ? '' : r.price, r.client_status || '', r.lead_source || ''].join(','); }).join('\n');
      if (payload.product_sales != null && ST.hr && !locked()) {
        var ps = $('svc-ps'), pn = $('svc-pn');
        if (ps && !ps.value) ps.value = payload.product_sales;
        if (pn && !pn.value && payload.product_note) pn.value = payload.product_note;
      }
      toast(L(payload.logs.length + ' row(s) read — review before importing', payload.logs.length + ' baris dibaca — semak sebelum import'));
      importModal(csv);
      return true;
    });
    var pick = function (list) { if (list && list[0]) { files = [list[0]]; var fn = o.querySelector('#svc-ai-fn'); if (fn) fn.textContent = list[0].name; } };
    o.querySelector('#svc-ai-f').onchange = function () { pick(this.files); };
    o.querySelector('#svc-ai-cam').onchange = function () { pick(this.files); };
  }

  /* ---------- signatures + WhatsApp share (same concept as SD: sd-signatures.js / sd_signatures_01.sql) ----------
     Roles per employee-month: prepared (staff, after Submit) + approved (Owner/HR, after Approve). In-app draw pad or
     WhatsApp link → public-svc.html?svc_sign=<token>. Shared WAD sheet (wa-doc-core/sheet) logs to doc_shares. */
  var SG = { ready: true, rows: {}, imgs: {}, link: {} };
  S._sig = SG;
  var ROLES = [{ r: 'prepared', en: 'Prepared by', bm: 'Disediakan oleh', col: 'prepared_by_name' }, { r: 'approved', en: 'Approved by', bm: 'Diluluskan oleh', col: 'approved_by_name' }];
  function roleOf(r) { return ROLES.filter(function (x) { return x.r === r; })[0] || ROLES[0]; }
  function sigN() { return ROLES.filter(function (x) { return !!SG.rows[x.r]; }).length; }
  /* free-text names per slot (like SD's name inputs): svc_comm_months.prepared_by_name / approved_by_name via svc_sign_names
     (svc_commission_03.sql); before that SQL is run they are kept on this device only. Who may SIGN is unchanged. */
  SG.names = {}; SG.namesDb = true; SG.nmT = null; SG.nmKey = '';
  function meName() { try { return String(APP.user.name || APP.user.full_name || '').trim(); } catch (e) { return ''; } }
  function nmLsKey() { return 'svc-signame:' + tid() + ':' + ST.emp + ':' + ST.y + '-' + ST.m; }
  function canName(role) { return SG.ready && !SG.rows[role] && (ST.hr || (role === 'prepared' && isSelfEmp())); }
  function loadNames() {
    var key = nmLsKey(); if (SG.nmKey === key) return; SG.nmKey = key;
    var mon = ST.mon || {}, ls = {}; try { ls = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) {}
    SG.names = {};
    ROLES.forEach(function (x) {
      var v = mon[x.col] != null && mon[x.col] !== '' ? mon[x.col] : ls[x.r];
      if (v == null) v = x.r === 'prepared' ? empName() : (ST.hr ? meName() : '');
      SG.names[x.r] = String(v || '');
    });
  }
  // the name shown / passed for a slot: signed name wins, else what was typed
  function slotName(role) { var g = SG.rows[role]; if (g) return g.signer_name || ''; loadNames(); return String(SG.names[role] || '').trim(); }
  function saveNames(now) {
    try { localStorage.setItem(nmLsKey(), JSON.stringify(SG.names)); } catch (e) {}
    clearTimeout(SG.nmT);
    var run = function () {
      if (!SG.namesDb || !(ST.hr || isSelfEmp())) return Promise.resolve();
      var a = Object.assign(base(), { p_prepared: canName('prepared') ? String(SG.names.prepared || '') : null, p_approved: ST.hr && canName('approved') ? String(SG.names.approved || '') : null });
      if (a.p_prepared === null && a.p_approved === null) return Promise.resolve();
      return Promise.resolve(sb.rpc('svc_sign_names', a)).then(function (r) {
        if (r && r.error) { if (missing(r.error) || /svc_sign_names/i.test(String(r.error.message || ''))) SG.namesDb = false; else console.warn('[svc] names', r.error); return; }
        SG.dirtyKey = '';
        var d = r && r.data; if (d && ST.mon && String(ST.mon.id) === String(d.month_id)) { ST.mon.prepared_by_name = d.prepared_by_name; ST.mon.approved_by_name = d.approved_by_name; }
        else if (d && !ST.mon) ST.mon = { id: d.month_id, status: 'draft', prepared_by_name: d.prepared_by_name, approved_by_name: d.approved_by_name };
      }, function (e) { console.warn('[svc] names', e); });
    };
    if (now) return run();
    SG.nmT = setTimeout(run, 700); return Promise.resolve();
  }
  function setName(role, v) { loadNames(); SG.names[role] = String(v || '').slice(0, 120); SG.dirtyKey = nmLsKey(); }
  function isSelfEmp() { return !!(ST.self && String(ST.self.id) === String(ST.emp)); }
  function stNow() { return (ST.mon && ST.mon.status) || 'draft'; }
  function gateOk(role) { var s = stNow(); return role === 'prepared' ? (s === 'submitted' || s === 'approved') : s === 'approved'; }
  // can this user sign this slot in the app? prepared: the staff member or Owner/HR; approved: Owner/HR only
  function canSign(role) {
    if (!SG.ready || SG.rows[role]) return false;
    if (role === 'prepared') return (isSelfEmp() || ST.hr) && (gateOk('prepared') || stNow() === 'draft');
    return ST.hr && gateOk('approved');
  }
  function sigErr(e) {
    var m = String((e && (e.message || e.details)) || e || '');
    if (/Submit the month first/i.test(m)) return L('Submit the month first.', 'Hantar bulan ini dahulu.');
    if (/Approve the month first/i.test(m)) return L('Approve the month first.', 'Luluskan bulan ini dahulu.');
    if (/already signed/i.test(m)) return L('This slot is already signed.', 'Slot ini sudah ditandatangani.');
    if (/Only HR managers/i.test(m)) return L('Only Owner/HR can do this.', 'Hanya Owner/HR boleh buat ini.');
    return errMsg(e);
  }
  async function loadSigs() {
    SG.rows = {}; if (SG.dirtyKey !== nmLsKey()) SG.nmKey = '';
    var mid = ST.mon && ST.mon.id;
    var r = await sb.from('svc_signatures').select('id,role,signer_name,signed_at,signed_via,storage_path').eq('tenant_id', tid())
      .eq('month_id', mid || '00000000-0000-0000-0000-000000000000').is('voided_at', null);
    if (r.error) { SG.ready = !missing(r.error); if (SG.ready) console.warn('[svc] signatures', r.error); return; }
    SG.ready = true; (r.data || []).forEach(function (x) { SG.rows[x.role] = x; });
  }
  // drawn PNGs → data: URLs (also used by the A4 statement / PDF); same approach as sd-signatures.js loadImgs()
  function loadImgs() {
    var need = ROLES.map(function (x) { return SG.rows[x.r]; }).filter(function (g) { return g && g.storage_path && !SG.imgs[g.storage_path]; }).map(function (g) { return g.storage_path; });
    if (!need.length) return Promise.resolve();
    return Promise.resolve(sb.storage.from('doc-files').createSignedUrls(need, 600)).then(function (r) {
      return Promise.all(((r && r.data) || []).map(function (u, i) {
        var p = need[i]; if (!u || !u.signedUrl) return null;
        return fetch(u.signedUrl).then(function (x) { return x.blob(); }).then(function (bl) {
          return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(''); }; fr.readAsDataURL(bl); });
        }).then(function (d) {
          if (!d) return; SG.imgs[p] = d;
          document.querySelectorAll('[data-svc-sigimg]').forEach(function (im) { var g = SG.rows[im.getAttribute('data-svc-sigimg')]; if (g && g.storage_path === p) { im.src = d; im.hidden = false; } });
        }, function () {});
      }));
    }, function () {});
  }
  function sigChip() {
    if (!SG.ready) return '';
    var n = sigN();
    if (n >= 2) return '<span class="svc-chip ok"><i class="ti ti-signature"></i>&nbsp;' + esc(L('Signed 2/2', 'Ditandatangani 2/2')) + '</span>';
    if (stNow() === 'draft' && !n) return '';
    return '<span class="svc-chip w"><i class="ti ti-signature"></i>&nbsp;' + esc(L('Pending signature ', 'Menunggu tandatangan ')) + n + '/2</span>';
  }
  function viaText(v) { return v === 'link' ? L('via WhatsApp link', 'melalui pautan WhatsApp') : L('in app', 'dalam aplikasi'); }
  function sigCard() {
    loadNames();
    var st = stNow(), self = isSelfEmp(), h = '<div class="svc-card" id="svc-sig"><div class="svc-hd"><span><i class="ti ti-signature"></i> ' + esc(L('Signatures', 'Tandatangan')) + '</span><span class="m">' + sigChip() + '</span></div>';
    if (!SG.ready) return h + '<div class="svc-body svc-hint" style="margin:0">' + esc(ST.hr ? L('Signatures & WhatsApp share are not set up yet. Run supabase/svc_commission_02.sql in Supabase.', 'Tandatangan & kongsi WhatsApp belum disediakan. Jalankan supabase/svc_commission_02.sql di Supabase.') : L('Signatures are not enabled yet.', 'Tandatangan belum diaktifkan.')) + '</div></div>';
    ROLES.forEach(function (x) {
      var g = SG.rows[x.r], btn = '';
      if (g) {
        h += '<div class="svc-row svc-sgr"><div class="x"><div class="n">' + esc(L(x.en, x.bm)) + '</div><div class="t"><span class="svc-chip ok">' + esc(L('Signed', 'Ditandatangani')) + '</span>' +
          '<span class="svc-hint" style="margin:0">' + esc(g.signer_name) + ' · ' + esc(fdt(g.signed_at)) + ' · ' + esc(viaText(g.signed_via)) + '</span></div></div>' +
          '<img class="svc-sgi" alt="' + esc(L('Signature', 'Tandatangan')) + '" data-svc-sigimg="' + x.r + '"' + (SG.imgs[g.storage_path] ? ' src="' + esc(SG.imgs[g.storage_path]) + '"' : ' hidden') + '></div>';
        return;
      }
      if (canSign(x.r)) btn += '<button type="button" class="btn btn-primary btn-sm" data-svc-sign="' + x.r + '"><i class="ti ti-writing-sign"></i> ' + esc(x.r === 'prepared' && st === 'draft' ? L('Sign & submit', 'Tandatangan & hantar') : L('Sign', 'Tandatangan')) + '</button>';
      if (ST.hr && (gateOk(x.r) || (x.r === 'prepared' && st === 'draft'))) btn += '<button type="button" class="btn btn-outline btn-sm" data-svc-wa="' + x.r + '"><i class="ti ti-brand-whatsapp"></i> WhatsApp</button>';
      if (gateOk(x.r) && (x.r === 'prepared' ? (ST.hr && !self) : (ST.hr || self))) btn += '<button type="button" class="btn btn-outline btn-sm" data-svc-req="' + x.r + '"><i class="ti ti-bell-ringing"></i> ' + esc(L('Request', 'Minta')) + '</button>';
      var wait = x.r === 'approved' && !gateOk('approved') ? L('After approval', 'Selepas kelulusan') : (x.r === 'prepared' && st === 'draft' ? L('After submit', 'Selepas dihantar') : L('Pending', 'Menunggu'));
      var nmv = slotName(x.r), id = 'svc-sgn-' + x.r;
      h += '<div class="svc-row svc-sgr svc-sgu"><div class="x"><label class="n" for="' + id + '">' + esc(L(x.en, x.bm)) + '</label>' +
        (canName(x.r) ? '<input id="' + id + '" class="form-input svc-sgn" data-svc-nm="' + x.r + '" maxlength="120" autocomplete="off" data-no-titlecase="1" placeholder="' + esc(L('Name', 'Nama')) + '" value="' + esc(nmv) + '">'
          : '<div class="svc-sgn svc-sgn-ro" id="' + id + '">' + (nmv ? esc(nmv) : '<span class="svc-hint" style="margin:0">—</span>') + '</div>') +
        '<div class="t"><span class="svc-chip w">' + esc(wait) + '</span></div></div>' + (btn ? '<div class="o">' + btn + '</div>' : '') + '</div>';
    });
    h += '<div class="svc-body" style="padding-top:8px"><div class="svc-hint" style="margin:0">' + esc(L('Signatures are voided when the month is reopened or the approved total changes. Links expire in 30 days.', 'Tandatangan dibatalkan jika bulan dibuka semula atau jumlah diluluskan berubah. Pautan tamat dalam 30 hari.')) + '</div>' +
      (ST.hr && sigN() ? '<div class="svc-act" style="margin-top:8px"><button type="button" class="btn btn-outline btn-sm" id="svc-sig-reset"><i class="ti ti-rotate"></i> ' + esc(L('Reset signatures', 'Set semula tandatangan')) + '</button></div>' : '') + '</div>';
    return h + '</div>';
  }
  function base() { return { p_emp: ST.emp, p_month: ST.m, p_year: ST.y }; }
  // prepared on a draft month: freeze the numbers first (svc_comm_submit), same as SD's ensureBatch()
  async function ensureSubmitted(role) {
    if (role !== 'prepared' || gateOk('prepared')) return true;
    var r = await sb.rpc('svc_comm_submit', base());
    if (r.error) throw r.error;
    PAY.clear(); await load(); return gateOk('prepared');
  }
  function addI18n() {
    var S2 = window.__WAD_S; if (!S2 || !S2.en || S2.en.svcSend) return;
    S2.en.svcSend = 'Statement + sign link'; S2.en.svcSendD = 'Commission summary, view & sign as Prepared by';
    S2.en.svcRemind = 'Reminder to sign'; S2.en.svcRemindD = 'Gentle nudge with the same sign link';
    S2.en.svcSign = 'Approval sign request'; S2.en.svcSignD = 'Reviewer signs as Approved by';
    S2.bm.svcSend = 'Penyata + pautan tandatangan'; S2.bm.svcSendD = 'Ringkasan komisen, semak & tandatangan sebagai Disediakan oleh';
    S2.bm.svcRemind = 'Peringatan tandatangan'; S2.bm.svcRemindD = 'Peringatan dengan pautan tandatangan yang sama';
    S2.bm.svcSign = 'Permintaan tandatangan kelulusan'; S2.bm.svcSignD = 'Penyemak tandatangan sebagai Diluluskan oleh';
  }
  function waText(k, lang, url) {
    var en = lang !== 'bm', mon = ST.mon || {}, live = stNow() === 'draft';
    var c = live ? S.calc(ST.logs, ST.cfgRow || {}, monArg()) : null;
    var heads = live ? c.heads : num(mon.svc_heads), tot = live ? c.commission_total : num(mon.commission_total);
    var per = (en ? MEN : MBM)[ST.m - 1] + ' ' + ST.y, nm = empName(), pn = slotName('prepared') || nm, first = String(pn).split(/\s+/)[0] || pn, an = slotName('approved');
    var co = (window.WAD && WAD.company && WAD.company()) || (APP.tenant && APP.tenant.name) || 'M-Core', money = rm(tot);
    var all = !!(ST.cfg && ST.cfg.svc_all), hE = all ? ' heads' : ' NM heads', hB = all ? ' kepala' : ' kepala NM', HE = all ? 'Heads: ' : 'NM heads: ', HB = all ? 'Kepala: ' : 'Kepala NM: ';
    if (k === 'svc_sign') return en
      ? 'Hi' + (an ? ' ' + an : '') + ', please review the Service Commission statement of ' + nm + ' for ' + per + ' (' + heads + hE + ', total commission ' + money + ') and sign as Approved by via the link below (no login needed).\nView & sign: ' + url + '\nThank you. – ' + co
      : 'Salam' + (an ? ' ' + an : '') + ', sila semak Penyata Komisen Servis ' + nm + ' bagi ' + per + ' (' + heads + hB + ', jumlah komisen ' + money + ') dan tandatangan sebagai Diluluskan oleh melalui pautan di bawah (tiada log masuk).\nSemak & tandatangan: ' + url + '\nTerima kasih. – ' + co;
    var signed = !!SG.rows.prepared, rem = k === 'svc_remind';
    return en
      ? (rem ? 'Hi ' + first + ', reminder: ' : 'Hi ' + first + ', ') + (pn === nm ? 'your Service Commission statement' : 'the Service Commission statement of ' + nm) + ' for ' + per + ' is ready.\n' + HE + heads + '\nTotal commission: ' + money + '\n\n' +
        (signed ? 'View statement: ' : 'Review & sign as Prepared by (no login needed): ') + url + '\nThank you. – ' + co
      : (rem ? 'Salam ' + first + ', peringatan: ' : 'Salam ' + first + ', ') + (pn === nm ? 'penyata Komisen Servis anda' : 'penyata Komisen Servis ' + nm) + ' bagi ' + per + ' sudah sedia.\n' + HB + heads + '\nJumlah komisen: ' + money + '\n\n' +
        (signed ? 'Lihat penyata: ' : 'Semak & tandatangan sebagai Disediakan oleh (tiada log masuk): ') + url + '\nTerima kasih. – ' + co;
  }
  async function share(role, btn) {
    var W = window.WAD;
    if (!W || typeof W.open !== 'function') return toast(L('WhatsApp share is not available.', 'Kongsi WhatsApp tidak tersedia.'), 'error');
    if (!ST.hr) return toast(L('Only Owner/HR can share signing links.', 'Hanya Owner/HR boleh kongsi pautan tandatangan.'), 'error');
    if (role === 'prepared' && stNow() === 'draft' && !confirm(L('Submit this month first? The numbers are frozen for signing.', 'Hantar bulan ini dahulu? Angka dibekukan untuk tandatangan.'))) return;
    var wasDraft = role === 'prepared' && stNow() === 'draft';
    try { if (!(await ensureSubmitted(role))) return toast(L('Submit the month first.', 'Hantar bulan ini dahulu.'), 'error'); }
    catch (e) { return toast(sigErr(e), 'error'); }
    if (wasDraft) { toast(L('Submitted to Owner/HR', 'Dihantar kepada Owner/HR')); paint(); }
    if (!ST.mon || !ST.mon.id) return toast(L('Submit the month first.', 'Hantar bulan ini dahulu.'), 'error');
    if (typeof W.ready === 'function') { var okL = await Promise.resolve(W.ready()).catch(function () { return true; }); if (okL === false) return toast(L('WhatsApp share log is not set up yet.', 'Log kongsi WhatsApp belum disediakan.'), 'warning'); }
    addI18n();
    await saveNames(true);
    var mid = ST.mon.id, ref = 'SC' + ST.y + pad(ST.m) + '-' + String(ST.emp).slice(0, 4).toUpperCase(), key = mid + ':' + role;
    var pdfP = null;
    var o = {
      docType: 'svc', docId: mid, docRef: L('Service commission', 'Komisen servis') + ' · ' + ref + ' · ' + empName(), recipientKind: 'other',
      to: slotName(role) || (role === 'prepared' ? empName() : L('Approver', 'Pelulus')), phone: role === 'prepared' && (slotName('prepared') || empName()) === empName() ? ((ST.empRow && ST.empRow.phone) || '') : '',
      k: role === 'prepared' ? 'svc_send' : 'svc_sign',
      tpls: role === 'prepared' ? [{ k: 'svc_send', label: 'svcSend', desc: 'svcSendD' }, { k: 'svc_remind', label: 'svcRemind', desc: 'svcRemindD' }] : [{ k: 'svc_sign', label: 'svcSign', desc: 'svcSignD' }],
      file: function () { return pdfP || (pdfP = (window.DKD ? (async function () { await loadImgs(); var m = stModel(await tenant()); return DKD.file(m, m.file + '.pdf'); })() : Promise.resolve(null)).catch(function () { return null; })); },
      build: function (k, lang) {
        var get = SG.link[key] ? Promise.resolve(SG.link[key]) : Promise.resolve(sb.rpc('svc_sign_link_create', Object.assign(base(), { p_role: role }))).then(function (r) {
          if (r.error) throw new Error(sigErr(r.error)); SG.link[key] = r.data; return r.data;
        });
        return get.then(function (l) {
          var th = typeof W.theme === 'function' ? W.theme() : null;
          var url = W.base() + 'public-svc.html?svc_sign=' + encodeURIComponent(l.token) + (lang === 'bm' ? '&lang=bm' : '') + (th ? '&theme=' + th : '');
          return { text: waText(k, lang, url), link_id: l.link_id, expires_at: l.expires_at };
        });
      }
    };
    W.open(o);
  }
  // signer gets a bell + push (dk__notify, actor skipped, no amounts)
  async function request(role, btn) {
    var r = await sb.rpc('svc_sign_request', Object.assign(base(), { p_role: role }));
    if (r.error) return toast(sigErr(r.error), 'error');
    var n = (r.data && r.data.notified) || 0;
    if (n > 0) return toast(L('Signature request sent (' + n + ')', 'Permintaan tandatangan dihantar (' + n + ')'));
    toast(role === 'prepared' ? L('This staff has no app login linked — use WhatsApp instead.', 'Staf ini tiada log masuk aplikasi — guna WhatsApp.')
      : L('No one else to notify.', 'Tiada orang lain untuk dimaklumkan.'), 'warning');
  }
  async function resetSigs() {
    var reason = window.prompt(L('Void ' + sigN() + ' signature(s) and stop all links? Reason (optional):', 'Batalkan ' + sigN() + ' tandatangan dan hentikan semua pautan? Sebab (pilihan):'), '');
    if (reason === null) return;
    var r = await sb.rpc('svc_sign_reset', Object.assign(base(), { p_reason: reason || null }));
    if (r.error) return toast(sigErr(r.error), 'error');
    SG.link = {}; toast(L('Signatures reset', 'Tandatangan diset semula')); await refresh();
  }
  /* draw pad — same canvas behaviour as sd-signatures.js (white bg, black 2.5px) */
  var SP = null;
  function closeSign() { var m = $('svc-sg-modal'); if (m) m.remove(); SP = null; }
  function openSign(role) {
    if (!canSign(role)) return;
    closeSign();
    var x = roleOf(role), nm = slotName(role);
    if (!nm) nm = role === 'prepared' ? empName() : meName();
    var ov = document.createElement('div');
    ov.id = 'svc-sg-modal'; ov.className = 'modal-overlay active svc-modal';
    ov.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="svc-sg-t">' +
      '<div class="modal-box-header" id="svc-sg-t"><i class="ti ti-writing-sign"></i> ' + esc(L('Sign as ', 'Tandatangan sebagai ') + L(x.en, x.bm)) + '</div>' +
      '<div class="modal-box-body">' +
      '<div class="svc-hint" style="margin:0 0 8px">' + esc(empName() + ' · ' + mlabel(ST.m, ST.y)) + (stNow() === 'draft' ? ' · ' + esc(L('this also submits the month', 'ini juga menghantar bulan ini')) : '') + '</div>' +
      '<div class="form-group" style="margin:0 0 10px"><label class="form-label" for="svc-sg-name">' + esc(L('Name', 'Nama')) + '</label>' +
      '<input id="svc-sg-name" class="form-input" maxlength="120" autocomplete="name" value="' + esc(nm) + '"></div>' +
      '<div class="form-group" style="margin:0"><label class="form-label">' + esc(L('Draw your signature', 'Lukis tandatangan anda')) + '</label>' +
      '<canvas id="svc-sg-pad" class="svc-pad" aria-label="' + esc(L('Signature pad', 'Pad tandatangan')) + '"></canvas>' +
      '<div class="svc-hint">' + esc(L('Sign with your finger or mouse.', 'Tandatangan dengan jari atau tetikus.')) + '</div></div>' +
      '<div class="svc-flag" id="svc-sg-err" role="alert" style="margin-top:6px"></div></div>' +
      '<div class="modal-box-footer" style="flex-wrap:wrap">' +
      '<button type="button" class="btn btn-outline" data-a="clear" style="white-space:nowrap"><i class="ti ti-eraser"></i> ' + esc(L('Clear', 'Padam')) + '</button>' +
      '<button type="button" class="btn btn-outline" data-a="cancel" style="white-space:nowrap">' + esc(L('Cancel', 'Batal')) + '</button>' +
      '<button type="button" class="btn btn-primary" data-a="save" style="white-space:nowrap"><i class="ti ti-check"></i> ' + esc(L('Save signature', 'Simpan tandatangan')) + '</button></div></div>';
    ov.addEventListener('click', function (e) {
      if (e.target === ov) return closeSign();
      var a = e.target.closest && e.target.closest('[data-a]'); if (!a) return;
      var k = a.getAttribute('data-a');
      if (k === 'cancel') closeSign(); else if (k === 'clear') clearPad(); else if (k === 'save') saveSign(role, a);
    });
    document.body.appendChild(ov);
    initPad($('svc-sg-pad'));
  }
  function initPad(cv) {
    var r = cv.getBoundingClientRect(), dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    var w = Math.max(240, Math.round(r.width || 400)), h = Math.max(120, Math.round(r.height || 160));
    cv.width = w * dpr; cv.height = h * dpr;
    var c = cv.getContext('2d'); if (!c) return;
    c.scale(dpr, dpr);
    SP = { cv: cv, c: c, w: w, h: h, ink: false, down: false };
    clearPad();
    function pt(e) { var b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * (w / (b.width || w)), y: (e.clientY - b.top) * (h / (b.height || h)) }; }
    cv.addEventListener('pointerdown', function (e) { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} SP.down = true; var p = pt(e); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 0.1, p.y + 0.1); c.stroke(); SP.ink = true; });
    cv.addEventListener('pointermove', function (e) { if (!SP || !SP.down) return; e.preventDefault(); var p = pt(e); c.lineTo(p.x, p.y); c.stroke(); });
    var up = function () { if (SP) SP.down = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
  }
  function clearPad() {
    if (!SP) return;
    var c = SP.c;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = 'white'; c.fillRect(0, 0, SP.cv.width, SP.cv.height); c.restore();
    c.strokeStyle = 'black'; c.lineWidth = 2.5; c.lineCap = 'round'; c.lineJoin = 'round';
    SP.ink = false;
  }
  S._pad = function () { return SP; };
  function padBlob() { return new Promise(function (res) { SP.cv.toBlob(function (b) { res(b); }, 'image/png'); }); }
  async function saveSign(role, btn) {
    var er = $('svc-sg-err'), name = String(($('svc-sg-name') || {}).value || '').trim();
    var lbl = '<i class="ti ti-check"></i> ' + esc(L('Save signature', 'Simpan tandatangan'));
    var fail = function (m) { if (er) er.textContent = m; btn.disabled = false; btn.innerHTML = lbl; };
    if (!name) return fail(L('Enter your name.', 'Masukkan nama anda.'));
    if (!SP || !SP.ink) return fail(L('Draw your signature first.', 'Lukis tandatangan anda dahulu.'));
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> ' + esc(L('Saving…', 'Menyimpan…'));
    setName(role, name);
    if (er) er.textContent = '';
    try {
      var blob = await padBlob();
      if (!blob) throw new Error(L('Could not read the signature.', 'Tandatangan tidak dapat dibaca.'));
      if (!(await ensureSubmitted(role)) || !ST.mon || !ST.mon.id) throw new Error(L('Submit the month first.', 'Hantar bulan ini dahulu.'));
      await saveNames(true);
      var path = tid() + '/svc-signatures/' + ST.mon.id + '/' + role + '-' + Date.now() + '.png';
      var up = await sb.storage.from('doc-files').upload(path, blob, { contentType: 'image/png', upsert: false });
      if (up.error) throw up.error;
      var r = await sb.rpc('svc_sign_app', Object.assign(base(), { p_role: role, p_name: name, p_path: path }));
      if (r.error) throw r.error;
      var res = r.data || {};
      closeSign();
      toast(res.complete ? L('Signed — 2/2, statement fully signed.', 'Ditandatangani — 2/2, penyata lengkap ditandatangani.') : L('Signed', 'Ditandatangani') + ' (' + (res.signed || sigN() + 1) + '/2).');
      await refresh();
    } catch (e) { fail(L('Could not sign: ', 'Gagal tandatangan: ') + sigErr(e)); }
  }
  function wireSig() {
    var W = $('svc-wrap'); if (!W) return;
    W.querySelectorAll('[data-svc-nm]').forEach(function (el) {
      var r = el.getAttribute('data-svc-nm');
      el.oninput = function () { setName(r, el.value); saveNames(false); };
      el.onchange = function () { setName(r, el.value.trim()); saveNames(true); };
    });
    W.querySelectorAll('[data-svc-sign]').forEach(function (el) { el.onclick = function () { openSign(el.getAttribute('data-svc-sign')); }; });
    W.querySelectorAll('[data-svc-wa]').forEach(function (el) { el.onclick = function () { busy(el, share(el.getAttribute('data-svc-wa'), el)); }; });
    W.querySelectorAll('[data-svc-req]').forEach(function (el) { el.onclick = function () { busy(el, request(el.getAttribute('data-svc-req'), el)); }; });
    var wa = $('svc-wa'); if (wa) wa.onclick = function () { busy(wa, share('prepared', wa)); };
    var rs = $('svc-sig-reset'); if (rs) rs.onclick = function () { busy(rs, resetSigs()); };
    // deep link from a notification: {..., sig: 'prepared'|'approved'} → scroll to the card, open the pad when this user can sign
    if (ST.wantSig) {
      var want = ST.wantSig; ST.wantSig = null;
      var card = $('svc-sig'); if (card && card.scrollIntoView) setTimeout(function () { card.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60);
      if (canSign(want) && gateOk(want)) setTimeout(function () { openSign(want); }, 250);
    }
    loadImgs();
  }
  S.sign = { names: function () { loadNames(); return SG.names; }, setName: setName, saveNames: saveNames, open: openSign, share: share, request: request, reset: resetSigs, load: loadSigs, card: sigCard, chip: sigChip };

  /* ---------- statement (A4 light, signature boxes) ---------- */
  function ddmmyyyy(d) { d = d || new Date(); return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear(); }
  // tenant header — same source as dk-staff/dk-ops/dk-purch (_pdocGetTenant → logo_url + _pdocAddressLine + phone)
  function tenant() { try { return typeof _pdocGetTenant === 'function' ? Promise.resolve(_pdocGetTenant()).catch(function () { return APP.tenant || {}; }) : Promise.resolve(APP.tenant || {}); } catch (e) { return Promise.resolve({}); } }
  function coSub(t) { var a = ''; try { a = typeof _pdocAddressLine === 'function' ? _pdocAddressLine(t) : (t.address || ''); } catch (e) {} return [a, t.phone].filter(Boolean).join(' · '); }
  function stModel(t) {
    t = t || APP.tenant || {};
    var mon = ST.mon || {}, c = S.calc(ST.logs, ST.cfgRow || {}, monArg()), r = c.rates;
    var code = String((APP.tenant && APP.tenant.code) || 'MCORE').replace(/[^\w]+/g, '').toUpperCase();
    var ref = 'SC' + ST.y + pad(ST.m) + '-' + String(ST.emp).slice(0, 4).toUpperCase();
    var coName = t.name || (APP.tenant && APP.tenant.name) || '';
    var m = { co: coName, sub: coSub(t), logo: t.logo_url || '',
      title: L('SERVICE COMMISSION STATEMENT', 'PENYATA KOMISEN SERVIS'),
      meta: [{ k: L('Ref', 'Ruj.'), v: ref }, { k: L('Period', 'Tempoh'), v: mlabel(ST.m, ST.y) }, { k: L('Status', 'Status'), v: ({ draft: L('Draft', 'Draf'), submitted: L('Submitted', 'Dihantar'), approved: L('Approved', 'Diluluskan') })[mon.status || 'draft'] }],
      party: { name: empName(), lines: [ST.empRow && ST.empRow.position || '', L('Scheme: ', 'Skim: ') + schemeText(r) + ' · ' + (r.svc_all ? '' : r.eligible_status + ' + ' + r.eligible_leads.join('/') + ' · ') + L('product ', 'produk ') + r.prod_rate_pct + '%'].filter(Boolean) },
      cols: [L('Date · Service', 'Tarikh · Servis'), L('Price', 'Harga'), L('Client', 'Pelanggan'), 'Lead', L('Commission', 'Komisen')],
      rows: ST.logs.map(function (x) { var rc = rowCalc(x, r); return [dmy(x.log_date) + ' · ' + x.service + (x.code && x.code !== String(x.service || '').toUpperCase() ? ' [' + x.code + ']' : '') + (rc.flag ? ' (' + flagText(rc.flag) + ')' : '') + (rc.review ? ' (' + flagText('nocode') + ')' : ''), x.price == null ? '—' : rm(x.price), x.client_status || '—', x.lead_source || '—', rc.ok ? rm(rc.cents / 100) : '—']; }),
      tots: [], notes: [], sigs: [], foot: L('Computer-generated statement', 'Penyata janaan komputer') + ' · ' + coName,
      file: 'SVC-' + code + '-' + ref + '-' + ddmmyyyy() };
    if (!m.rows.length) m.rows.push([L('No logs this month', 'Tiada log bulan ini'), '', '', '', '']);
    if (ST.basic !== null) m.tots.push({ k: L('Basic pay', 'Gaji asas'), v: rm(ST.basic) });
    // short label + detail line (dk-doc wraps both; nothing is cut with "." any more)
    m.tots.push({ k: L('Service commission', 'Komisen servis'), sub: (r.svc_all ? L(c.heads + ' heads · ', c.heads + ' kepala · ') : L(c.heads + ' NM heads · ', c.heads + ' kepala NM · ')) + schemeText(r), v: rm(c.svc_commission) });
    m.tots.push({ k: L('Product commission', 'Komisen produk'), sub: r.prod_rate_pct + '% × ' + rm(c.product_sales), v: rm(c.prod_commission) });
    if (!(r.svc_all && !(c.bonus > 0))) m.tots.push({ k: L('Conversion bonus', 'Bonus conversion'), v: rm(c.bonus) });
    m.tots.push({ k: L('Total', 'Jumlah'), v: rm((ST.basic || 0) + c.commission_total), g: true });
    if (ST.items.length) m.notes.push({ k: L('Products', 'Produk'), v: ST.items.map(function (it) { var cd = codeOf('product', it.code); return dmy(it.log_date) + ' ' + (it.name || (cd && cd.name) || it.code || L('No name', 'Tanpa nama')) + (num(it.qty) !== 1 ? ' ×' + num(it.qty) : '') + ' ' + rm(it.amount); }).join(' · ') });
    else if (mon.product_note) m.notes.push({ k: L('Products', 'Produk'), v: mon.product_note });
    if (c.review) m.notes.push({ k: L('Needs review', 'Perlu semak'), v: L(c.review + ' row(s) have no code / name — already included in the total.', c.review + ' baris tiada kod / nama — sudah termasuk dalam jumlah.') });
    if (c.flags) m.notes.push({ k: L('Flags', 'Tanda'), v: L(c.flags + ' row(s) earn no commission (no price / no status / NM without TT-ADS lead).', c.flags + ' baris tiada komisen (tiada harga / tiada status / NM tanpa lead TT-ADS).') });
    m.notes.push({ k: L('Note', 'Nota'), v: L('Statutory deductions are applied in the payslip. Only approved months are paid.', 'Potongan berkanun dikira dalam slip gaji. Hanya bulan diluluskan dibayar.') });
    // signed slots: signer name + signed date + drawn PNG (dk-doc v5 sigs[].img); unsigned keep the old fallback
    var gP = SG.rows.prepared, gA = SG.rows.approved;
    m.sigs = [{ label: L('Prepared by', 'Disediakan oleh'), name: gP ? gP.signer_name : (slotName('prepared') || empName()), at: gP ? fdt(gP.signed_at) : (mon.submitted_at ? fdt(mon.submitted_at) : ''), img: gP ? SG.imgs[gP.storage_path] || '' : '' },
      { label: L('Approved by', 'Diluluskan oleh'), name: gA ? gA.signer_name : slotName('approved'), at: gA ? fdt(gA.signed_at) : (mon.approved_at ? fdt(mon.approved_at) : ''), img: gA ? SG.imgs[gA.storage_path] || '' : '' }];
    return m;
  }
  S.model = stModel;
  async function statement(how) {
    if (!window.DKD) return toast(L('Document kit not loaded', 'Kit dokumen belum dimuat'), 'error');
    await Promise.race([loadImgs(), new Promise(function (r) { setTimeout(r, 3500); })]);
    var m = stModel(await tenant());
    if (how === 'pdf') return DKD.file(m, m.file + '.pdf').then(DKD.download);
    var p = DKD.paper(m, { cls: 'dk-tmp' }); DKD.sigBoxes(p, m.sigs); ($('main') || document.body).appendChild(p);
    var gone = false, rmv = function () { if (gone) return; gone = true; p.remove(); window.removeEventListener('afterprint', rmv); };
    window.addEventListener('afterprint', rmv); DKD.printOne(p, { title: m.file }); setTimeout(rmv, 4500);
  }

  /* ---------- payroll + payslip hooks ---------- */
  var PAY = { c: {}, slip: {}, clear: function () { PAY.c = {}; PAY.slip = {}; } };
  S._pay = PAY;
  function approvedFor(month, year) {
    var k = month + ':' + year, hit = PAY.c[k];
    if (hit && Date.now() - hit.t < 30000) return hit.p;
    var p = (async function () {
      var map = {};
      try {
        var r = await sb.from('svc_comm_months').select('id,employee_id,month,year,svc_heads,svc_commission,prod_commission,bonus,commission_total,product_sales,rates')
          .eq('tenant_id', tid()).eq('month', Number(month)).eq('year', Number(year)).eq('status', 'approved').is('deleted_at', null);
        if (r.error) return map;
        var byMid = {};
        (r.data || []).forEach(function (x) {
          map[String(x.employee_id)] = x;
          byMid[String(x.id)] = x;
          PAY.slip[x.employee_id + ':' + x.month + ':' + x.year] = x;
        });
        var ids = Object.keys(map);
        if (ids.length) {
          try {
            var s = await sb.from('svc_comm_settings').select('employee_id,pay_via_pv').eq('tenant_id', tid()).in('employee_id', ids).is('deleted_at', null);
            if (!s.error) (s.data || []).forEach(function (x) { var m = map[String(x.employee_id)]; if (m && x.pay_via_pv) m.pay_via_pv = true; });
          } catch (e) {}
          try {
            var mids = Object.keys(byMid);
            var pv = await sb.from('payment_vouchers').select('source_ref').eq('tenant_id', tid()).eq('source', 'svc').in('source_ref', mids).is('deleted_at', null);
            if (!pv.error) (pv.data || []).forEach(function (p) { var m = byMid[String(p.source_ref)]; if (m) { m.has_pv = true; m.pay_via_pv = true; } });
          } catch (e) {}
        }
      } catch (e) {}
      return map;
    })();
    PAY.c[k] = { t: Date.now(), p: p }; return p;
  }
  S.approvedFor = approvedFor;
  function hook() {
    if (typeof window._scCommissionTotal === 'function' && !window._scCommissionTotal._svc) {
      var o1 = window._scCommissionTotal;
      window._scCommissionTotal = async function (pid, month, year, pf) {
        var res = await o1.apply(this, arguments);
        if (pf === 'earned' || !pid || !tid()) return res;
        try {
          var x = (await approvedFor(month, year))[String(pid)];
          if (x && (x.pay_via_pv || x.has_pv)) return res; // Bayar via PV — skip SD to avoid double pay
          if (x && num(x.commission_total) > 0) res = Object.assign({}, res, { total: num(res && res.total) + num(x.commission_total), svc: num(x.commission_total) });
        } catch (e) {}
        return res;
      };
      window._scCommissionTotal._svc = 1;
    }
    if (typeof window._pdocPayslipHtml === 'function' && !window._pdocPayslipHtml._svc) {
      var o2 = window._pdocPayslipHtml;
      window._pdocPayslipHtml = function (rec, tn, t, isBm, accent) {
        var html = o2.apply(this, arguments);
        try { return split(html, rec, isBm); } catch (e) { return html; }
      };
      window._pdocPayslipHtml._svc = 1;
    }
    if (typeof window.renderPayslipDetail === 'function' && !window.renderPayslipDetail._svc) {
      var o3 = window.renderPayslipDetail;
      window.renderPayslipDetail = async function (id) {
        var self = this, args = arguments;
        try {
          var r = await Promise.race([sb.from('payroll_records').select('employee_id,month,year').eq('id', id).eq('tenant_id', tid()).maybeSingle(), new Promise(function (ok) { setTimeout(function () { ok({}); }, 2500); })]);
          if (r && r.data) await Promise.race([approvedFor(r.data.month, r.data.year), new Promise(function (ok) { setTimeout(ok, 2500); })]);
        } catch (e) {}
        return o3.apply(self, args);
      };
      window.renderPayslipDetail._svc = 1;
    }
    if (typeof window.renderPayslipsPrint === 'function' && !window.renderPayslipsPrint._svc) {
      var o4 = window.renderPayslipsPrint;
      window.renderPayslipsPrint = async function (month, year) {
        var self = this, args = arguments;
        try { await Promise.race([approvedFor(month, year), new Promise(function (ok) { setTimeout(ok, 2500); })]); } catch (e) {}
        return o4.apply(self, args);
      };
      window.renderPayslipsPrint._svc = 1;
    }
    if (typeof window.renderMyPayslips === 'function' && !window.renderMyPayslips._svc) {
      var o5 = window.renderMyPayslips;
      window.renderMyPayslips = function (params) {
        if (params && params.svc === 'log') return S.open(params);
        var out = o5.apply(this, arguments);
        try { if (out && typeof out.then === 'function') out.then(staffButton, function () {}); else staffButton(); } catch (e) {}
        return out;
      };
      window.renderMyPayslips._svc = 1;
    }
    if (typeof window.renderEmployeeList === 'function' && !window.renderEmployeeList._svc) {
      var o6 = window.renderEmployeeList;
      window.renderEmployeeList = function () {
        var out = o6.apply(this, arguments);
        try { if (out && typeof out.then === 'function') out.then(hrButton, function () {}); else hrButton(); } catch (e) {}
        return out;
      };
      window.renderEmployeeList._svc = 1;
    }
  }
  S.split = split;
  // helpers for app/svc-comm-pv.js (PV for all staff / PVD / PV description / receipt / source file)
  S.util = { L: L, bm: bm, tid: tid, esc: esc, toast: toast, rm: rm, num: num, errMsg: errMsg, missing: missing, mlabel: mlabel, dmy: dmy, pad: pad,
    MEN: MEN, MBM: MBM, rates: rates, rowCalc: rowCalc, refresh: refresh, paint: function () { paint(); }, isOwner: isOwner, empName: empName, base: base, sigErr: sigErr,
    modal: modal, busy: busy, prevMY: prevMY, sigRows: function () { return SG.rows; } };
  function split(html, rec, isBm) {
    if (!rec || !(num(rec.commission) > 0)) return html;
    var x = PAY.slip[rec.employee_id + ':' + rec.month + ':' + rec.year];
    if (!x || !(num(x.commission_total) > 0) || num(rec.commission) < num(x.commission_total) - 0.005) return html;
    var re = /<tr><td>(Komisen Jualan|Sales Commission)<\/td><td style="([^"]*)">\+ ([^<]*)<\/td><\/tr>/;
    var mm = html.match(re); if (!mm) return html;
    var r = x.rates || {}, pct = r.svc_rate_pct != null ? num(r.svc_rate_pct) : 5, cap = r.svc_cap === undefined ? 10 : r.svc_cap, pp = r.prod_rate_pct != null ? num(r.prod_rate_pct) : 5;
    var B = function (en, b) { return isBm ? b : en; };
    var row = function (lbl, amt) { return '<tr><td>' + esc(lbl) + '</td><td style="' + mm[2] + '">+ ' + esc(rm(amt)) + '</td></tr>'; };
    var out = '';
    if (num(x.svc_commission) > 0 && r.svc_all) out += row(B('Service commission (' + num(x.svc_heads) + ' heads, ' + pct + '%)', 'Komisen servis (' + num(x.svc_heads) + ' kepala, ' + pct + '%)'), x.svc_commission);
    else if (num(x.svc_commission) > 0) out += row(B('Service commission (' + num(x.svc_heads) + ' heads NM, ' + pct + '%' + (cap != null ? ' max ' + rm(cap) + '/head' : '') + ')', 'Komisen servis (' + num(x.svc_heads) + ' kepala NM, ' + pct + '%' + (cap != null ? ' maks ' + rm(cap) + '/kepala' : '') + ')'), x.svc_commission);
    if (num(x.prod_commission) > 0) out += row(B('Product commission (' + pp + '% × ' + rm(x.product_sales) + ')', 'Komisen produk (' + pp + '% × ' + rm(x.product_sales) + ')'), x.prod_commission);
    if (num(x.bonus) > 0) out += row(B('Conversion bonus', 'Bonus conversion'), x.bonus);
    var rest = Math.round((num(rec.commission) - num(x.commission_total)) * 100) / 100;
    if (rest > 0.004) out += row(mm[1], rest);
    return html.replace(re, out);
  }
  async function hasScheme(empId) {
    var q = sb.from('svc_comm_settings').select('id').eq('tenant_id', tid()).is('deleted_at', null).eq('enabled', true).limit(1);
    if (empId) q = q.eq('employee_id', empId);
    var r = await q; return !r.error && (r.data || []).length > 0;
  }
  function btn(label, onclick) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-outline btn-sm'; b.style.whiteSpace = 'nowrap'; b.innerHTML = '<i class="ti ti-scissors"></i> ' + esc(label); b.onclick = onclick; return b; }
  function staffButton() {
    var M = $('main'); if (!M) return; var row = M.querySelector('.page-header + div[style*="flex-wrap"]'); if (!row || row.querySelector('[data-svc-btn]')) return;
    (async function () {
      var me = await _hrResolveSelfEmployee(); if (!me || !row.isConnected) return;
      if (!(await hasScheme(me.id)) || !row.isConnected || row.querySelector('[data-svc-btn]')) return;
      var b = btn(L('Service Log', 'Log Servis'), function () { openPage('hr', { view: 'my-payslips', svc: 'log', emp: me.id }); }); b.setAttribute('data-svc-btn', '1'); row.appendChild(b);
    })().catch(function () {});
  }
  function hrButton() {
    if (!canHR()) return; var M = $('main'), row = M && M.querySelector('.page-header > div[style*="flex-wrap"]'); if (!row || row.querySelector('[data-svc-btn]')) return;
    (async function () {
      var r = await sb.from('svc_comm_settings').select('id', { head: true, count: 'exact' }).eq('tenant_id', tid()).limit(1);
      if (r.error || !row.isConnected || row.querySelector('[data-svc-btn]')) return;
      var b = btn(L('Service Commission', 'Komisen Servis'), function () { openPage('hr', { view: 'my-payslips', svc: 'log' }); }); b.setAttribute('data-svc-btn', '1');
      var pri = row.querySelector('.btn-primary'); row.insertBefore(b, pri || null);
    })().catch(function () {});
  }
  hook(); setTimeout(hook, 1500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook);
})();
