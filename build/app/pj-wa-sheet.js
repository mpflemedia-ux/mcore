/* M-Core Projects - Share WhatsApp sheet: 1 template + EN/BM, 2 recipient (staff / client / other-group), 3 preview
   (Edit / Copy / Open WhatsApp via wa.me). Mobile = bottom sheet steps; >=900px = one modal (template+recipient | preview). */
(function () {
  var W = window.PJW; if (!W || W.share) return;
  var S = null;
  function wide() { return window.matchMedia && matchMedia('(min-width:900px)').matches; }
  function close() { var a = document.getElementById('pjw-ov'), b = document.getElementById('pjw-sh'); if (a) a.remove(); if (b) b.remove(); S = W.SS = null; }
  W.closeSheet = close;
  /* o: { task } single task, or { tasks, tpl:'summary'|'daily', text(lang) fn } */
  W.share = function (o) {
    var k = o.task, multi = !k;
    var emp = k && W.emps.find(function (e) { return W.same(e.id, k.assignee_employee_id); });
    S = { o: o, step: multi ? 2 : 1, tpl: o.tpl || 'reminder', lang: W.bm() ? 'bm' : 'en', kind: 'staff', rid: o.rid != null ? o.rid : (emp && !multi ? emp.id : null), q: '', edit: false, text: null };
    if (o.kind) S.kind = o.kind;
    W.SS = S;
    paint();
  };
  function cur() { return W._recips().concat([]).find(function (r) { return W.same(r.id, S.rid); }) || (S.rid ? (S.kind === 'staff' ? W.emps : W.custs).map(function (e) { return { id: e.id, n: e.nickname || e.name, ph: e.phone }; }).find(function (r) { return W.same(r.id, S.rid); }) : null); }
  function text() {
    if (S.text != null) return S.text;
    if (S.o.task) return W.build({ task: S.o.task, tpl: S.tpl, lang: S.lang, kind: S.kind });
    return S.o.text(S.lang);
  }
  function preHtml() {
    var r = S.kind === 'other' ? null : cur(), ph = r ? W.phone(r.ph) : '';
    return '<div class="pjw-hd" style="margin-bottom:8px"><span class="cob-xs" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + W.L('To', 'Kepada') + ': <b style="color:var(--text)">' + (r ? W.esc(r.n) + (ph ? ' · +' + ph : '') : W.L('Choose in WhatsApp', 'Pilih dalam WhatsApp')) + '</b></span><span class="badge badge-blue" style="white-space:nowrap">' + (S.o.badge || (S.o.task ? W.tplName(S.tpl) : W.L('Summary', 'Ringkasan'))) + ' · ' + S.lang.toUpperCase() + '</span></div>' +
      (S.edit ? '<textarea class="pjw-ta" id="pjw-ta" data-no-titlecase="1">' + W.esc(text()) + '</textarea>' : W.bubble(text())) +
      '<div class="pjw-lock"><i class="ti ti-lock"></i><span>' + W.L('Internal notes & confidential attachments are not included. The recipient must log in to M-Core to open the task.', 'Nota dalaman & lampiran sulit tidak dimasukkan. Penerima perlu log masuk M-Core untuk buka task.') + '</span></div>' +
      '<div class="pjw-row"><button type="button" class="btn btn-outline" id="pjw-ed" style="flex:0 0 auto"><i class="ti ti-' + (S.edit ? 'check' : 'pencil') + '"></i> ' + (S.edit ? W.L('Done', 'Siap') : 'Edit') + '</button><button type="button" class="btn btn-outline" id="pjw-cp" style="flex:0 0 auto"><i class="ti ti-copy"></i> ' + W.L('Copy', 'Salin') + '</button><button type="button" class="btn pjw-go" id="pjw-go"><i class="ti ti-brand-whatsapp"></i> ' + W.L('Open WhatsApp', 'Buka WhatsApp') + '</button></div>' +
      '<div class="cob-xs" style="text-align:center;margin-top:8px">' + W.L('Opens wa.me with the message filled in · M-Core records “Shared” in the activity log', 'Buka wa.me dengan mesej siap diisi · M-Core rekod “Dikongsi” dalam log aktiviti') + '</div>';
  }
  function paint() {
    if (!S) return;
    var ov = document.getElementById('pjw-ov'); if (!ov) { ov = document.createElement('div'); ov.id = 'pjw-ov'; ov.className = 'pjw-ov'; ov.onclick = close; document.body.appendChild(ov); }
    var sh = document.getElementById('pjw-sh'); if (!sh) { sh = document.createElement('div'); sh.id = 'pjw-sh'; sh.className = 'pjw-sh'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); document.body.appendChild(sh); }
    var k = S.o.task, wd = wide(), ttl = wd ? W.L('Share to WhatsApp', 'Share ke WhatsApp') : [W.L('Share to WhatsApp', 'Share ke WhatsApp'), W.L('Choose recipient', 'Pilih penerima'), W.L('Message preview', 'Pratonton mesej')][S.step - 1];
    var sub = S.o.subtitle || (k ? k.title : W.L('Summary', 'Ringkasan') + ' · ' + (S.o.tasks ? S.o.tasks.length + ' task' : ''));
    var h = '<div class="pjw-grab"></div><div class="pjw-hd"><b><i class="ti ti-brand-whatsapp" style="color:var(--pjw)"></i> ' + ttl + '</b><button type="button" class="pjw-x" id="pjw-x" aria-label="' + W.L('Close', 'Tutup') + '"><i class="ti ti-x"></i></button></div>' +
      '<div class="cob-xs" style="margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (wd ? '' : W.L('Step ', 'Langkah ') + S.step + ' / 3 · ') + W.esc(sub) + '</div><div class="pjw-prog">' + [1, 2, 3].map(function (i) { return '<i class="' + (i <= S.step ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    if (wd) h += '<div class="pjw-wide" style="margin-top:12px"><div>' + (k ? W._tplHtml(true) : '<div class="pjw-hd" style="margin-bottom:10px"><b style="font-size:13px">' + W.L('Language', 'Bahasa') + '</b>' + W._seg() + '</div>') + '<b style="font-size:13px;display:block;margin:10px 0 8px">' + W.L('Recipient', 'Penerima') + '</b>' + W._recHtml() + '</div><div>' + preHtml() + '</div></div>';
    else if (S.step === 1) h += W._tplHtml(false) + '<div class="pjw-row"><button type="button" class="btn btn-outline" id="pjw-x2">' + W.L('Cancel', 'Batal') + '</button><button type="button" class="btn btn-primary" id="pjw-nx">' + W.L('Next', 'Seterusnya') + ' <i class="ti ti-arrow-right"></i></button></div>';
    else if (S.step === 2) h += (k ? '' : '<div class="pjw-hd" style="margin-bottom:10px"><b style="font-size:13px">' + W.L('Language', 'Bahasa') + '</b>' + W._seg() + '</div>') + W._recHtml() + '<div class="pjw-row">' + (k ? '<button type="button" class="btn btn-outline" id="pjw-bk"><i class="ti ti-arrow-left"></i> ' + W.L('Back', 'Kembali') + '</button>' : '<button type="button" class="btn btn-outline" id="pjw-x2">' + W.L('Cancel', 'Batal') + '</button>') + '<button type="button" class="btn btn-primary" id="pjw-nx">' + W.L('Preview', 'Pratonton') + ' <i class="ti ti-arrow-right"></i></button></div>';
    else h += preHtml() + '<button type="button" class="btn btn-outline" id="pjw-bk" style="width:100%;justify-content:center;margin-top:8px"><i class="ti ti-arrow-left"></i> ' + W.L('Back', 'Kembali') + '</button>';
    sh.innerHTML = h; bind(sh);
  }
  function bind(sh) {
    var on = function (sel, fn) { sh.querySelectorAll(sel).forEach(function (b) { b.onclick = fn; }); };
    on('#pjw-x,#pjw-x2', close);
    on('[data-lang]', function () { S.lang = this.dataset.lang; S.text = null; paint(); });
    on('[data-tpl]', function () { S.tpl = this.dataset.tpl; S.text = null; if (S.tpl === 'client' && S.kind === 'staff') { S.kind = 'client'; S.rid = null; } paint(); });
    on('[data-kind]', function () { S.kind = this.dataset.kind; S.rid = null; S.q = ''; S.text = null; paint(); });
    on('[data-rid]', function () { S.rid = this.dataset.rid; S.text = null; paint(); });
    on('#pjw-nx', function () { if (S.step === 2 && S.kind !== 'other' && !S.rid) return W.toast(W.L('Choose a recipient', 'Pilih penerima'), 'error'); S.step++; paint(); });
    on('#pjw-bk', function () { S.step--; S.edit = false; paint(); });
    var q = sh.querySelector('#pjw-q'); if (q) q.oninput = function () { S.q = q.value; var p = q.selectionStart; paint(); var n = document.getElementById('pjw-q'); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} } };
    on('#pjw-ed', function () { var ta = document.getElementById('pjw-ta'); if (S.edit && ta) S.text = ta.value.slice(0, 6000); else S.text = text(); S.edit = !S.edit; paint(); });
    on('#pjw-cp', function () { var ta = document.getElementById('pjw-ta'); var v = ta ? ta.value : text(); try { navigator.clipboard.writeText(v); W.toast(W.L('Copied', 'Disalin')); } catch (e) {} });
    on('#pjw-go', function () {
      var ta = document.getElementById('pjw-ta'); if (ta) S.text = ta.value.slice(0, 6000);
      if (S.kind !== 'other' && !S.rid) return W.toast(W.L('Choose a recipient', 'Pilih penerima'), 'error');
      var r = S.kind === 'other' ? null : cur(), ph = r ? W.phone(r.ph) : '', msg = text();
      if (r && !ph && !confirm(W.L('This contact has no phone number. Open WhatsApp and choose the contact there?', 'Kenalan ini tiada no. telefon. Buka WhatsApp dan pilih kenalan di sana?'))) return;
      W.open(W.waUrl(ph, msg));
      var base = { template: S.o.task ? S.tpl : S.o.tpl, lang: S.lang, recipient_kind: S.kind, recipient_id: r ? r.id : null, recipient_label: r ? String(r.n || '').slice(0, 200) : null, phone: ph || null, message: msg };
      var rows = S.o.task ? [Object.assign({ task_id: S.o.task.id, project_id: S.o.task.project_id }, base)] : S.o.tpl === 'daily' ? [base] : (S.o.tasks && S.o.tasks.length) ? S.o.tasks.map(function (t) { return Object.assign({ task_id: t.id, project_id: t.project_id }, base); }) : S.o.projectId ? [Object.assign({ project_id: S.o.projectId }, base)] : [base];
      W.log(rows).then(function () { if (W.after) W.after(); }, function (e) { W.toast((e && e.message) || 'Error', 'error'); });
      close();
    });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S) close(); });
})();
