/* M-Core Service Desk - Share WhatsApp sheet (same look as Projects pj-wa): 1 template by status + EN/BM + service hint,
   2 recipient (requester / owner-PIC / other-group), 3 preview (Edit / Copy / Open WhatsApp). >=900px = 2-column modal. */
(function () {
  var SD = window.SD, W = window.SDW; if (!SD || !W || W.share) return;

  function drawQr(url) {
    var LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
    var load = window.qrcode ? Promise.resolve() : new Promise(function (ok, no) { var s = document.createElement('script'); s.src = LIB; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    return load.then(function () { var q = window.qrcode(0, 'M'); q.addData(url); q.make(); var c = document.createElement('canvas'); var n = q.getModuleCount(), z = 3; c.width = c.height = n * z; var x = c.getContext('2d'); for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) { x.fillStyle = q.isDark(r, col) ? '#000' : '#fff'; x.fillRect(col * z, r * z, z, z); } return c; });
  }

  var S = null;
  var wide = function () { return window.matchMedia && matchMedia('(min-width:900px)').matches; };
  function close() { ['pjw-ov', 'pjw-sh'].forEach(function (i) { var e = document.getElementById(i); if (e) e.remove(); }); S = null; }
  W.close = close;
  W.share = function (r, after) {
    S = { r: r, after: after, step: 1, tpl: W.suggest(r.status), lang: SD.bm() ? 'bm' : 'en', rid: null, recips: null, manual: '', edit: false, text: null, token: null };
    paint();
    W.recips(r).then(function (rs) { if (!S || S.r !== r) return; S.recips = rs; if (!S.rid && rs[0]) S.rid = rs[0].id; paint(); });
  };
  var cur = function () { return S.rid === 'other' ? null : (S.recips || []).find(function (x) { return SD.same(x.id, S.rid); }) || null; };
  var phone = function () { var c = cur(); return W.phone(S.manual) || (c ? c.ph : ''); };
  function text() {
    if (S.text != null) return S.text;
    if (W.withLink(S.tpl, S.r) && !S.token) S.token = W.rnd(40);
    var c = cur();
    return W.build({ r: S.r, tpl: S.tpl, lang: S.lang, name: c && c.kind === 'requester' ? String(c.n || '').split(' ')[0] : '', url: W.withLink(S.tpl, S.r) ? W.resultUrl(S.token, S.lang) : '' });
    
  }
  var seg = function () { return '<div class="cob-seg" role="group" aria-label="Language"><button type="button" data-lang="en" class="' + (S.lang === 'en' ? 'on' : '') + '">EN</button><button type="button" data-lang="bm" class="' + (S.lang === 'bm' ? 'on' : '') + '">BM</button></div>'; };
  var IC = { received: 'ti-inbox', need_info: 'ti-help-circle', in_progress: 'ti-loader-2', done: 'ti-circle-check', reminder: 'ti-bell-ringing' };
  function tplHtml(compact) {
    var D = { received: W.L('Confirm the request is received + estimate', 'Maklum permintaan diterima & anggaran siap'), need_info: W.L('Ask for documents / more information', 'Minta dokumen / maklumat tambahan'), in_progress: W.L('Progress update for the client', 'Kemas kini kemajuan kepada client'), done: W.L('Result ready · result link, Confirm / Request changes', 'Hasil siap · link keputusan, Sahkan / Minta pindaan'), reminder: W.L('Remind the client to confirm / reply', 'Ingatkan client sahkan / hantar maklumat') };
    var sug = W.suggest(S.r.status);
    return '<div class="pjw-hd" style="margin-bottom:10px"><b style="font-size:13px">' + W.L('Message template', 'Template mesej') + '</b>' + seg() + '</div>' + W.TPL.map(function (t) {
      var on = S.tpl === t;
      return '<button type="button" class="pjw-opt' + (on ? ' on' : '') + '" data-tpl="' + t + '"><i class="ti ' + IC[t] + '"></i><div><b style="font-size:14px">' + W.tplName(t) + '</b>' + (t === sug ? ' <span class="badge badge-green" style="font-size:10.5px">' + W.L('Suggested by status', 'Dicadang ikut status') + '</span>' : '') + (compact ? '' : '<small>' + D[t] + '</small>') + '</div><i class="ti ' + (on ? 'ti-circle-check-filled' : 'ti-circle') + '" style="font-size:20px"></i></button>';
    }).join('') + (S.tpl === 'done' && !compact ? '<div class="pjw-lock" style="border-style:dashed"><i class="ti ti-bulb"></i><span><b>' + W.L('Service wording: ', 'Ayat khusus servis: ') + W.esc(W.svcName(S.r.service_code, S.lang)) + '</b><br>“' + W.esc(W.svcLine(S.r.service_code, S.lang)) + '”</span></div>' : '');
  }
  var av = function (n) { return W.esc(String(n || '?').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase() || '?'); };
  function recHtml() {
    if (!S.recips) return '<div class="cob-xs" style="padding:12px 0">' + W.L('Loading…', 'Memuatkan…') + '</div>';
    var row = function (x) { var on = SD.same(x.id, S.rid); return '<button type="button" class="pjw-opt' + (on ? ' on' : '') + '" data-rid="' + W.esc(x.id) + '"><span class="pjw-av">' + av(x.n) + '</span><div><b style="font-size:13.5px">' + W.esc(x.n) + '</b><small>' + W.esc(x.s) + '</small></div><span class="pjw-ph"' + (x.ph ? '' : ' style="color:var(--warning)"') + '>' + (x.ph ? '+' + x.ph : W.L('No phone no.', 'Tiada no. telefon')) + '</span>' + (on ? '<i class="ti ti-circle-check-filled" style="font-size:20px;color:var(--primary)"></i>' : '') + '</button>'; };
    var req = S.recips.filter(function (x) { return x.kind === 'requester'; }), pic = S.recips.filter(function (x) { return x.kind === 'pic'; }), c = cur();
    return (req.length ? '<div class="pjw-sec">' + W.L('REQUESTER (FROM REQUEST)', 'PEMOHON (DARI PERMINTAAN)') + '</div>' + req.map(row).join('') : '') +
      (pic.length ? '<div class="pjw-sec">' + W.L('OWNER / PIC', 'OWNER / PIC') + '</div>' + pic.map(row).join('') : '') +
      '<button type="button" class="pjw-opt' + (S.rid === 'other' ? ' on' : '') + '" data-rid="other" style="border-style:dashed"><i class="ti ti-users-group"></i><div><b style="font-size:13.5px">' + W.L('Other / group', 'Lain / group') + '</b><small>' + W.L('Pick a contact or group directly in WhatsApp', 'Pilih kenalan atau group terus dalam WhatsApp') + '</small></div></button>' +
      (S.rid === 'other' || (c && !c.ph) ? '<input class="form-input" id="sdw-ph" inputmode="tel" style="margin-top:4px" placeholder="' + W.L('WhatsApp no. (optional), e.g. 0123456789', 'No. WhatsApp (pilihan), cth 0123456789') + '" value="' + W.esc(S.manual) + '">' : '');
  }
  function preHtml() {
    var c = cur(), ph = phone();
    return '<div class="pjw-hd" style="margin-bottom:8px"><span class="cob-xs" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + W.L('To', 'Kepada') + ': <b style="color:var(--text)">' + (c ? W.esc(c.n) : W.L('Choose in WhatsApp', 'Pilih dalam WhatsApp')) + (ph ? ' · +' + ph : '') + '</b></span><span class="badge badge-blue" style="white-space:nowrap">' + W.tplName(S.tpl) + ' · ' + S.lang.toUpperCase() + '</span></div>' +
      (S.edit ? '<textarea class="pjw-ta" id="pjw-ta" data-no-titlecase="1">' + W.esc(text()) + '</textarea>' : W.bubble(text())) +
      '<div class="pjw-lock"><i class="ti ti-lock"></i><span>' + W.L('Internal notes & internal files are not included. The client only sees files marked as deliverables.', 'Nota dalaman & fail dalaman tidak dimasukkan. Client cuma nampak fail yang ditanda hasil kerja.') + '</span></div>' +
      '<div class="pjw-row"><button type="button" class="btn btn-outline" id="pjw-ed" style="flex:0 0 auto"><i class="ti ti-' + (S.edit ? 'check' : 'pencil') + '"></i> ' + (S.edit ? W.L('Done', 'Siap') : 'Edit') + '</button><button type="button" class="btn btn-outline" id="pjw-cp" style="flex:0 0 auto"><i class="ti ti-copy"></i> ' + W.L('Copy', 'Salin') + '</button><button type="button" class="btn pjw-go" id="pjw-go"><i class="ti ti-brand-whatsapp"></i> ' + W.L('Open WhatsApp', 'Buka WhatsApp') + '</button></div>' +
      '<div id="sdw-qr" style="width:120px;height:120px;margin:8px auto;background:#fff;border-radius:8px"></div>' +
      '<div class="cob-xs" style="text-align:center;margin-top:8px">' + W.L('Opens wa.me with the message filled in · M-Core records “Notified” in the timeline', 'Buka wa.me dengan mesej siap diisi · M-Core rekod “Dimaklumkan” dalam timeline') + '</div>';

  }
  function paint() {
    if (!S) return;
    var ov = document.getElementById('pjw-ov'); if (!ov) { ov = document.createElement('div'); ov.id = 'pjw-ov'; ov.className = 'pjw-ov'; ov.onclick = close; document.body.appendChild(ov); }
    var sh = document.getElementById('pjw-sh'); if (!sh) { sh = document.createElement('div'); sh.id = 'pjw-sh'; sh.className = 'pjw-sh'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); document.body.appendChild(sh); }
    var wd = wide(), ttl = wd ? W.L('Share to WhatsApp', 'Share ke WhatsApp') : [W.L('Share to WhatsApp', 'Share ke WhatsApp'), W.L('Choose recipient', 'Pilih penerima'), W.L('Message preview', 'Pratonton mesej')][S.step - 1];
    var h = '<div class="pjw-grab"></div><div class="pjw-hd"><b><i class="ti ti-brand-whatsapp" style="color:var(--pjw)"></i> ' + ttl + '</b><button type="button" class="pjw-x" id="pjw-x" aria-label="' + W.L('Close', 'Tutup') + '"><i class="ti ti-x"></i></button></div>' +
      '<div class="cob-xs" style="margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (wd ? '' : W.L('Step ', 'Langkah ') + S.step + ' / 3 · ') + W.esc(S.r.ref_no + ' · ' + S.r.title) + '</div><div class="pjw-prog">' + [1, 2, 3].map(function (i) { return '<i class="' + (i <= S.step ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    if (wd) h += '<div class="pjw-wide" style="margin-top:12px"><div>' + tplHtml(true) + '<b style="font-size:13px;display:block;margin:10px 0 8px">' + W.L('Recipient', 'Penerima') + '</b>' + recHtml() + '</div><div>' + preHtml() + '</div></div>';
    else if (S.step === 1) h += tplHtml(false) + '<div class="pjw-row"><button type="button" class="btn btn-outline" id="pjw-x2">' + W.L('Cancel', 'Batal') + '</button><button type="button" class="btn btn-primary" id="pjw-nx">' + W.L('Next', 'Seterusnya') + ' <i class="ti ti-arrow-right"></i></button></div>';
    else if (S.step === 2) h += recHtml() + '<div class="pjw-row"><button type="button" class="btn btn-outline" id="pjw-bk"><i class="ti ti-arrow-left"></i> ' + W.L('Back', 'Kembali') + '</button><button type="button" class="btn btn-primary" id="pjw-nx">' + W.L('Preview', 'Pratonton') + ' <i class="ti ti-arrow-right"></i></button></div>';
    else h += preHtml() + '<button type="button" class="btn btn-outline" id="pjw-bk" style="width:100%;justify-content:center;margin-top:8px"><i class="ti ti-arrow-left"></i> ' + W.L('Back', 'Kembali') + '</button>';
    sh.innerHTML = h; bind(sh);
    var qrUrl = W.withLink(S.tpl, S.r) ? W.resultUrl(S.token, S.lang) : ''; if (qrUrl) drawQr(qrUrl).then(function (cv) { var h = document.getElementById('sdw-qr'); if (h) { h.innerHTML = ''; h.appendChild(cv); } }, function () {});
  }
  function bind(sh) {
    var on = function (sel, fn) { sh.querySelectorAll(sel).forEach(function (b) { b.onclick = fn; }); };
    on('#pjw-x,#pjw-x2', close);
    on('[data-lang]', function () { S.lang = this.dataset.lang; S.text = null; paint(); });
    on('[data-tpl]', function () { S.tpl = this.dataset.tpl; S.text = null; paint(); });
    on('[data-rid]', function () { S.rid = this.dataset.rid; S.manual = ''; S.text = null; paint(); });
    on('#pjw-nx', function () { if (S.step === 2 && !S.rid) return SD.toast(W.L('Choose a recipient', 'Pilih penerima'), 'error'); S.step++; paint(); });
    on('#pjw-bk', function () { S.step--; S.edit = false; paint(); });
    var ph = sh.querySelector('#sdw-ph'); if (ph) ph.onchange = function () { S.manual = ph.value; paint(); };
    on('#pjw-ed', function () { var ta = document.getElementById('pjw-ta'); S.text = S.edit && ta ? ta.value.slice(0, 6000) : text(); S.edit = !S.edit; paint(); });
    on('#pjw-cp', function () { var ta = document.getElementById('pjw-ta'); try { navigator.clipboard.writeText(ta ? ta.value : text()); SD.toast(W.L('Copied', 'Disalin')); } catch (e) {} });
    on('#pjw-go', function () {
      var ta = document.getElementById('pjw-ta'); if (ta) S.text = ta.value.slice(0, 6000);
      if (!S.rid) return SD.toast(W.L('Choose a recipient', 'Pilih penerima'), 'error');
      var c = cur(), p = phone(), msg = text(), st = S, win = null;
      try { win = window.open('', '_blank'); if (win) win.opener = null; } catch (e) {}
      var link = st.token && msg.indexOf(st.token) >= 0 ? st.token : null;
      W.log(st.r, { tpl: st.tpl, lang: st.lang, kind: c ? c.kind : 'other', label: c ? c.n : null, phone: p, text: msg, token: link }).then(function () {
        var u = W.waUrl(p, msg); if (win) win.location.href = u; else W.open(u);
        if (st.after) st.after();
      }, function (e) { if (win) win.close(); SD.toast(SD.err(e), 'error'); });
      close();
    });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S) close(); });
})();
