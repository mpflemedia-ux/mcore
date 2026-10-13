/* M-Core Projects - Share WhatsApp sheet parts: template list, recipient picker (staff / client / other). */
(function () {
  var W = window.PJW; if (!W || W._recHtml) return;
  W._recips = function () {
    var S = W.SS;
    var q = S.q.toLowerCase();
    var list = S.kind === 'staff' ? W.emps.map(function (e) { return { id: e.id, n: e.nickname || e.name, s: e.nickname && e.name !== e.nickname ? e.name : '', ph: e.phone }; })
      : S.kind === 'client' ? W.custs.map(function (c) { return { id: c.id, n: c.name, s: '', ph: c.phone }; }) : [];
    return list.filter(function (r) { return !q || String(r.n + ' ' + r.s).toLowerCase().indexOf(q) >= 0; }).slice(0, 60);
  };
  var av = function (n) { return W.esc(String(n || '?').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase() || '?'); };
  W._seg = function () { var S = W.SS; return '<div class="cob-seg" role="group" aria-label="Language"><button type="button" data-lang="en" class="' + (S.lang === 'en' ? 'on' : '') + '">EN</button><button type="button" data-lang="bm" class="' + (S.lang === 'bm' ? 'on' : '') + '">BM</button></div>'; };
  W._tplHtml = function (compact) {
    var S = W.SS;
    var IC = { reminder: 'ti-bell-ringing', request_info: 'ti-help-circle', done: 'ti-circle-check', client: 'ti-user-share' };
    var D = { reminder: W.L('Remind the assignee about the task & due date', 'Ingatkan assignee tentang task & tarikh akhir'), request_info: W.L('Ask for documents / answers needed', 'Minta dokumen / jawapan yang diperlukan'), done: W.L('Let them know the task is done', 'Maklumkan task sudah selesai'), client: W.L('Customer-friendly summary, no internal details', 'Ringkasan mesra pelanggan tanpa butiran dalaman') };
    return '<div class="pjw-hd" style="margin-bottom:10px"><b style="font-size:13px">' + W.L('Message template', 'Template mesej') + '</b>' + W._seg() + '</div>' +
      W.TPL.map(function (t) { var on = S.tpl === t; return '<button type="button" class="pjw-opt' + (on ? ' on' : '') + '" data-tpl="' + t + '"><i class="ti ' + IC[t] + '"></i><div><b style="font-size:14px">' + W.tplName(t) + '</b>' + (compact ? '' : '<small>' + D[t] + '</small>') + '</div><i class="ti ' + (on ? 'ti-circle-check-filled' : 'ti-circle') + '" style="font-size:20px"></i></button>'; }).join('');
  };
  W._recHtml = function () {
    var S = W.SS;
    var k = S.o.task, rs = W._recips();
    var row = function (r, tag) { var on = W.same(r.id, S.rid), ph = W.phone(r.ph); return '<button type="button" class="pjw-opt' + (on ? ' on' : '') + '" data-rid="' + W.esc(r.id) + '"><span class="pjw-av">' + av(r.n) + '</span><div><b style="font-size:13.5px">' + W.esc(r.n) + '</b>' + (r.s || tag ? '<small>' + W.esc(tag || r.s) + '</small>' : '') + '</div><span class="pjw-ph"' + (ph ? '' : ' style="color:var(--warning)"') + '>' + (ph ? '+' + ph : W.L('No phone no.', 'Tiada no. telefon')) + '</span>' + (on ? '<i class="ti ti-circle-check-filled" style="color:var(--primary);font-size:20px"></i>' : '') + '</button>'; };
    var h = '<div class="cob-chips" style="margin-bottom:12px">' + [['staff', 'ti-users', W.L('Staff', 'Staf')], ['client', 'ti-address-book', W.L('Client', 'Klien')], ['other', 'ti-users-group', W.L('Other / group', 'Lain / group')]].map(function (x) { return '<button type="button" class="cob-chip' + (S.kind === x[0] ? ' on' : '') + '" data-kind="' + x[0] + '"><i class="ti ' + x[1] + '"></i> ' + x[2] + '</button>'; }).join('') + '</div>';
    if (S.kind === 'other') return h + '<div class="pjw-opt on" style="cursor:default"><i class="ti ti-link"></i><div><b style="font-size:13.5px">' + W.L('Other / group', 'Lain / group') + '</b><small>' + W.L('No number: pick a contact or group inside WhatsApp.', 'Tiada nombor: pilih kenalan atau group terus dalam WhatsApp.') + '</small></div></div>';
    h += '<input class="form-input" id="pjw-q" data-no-titlecase="1" placeholder="' + W.esc(S.kind === 'staff' ? W.L('Search staff…', 'Cari staf…') : W.L('Search client…', 'Cari klien…')) + '" value="' + W.esc(S.q) + '" style="margin-bottom:10px">';
    var asg = k && S.kind === 'staff' ? rs.filter(function (r) { return W.same(r.id, k.assignee_employee_id); }) : [];
    if (asg.length) h += '<div class="pjw-sec">ASSIGNEE</div>' + asg.map(function (r) { return row(r); }).join('') + '<div class="pjw-sec">' + W.L('OTHER STAFF', 'STAF LAIN') + '</div>';
    var rest = rs.filter(function (r) { return asg.indexOf(r) < 0; });
    return h + (rest.length ? rest.map(function (r) { return row(r); }).join('') : '<div class="cob-xs" style="padding:8px 0">' + W.L('No match', 'Tiada padanan') + '</div>');
  };
})();
