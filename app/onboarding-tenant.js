/* M-Core Onboarding Checklist - tenant checklist screen (mockup ob1). Needs onboarding-core.js + onboarding-data.js. */
(function () {
  var C = window.COB; if (!C || C._tenant) return; C._tenant = 1;
  var E = C.esc, L = C.L;
  function ring(pct, done, tot) {
    var c = 276.46, d = (c * pct / 100).toFixed(1);
    return '<svg width="104" height="104" viewBox="0 0 104 104" style="flex-shrink:0" role="img" aria-label="' + pct + '%"><circle cx="52" cy="52" r="44" fill="none" style="stroke:var(--cob-track)" stroke-width="10"/>' +
      '<circle cx="52" cy="52" r="44" fill="none" style="stroke:var(--cob-ring)" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + d + ' ' + c + '" transform="rotate(-90 52 52)"/>' +
      '<text x="52" y="52" text-anchor="middle" font-size="24" font-weight="700" style="fill:var(--text)">' + pct + '%</text><text x="52" y="69" text-anchor="middle" font-size="10.5" style="fill:var(--text-2)">' + done + ' / ' + tot + ' ' + L('done', 'siap') + '</text></svg>';
  }
  var UI = { f: 'all', open: null, tid: null };
  C.tenantBody = function (d, opt) {
    opt = opt || {};
    var it = d.items, s = C.stats(it), cl = d.cl, h = '';
    var coreOpen = it.filter(function (i) { return i.section_core && (i.status === 'pending' || i.status === 'rejected'); });
    var anyOpen = it.filter(function (i) { return i.status === 'pending' || i.status === 'rejected'; });
    if (cl.status === 'completed') h += '<div class="cob-banner info" style="margin-bottom:12px"><i class="ti ti-award"></i><div><b>' + L('Onboarding complete', 'Onboarding lengkap') + '</b> · ' + L('all items approved or not applicable', 'semua item lulus atau tak berkenaan') + (cl.completed_at ? ' · ' + C.date(cl.completed_at) : '') + '</div></div>';
    else if (coreOpen.length || anyOpen.length) {
      var dl = C.daysTo(cl.target_date), nx = coreOpen[0] || anyOpen[0];
      h += '<div class="cob-banner warn" style="margin-bottom:12px"><i class="ti ti-bell-ringing"></i><div><b>' + L('Reminder:', 'Peringatan:') + '</b> ' + coreOpen.length + ' ' + L('MAIN items incomplete.', 'item UTAMA belum lengkap.') +
        (cl.target_date ? ' ' + L('Target', 'Sasaran siap') + ' <b>' + C.date(cl.target_date) + '</b> (' + (dl >= 0 ? dl + L(' days left', ' hari lagi') : Math.abs(dl) + L(' days overdue', ' hari lewat')) + ').' : '') +
        '<div style="margin-top:6px"><span class="cob-ut" style="color:var(--cob-warn);border-color:var(--cob-warn-bd);background:transparent">' + L('Next action: ', 'Tindakan seterusnya: ') + E(nx.code + ' ' + C.lab(nx, 'label')) + '</span></div></div></div>';
    }
    C.expiring(it, 30).forEach(function (i) {
      var n = C.daysTo(i.expiry_date);
      h += '<div class="cob-banner ' + (n <= 7 ? 'err' : 'warn') + '" style="margin-bottom:12px"><i class="ti ti-calendar-due"></i><div>' + E(i.code + ' ' + C.lab(i, 'label')) + ' · ' + (n < 0 ? L('expired ', 'tamat ') + Math.abs(n) + L(' days ago', ' hari lalu') : L('expires in ', 'tamat dalam ') + n + L(' days', ' hari')) + '</div></div>';
    });
    h += '<div class="cob-card" style="padding:16px;margin-bottom:12px"><div class="row" style="gap:16px">' + ring(s.pct, s.done, s.tot) + '<div class="grow"><div style="font-size:16px;font-weight:700">' + L('Onboarding ', 'Onboarding ') + E(opt.tname || '') + '</div>' +
      '<div class="cob-sm" style="margin-top:2px">' + L('Started ', 'Mula ') + C.date(cl.started_at) + (cl.pic_name ? ' · ' + L('M-Core PIC: ', 'PIC M-Core: ') + E(cl.pic_name) : '') + '</div>' +
      '<div style="margin-top:10px"><div class="row" style="justify-content:space-between"><span class="cob-ut"><i class="ti ti-flame" style="font-size:11px"></i>' + L('MAIN', 'UTAMA') + ' ' + coreKeys(it) + '</span><b style="font-size:13px">' + s.corePct + '%</b></div>' +
      '<div class="cob-bar" style="margin-top:6px"><i style="width:' + s.corePct + '%;background:var(--cob-core)"></i></div><div class="cob-xs" style="margin-top:4px">' + s.coreDone + ' / ' + s.core + ' ' + L('main items done', 'item utama siap') + '</div></div></div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:14px;text-align:center">' + cnt(s.approved, L('Approved', 'Lulus'), 'var(--cob-ok)') + cnt(s.submitted, L('Submitted', 'Dihantar'), 'var(--cob-info)') +
      cnt(s.rejected, L('Rejected', 'Ditolak'), 'var(--cob-bad)') + cnt(s.pending, L('Not started', 'Belum'), 'var(--text)') + cnt(s.na, L('N/A', 'T/B'), 'var(--text-2)') + '</div></div>';
    var nAct = anyOpen.length;
    h += '<div class="cob-chips cob-noprint" style="margin-bottom:12px">' + chip('all', L('All ', 'Semua ') + s.tot) + chip('action', L('Needs action ', 'Perlu tindakan ') + nAct) + chip('rej', L('Rejected ', 'Ditolak ') + s.rejected) + '</div>';
    var groups = C.groups(it);
    if (!UI.open) { var g0 = groups.find(function (g) { return g.items.some(function (i) { return i.status === 'pending' || i.status === 'rejected'; }); }) || groups[0]; UI.open = {}; if (g0) UI.open[g0.key] = 1; }
    groups.forEach(function (g) {
      var vis = g.items.filter(function (i) { return UI.f === 'all' || (UI.f === 'rej' ? i.status === 'rejected' : (i.status === 'pending' || i.status === 'rejected')); });
      if (UI.f !== 'all' && !vis.length) return;
      var done = g.items.filter(function (i) { return C.done(i.status); }).length, tot = g.items.length, pct = tot ? Math.round(done * 100 / tot) : 0;
      var rj = g.items.filter(function (i) { return i.status === 'rejected'; }).length, op = !!(UI.open[g.key] || UI.f !== 'all' || opt.print);
      h += '<div class="cob-card cob-sec"><button class="cob-sech row" data-sec="' + E(g.key) + '" aria-expanded="' + op + '"><span class="cob-k">' + E(g.key) + '</span><div class="grow"><div class="row" style="gap:6px;flex-wrap:wrap"><span style="font-size:14px;font-weight:600">' + E(C.lab(g, 'name')) + '</span>' + (g.core ? '<span class="cob-ut">' + L('MAIN', 'UTAMA') + '</span>' : '') + '</div>' +
        '<div class="row" style="gap:8px;margin-top:6px"><div class="cob-bar grow"><i style="width:' + pct + '%' + (pct === 100 ? ';background:var(--cob-full)' : '') + '"></i></div><span class="cob-xs" style="white-space:nowrap">' + done + '/' + tot + '</span>' +
        (rj ? '<span class="badge badge-red cob-st" style="font-size:10.5px">' + rj + L(' rejected', ' ditolak') + '</span>' : '') + '</div></div><i class="ti ti-chevron-' + (op ? 'up' : 'down') + ' cob-noprint" style="color:var(--cob-t3);font-size:18px"></i></button>';
      if (op) vis.forEach(function (i) { h += itemRow(i, d.subs); });
      h += '</div>';
    });
    h += '<div class="cob-xs" style="text-align:center;margin:10px 0 4px"><i class="ti ti-lock"></i> ' + L('Documents stored privately for ', 'Dokumen disimpan peribadi untuk ') + E(opt.tname || '') + L(' · every view is logged', ' · setiap paparan dilog') + '</div>';
    return h;
  };
  function coreKeys(it) { var k = []; it.forEach(function (i) { if (i.section_core && k.indexOf(i.section_key) < 0) k.push(i.section_key); }); return k.join('·'); }
  function cnt(n, l, col) { return '<div><div style="font-weight:700;color:' + col + '">' + n + '</div><div class="cob-xs">' + l + '</div></div>'; }
  function chip(k, l) { return '<button class="cob-chip' + (UI.f === k ? ' on' : '') + '" data-f="' + k + '">' + l + '</button>'; }
  function itemRow(i, subs) {
    var h = '<div class="cob-item" tabindex="0" role="button" data-item="' + E(i.id) + '"><div class="row" style="align-items:flex-start"><i class="ti ' + C.typeIcon(i) + ' cob-ico"></i><div class="grow"><div style="font-size:13.5px;font-weight:500"><span class="cob-mono" style="color:var(--cob-t3);margin-right:5px">' + E(i.code) + '</span>' + E(C.lab(i, 'label')) + '</div>' +
      '<div class="cob-xs" style="margin-top:2px">' + E(C.lab(i, 'note') || '') + '</div></div>' + C.st(i.status) + '</div>';
    if (i.status === 'rejected') {
      var s = subs.find(function (x) { return x.item_id === i.id && x.decision === 'rejected'; }) || {}, rr = s.restore_result || {};
      h += '<div class="cob-banner err" style="margin:8px 0 0 28px;padding:8px 10px;font-size:12.5px"><i class="ti ti-message-report" style="font-size:16px"></i><div><b>' + L('Reason:', 'Sebab:') + '</b> ' + E(i.status_reason || '') +
        '<div class="cob-xs" style="color:var(--cob-bad);opacity:.85;margin-top:3px">Admin M-Core · ' + C.dt(i.status_at) + ((rr.restored || []).length ? L(' · old values restored', ' · nilai lama dipulihkan') : '') + ((rr.conflicts || []).length ? L(' · manual check: ', ' · semak manual: ') + E(rr.conflicts.join(', ')) : '') + '</div></div></div>' +
        '<div style="margin:8px 0 0 28px" class="cob-noprint"><button class="btn btn-sm btn-primary" style="min-height:36px" data-item="' + E(i.id) + '"><i class="ti ti-upload"></i>' + L('Resubmit', 'Hantar semula') + '</button></div>';
    }
    if (i.status === 'submitted') h += '<div class="cob-xs" style="margin:6px 0 0 28px;color:var(--cob-info)"><i class="ti ti-bolt"></i> ' + L('Already active in the system · awaiting admin review', 'Sudah aktif dalam sistem · menunggu semakan admin') + '</div>';
    return h + '</div>';
  }
  C.bindTenant = function (root, rerender, openItem) {
    root.onclick = function (ev) {
      var t = ev.target.closest('[data-f],[data-sec],[data-item]'); if (!t) return;
      if (t.dataset.f) { UI.f = t.dataset.f; rerender(); }
      else if (t.dataset.sec) { UI.open[t.dataset.sec] = !UI.open[t.dataset.sec]; rerender(); }
      else if (t.dataset.item) openItem(t.dataset.item);
    };
    root.onkeydown = function (ev) { if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.item) openItem(ev.target.dataset.item); };
  };
  C.view.client_onboarding = function (p) {
    if (p && p.view === 'item' && p.id && C.itemView) return C.itemView(p.id, 'client_onboarding', {});
    var tid = C.tid(); if (UI.tid !== tid) { UI = { f: 'all', open: null, tid: tid }; }
    return C.loadT(tid).then(function (d) {
      var m = document.getElementById('main'); if (APP.currentPage !== 'client_onboarding') return;
      if (!d.cl) {
        m.innerHTML = '<div class="cob-root" style="max-width:640px;margin:0 auto"><div class="cob-card" style="padding:24px;text-align:center"><i class="ti ti-checklist" style="font-size:36px;color:var(--primary)"></i><div style="font-size:17px;font-weight:700;margin-top:8px">' + L('Start M-Core onboarding', 'Mulakan onboarding M-Core') + '</div>' +
          '<div class="cob-sm" style="margin:6px 0 16px">' + L('A checklist of company, statutory, banking, HR and data items to set up your M-Core account.', 'Senarai semak maklumat syarikat, statutori, perbankan, SDM dan data untuk menyediakan akaun M-Core anda.') + '</div><button class="btn btn-primary" id="cob-start"><i class="ti ti-player-play"></i>' + L('Start checklist', 'Mula senarai semak') + '</button></div></div>';
        document.getElementById('cob-start').onclick = function () {
          this.disabled = true;
          sb.rpc('cob_start', {}).then(function (r) { if (r.error) throw r.error; C.go('client_onboarding', {}); }).catch(function (e) { C.toast(C.err(e), 'error'); });
        };
        return;
      }
      var draw = function () {
        m.innerHTML = '<div class="cob-root" style="max-width:880px;margin:0 auto"><div class="row cob-noprint" style="justify-content:flex-end;margin-bottom:8px"><button class="btn btn-outline btn-sm" id="cob-pdf"><i class="ti ti-file-type-pdf"></i>' + L('Export PDF', 'Eksport PDF') + '</button></div>' + C.tenantBody(d, { tname: APP.tenant.name }) + '</div>';
        document.getElementById('cob-pdf').onclick = C.print;
        C.bindTenant(m.firstChild, draw, function (id) { C.go('client_onboarding', { view: 'item', id: id }); });
      };
      draw();
    });
  };
})();
