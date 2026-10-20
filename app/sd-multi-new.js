/* M-Core Service Desk - multi-request wizard (max 5 services): 1 pick (quota, duplicate open SR, templates, draft),
   2 details (same-for-all, per-service + shared files), 3 review + save template. 1 service = normal SR; 2+ = group SG-.
   Wraps SD.newReq only when sd_multi_01.sql is live; otherwise the original single-request wizard runs unchanged. */
(function () {
  var SD = window.SD, MG = SD && SD.MG; if (!MG || SD._mgNew || !SD.newReq) return; SD._mgNew = 1;
  var orig = SD.newReq, N, S, tpls = [], saved = null, draft = null;
    function fresh() { return { step: 1, svcs: [], dup: {}, same: true, c: { title: '', desc: '', pri: 'normal' }, per: {}, files: [], pf: {}, tpl: false, tname: '' }; }
  function cat() { var c = S.c || {}; return (SD.catalogList || []).filter(function (x) { return (c.services || []).indexOf(x.code) >= 0; }); }
  function left() { var c = S.c; return c && c.monthly_quota != null ? c.monthly_quota - S.used : null; }
  function openDup(code) { return (S.rows || []).find(function (r) { return r.service_code === code && ['submitted', 'triaged', 'in_progress', 'waiting_client', 'revision'].indexOf(r.status) >= 0; }); }
  /* split selection: duplicate->note, then quota keeps the first `left`, the rest are skipped */
  function plan() {
    var l = left(), mk = [], note = [], skip = [];
    N.svcs.forEach(function (k) { if (N.dup[k] === 'note' && openDup(k)) note.push(k); else if (l == null || mk.length < l) mk.push(k); else skip.push(k); });
    return { mk: mk, note: note, skip: skip };
  }
  function det(k) { return N.same ? N.c : (N.per[k] = N.per[k] || { title: N.c.title, desc: N.c.desc, pri: N.c.pri }); }
  function persist() { var p = JSON.parse(JSON.stringify(N)); p.files = []; p.pf = {}; MG.draftSave(p).then(function (t) { if (t) { saved = t; var e = document.getElementById('mg-saved'); if (e) e.textContent = SD.L('Draft saved ', 'Draf disimpan ') + SD.time(t); } }); }
  function paint() {
    var m = SD.main(); if (!m) return;
    var l = left(), P = plan(), body = '';
    if (N.step === 1) {
      body = (draft ? '<div class="cob-banner info" style="margin-bottom:12px"><i class="ti ti-device-floppy"></i><div class="grow">' + SD.L('You have an unsent draft.', 'Anda ada draf belum dihantar.') + '<div class="sd-acts" style="margin-top:8px"><button class="btn btn-sm btn-primary" id="mg-dres">' + SD.L('Resume', 'Sambung') + '</button><button class="btn btn-sm btn-outline" id="mg-ddel">' + SD.L('Discard', 'Buang') + '</button></div></div></div>' : '') +
        (tpls.length ? '<div class="cob-xs" style="margin-bottom:6px">' + SD.L('Templates', 'Templat') + '</div><div class="cob-chips" style="margin-bottom:12px;flex-wrap:wrap">' + tpls.map(function (t) { return '<button class="cob-chip" data-tpl="' + t.id + '"><i class="ti ti-bolt"></i> ' + SD.esc(t.name) + '</button>'; }).join('') + '</div>' : '') +
        '<div class="row" style="margin-bottom:2px"><b class="grow" style="font-size:15px">' + SD.L('Which services?', 'Servis apa?') + '</b><span class="cob-xs">' + N.svcs.length + SD.L(' of max ', ' daripada maks ') + MG.MAX + '</span></div>' +
        '<div class="cob-xs" style="margin-bottom:12px">' + (l != null ? SD.L(l + ' requests left this month · each service uses 1', 'Baki ' + l + ' permohonan bulan ini · setiap servis guna 1') : SD.L('No monthly limit', 'Tiada had bulanan')) + '</div><div class="sd-pick">' +
        cat().map(function (x) {
          var on = N.svcs.indexOf(x.code) >= 0, dis = !on && N.svcs.length >= MG.MAX, d = on && openDup(x.code), sk = on && P.skip.indexOf(x.code) >= 0;
          return '<label style="flex-wrap:wrap' + (dis ? ';opacity:.55' : '') + '"><input type="checkbox" value="' + x.code + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '><span class="grow">' + SD.esc(SD.L(x.name_en, x.name_bm)) + '</span>' +
            (sk ? '<div class="cob-banner err" style="flex-basis:100%;margin:6px 0 0"><i class="ti ti-alert-triangle"></i><div>' + SD.L('Quota full this month: this service will be skipped.', 'Kuota bulan ini penuh: servis ini akan diskip.') + '</div></div>' : '') +
            (d ? '<div class="cob-banner warn" style="flex-basis:100%;margin:6px 0 0"><i class="ti ti-alert-triangle"></i><div>' + SD.L('Open request ', 'Permohonan terbuka ') + '<b>' + SD.esc(d.ref_no) + '</b> "' + SD.esc(d.title) + '"' + SD.L(' already exists for this service.', ' sudah ada untuk servis ini.') +
              '<div class="sd-acts" style="margin-top:8px"><button type="button" class="btn btn-sm ' + (N.dup[x.code] === 'note' ? 'btn-primary' : 'btn-outline') + '" data-dup="' + x.code + '" data-v="note">' + SD.L('Add to existing SR', 'Tambah ke SR sedia ada') + '</button><button type="button" class="btn btn-sm ' + (N.dup[x.code] !== 'note' ? 'btn-primary' : 'btn-outline') + '" data-dup="' + x.code + '" data-v="new">' + SD.L('Create new', 'Buat baharu') + '</button></div></div></div>' : '') + '</label>';
        }).join('') + '</div>';
    } else if (N.step === 2) {
      var tab = N.tab && N.svcs.indexOf(N.tab) >= 0 ? N.tab : N.svcs[0];
      body = (N.svcs.length > 1 ? '<label class="row cob-card" style="padding:12px;margin-bottom:12px;gap:10px;cursor:pointer"><span class="grow"><b style="display:block">' + SD.L('Use same details for all', 'Guna butiran sama untuk semua') + '</b><span class="cob-xs">' + SD.L('Copy title, details & priority to all ' + N.svcs.length + ' services', 'Salin tajuk, butiran & keutamaan ke semua ' + N.svcs.length + ' servis') + '</span></span><input type="checkbox" id="mg-same" style="width:20px;height:20px;accent-color:var(--primary)"' + (N.same ? ' checked' : '') + '></label>' : '') +
        (N.same || N.svcs.length < 2 ? SD.mgUI.form(N.c) : '<div class="cob-chips" style="margin-bottom:10px;flex-wrap:wrap">' + N.svcs.map(function (k) { return '<button class="cob-chip' + (k === tab ? ' on' : '') + '" data-tab="' + k + '">' + SD.esc(SD.svcName(k)) + '</button>'; }).join('') + '</div>' + SD.mgUI.form(det(tab), tab)) +
        '<div class="form-group"><label class="form-label">' + SD.L('Files for ', 'Fail untuk ') + SD.esc(SD.svcName(tab)) + SD.L(' only', ' sahaja') + '</label><input type="file" multiple class="form-input" id="mg-pf" data-k="' + tab + '"><div style="margin-top:6px">' + SD.mgUI.chips(N.pf[tab] || []) + '</div></div>' +
        (N.svcs.length > 1 ? '<div class="form-group"><label class="form-label"><i class="ti ti-paperclip"></i> ' + SD.L('Shared attachments (linked to every request)', 'Lampiran berkongsi (dipaut ke setiap permohonan)') + '</label><input type="file" multiple class="form-input" id="mg-sf"><div style="margin-top:6px">' + SD.mgUI.chips(N.files) + '</div></div>' : '');
    } else {
      body = SD.mgUI.review(N, P, det, S, left(), openDup);
    }
    var n = P.mk.length, nx = N.step === 3 ? '<i class="ti ti-send"></i> ' + (n > 1 ? SD.L('Submit ' + n + ' requests', 'Hantar ' + n + ' permohonan') : SD.L('Submit', 'Hantar')) : SD.L('Next', 'Seterusnya') + (N.step === 1 && N.svcs.length ? ' (' + N.svcs.length + ')' : '') + ' <i class="ti ti-arrow-right"></i>';
    m.innerHTML = '<div class="cob-root">' + SD.head(SD.L('New request', 'Permohonan baharu'), SD.L('Step ', 'Langkah ') + N.step + ' / 3') + '<div class="sd-step">' + [1, 2, 3].map(function (i) { return '<i class="' + (i <= N.step ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="cob-card" style="padding:16px;margin-bottom:8px">' + body + '</div><div class="cob-xs" id="mg-saved" style="margin-bottom:10px">' + (saved ? SD.L('Draft saved ', 'Draf disimpan ') + SD.time(saved) : '') + '</div>' +
      '<div class="sd-acts"><button class="btn btn-outline" id="mg-back" style="flex:1"><i class="ti ti-arrow-left"></i> ' + (N.step === 1 ? SD.L('Cancel', 'Batal') : SD.L('Back', 'Kembali')) + '</button><button class="btn btn-primary" id="mg-next" style="flex:1"' + ((N.step === 1 && l != null && l <= 0) || (N.step === 3 && !n && !P.note.length) ? ' disabled' : '') + '>' + nx + '</button></div></div>';
    wire(m);
  }
  function grab() {
    var g = function (id) { return document.getElementById(id); }, rd = function (d, k) { var s = k ? '-' + k : ''; if (!g('mg-t' + s)) return; d.title = g('mg-t' + s).value.trim(); d.desc = g('mg-d' + s).value.trim(); d.pri = g('mg-p' + s).value; };
    if (N.step === 2) { if (N.same || N.svcs.length < 2) rd(N.c); else rd(det(N.tab || N.svcs[0]), N.tab || N.svcs[0]); }
    if (N.step === 3) { N.tpl = !!(g('mg-tpl') && g('mg-tpl').checked); if (g('mg-tn')) N.tname = g('mg-tn').value.trim(); }
  }
  function wire(m) {
    var q = function (s) { return m.querySelectorAll(s); }, re = function () { grab(); persist(); paint(); };
    q('.sd-pick input').forEach(function (i) { i.onchange = function () { var k = i.value, at = N.svcs.indexOf(k); if (i.checked && at < 0 && N.svcs.length < MG.MAX) N.svcs.push(k); if (!i.checked && at >= 0) N.svcs.splice(at, 1); re(); }; });
    q('[data-dup]').forEach(function (b) { b.onclick = function (e) { e.preventDefault(); N.dup[b.dataset.dup] = b.dataset.v; re(); }; });
    q('[data-tab]').forEach(function (b) { b.onclick = function () { grab(); N.tab = b.dataset.tab; paint(); }; });
    q('[data-tpl]').forEach(function (b) { b.onclick = function () {
      var t = tpls.find(function (x) { return SD.same(x.id, b.dataset.tpl); }), ok = cat().map(function (x) { return x.code; }); if (!t) return;
      N.svcs = (t.services || []).filter(function (k) { return ok.indexOf(k) >= 0; }).slice(0, MG.MAX); var pl = t.payload || {};
      if (pl.c) { N.c = Object.assign(N.c, pl.c); N.same = pl.same !== false; N.per = pl.per || {}; }
      N.step = N.svcs.length && N.c.title ? 3 : 1; persist(); paint();
    }; });
    var s = m.querySelector('#mg-same'); if (s) s.onchange = function () { grab(); N.same = s.checked; persist(); paint(); };
    var pf = m.querySelector('#mg-pf'); if (pf) pf.onchange = function () { grab(); var k = pf.dataset.k; N.pf[k] = (N.pf[k] || []).concat([].slice.call(pf.files)); paint(); };
    var sf = m.querySelector('#mg-sf'); if (sf) sf.onchange = function () { grab(); N.files = N.files.concat([].slice.call(sf.files)); paint(); };
    var t = m.querySelector('#mg-tpl'); if (t) t.onchange = function () { grab(); paint(); };
    var dr = m.querySelector('#mg-dres'); if (dr) dr.onclick = function () { var p = draft.payload || {}; MG.draftUse(draft); draft = null; N = Object.assign(fresh(), p, { files: [], pf: {} }); paint(); };
    var dd = m.querySelector('#mg-ddel'); if (dd) dd.onclick = function () { MG.draftUse(draft); draft = null; MG.draftDrop(); paint(); };
    q('input,textarea,select').forEach(function (i) { if (i.type !== 'file' && i.type !== 'checkbox') i.addEventListener('change', function () { grab(); persist(); }); });
    m.querySelector('#mg-back').onclick = function () { if (N.step === 1) SD.go('servis_saya'); else { grab(); N.step--; paint(); } };
    m.querySelector('#mg-next').onclick = function () { grab(); next(this); };
  }
  function next(btn) {
    if (N.step === 1 && !N.svcs.length) return SD.toast(SD.L('Choose at least one service', 'Pilih sekurang-kurangnya satu servis'), 'error');
    if (N.step === 2 && N.svcs.some(function (k) { return !det(k).title; })) return SD.toast(SD.L('Enter a title for every service', 'Masukkan tajuk untuk setiap servis'), 'error');
    if (N.step < 3) { N.step++; persist(); return paint(); }
    btn.disabled = true;
    var hook = SD.taskSrLinkCallback; SD.taskSrLinkCallback = null;
    SD.mgSubmit(N, plan(), det, S, hook).then(function (msg) { MG.draftDrop(); SD.toast(msg, 'success'); SD.go('servis_saya'); }, function (e) { btn.disabled = false; SD.toast(SD.err(e), 'error'); });
  }
  SD.newReq = function (prefill) {
    S = SD.CL;
    MG.probe().then(function (on) {
      if (!on) return orig(prefill);
      N = Object.assign(fresh(), prefill || {}); saved = null; draft = null; MG.draftUse(null);
      return Promise.all([MG.templates(), MG.draftGet()]).then(function (r) { tpls = r[0]; draft = (!prefill && r[1] && r[1].payload && (r[1].payload.svcs || []).length) ? r[1] : null; if (!draft && r[1] && !prefill) MG.draftUse(r[1]); paint(); });
    });
  };
})();
