/* M-Core Service Desk - admin 'Kontrak Servis' tab (platform admin only): list + form + summary + unpaid banner. */
(function () {
  var SD = window.SD; if (!SD || SD._contract) return; SD._contract = 1;
  var S = SD.CS = { rows: [], tenants: [], sel: null, filter: 'all', q: '' };
  function tName(id) { var t = S.tenants.find(function (x) { return SD.same(x.id, id); }); return t ? t.name : '—'; }
  SD.cTenant = tName;
  function period(c) { return SD.date(c.start_date) + ' – ' + SD.date(c.end_date); }
  function months(c) { var a = new Date(c.start_date), b = new Date(c.end_date); return Math.max(1, Math.round(((b - a) / 86400000 + 1) / 30.44)); }
  function load() {
    return Promise.all([
      sb.from('service_contracts').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      sb.from('tenants').select('id,name,code').order('name'),
      SD.catalog()
    ]).then(function (r) {
      if (r[0].error) throw r[0].error;
      S.rows = r[0].data || []; S.tenants = (r[1].data || []).filter(function (t) { return !t.deleted_at; });
      SD.persistExpired(S.rows);
    });
  }
  function list() {
    var cnt = { all: S.rows.length, active: 0, draft: 0, expired: 0, cancelled: 0 };
    S.rows.forEach(function (c) { cnt[SD.cStatus(c)]++; });
    var q = S.q.toLowerCase();
    var rows = S.rows.filter(function (c) { return (S.filter === 'all' || SD.cStatus(c) === S.filter) && (!q || tName(c.tenant_id).toLowerCase().indexOf(q) >= 0); });
    var chips = [['all', 'All', 'Semua'], ['active', 'Active', 'Aktif'], ['draft', 'Draft', 'Draf'], ['expired', 'Expired', 'Tamat'], ['cancelled', 'Cancelled', 'Batal']].filter(function (x) { return x[0] === 'all' || cnt[x[0]]; })
      .map(function (x) { return '<button class="cob-chip' + (S.filter === x[0] ? ' on' : '') + '" data-f="' + x[0] + '">' + SD.L(x[1], x[2]) + ' ' + cnt[x[0]] + '</button>'; }).join('');
    return '<div class="cob-card" style="padding:14px"><div class="row" style="margin-bottom:10px;gap:8px;flex-wrap:wrap"><b class="grow" style="font-size:15px">' + SD.L('Contracts', 'Senarai kontrak') + '</b>' +
      '<input id="sd-q" class="form-input" style="width:220px;max-width:100%" placeholder="' + SD.L('Search client…', 'Cari klien…') + '" value="' + SD.esc(S.q) + '"></div>' +
      '<div class="cob-chips" style="margin-bottom:8px">' + chips + '</div><div class="cob-scroll"><table class="cob-tbl"><tr><th>' + SD.L('Client / Period', 'Klien / Tempoh') + '</th><th>' + SD.L('Payment', 'Bayaran') + '</th><th>Status</th></tr>' +
      (rows.length ? rows.map(function (c) {
        return '<tr class="cob-click' + (S.sel && SD.same(S.sel.id, c.id) ? ' sel' : '') + '" data-id="' + c.id + '"><td><b class="cob-ell" style="max-width:280px" title="' + SD.esc(tName(c.tenant_id)) + '">' + SD.esc(tName(c.tenant_id)) + '</b><div class="cob-xs">' + period(c) + '</div></td><td>' + SD.payChip(c) + '</td><td>' + SD.cChip(c) + '</td></tr>';
      }).join('') : '<tr><td colspan="3" class="cob-xs" style="padding:18px;text-align:center">' + SD.L('No contracts yet.', 'Tiada kontrak lagi.') + '</td></tr>') + '</table></div></div>';
  }
  function summary(c) {
    if (!c || !c.id) return '';
    var svc = (c.services || []).length;
    var it = [[SD.L('Client', 'Klien'), tName(c.tenant_id)], [SD.L('Period', 'Tempoh'), months(c) + SD.L(' months · ', ' bulan · ') + period(c)],
      [SD.L('Services', 'Servis'), svc + SD.L(' of ', ' daripada ') + ((SD.catalogList || []).length || 12)], [SD.L('Monthly quota', 'Kuota bulanan'), c.monthly_quota == null ? SD.L('Unlimited', 'Tanpa had') : c.monthly_quota + SD.L(' requests', ' permohonan')],
      ['SLA', c.sla_hours + SD.L(' business hours', ' jam bekerja')], [SD.L('Renewal', 'Pembaharuan'), 'RM' + Number(c.renew_monthly_fee == null ? 750 : c.renew_monthly_fee) + SD.L(' / month after end', ' / bulan selepas tamat')]];
    var d = SD.daysTo(c.end_date), renew = SD.cStatus(c) === 'active' && d != null && d <= 30;
    return '<div class="cob-card" style="padding:16px"><div class="row"><b class="grow" style="font-size:15px">' + SD.L('Contract summary', 'Ringkasan kontrak') + '</b>' + (SD.packModal ? '<button class="btn btn-sm btn-outline" id="sd-pack"><i class="ti ti-report-analytics"></i> ' + SD.L('Monthly report', 'Laporan bulanan') + '</button>' : '') + '</div><div class="sd-sum">' +
      it.map(function (x) { return '<div><div class="cob-xs">' + x[0] + '</div><b>' + SD.esc(x[1]) + '</b></div>'; }).join('') + '</div>' +
      (renew ? '<div class="cob-banner warn" style="margin-top:12px"><i class="ti ti-refresh"></i><div>' + SD.L('Ends in ' + d + ' days. Renews monthly at RM' + c.renew_monthly_fee + ' unless the client gave a non-renewal notice. Create the renewal contract manually.', 'Tamat dalam ' + d + ' hari. Diperbaharui bulanan RM' + c.renew_monthly_fee + ' kecuali klien beri notis tidak memperbaharui. Cipta kontrak pembaharuan secara manual.') + '</div></div>' : '') + '</div>';
  }
  function paint() {
    var m = SD.main(); if (!m) return;
    var c = S.sel, unpaid = c && c.id && c.payment_status !== 'paid' && SD.cStatus(c) !== 'cancelled';
    m.innerHTML = '<div class="cob-root">' + SD.head(SD.L('Admin — Service Contracts', 'Admin — Kontrak Servis'), SD.L('Admin service contracts per client', 'Kontrak perkhidmatan pentadbiran bagi setiap klien'), '<button class="btn btn-primary" id="sd-new"><i class="ti ti-plus"></i> <span class="btn-txt">' + SD.L('New contract', 'Kontrak baharu') + '</span></button>') + SD.tabs('sd_contracts') +
      (unpaid ? '<div class="cob-banner err" style="margin-bottom:14px"><i class="ti ti-lock"></i><div><b>' + SD.L('Unpaid:', 'Belum dibayar:') + '</b> ' + SD.esc(SD.L('Contract for ' + tName(c.tenant_id) + ' is locked until invoice ' + (c.invoice_ref || '') + ' is paid. Service requests cannot be submitted.', 'Kontrak ' + tName(c.tenant_id) + ' dikunci sehingga invois ' + (c.invoice_ref || '') + ' dijelaskan. Permohonan servis tidak boleh dihantar.')) + '</div></div>' : '') +
      '<div class="sd-g2"><div class="sd-col">' + list() + summary(c) + '</div>' + SD.cForm(c) + '</div></div>';
    m.querySelector('#sd-new').onclick = function () { S.sel = null; paint(); var t = document.getElementById('sd-t'); if (t) t.focus(); };
    m.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { S.filter = b.dataset.f; paint(); }; });
    m.querySelectorAll('tr[data-id]').forEach(function (tr) { tr.onclick = function () { S.sel = S.rows.find(function (x) { return SD.same(x.id, tr.dataset.id); }); paint(); }; });
    var q = m.querySelector('#sd-q'); q.oninput = function () { S.q = q.value; var p = q.selectionStart; paint(); var n = document.getElementById('sd-q'); n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} };
    m.querySelectorAll('#sd-p button').forEach(function (b) { b.onclick = function () { m.querySelectorAll('#sd-p button').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    m.querySelector('#sd-free').onclick = function () { this.classList.toggle('on'); };
    m.querySelector('#sd-form').onsubmit = function (e) { SD.cSave(e).then(function (ok) { if (ok) refresh(); }); };
    m.querySelector('#sd-cancel').onclick = function () { paint(); };
    var d = m.querySelector('#sd-del'); if (d) d.onclick = function () {
      if (!confirm(SD.L('Delete this contract? (soft delete)', 'Padam kontrak ini? (padam lembut)'))) return;
      sb.from('service_contracts').update({ deleted_at: new Date().toISOString() }).eq('id', S.sel.id).then(function (r) { if (r.error) return SD.toast(SD.err(r.error), 'error'); S.sel = null; refresh(); });
    };
    var pk = m.querySelector('#sd-pack'); if (pk) pk.onclick = function () { SD.packModal(c.tenant_id, tName(c.tenant_id)); };
  }
  function refresh() { return load().then(function () { SD.catalogList = SD.catalogList || []; if (S.sel) S.sel = S.rows.find(function (x) { return SD.same(x.id, S.sel.id); }) || null; paint(); }); }
  SD.admin.sd_contracts = function () { return SD.catalog().then(function (c) { SD.catalogList = c; return refresh(); }); };
  SD.contractsCache = function () { return S; };
})();
