/* Payment Vouchers — 4 signatures v1 (needs supabase/pv_revamp_01.sql; loads after pv-core.js).
   Prepared By / Checked By / First Approval / Second Approval, any order, in the app (draw pad) or via a
   per-role WhatsApp link (public-pv.html, no login; only the token's SHA-256 is stored).
   Required count from pv_settings: below the threshold (default RM5,000) the first N roles (default 3), else all 4.
   All required signed -> server auto-approves; a PVD also gets its approved single PVs created (RPC).
   Reset -> Draft, signatures voided + links revoked (server). Bell + push per signature come from the RPC, no amounts.
   API: PVS.mount(el, {kind, id, amount, status, ref, title, beforeShare, onChange, onProgress}), PVS.load(kind, id),
        PVS.printHtml(kind, id), PVS.images(kind, id). */
(function () {
  if (window.PVS || !window.PVX) return;
  var X = window.PVX, L = X.L, esc = X.esc;
  var P = window.PVS = {};
  var IMG = {}, pad = null;
  function $(id) { return document.getElementById(id); }

  /* wa-doc labels (WAD.t falls back to the key, so register ours) */
  (function () {
    var add = {
      en: { pvSign: 'Request signature', pvSignD: 'Voucher summary + link — signer signs without login', pvRemind: 'Reminder', pvRemindD: 'Nudge the signer to sign', pvPdf: 'Payment voucher PDF', pvPdfD: 'Send the voucher as a PDF' },
      bm: { pvSign: 'Minta tandatangan', pvSignD: 'Ringkasan baucar + link — penandatangan tandatangan tanpa log masuk', pvRemind: 'Peringatan', pvRemindD: 'Ingatkan penandatangan untuk tandatangan', pvPdf: 'PDF baucar bayaran', pvPdfD: 'Hantar baucar sebagai PDF' }
    };
    ['en', 'bm'].forEach(function (l) {
      try { if (window.__WAD_S && window.__WAD_S[l]) Object.keys(add[l]).forEach(function (k) { if (window.__WAD_S[l][k] == null) window.__WAD_S[l][k] = add[l][k]; }); } catch (e) {}
      try { if (window.LANG && LANG[l] && LANG[l].waDoc) Object.keys(add[l]).forEach(function (k) { if (LANG[l].waDoc[k] == null) LANG[l].waDoc[k] = add[l][k]; }); } catch (e) {}
    });
  })();

  /* ---------- load ---------- */
  P.load = async function (kind, id) {
    var r = await sb.from('pv_signatures').select('id,role,signer_name,signed_at,signed_via,storage_path,attachment_path').eq('doc_kind', kind).eq('doc_id', id).eq('tenant_id', X.tid()).is('voided_at', null);
    var m = {};
    ((r && r.data) || []).forEach(function (s) { m[s.role] = s; });
    return m;
  };
  function toData(url) {
    return fetch(url).then(function (x) { return x.blob(); }).then(function (bl) {
      return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(''); }; fr.readAsDataURL(bl); });
    });
  }
  P.loadImgs = async function (sigs) {
    var need = Object.keys(sigs).map(function (k) { return sigs[k].storage_path; }).filter(function (p) { return p && !IMG[p]; });
    if (!need.length) return;
    try {
      var r = await sb.storage.from('doc-files').createSignedUrls(need, 600);
      await Promise.all(((r && r.data) || []).map(function (u, i) {
        if (!u || !u.signedUrl) return null;
        var p = u.path || need[i];
        return toData(u.signedUrl).then(function (d) { if (d) IMG[p] = d; }, function () {});
      }));
    } catch (e) {}
  };
  P.images = async function (kind, id) {
    var sigs = await P.load(kind, id);
    await P.loadImgs(sigs);
    return X.ROLES.map(function (x) { var g = sigs[x.r]; return { role: x.r, label: X.roleLabel(x.r), name: g ? g.signer_name : '', date: g ? X.dmy(g.signed_at) : '', img: g ? IMG[g.storage_path] || '' : '' }; });
  };

  /* ---------- css ---------- */
  function css() {
    if ($('pvs-css')) return;
    var s = document.createElement('style'); s.id = 'pvs-css';
    s.textContent =
      '.pvs-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin:0 0 12px;color:var(--text)}' +
      '.pvs-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 10px;margin:0 0 8px}' +
      '.pvs-t{font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px}' +
      '.pvs-prog{font-size:11px;font-weight:700;color:var(--warning);white-space:nowrap}.pvs-prog.pvs-done{color:var(--success)}' +
      '.pvs-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}' +
      '@media (min-width:700px){.pvs-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
      '.pvs-row{border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;min-width:0}' +
      '.pvs-row.pvs-opt{border-style:dashed}' +
      '.pvs-rl{flex:1 1 140px;min-width:0}' +
      '.pvs-rn{font-size:12px;font-weight:600}' +
      '.pvs-rs{font-size:11px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.pvs-th{width:84px;height:34px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);overflow:hidden;color:var(--text-3)}' +
      '.pvs-th img{max-width:100%;max-height:100%;object-fit:contain;display:block}' +
      '.pvs-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;white-space:nowrap;border:1px solid var(--border);color:var(--text-2)}' +
      '.pvs-chip.pvs-ok{color:var(--success);border-color:var(--success)}' +
      '.pvs-acts{display:flex;flex-wrap:wrap;gap:6px;flex-basis:100%}' +
      '.pvs-acts .btn,.pvs-foot .btn,#pvs-modal .btn{white-space:nowrap}' +
      '.pvs-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0 0}' +
      '.pvs-hint{font-size:11px;color:var(--text-3);flex:1 1 200px;min-width:0}' +
      '.pvs-reset{color:var(--danger)!important;border-color:var(--danger)!important}' +
      '#pvs-modal .modal-box-body{display:flex;flex-direction:column;gap:10px}' +
      '.pvs-pad{display:block;width:100%;height:160px;border:1px solid var(--border);border-radius:8px;background:white;touch-action:none;cursor:crosshair}' +
      '.pvs-err{font-size:12px;color:var(--danger)}.pvs-err:empty{display:none}' +
      '@media print{.pvs-card{display:none!important}}';
    document.head.appendChild(s);
  }

  /* ---------- card ---------- */
  P.mount = async function (el, o) {
    css();
    el.innerHTML = '<div class="pvs-card"><div class="pvs-t"><i class="ti ti-signature"></i> ' + esc(L('Signatures', 'Tandatangan')) + '</div><div class="spinner" style="margin:10px auto"></div></div>';
    var set = await X.settings();
    var req = X.requiredRoles(set, o.amount);
    var sigs = await P.load(o.kind, o.id);
    var st = o.status || 'draft', open = ['draft', 'shared', 'pending'].indexOf(st) >= 0;
    var n = req.filter(function (r) { return sigs[r]; }).length;
    if (o.onProgress) o.onProgress(n, req.length);
    function draw() {
      var rows = X.ROLES.map(function (x) {
        var g = sigs[x.r], isReq = req.indexOf(x.r) >= 0;
        if (!isReq && !g) {
          if (!open) return '';
        }
        var h = '<div class="pvs-row' + (isReq ? '' : ' pvs-opt') + '">' +
          '<span class="pvs-th">' + (g && IMG[g.storage_path] ? '<img alt="" src="' + IMG[g.storage_path] + '">' : '<i class="ti ti-signature"></i>') + '</span>' +
          '<div class="pvs-rl"><div class="pvs-rn">' + esc(X.roleLabel(x.r)) + (isReq ? '' : ' <span style="color:var(--text-3);font-weight:400">· ' + esc(L('optional', 'pilihan')) + '</span>') + '</div>' +
          '<div class="pvs-rs">' + esc(g ? g.signer_name + ' · ' + X.dmy(g.signed_at) + (g.signed_via === 'link' ? ' · WhatsApp' : '') : L('Not signed', 'Belum ditandatangani')) + '</div></div>' +
          (g ? '<span class="pvs-chip pvs-ok"><i class="ti ti-circle-check"></i> ' + esc(L('Signed', 'Ditandatangani')) + '</span>' : '<span class="pvs-chip">' + esc(L('Pending', 'Menunggu')) + '</span>');
        if (!g && open) h += '<div class="pvs-acts"><button type="button" class="btn btn-primary btn-sm" data-s="sign" data-r="' + x.r + '"><i class="ti ti-writing-sign"></i> ' + esc(L('Sign', 'Tandatangan')) + '</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-s="share" data-r="' + x.r + '"><i class="ti ti-brand-whatsapp"></i> ' + esc(L('Send link', 'Hantar pautan')) + '</button></div>';
        if (g && g.attachment_path) h += '<div class="pvs-acts"><button type="button" class="btn btn-outline btn-sm" data-s="att" data-r="' + x.r + '"><i class="ti ti-paperclip"></i> ' + esc(L('Attachment', 'Lampiran')) + '</button></div>';
        return h + '</div>';
      }).join('');
      var anySig = Object.keys(sigs).length > 0;
      var canReset = X.isApprover() && (st === 'shared' || st === 'pending' || (st === 'approved' && anySig) || (st === 'converted' && anySig));
      el.innerHTML = '<div class="pvs-card"><div class="pvs-top"><div class="pvs-t"><i class="ti ti-signature"></i> ' + esc(L('Signatures', 'Tandatangan')) + '</div>' +
        '<span class="pvs-prog' + (n >= req.length ? ' pvs-done' : '') + '">' + esc(n + '/' + req.length + ' ' + L('required signed', 'wajib ditandatangani')) + '</span></div>' +
        '<div class="pvs-grid">' + rows + '</div>' +
        '<div class="pvs-foot"><span class="pvs-hint">' + esc(open
          ? L('Sign in any order. ' + req.length + ' signature(s) needed (' + (req.length === 4 ? 'RM' + Number(set.sig_threshold).toLocaleString() + ' and above' : 'below RM' + Number(set.sig_threshold).toLocaleString()) + '). The voucher approves itself when the last one signs; amounts lock at the first share or signature.',
              'Tandatangan dalam apa-apa susunan. ' + req.length + ' tandatangan diperlukan (' + (req.length === 4 ? 'RM' + Number(set.sig_threshold).toLocaleString() + ' ke atas' : 'bawah RM' + Number(set.sig_threshold).toLocaleString()) + '). Baucar diluluskan sendiri bila tandatangan terakhir siap; jumlah dikunci selepas kongsi atau tandatangan pertama.')
          : L('Signing closed.', 'Tandatangan ditutup.')) + '</span>' +
        (canReset ? '<button type="button" class="btn btn-outline btn-sm pvs-reset" data-s="reset"><i class="ti ti-arrow-back-up"></i> ' + esc(L('Reset signatures', 'Set semula tandatangan')) + '</button>' : '') + '</div></div>';
    }
    draw();
    P.loadImgs(sigs).then(function () { if (el.isConnected) draw(); });
    el.onclick = function (e) {
      var b = e.target.closest('[data-s]'); if (!b) return;
      var a = b.getAttribute('data-s'), r = b.getAttribute('data-r');
      if (a === 'sign') openSign(o, r);
      if (a === 'share') share(o, r);
      if (a === 'att' && sigs[r] && window.PVC) PVC.viewFile(sigs[r].attachment_path);
      if (a === 'reset') reset(o, n);
    };
  };

  /* ---------- draw pad ---------- */
  function closeSign() { var m = $('pvs-modal'); if (m) m.remove(); pad = null; }
  function openSign(o, role) {
    closeSign();
    var ov = document.createElement('div');
    ov.id = 'pvs-modal'; ov.className = 'modal-overlay active';
    ov.innerHTML = '<div class="modal-box" style="max-width:460px" role="dialog" aria-modal="true" aria-labelledby="pvs-mt">' +
      '<div class="modal-box-header" id="pvs-mt"><i class="ti ti-writing-sign"></i> ' + esc(L('Sign as ', 'Tandatangan sebagai ') + X.roleLabel(role)) + '</div>' +
      '<div class="modal-box-body">' +
      '<div class="form-group" style="margin:0"><label class="form-label" for="pvs-name">' + esc(L('Name', 'Nama')) + '</label>' +
      '<input id="pvs-name" class="form-input" maxlength="120" autocomplete="name" value="' + esc(X.me()) + '"></div>' +
      '<div class="form-group" style="margin:0"><label class="form-label">' + esc(L('Draw your signature', 'Lukis tandatangan anda')) + '</label>' +
      '<canvas id="pvs-pad" class="pvs-pad" aria-label="' + esc(L('Signature pad', 'Pad tandatangan')) + '"></canvas>' +
      '<div style="font-size:11px;color:var(--text-3);margin-top:4px">' + esc(L('Sign with your finger or mouse.', 'Tandatangan dengan jari atau tetikus.')) + '</div></div>' +
      '<div class="pvs-err" id="pvs-err" role="alert"></div></div>' +
      '<div class="modal-box-footer" style="flex-wrap:wrap">' +
      '<button type="button" class="btn btn-outline" data-a="clear"><i class="ti ti-eraser"></i> ' + esc(L('Clear', 'Padam')) + '</button>' +
      '<button type="button" class="btn btn-outline" data-a="cancel">' + esc(L('Cancel', 'Batal')) + '</button>' +
      '<button type="button" class="btn btn-primary" data-a="save"><i class="ti ti-check"></i> ' + esc(L('Save signature', 'Simpan tandatangan')) + '</button></div></div>';
    ov.addEventListener('click', function (e) {
      if (e.target === ov) return closeSign();
      var a = e.target.closest && e.target.closest('[data-a]'); if (!a) return;
      var k = a.getAttribute('data-a');
      if (k === 'cancel') closeSign(); else if (k === 'clear') clearPad(); else if (k === 'save') saveSign(o, role, a);
    });
    document.body.appendChild(ov);
    initPad($('pvs-pad'));
  }
  function initPad(cv) {
    var r = cv.getBoundingClientRect(), dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    var w = Math.max(240, Math.round(r.width || 400)), h = Math.max(120, Math.round(r.height || 160));
    cv.width = w * dpr; cv.height = h * dpr;
    var c = cv.getContext('2d'); if (!c) return;
    c.scale(dpr, dpr);
    pad = { cv: cv, c: c, w: w, h: h, ink: false, down: false };
    clearPad();
    function pt(e) { var b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * (w / (b.width || w)), y: (e.clientY - b.top) * (h / (b.height || h)) }; }
    cv.addEventListener('pointerdown', function (e) { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} pad.down = true; var p = pt(e); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 0.1, p.y + 0.1); c.stroke(); pad.ink = true; });
    cv.addEventListener('pointermove', function (e) { if (!pad || !pad.down) return; e.preventDefault(); var p = pt(e); c.lineTo(p.x, p.y); c.stroke(); });
    var up = function () { if (pad) pad.down = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
  }
  function clearPad() {
    if (!pad) return;
    var c = pad.c;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = 'white'; c.fillRect(0, 0, pad.cv.width, pad.cv.height); c.restore();
    c.strokeStyle = 'black'; c.lineWidth = 2.5; c.lineCap = 'round'; c.lineJoin = 'round';
    pad.ink = false;
  }
  function padBlob() { return new Promise(function (res) { pad.cv.toBlob(function (b) { res(b); }, 'image/png'); }); }
  async function saveSign(o, role, btn) {
    var er = $('pvs-err'), name = String(($('pvs-name') || {}).value || '').trim();
    var lbl = '<i class="ti ti-check"></i> ' + esc(L('Save signature', 'Simpan tandatangan'));
    var fail = function (m) { if (er) er.textContent = m; btn.disabled = false; btn.innerHTML = lbl; };
    if (!name) return fail(L('Enter your name.', 'Masukkan nama anda.'));
    if (!pad || !pad.ink) return fail(L('Draw your signature first.', 'Lukis tandatangan anda dahulu.'));
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> ' + esc(L('Saving…', 'Menyimpan…'));
    if (er) er.textContent = '';
    try {
      if (o.beforeShare) await o.beforeShare();
      var blob = await padBlob();
      if (!blob) throw new Error(L('Could not read the signature.', 'Tandatangan tidak dapat dibaca.'));
      var path = X.tid() + '/pv-signatures/' + o.id + '/' + role + '-' + Date.now() + '.png';
      var up = await sb.storage.from('doc-files').upload(path, blob, { contentType: 'image/png', upsert: false });
      if (up.error) throw up.error;
      var r = await sb.rpc('pv_sign_app', { p_kind: o.kind, p_doc: o.id, p_role: role, p_name: name, p_path: path });
      if (r.error) throw r.error;
      var res = r.data || {};
      closeSign();
      X.toast(res.approved
        ? (o.kind === 'pvd' && res.created ? L('Signed — approved. ' + res.created + ' payment voucher(s) created.', 'Ditandatangani — diluluskan. ' + res.created + ' baucar bayaran dicipta.') : L('Signed — voucher approved.', 'Ditandatangani — baucar diluluskan.'))
        : L('Signed', 'Ditandatangani') + ' (' + (res.signed || '') + '/' + (res.required || '') + ').', 'success');
      try { auditLog('update', o.kind === 'pvd' ? 'payment_voucher_batches' : 'payment_vouchers', o.id, null, { action: 'sign', role: role }); } catch (e) {}
      if (o.onChange) o.onChange();
    } catch (e) { fail(L('Could not sign: ', 'Gagal tandatangan: ') + X.errMsg(e)); }
  }

  /* ---------- WhatsApp link per role ---------- */
  function roleText(o, role, lang, url, co, remind) {
    var en = lang !== 'bm', who = en ? X.ROLES.filter(function (x) { return x.r === role; })[0].en : X.ROLES.filter(function (x) { return x.r === role; })[0].bm;
    var what = o.kind === 'pvd' ? (en ? 'PV Disbursement' : 'Penyaluran PV') : (en ? 'Payment Voucher' : 'Baucar Bayaran');
    var ref = (o.ref || '') + (o.title ? ' (' + o.title + ')' : '');
    if (en) return (remind ? 'Hi, reminder: ' : 'Hi, ') + 'please review the ' + what + ' ' + ref + ' and sign as ' + who + ' via the link below (no login needed).\nView & sign: ' + url + '\nThank you. – ' + co;
    return (remind ? 'Salam, peringatan: ' : 'Salam, ') + 'sila semak ' + what + ' ' + ref + ' dan tandatangan sebagai ' + who + ' melalui pautan di bawah (tiada log masuk).\nSemak & tandatangan: ' + url + '\nTerima kasih. – ' + co;
  }
  async function share(o, role) {
    var W = window.WAD;
    if (!W || typeof W.open !== 'function') { X.toast(L('WhatsApp share is not available.', 'Kongsi WhatsApp tidak tersedia.'), 'error'); return; }
    try { if (o.beforeShare) await o.beforeShare(); } catch (e) { X.toast(X.errMsg(e), 'error'); return; }
    var link = null, created = false, wasDraft = (o.status || 'draft') === 'draft';
    function onClose() {
      // a link was created -> status is now 'shared' on the server; refresh once the sheet goes away
      if (created) setTimeout(function () { if (o.onChange) o.onChange(); }, 300);
    }
    function onShared(e) {
      if (!e.detail || String(e.detail.doc_id) !== String(o.id)) return;
      document.removeEventListener('wad:shared', onShared);
      if (wasDraft) X.notify('pv_submitted', { kind: o.kind, id: o.id });
      onClose(); created = false;
    }
    document.addEventListener('wad:shared', onShared);
    W.open({
      docType: o.kind, docId: o.id, docRef: X.roleLabel(role) + ' · ' + (o.ref || ''), to: null, phone: '',
      k: 'pv_sign',
      tpls: [{ k: 'pv_sign', label: 'pvSign', desc: 'pvSignD' }, { k: 'pv_remind', label: 'pvRemind', desc: 'pvRemindD' }],
      build: function (k, lang) {
        var get = link ? Promise.resolve(link) : Promise.resolve(sb.rpc('pv_sign_link_create', { p_kind: o.kind, p_doc: o.id, p_role: role })).then(function (r) {
          if (r.error) throw r.error; link = r.data; created = true; return link;
        });
        return get.then(function (l) {
          var th = typeof W.theme === 'function' ? W.theme() : null;
          var url = W.base() + 'public-pv.html?pv_sign=' + encodeURIComponent(l.token) + (lang === 'bm' ? '&lang=bm' : '') + (th ? '&theme=' + th : '');
          return { text: roleText(o, role, lang, url, W.company(), k === 'pv_remind'), link_id: l.link_id, expires_at: l.expires_at };
        });
      }
    });
    // sheet closed without sending: still refresh so the Draft -> Shared lock shows
    var seen = false, tries = 0;
    var t = setInterval(function () {
      var on = !!document.querySelector('.wad-bg'); if (on) seen = true; tries++;
      if ((seen && !on) || (!seen && tries > 8)) { clearInterval(t); document.removeEventListener('wad:shared', onShared); onClose(); }
    }, 600);
  }

  async function reset(o, n) {
    var reason = window.prompt(L('Reset all signatures and unlock for editing? ' + n + ' signature(s) will be voided and links stop working.' + (o.kind === 'pvd' ? ' Unpaid payment vouchers made from it are voided.' : '') + ' Reason (optional):',
      'Set semula semua tandatangan dan buka kunci untuk edit? ' + n + ' tandatangan akan dibatalkan dan pautan tidak lagi berfungsi.' + (o.kind === 'pvd' ? ' Baucar bayaran belum dibayar daripadanya akan dibatalkan.' : '') + ' Sebab (pilihan):'), '');
    if (reason === null) return;
    var r = await sb.rpc('pv_sign_reset', { p_kind: o.kind, p_doc: o.id, p_reason: String(reason || '').trim() || null });
    if (r.error) { X.toast(L('Reset failed: ', 'Gagal set semula: ') + X.errMsg(r.error), 'error'); return; }
    try { auditLog('update', o.kind === 'pvd' ? 'payment_voucher_batches' : 'payment_vouchers', o.id, null, { status: 'draft', action: 'reset_signatures' }); } catch (e) {}
    X.toast(L('Signatures reset — back to Draft.', 'Tandatangan diset semula — kembali ke Draf.'), 'success');
    if (o.onChange) o.onChange();
  }

  /* ---------- print grid (light; images as data URLs) ---------- */
  P.printHtml = async function (kind, id, amount) {
    var set = await X.settings();
    var req = X.requiredRoles(set, amount);
    var cells = await P.images(kind, id);
    cells = cells.filter(function (c) { return req.indexOf(c.role) >= 0 || c.name; });
    return '<div class="pvp-sgrid" style="grid-template-columns:repeat(' + cells.length + ',minmax(0,1fr))">' + cells.map(function (c) {
      return '<div class="pvp-sg"><div class="pvp-sgi">' + (c.img ? '<img alt="" src="' + c.img + '">' : '') + '</div><div class="pvp-sgl"></div>' +
        '<div class="pvp-sgn">' + esc(c.name || '\u00a0') + '</div><div class="pvp-sgr">' + esc(c.label) + '</div>' +
        '<div class="pvp-sgd">' + esc(L('Date', 'Tarikh') + ': ' + (c.date || '')) + '</div></div>';
    }).join('') + '</div>';
  };
})();
