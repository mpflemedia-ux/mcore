/* M-Core Service Desk - monthly report pack. Client 'Laporan Bulanan' (only months the admin marked sent): SLA summary +
   Sales / Accounts (existing Reports renderers, rendered into a hidden host) + HR + Operations; print to PDF. */
(function () {
  var SD = window.SD; if (!SD || SD._report) return; SD._report = 1;
  var MB = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  var ME = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function mName(ym) { var d = String(ym).slice(0, 7).split('-'); return (SD.bm() ? MB : ME)[+d[1] - 1] + ' ' + d[0]; }
  function range(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7), last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return [ym.slice(0, 8) + '01', ym.slice(0, 8) + String(last).padStart(2, '0')]; }
  function iso(d, end) { return new Date(Date.parse(d + (end ? 'T23:59:59' : 'T00:00:00') + '+08:00')).toISOString(); }
  var busy = Promise.resolve();
  /* reuse an existing report renderer: swap #main for a hidden host, render, set the pack month, reload, copy the result */
  SD.reuse = function (render, fromId, toId, loader, resultId, from, to) {
    busy = busy.then(function () {
      var real = document.getElementById('main'); if (!real || typeof window[render] !== 'function') return '';
      var host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-99999px;top:0;width:900px;visibility:hidden';
      real.id = 'sd-main-real'; host.id = 'main'; document.body.appendChild(host);
      var restore = function () { host.remove(); real.id = 'main'; };
      return Promise.resolve().then(function () { return window[render](); }).then(function () {
        var f = document.getElementById(fromId), t = document.getElementById(toId); if (f) f.value = from; if (t) t.value = to;
        return typeof window[loader] === 'function' ? window[loader]() : null;
      }).then(function () { var r = document.getElementById(resultId); var h = r ? r.innerHTML : ''; restore(); return h; }, function (e) { restore(); console.warn('[sd] report reuse', e); return ''; });
    });
    return busy;
  };
  function cnt(q) { return Promise.resolve(q).then(function (r) { return r && !r.error ? (r.count || 0) : '—'; }, function () { return '—'; }); }
  function sec(icon, title, body, id) { return '<div class="cob-card" style="padding:16px;margin-bottom:12px"' + (id ? ' id="' + id + '"' : '') + '><b style="font-size:15px"><i class="ti ' + icon + '"></i> ' + title + '</b><div style="margin-top:10px;overflow-x:auto">' + body + '</div></div>'; }
  function stat(a) { return '<div class="sd-sum">' + a.map(function (x) { return '<div><div class="cob-xs">' + x[0] + '</div><b style="font-size:16px">' + x[1] + '</b></div>'; }).join('') + '</div>'; }
  SD.view.laporan_bulanan = function (p) {
    var tid = SD.tid();
    return sb.from('service_report_packs').select('*').eq('tenant_id', tid).eq('status', 'sent').is('deleted_at', null).order('month', { ascending: false }).then(function (r) {
      if (r.error) throw r.error;
      var packs = r.data || [], m = SD.main();
      if (!packs.length) { m.innerHTML = '<div class="cob-root"><div class="empty-state" style="padding:48px"><i class="ti ti-report-analytics" style="font-size:32px;color:var(--text-3)"></i><p>' + SD.L('No monthly report has been sent yet.', 'Belum ada laporan bulanan dihantar.') + '</p></div></div>'; return; }
      var pk = packs.find(function (x) { return p.month && x.month === p.month; }) || packs[0], rg = range(pk.month);
      m.innerHTML = '<div class="cob-root"><div class="row sd-noprint" style="gap:8px;flex-wrap:wrap;margin-bottom:12px"><select class="form-input" id="sd-m" style="width:auto">' + packs.map(function (x) { return '<option value="' + x.month + '"' + (x === pk ? ' selected' : '') + '>' + mName(x.month) + '</option>'; }).join('') + '</select><span class="grow"></span>' +
        '<button class="btn btn-primary" id="sd-pdf"><i class="ti ti-download"></i> ' + SD.L('Download all (PDF)', 'Muat turun semua (PDF)') + '</button></div>' +
        '<div class="sd-pack pdoc" style="background:none;padding:0;margin:0;box-shadow:none;border:0;width:auto;max-width:none;min-height:0;color:inherit"><div class="cob-card" style="padding:16px;margin-bottom:12px"><div class="cob-xs" style="font-weight:700;letter-spacing:.05em">' + SD.L('MONTHLY REPORT PACK', 'PEK LAPORAN BULANAN') + '</div><div style="font-weight:700;font-size:18px;margin-top:2px">' + mName(pk.month) + '</div><div class="cob-sm">' + SD.esc((APP.tenant && APP.tenant.name) || '') + ' · ' + SD.L('Sent ', 'Dihantar ') + SD.dt(pk.sent_at) + '</div></div>' +
        sec('ti-clock-check', SD.L('Service summary (SLA)', 'Ringkasan servis (SLA)'), '<div class="spinner"></div>', 'sd-r-sla') + sec('ti-chart-bar', SD.L('Sales', 'Jualan'), '<div class="spinner"></div>', 'sd-r-sales') +
        sec('ti-users', SD.L('HR', 'HR'), '<div class="spinner"></div>', 'sd-r-hr') + sec('ti-report-money', SD.L('Accounts', 'Akaun'), '<div class="spinner"></div>', 'sd-r-acc') + sec('ti-settings-automation', SD.L('Operations', 'Operasi'), '<div class="spinner"></div>', 'sd-r-ops') + '</div></div>';
      m.querySelector('#sd-m').onchange = function () { SD.go('laporan_bulanan', { month: this.value }); };
      m.querySelector('#sd-pdf').onclick = function () { document.body.classList.add('sd-printing'); setTimeout(function () { window.print(); setTimeout(function () { document.body.classList.remove('sd-printing'); }, 400); }, 50); };
      var put = function (id, h) { var e = document.getElementById(id); if (e) e.querySelector('div').innerHTML = h || '<span class="cob-xs">' + SD.L('No data for this period', 'Tiada data untuk tempoh ini') + '</span>'; };
      var a = iso(rg[0]), b = iso(rg[1], true);
      sb.from('service_requests').select('status,created_at,delivered_at,due_at,sla_paused_seconds,paused_at,service_code').eq('tenant_id', tid).is('deleted_at', null).gte('created_at', a).lte('created_at', b).then(function (q) {
        var rows = q.data || [], dl = rows.filter(function (x) { return x.delivered_at; });
        var ontime = dl.filter(function (x) { var d = SD.due(Object.assign({}, x, { paused_at: null })); return !d || new Date(x.delivered_at) <= d; }).length;
        var avg = dl.length ? Math.round(dl.reduce(function (s, x) { return s + SD.bhBetween(x.created_at, x.delivered_at); }, 0) / dl.length) + SD.L(' h', ' j') : '—';
        put('sd-r-sla', stat([[SD.L('Requests', 'Permohonan'), rows.length], [SD.L('Delivered', 'Dihantar'), dl.length], [SD.L('On time', 'Tepat masa'), dl.length ? Math.round(ontime / dl.length * 100) + '%' : '—'], [SD.L('Avg completion', 'Purata siap'), avg]]) + '<div class="cob-xs" style="margin-top:8px">' + SD.L('Business hours Mon–Fri; public holidays not excluded.', 'Jam bekerja Isnin–Jumaat; cuti umum tidak dikecualikan.') + '</div>');
        var by = {}; rows.forEach(function (x) { by[x.service_code] = (by[x.service_code] || 0) + 1; });
        put('sd-r-ops', Object.keys(by).length ? '<table class="cob-tbl"><tr><th>' + SD.L('Service', 'Servis') + '</th><th class="num">' + SD.L('Requests', 'Permohonan') + '</th></tr>' + Object.keys(by).map(function (k) { return '<tr><td>' + SD.esc(SD.svcName(k)) + '</td><td class="num">' + by[k] + '</td></tr>'; }).join('') + '</table>' : '');
      });
      Promise.all([cnt(sb.from('employees').select('id', { count: 'exact', head: true })), cnt(sb.from('leave_requests').select('id', { count: 'exact', head: true }).gte('created_at', a).lte('created_at', b)), cnt(sb.from('payroll_records').select('id', { count: 'exact', head: true }).gte('created_at', a).lte('created_at', b))])
        .then(function (h) { put('sd-r-hr', stat([[SD.L('Employees', 'Pekerja'), h[0]], [SD.L('Leave requests', 'Permohonan cuti'), h[1]], [SD.L('Payslips', 'Slip gaji'), h[2]]])); });
      SD.reuse('renderSalesReport', 'sales-from', 'sales-to', '_salesRepLoad', 'sales-rep-result', rg[0], rg[1]).then(function (h) { put('sd-r-sales', h); });
      SD.reuse('renderPnL', 'pnl-from', 'pnl-to', '_pnlLoad', 'pnl-result', rg[0], rg[1]).then(function (h) { put('sd-r-acc', h); });
    });
  };
  /* admin: create / send a month's pack for one tenant (from the contract summary) */
  SD.packModal = function (tid, tname) {
    var ym = SD.today().slice(0, 8) + '01';
    var w = SD.modal(SD.L('Monthly report pack', 'Pek laporan bulanan'), '<div class="cob-sm" style="margin-bottom:10px">' + SD.esc(tname) + '</div><label class="form-label">' + SD.L('Month', 'Bulan') + '</label><input type="month" class="form-input" id="sd-pm" value="' + ym.slice(0, 7) + '"><div id="sd-pst" class="cob-xs" style="margin:10px 0"></div>' +
      '<div class="cob-xs" style="margin-bottom:12px">' + SD.L('The client sees the pack only after it is sent. Figures are generated live from the client’s own data.', 'Klien hanya nampak pek selepas dihantar. Angka dijana terus daripada data klien sendiri.') + '</div><div class="sd-acts"><button class="btn btn-outline" id="sd-pd" style="flex:1">' + SD.L('Save draft', 'Simpan draf') + '</button><button class="btn btn-primary" id="sd-ps" style="flex:1"><i class="ti ti-send"></i> ' + SD.L('Send to client', 'Hantar kepada klien') + '</button></div>');
    var cur = null, month = function () { return w.querySelector('#sd-pm').value + '-01'; };
    var look = function () { return sb.from('service_report_packs').select('*').eq('tenant_id', tid).eq('month', month()).is('deleted_at', null).maybeSingle().then(function (r) { cur = r.data; w.querySelector('#sd-pst').innerHTML = cur ? (cur.status === 'sent' ? SD.L('Sent ', 'Dihantar ') + SD.dt(cur.sent_at) : SD.L('Draft saved', 'Draf disimpan')) : SD.L('Not created yet', 'Belum dicipta'); }); };
    var save = function (sent) {
      var rec = sent ? { status: 'sent', sent_at: new Date().toISOString(), sent_by: SD.uid() } : { status: cur ? cur.status : 'draft' };
      var q = cur ? sb.from('service_report_packs').update(rec).eq('id', cur.id) : sb.from('service_report_packs').insert(Object.assign({ tenant_id: tid, month: month() }, rec));
      return q.then(function (r) {
        if (r.error) return SD.toast(SD.err(r.error), 'error');
        if (sent) SD.bellFor({ tenant_id: tid }, SD.L('Monthly report ready: ', 'Laporan bulanan sedia: ') + mName(month()), tname);
        SD.toast(sent ? SD.L('Sent to client', 'Dihantar kepada klien') : SD.L('Draft saved', 'Draf disimpan'), 'success'); look();
      });
    };
    w.querySelector('#sd-pm').onchange = look; w.querySelector('#sd-pd').onclick = function () { save(false); }; w.querySelector('#sd-ps').onclick = function () { save(true); };
    look();
  };
})();
