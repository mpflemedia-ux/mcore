/* M-Core Service Desk - client 'Servis Saya': contract card, counters, list, FAB, 3-step new request. */
(function () {
  var SD = window.SD; if (!SD || SD._client) return; SD._client = 1;
  var S = SD.CL = { c: null, rows: [], f: 'all', used: 0 };
  function lockMsg(c) {
    var x = !c ? SD.L('No service contract yet. Contact M-Core to start.', 'Tiada kontrak servis lagi. Hubungi M-Core untuk bermula.')
      : c.payment_status !== 'paid' ? SD.L('Your contract is locked until the contract invoice ' + (c.invoice_ref || '') + ' is paid.', 'Kontrak anda dikunci sehingga invois kontrak ' + (c.invoice_ref || '') + ' dijelaskan.')
      : SD.cStatus(c) === 'expired' ? SD.L('Your contract has ended.', 'Kontrak anda telah tamat.') : SD.L('Your contract is not active yet.', 'Kontrak anda belum aktif.');
    return '<div class="cob-banner ' + (!c ? 'info' : 'err') + '" style="margin-bottom:12px"><i class="ti ti-lock"></i><div>' + SD.esc(x) + '</div></div>';
  }
  function card(c) {
    if (!c) return '';
    var q = c.monthly_quota, pct = q ? Math.min(100, Math.round(S.used / q * 100)) : 0, mon = SD.date(SD.monthStart(), false).replace(/^\d+ /, '');
    return '<div class="cob-card" style="padding:16px;margin-bottom:12px"><div class="row"><div class="grow" style="min-width:0"><div class="cob-xs" style="font-weight:700;letter-spacing:.05em">' + SD.L('SERVICE CONTRACT', 'KONTRAK SERVIS') + '</div><div class="cob-ell" style="font-weight:700;font-size:15px;margin-top:2px">' + SD.esc((APP.tenant && APP.tenant.name) || '') + '</div></div>' + SD.cChip(c) + '</div>' +
      '<div class="row cob-sm" style="margin-top:8px;gap:8px;flex-wrap:wrap"><span class="grow"><i class="ti ti-calendar"></i> ' + SD.date(c.start_date) + ' – ' + SD.date(c.end_date) + '</span><span><i class="ti ti-clock"></i> SLA ' + c.sla_hours + SD.L(' business h', ' jam bekerja') + '</span></div>' +
      (q != null ? '<div class="row" style="justify-content:space-between;margin-top:10px"><b style="font-size:12.5px">' + SD.L('Quota ', 'Kuota ') + mon + '</b><b style="font-size:12.5px">' + S.used + ' / ' + q + '</b></div><div class="cob-bar" style="margin-top:6px"><i style="width:' + pct + '%"></i></div>' : '') + '</div>';
  }
  function notices(c) {
    var h = '', ex = SD.exportDays(c), d = c && SD.daysTo(c.end_date);
    if (ex != null) h += '<div class="cob-banner warn" style="margin-bottom:12px"><i class="ti ti-download"></i><div>' + SD.L('Contract ended. You have ' + ex + ' days left to download your files and data.', 'Kontrak tamat. Anda ada ' + ex + ' hari lagi untuk memuat turun fail dan data anda.') + '</div></div>';
    else if (c && SD.cStatus(c) === 'active' && d != null && d <= 30) h += '<div class="cob-banner info" style="margin-bottom:12px"><i class="ti ti-refresh"></i><div>' + SD.L('Contract ends in ' + d + ' days and renews monthly at RM' + c.renew_monthly_fee + ' unless you give notice 30 days before the end.', 'Kontrak tamat dalam ' + d + ' hari dan diperbaharui bulanan RM' + c.renew_monthly_fee + ' kecuali anda beri notis 30 hari sebelum tamat.') + '</div></div>';
    return h;
  }
  function paint() {
    var m = SD.main(); if (!m) return;
    var c = S.c, ok = SD.usable(c), n = { p: 0, w: 0, d: 0, c: 0 };
    S.rows.forEach(function (r) { if (['submitted', 'triaged', 'in_progress', 'revision'].indexOf(r.status) >= 0) n.p++; else if (r.status === 'waiting_client') n.w++; else if (r.status === 'delivered') n.d++; else n.c++; });
    var act = S.rows.filter(function (r) { return r.status === 'waiting_client' || r.status === 'delivered'; }).length;
    var rows = S.rows.filter(function (r) { return S.f === 'all' || (S.f === 'act' ? (r.status === 'waiting_client' || r.status === 'delivered') : r.status === 'delivered'); });
    m.innerHTML = '<div class="cob-root" style="padding-bottom:80px">' + (ok ? '' : lockMsg(c)) + notices(c) + card(c) +
      '<div class="sd-cnt">' + [[n.p, SD.L('In progress', 'Proses'), 'var(--cob-info,var(--info))'], [n.w, SD.L('Waiting', 'Tunggu'), 'var(--cob-warn,var(--warning))'], [n.d, SD.L('Delivered', 'Dihantar'), 'var(--cob-ok,var(--success))'], [n.c, SD.L('Closed', 'Ditutup'), 'var(--text-2)']]
        .map(function (x) { return '<div class="cob-card"><b style="color:' + x[2] + '">' + x[0] + '</b><span class="cob-xs">' + x[1] + '</span></div>'; }).join('') + '</div>' +
      '<div class="cob-chips" style="margin-bottom:10px">' + [['all', SD.L('All ', 'Semua ') + S.rows.length], ['act', SD.L('Needs action ', 'Perlu tindakan ') + act], ['del', SD.L('Delivered ', 'Dihantar ') + n.d]]
        .map(function (x) { return '<button class="cob-chip' + (S.f === x[0] ? ' on' : '') + '" data-f="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="cob-card" style="padding:0;overflow:hidden">' + (rows.length ? rows.map(function (r) {
        return '<button class="sd-li" data-id="' + r.id + '"><i class="ti ti-headset" style="font-size:18px;color:var(--text-2);margin-top:2px"></i><div class="grow" style="min-width:0"><div class="sd-ref">' + SD.esc(r.ref_no) + '</div><b style="display:block;font-size:14px;margin-top:2px">' + SD.esc(r.title) + '</b><div class="cob-xs cob-ell">' + SD.esc(SD.svcName(r.service_code)) + '</div></div>' + SD.st(r.status) + '</button>';
      }).join('') : '<div class="cob-xs" style="padding:22px;text-align:center">' + SD.L('No requests yet.', 'Tiada permohonan lagi.') + '</div>') + '</div>' +
      (ok ? '<button class="btn btn-primary sd-fab" id="sd-fab"><i class="ti ti-plus"></i> ' + SD.L('New request', 'Permohonan baharu') + '</button>' : '') + '</div>';
    m.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { S.f = b.dataset.f; paint(); }; });
    m.querySelectorAll('.sd-li').forEach(function (b) { b.onclick = function () { SD.go('servis_saya', { id: b.dataset.id }); }; });
    var f = m.querySelector('#sd-fab'); if (f) f.onclick = function () { SD.go('servis_saya', { new: 1 }); };
  }
  function load() {
    var tid = SD.tid();
    return Promise.all([SD.catalog(), SD.myContract(tid), sb.from('service_requests').select('*').eq('tenant_id', tid).is('deleted_at', null).order('created_at', { ascending: false }).limit(300)])
      .then(function (r) {
        if (r[2].error) throw r[2].error;
        S.c = r[1]; S.rows = r[2].data || [];
        var ms = SD.monthIso();
        S.used = S.rows.filter(function (x) { return x.created_at >= ms && x.status !== 'cancelled'; }).length;
        return SD.autoClose(S.rows);
      });
  }
  SD.view.servis_saya = function (p) {
    return SD.catalog().then(function (c) { SD.catalogList = c; return load(); }).then(function () {
      if (p.id && SD.detail) return SD.detail(p.id, false);
      if (p.new && SD.usable(S.c) && SD.newReq) return SD.newReq();
      paint();
    });
  };
  SD.onChange = function () { if (APP.currentPage === 'servis_saya' && document.querySelector('.sd-cnt')) SD.view.servis_saya({}); else if (typeof SD.onChangeAdmin === 'function') SD.onChangeAdmin(); };
})();
