/* M-Core Service Commission — PV suite (v1, 20261115200000_svc_commission_all_services_pv_suite.sql). Plugs into window.SVC
   (app/svc-commission.js v4) through SVC.ext:
   - desc():      commission-only WhatsApp-style PV description, JSON {"en","bm"} (pv-core descText renders it). No basic.
                  Services grouped by code (or price when no code), products "Name xN = RMxx", "⚠️ PERLU SEMAK (sudah termasuk
                  dalam total)" for rows without a code / name, comparison with last month. Only for the all-services scheme.
   - createAll(): "Create PV for all staff this month" → svc_create_pv (with the description) per approved month that pays via PV,
                  then svc_create_pvd → one PVD for the period (PV paid → PVD line paid → month closed, server side).
   - card():      PV card on the month: description preview + copy, WhatsApp to staff with a "Received by" sign link
                  (svc_signatures role 'received'), receipt status, source file (doc_attachments 'svc_month').
   EN/BM, existing tokens only. tenant_id on every query, soft delete only. */
(function () {
  'use strict';
  if (window.SVCPV) return;
  var X = window.SVCPV = { v: 1, att: [] };
  function S() { return window.SVC; }
  function U() { return (window.SVC && window.SVC.util) || null; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  // RM1,870 for whole amounts, RM692.65 otherwise (lines); totals always 2 decimals
  function rmL(n) { n = Math.round(num(n) * 100) / 100; var whole = Math.abs(n - Math.round(n)) < 0.005; return 'RM' + n.toLocaleString('en-MY', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }); }
  function rmT(n) { return 'RM' + num(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function dmy(s) { var p = String(s || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : String(s || ''); }
  var MEN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MBM = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];

  /* ---------- E) PV description ---------- */
  // d = { name, m, y, cfg (settings row), logs, items, prev: {commission_total}, comm_only }
  X.text = function (d, lang) {
    var en = lang !== 'bm', W = function (a, b) { return en ? a : b; };
    var Sv = S(), r = Sv.util.rates(d.cfg || {}), c = Sv.calc(d.logs || [], d.cfg || {}, { items: d.items || [], bonus_on: d.bonus_on, product_sales: d.product_sales });
    var per = (en ? MEN : MBM)[d.m - 1] + ' ' + d.y, out = [], rev = [];
    out.push('*' + W('PAYMENT DESCRIPTION', 'BUTIRAN BAYARAN') + ' — ' + String(d.name || '').toUpperCase() + '*');
    out.push('_' + W('Period: ', 'Tempoh: ') + per + ' · ' + (d.comm_only ? W('Commission only, paid via PV', 'Komisen sahaja, bayar via PV') : W('Commission, paid via PV', 'Komisen, bayar via PV')) + '_');
    // services: group by code (label = code name if known), no code → review grouped by price
    var g = {}, order = [], svcSum = 0;
    (d.logs || []).forEach(function (x) {
      var rc = Sv.rowCalc(x, d.cfg || {}); if (!rc.ok) return;
      var p = num(x.price); svcSum += p;
      var k = x.code ? String(x.code).toUpperCase() : (Sv.codeOf('service', x.service) ? String(x.service).toUpperCase() : null);
      if (!k) { rev.push({ t: 's', p: p, d: x.log_date }); return; }
      if (!g[k]) { g[k] = { n: 0, a: 0 }; order.push(k); } g[k].n++; g[k].a += p;
    });
    out.push(''); out.push('*' + W('SERVICES', 'SERVIS') + '* (' + r.svc_rate_pct + '%)');
    order.sort(function (a, b) { return g[b].a - g[a].a || (a < b ? -1 : 1); }).forEach(function (k) { var cd = Sv.codeOf('service', k); out.push((cd && cd.name ? cd.name : k) + ' x' + g[k].n + ' = ' + rmL(g[k].a)); });
    if (!order.length && !rev.some(function (x) { return x.t === 's'; })) out.push(W('No services', 'Tiada servis'));
    out.push(W('Service total: ', 'Jumlah servis: ') + rmL(svcSum) + ' → ' + W('Commission ', 'Komisen ') + rmT(c.svc_commission));
    // products: "Name xN = RMxx"; no code + no name → review grouped by amount
    var pg = {}, po = [];
    (d.items || []).forEach(function (it) {
      var cd = Sv.codeOf('product', it.code) || Sv.codeOf('product', it.name), nm = String(it.name || (cd && cd.name) || it.code || '').trim();
      if (!nm) { rev.push({ t: 'p', p: num(it.amount), q: num(it.qty) || 1, d: it.log_date }); return; }
      var k = nm.toUpperCase(); if (!pg[k]) { pg[k] = { nm: nm, n: 0, a: 0 }; po.push(k); } pg[k].n += num(it.qty) || 1; pg[k].a += num(it.amount);
    });
    if ((d.items || []).length || c.product_sales > 0) {
      out.push(''); out.push('*' + W('PRODUCTS', 'PRODUK') + '* (' + r.prod_rate_pct + '%)');
      po.forEach(function (k) { out.push(pg[k].nm + ' x' + pg[k].n + ' = ' + rmL(pg[k].a)); });
      out.push(W('Product total: ', 'Jumlah produk: ') + rmL(c.product_sales) + ' → ' + W('Commission ', 'Komisen ') + rmT(c.prod_commission));
    }
    if (c.bonus > 0) { out.push(''); out.push(W('Conversion bonus: ', 'Bonus conversion: ') + rmT(c.bonus)); }
    if (rev.length) {
      out.push(''); out.push('⚠️ ' + W('NEEDS REVIEW (already included in the total)', 'PERLU SEMAK (sudah termasuk dalam total)'));
      var rg = {}, ro = [];
      rev.forEach(function (x) { var k = x.t + ':' + x.p; if (!rg[k]) { rg[k] = { t: x.t, p: x.p, n: 0, ds: [] }; ro.push(k); } rg[k].n += x.q || 1; if (rg[k].ds.indexOf(dmy(x.d)) < 0) rg[k].ds.push(dmy(x.d)); });
      ro.forEach(function (k) { var x = rg[k]; out.push('• ' + (x.t === 's' ? W('Service, no code', 'Servis tiada kod') : W('Product, no name', 'Produk tiada nama')) + ' ' + rmL(x.p) + ' x' + x.n + ' = ' + rmL(x.p * x.n) + ' (' + x.ds.join(', ') + ')'); });
    }
    out.push(''); out.push('*' + W('TOTAL: ', 'JUMLAH: ') + rmT(c.commission_total) + '*');
    if (d.prev && d.prev.commission_total != null) {
      var pm = d.m === 1 ? 12 : d.m - 1, py = d.m === 1 ? d.y - 1 : d.y, p = num(d.prev.commission_total), pct = p > 0 ? ((c.commission_total - p) / p) * 100 : null;
      out.push(W('vs ', 'vs ') + (en ? MEN : MBM)[pm - 1] + ' ' + py + ': ' + rmT(p) + (pct === null ? '' : ' (' + (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%)'));
    }
    return out.join('\n');
  };
  X.build = function (d) { return JSON.stringify({ en: X.text(d, 'en'), bm: X.text(d, 'bm') }); };
  function curData(ST) {
    var Sv = S(), mon = ST.mon || {};
    return { name: Sv.util.empName(), m: ST.m, y: ST.y, cfg: ST.cfgRow || {}, logs: ST.logs, items: ST.items, prev: ST.prev, bonus_on: mon.bonus_on, product_sales: mon.product_sales,
      comm_only: !!(ST.cfgRow && ST.cfgRow.pay_basis === 'commission_only') };
  }
  function allOn(ST) { return !!(ST.cfg && ST.cfg.svc_all); }
  X.desc = function (ST) { return allOn(ST) ? X.build(curData(ST)) : null; };

  /* ---------- D) PV for all staff this month + PVD ---------- */
  X.createAll = async function (m, y) {
    var u = U(), L = u.L, t = u.tid();
    var q = function (tb, sel) { return sb.from(tb).select(sel).eq('tenant_id', t).is('deleted_at', null); };
    var r0 = await Promise.all([
      q('svc_comm_months', 'id,employee_id,status,commission_total,product_sales,bonus_on').eq('month', m).eq('year', y),
      q('svc_comm_settings', '*'),
      q('svc_logs', 'employee_id,log_date,service,code,price,client_status,lead_source').gte('log_date', y + '-' + u.pad(m) + '-01').lt('log_date', (m === 12 ? (y + 1) + '-01' : y + '-' + u.pad(m + 1)) + '-01'),
      q('svc_product_logs', 'employee_id,log_date,code,name,qty,amount').gte('log_date', y + '-' + u.pad(m) + '-01').lt('log_date', (m === 12 ? (y + 1) + '-01' : y + '-' + u.pad(m + 1)) + '-01'),
      q('svc_comm_months', 'employee_id,commission_total').eq('month', m === 1 ? 12 : m - 1).eq('year', m === 1 ? y - 1 : y),
      q('payment_vouchers', 'id,source_ref,status').eq('source', 'svc').neq('status', 'void'),
      S().loadCodes()
    ]);
    for (var i = 0; i < 6; i++) if (r0[i].error) { u.toast(u.missing(r0[i].error) ? L('Run the service-commission SQL in Supabase first.', 'Jalankan SQL komisen servis di Supabase dahulu.') : u.errMsg(r0[i].error), 'error'); return; }
    var mons = r0[0].data || [], cfg = {}, pvBy = {};
    (r0[1].data || []).forEach(function (x) { cfg[String(x.employee_id)] = x; });
    (r0[5].data || []).forEach(function (x) { pvBy[String(x.source_ref)] = x; });
    var ids = mons.map(function (x) { return x.employee_id; });
    var emps = {}; if (ids.length) { var re = await sb.from('employees').select('id,name').eq('tenant_id', t).in('id', ids); (re.data || []).forEach(function (x) { emps[String(x.id)] = x.name; }); }
    var go = mons.filter(function (x) { var s = cfg[String(x.employee_id)]; return x.status === 'approved' && num(x.commission_total) > 0 && ((s && s.pay_via_pv) || pvBy[String(x.id)]); });
    // mixed schemes: only staff on the all-services (commission-only) scheme go into this PV run + PVD
    var isAll = function (x) { var s = cfg[String(x.employee_id)]; return !!(s && s.svc_all); };
    var otherScheme = [];
    if (mons.some(isAll)) { otherScheme = mons.filter(function (x) { return !isAll(x); }); go = go.filter(isAll); mons = mons.filter(isAll); }
    var notApproved = mons.filter(function (x) { return x.status !== 'approved'; }).length;
    var viaPayroll = mons.filter(function (x) { var s = cfg[String(x.employee_id)]; return x.status === 'approved' && !(s && s.pay_via_pv) && !pvBy[String(x.id)]; }).length;
    if (!go.length) { u.toast(L('No approved month to pay via PV for ', 'Tiada bulan diluluskan untuk dibayar via PV bagi ') + u.mlabel(m, y) + (notApproved ? L(' (' + notApproved + ' not approved yet)', ' (' + notApproved + ' belum diluluskan)') : ''), 'error'); return; }
    var tot = go.reduce(function (a, x) { return a + num(x.commission_total); }, 0);
    var msg = L('Create a PV for ' + go.length + ' staff (' + rmT(tot) + ' commission) and one PVD for ' + u.mlabel(m, y) + '?', 'Buat PV untuk ' + go.length + ' staff (komisen ' + rmT(tot) + ') dan satu PVD bagi ' + u.mlabel(m, y) + '?');
    if (notApproved) msg += '\n' + L(notApproved + ' not approved yet — skipped.', notApproved + ' belum diluluskan — dilangkau.');
    if (viaPayroll) msg += '\n' + L(viaPayroll + ' paid through payroll — skipped.', viaPayroll + ' dibayar melalui payroll — dilangkau.');
    if (otherScheme.length) { var on = otherScheme.map(function (x) { return emps[String(x.employee_id)] || ''; }).filter(Boolean).join(', '); msg += '\n' + L('Other scheme, not in this PVD: ', 'Skim lain, tiada dalam PVD ini: ') + on; }
    if (!confirm(msg)) return;
    var by = function (rows) { var o = {}; (rows || []).forEach(function (x) { (o[String(x.employee_id)] = o[String(x.employee_id)] || []).push(x); }); return o; };
    var lg = by(r0[2].data), it = by(r0[3].data), pv = {}; (r0[4].data || []).forEach(function (x) { pv[String(x.employee_id)] = x; });
    var errs = [], made = 0;
    for (var k = 0; k < go.length; k++) {
      var x = go[k], e = String(x.employee_id), s = cfg[e] || {}, args = { p_emp: x.employee_id, p_month: m, p_year: y };
      if (s.svc_all) args.p_desc = X.build({ name: emps[e] || '', m: m, y: y, cfg: s, logs: (lg[e] || []).sort(function (a, b) { return a.log_date < b.log_date ? -1 : 1; }), items: it[e] || [], prev: pv[e] || null,
        bonus_on: x.bonus_on, product_sales: x.product_sales, comm_only: s.pay_basis === 'commission_only' });
      var r = await sb.rpc('svc_create_pv', args);
      if (r.error) errs.push((emps[e] || e.slice(0, 8)) + ': ' + u.errMsg(r.error)); else made++;
    }
    var pa = { p_month: m, p_year: y, p_title: null, p_bm: u.bm() };
    if (otherScheme.length) pa.p_emp_ids = go.map(function (x) { return x.employee_id; });
    var rb = await sb.rpc('svc_create_pvd', pa);
    if (rb.error && pa.p_emp_ids && (rb.error.code === 'PGRST202' || /function|schema cache/i.test(rb.error.message || ''))) { u.toast(L('Run the latest service-commission SQL in Supabase first.', 'Jalankan SQL komisen servis terkini di Supabase dahulu.'), 'error'); await u.refresh(); return; }
    try { S()._pay.clear(); } catch (e2) {}
    if (rb.error) { u.toast(u.errMsg(rb.error), 'error'); await u.refresh(); return; }
    var b = rb.data || {};
    u.toast(L(made + ' PV ready · ' + (b.ref_no || 'PVD') + ' ' + rmT(b.total), made + ' PV sedia · ' + (b.ref_no || 'PVD') + ' ' + rmT(b.total)) + (errs.length ? ' · ' + errs.join(' · ') : ''), errs.length ? 'warning' : 'success');
    if (b.id && typeof openPage === 'function') openPage('vouchers', { view: 'pvd-detail', id: b.id }); else await u.refresh();
  };

  /* ---------- I) source file (doc_attachments entity 'svc_month', doc-files/{tenant}/svc-source/{month}/...) ---------- */
  X.load = async function (ST) {
    X.att = []; X.attOk = true;
    if (!ST.mon || !ST.mon.id || !ST.hr) return;
    var r = await sb.from('doc_attachments').select('id,file_name,storage_path,size_bytes,created_at').eq('tenant_id', S().util.tid()).eq('entity_type', 'svc_month').eq('entity_id', ST.mon.id).is('deleted_at', null).order('created_at', { ascending: true });
    if (r.error) { X.attOk = false; return; }
    X.att = r.data || [];
  };
  function safe(n) { return String(n || 'file').replace(/[^\w.\-]+/g, '_').slice(-80); }
  X.attach = async function (file) {
    var u = U(), ST = S()._st, t = u.tid();
    if (!file) return;
    if (file.size > 10485760) { u.toast(u.L('File is larger than 10 MB', 'Fail lebih besar daripada 10 MB'), 'error'); return; }
    if (!ST.mon || !ST.mon.id) {
      var rm0 = await sb.from('svc_comm_months').insert({ tenant_id: t, employee_id: ST.emp, month: ST.m, year: ST.y }).select('id').single();
      if (rm0.error) { var rr = await sb.from('svc_comm_months').select('id').eq('tenant_id', t).eq('employee_id', ST.emp).eq('month', ST.m).eq('year', ST.y).is('deleted_at', null).maybeSingle(); if (!rr.data) throw rm0.error; ST.mon = Object.assign({}, ST.mon || {}, rr.data); }
      else ST.mon = Object.assign({}, ST.mon || {}, rm0.data);
    }
    var path = t + '/svc-source/' + ST.mon.id + '/' + new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe(file.name);
    var up = await sb.storage.from('doc-files').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (up.error) throw up.error;
    var me = null; try { me = (await sb.auth.getUser()).data.user.id; } catch (e) {}
    var ins = await sb.from('doc_attachments').insert({ tenant_id: t, entity_type: 'svc_month', entity_id: ST.mon.id, storage_path: path, file_name: String(file.name || 'file').slice(0, 200),
      mime_type: (file.type || '').slice(0, 120) || null, size_bytes: file.size || null, source: 'staff', uploaded_by: me });
    if (ins.error) throw ins.error;
  };
  async function openAtt(a) {
    var r = await sb.storage.from('doc-files').createSignedUrl(a.storage_path, 300);
    if (r.error || !r.data) return U().toast(U().errMsg(r.error), 'error');
    window.open(r.data.signedUrl, '_blank', 'noopener');
  }

  /* ---------- F) receipt: WhatsApp to staff + "Received by" sign link ---------- */
  function addI18n() {
    var S2 = window.__WAD_S; if (!S2 || !S2.en || S2.en.svcRcpt) return;
    S2.en.svcRcpt = 'Payment description + receipt link'; S2.en.svcRcptD = 'Staff checks the PV and signs as Received by';
    S2.bm.svcRcpt = 'Butiran bayaran + pautan resit'; S2.bm.svcRcptD = 'Staf semak PV dan tandatangan sebagai Diterima oleh';
  }
  function pvText(ST, lang) {
    var raw = ST.pv && ST.pv.description, j = null;
    try { j = raw && /^\s*\{/.test(raw) ? JSON.parse(raw) : null; } catch (e) {}
    if (j && (j.en || j.bm)) return lang === 'bm' ? (j.bm || j.en) : (j.en || j.bm);
    if (allOn(ST)) return X.text(curData(ST), lang);
    return String(raw || '');
  }
  X.receipt = async function (ST) {
    var u = U(), L = u.L, W = window.WAD;
    if (!W || typeof W.open !== 'function') return u.toast(L('WhatsApp share is not available.', 'Kongsi WhatsApp tidak tersedia.'), 'error');
    if (!ST.pv || !ST.pv.id) return u.toast(L('Create the PV first', 'Buat PV dahulu'), 'error');
    if (typeof W.ready === 'function') { var okL = await Promise.resolve(W.ready()).catch(function () { return true; }); if (okL === false) return u.toast(L('WhatsApp share log is not set up yet.', 'Log kongsi WhatsApp belum disediakan.'), 'warning'); }
    addI18n();
    var link = null, mid = ST.mon.id;
    W.open({
      docType: 'svc', docId: mid, docRef: (ST.pv.ref_no || 'PV') + ' · ' + u.empName(), recipientKind: 'other',
      to: u.empName(), phone: (ST.empRow && ST.empRow.phone) || '', k: 'svc_receipt', tpls: [{ k: 'svc_receipt', label: 'svcRcpt', desc: 'svcRcptD' }],
      build: function (k, lang) {
        var get = link ? Promise.resolve(link) : Promise.resolve(sb.rpc('svc_sign_link_create', Object.assign(u.base(), { p_role: 'received' }))).then(function (r) { if (r.error) throw new Error(u.sigErr(r.error)); link = r.data; return link; });
        return get.then(function (l) {
          var th = typeof W.theme === 'function' ? W.theme() : null;
          var url = W.base() + 'public-svc.html?svc_sign=' + encodeURIComponent(l.token) + (lang === 'bm' ? '&lang=bm' : '') + (th ? '&theme=' + th : '');
          var co = (W.company && W.company()) || (APP.tenant && APP.tenant.name) || 'M-Core', first = String(u.empName()).split(/\s+/)[0];
          var txt = (lang === 'bm' ? 'Salam ' + first + ', ini butiran bayaran komisen anda (' + (ST.pv.ref_no || 'PV') + '):' : 'Hi ' + first + ', here is your commission payment description (' + (ST.pv.ref_no || 'PV') + '):') + '\n\n' + pvText(ST, lang) + '\n\n' +
            (lang === 'bm' ? 'Sila semak dan tandatangan sebagai Diterima oleh (tiada log masuk): ' : 'Please check and sign as Received by (no login needed): ') + url + '\n' + (lang === 'bm' ? 'Terima kasih. – ' : 'Thank you. – ') + co;
          return { text: txt, link_id: l.link_id, expires_at: l.expires_at };
        });
      }
    });
  };

  /* ---------- card on the month ---------- */
  X.card = function (ST, c) {
    var u = U(); if (!u || !ST.v4 || !ST.mon) return '';
    var L = u.L, esc = u.esc, lk = ST.mon.status === 'approved', all = allOn(ST);
    if (!ST.hr && !(ST.pv && ST.pv.id)) return '';
    if (!all && !(ST.pv && ST.pv.id) && !ST.hr) return '';
    var rc = u.sigRows().received, h = '<div class="svc-card"><div class="svc-hd"><span>' + esc(L('Payment voucher', 'Baucar bayaran')) + '</span><span class="m">' +
      (ST.pv && ST.pv.id ? esc((ST.pv.ref_no || 'PV') + ' · ' + (({ draft: L('Draft', 'Draf'), approved: L('Approved', 'Diluluskan'), paid: L('Paid', 'Dibayar') })[ST.pv.status] || ST.pv.status || '')) : esc(L('Not created', 'Belum dibuat'))) + (ST.mon.closed_at ? ' · <i class="ti ti-lock"></i>' : '') + '</span></div><div class="svc-body">';
    var txt = all ? X.text(curData(ST), u.bm() ? 'bm' : 'en') : (ST.pv && ST.pv.id ? pvText(ST, u.bm() ? 'bm' : 'en') : '');
    if (txt) h += '<pre id="svc-pvd-txt" style="white-space:pre-wrap;word-break:break-word;margin:0 0 10px;padding:10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font:inherit;font-size:12.5px;line-height:1.45;max-height:340px;overflow:auto">' + esc(txt) + '</pre>';
    h += '<div class="svc-act">';
    if (txt) h += '<button type="button" class="btn btn-outline btn-sm" id="svc-pvd-copy"><i class="ti ti-copy"></i> ' + esc(L('Copy', 'Salin')) + '</button>';
    if (ST.hr && ST.pv && ST.pv.id) h += '<button type="button" class="btn btn-outline btn-sm" id="svc-pvd-rcv"><i class="ti ti-brand-whatsapp"></i> ' + esc(L('WhatsApp to staff', 'WhatsApp ke staff')) + '</button>';
    if (ST.hr) h += '<label class="btn btn-outline btn-sm" style="cursor:pointer;white-space:nowrap"><i class="ti ti-paperclip"></i> ' + esc(L('Attach source file', 'Lampir fail asal')) + '<input type="file" id="svc-src-f" accept=".xlsx,.xls,.csv,.pdf,image/*" style="display:none"></label>';
    h += '</div>';
    if (ST.pv && ST.pv.id) h += '<div class="svc-hint">' + (rc ? '<i class="ti ti-circle-check" style="color:var(--success)"></i> ' + esc(L('Received by ', 'Diterima oleh ') + (rc.signer_name || '') + ' · ' + String(rc.signed_at || '').slice(0, 10).split('-').reverse().join('/'))
      : esc(L('Receipt: not signed yet', 'Resit: belum ditandatangani'))) + '</div>';
    if (ST.hr && X.att.length) h += '<div class="svc-hint" style="margin-top:6px">' + X.att.map(function (a) { return '<a href="#" data-svc-att="' + esc(a.id) + '" style="color:var(--primary);margin-right:10px;white-space:nowrap"><i class="ti ti-file"></i> ' + esc(a.file_name) + '</a>'; }).join('') + '</div>';
    if (!lk && all) h += '<div class="svc-hint">' + esc(L('Preview — the PV uses this text when it is created after approval.', 'Pratonton — PV guna teks ini bila dibuat selepas kelulusan.')) + '</div>';
    return h + '</div></div>';
  };
  X.wire = function (ST) {
    var u = U(), $ = function (id) { return document.getElementById(id); };
    var cp = $('svc-pvd-copy'); if (cp) cp.onclick = function () { var t = ($('svc-pvd-txt') || {}).textContent || ''; Promise.resolve(navigator.clipboard && navigator.clipboard.writeText(t)).then(function () { u.toast(u.L('Copied', 'Disalin')); }, function () { u.toast(u.L('Copy failed', 'Gagal salin'), 'error'); }); };
    var rv = $('svc-pvd-rcv'); if (rv) rv.onclick = function () { X.receipt(ST).catch(function (e) { u.toast(u.errMsg(e), 'error'); }); };
    var f = $('svc-src-f'); if (f) f.onchange = function () { var file = this.files && this.files[0]; if (!file) return; X.attach(file).then(function () { u.toast(u.L('File attached', 'Fail dilampirkan')); return u.refresh(); }, function (e) { u.toast(u.errMsg(e), 'error'); }); };
    document.querySelectorAll('[data-svc-att]').forEach(function (el) { el.onclick = function (ev) { ev.preventDefault(); var a = X.att.filter(function (x) { return String(x.id) === el.getAttribute('data-svc-att'); })[0]; if (a) openAtt(a); }; });
  };

  function hook() {
    var Sv = S(); if (!Sv || !Sv.ext || !Sv.util) return false;
    Sv.ext.desc = X.desc; Sv.ext.createAll = X.createAll; Sv.ext.load = X.load; Sv.ext.attach = X.attach; Sv.ext.card = X.card; Sv.ext.wire = X.wire;
    return true;
  }
  if (!hook()) { var n = 0, iv = setInterval(function () { if (hook() || ++n > 80) clearInterval(iv); }, 250); }
})();
