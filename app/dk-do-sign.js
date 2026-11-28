/* dk-do-sign.js — Delivery Order signatures, PV style (window.DODSign). DO only; every other DK doc keeps dk-sign.js.
   2 slots: Delivered by / Received by, N/2 counter, draw pad (app), WhatsApp link per slot:
     Delivered by -> per-slot link (dk_do_sign_link_create -> dk-public.html?do_sign=…)
     Received by  -> the existing DO confirm link (DKS.share('do') -> dk-public.html?public_do=…)
   Signature PNG in bucket doc-files ({tenant}/do-signatures/{do_id}/…), path in dk_signatures.storage_path.
   Images go on print (DKD.sigBoxes s.img) + PDF (model.sigs). Status 'delivered' stays MANUAL — signing never changes it.
   Needs supabase/migrations/20261128120000_do_sign_pv_style.sql; until that runs, dk-sign.js keeps its old panel. v1 */
(function () {
  if (window.DODSign) return;
  var D = window.DODSign = { off: false, v: 1 };
  var IMG = {}, pad = null;
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }
  function role() { try { return String(APP.user.role || '').toLowerCase(); } catch (e) { return ''; } }
  function me() { try { return APP.user.full_name || APP.user.name || ''; } catch (e) { return ''; } }
  function tid() { try { return (APP.tenant && APP.tenant.id) || APP.user.tenant_id; } catch (e) { return null; } }
  function dt(d) { try { return window.DK ? DK.dt(d) : new Date(d).toLocaleString(); } catch (e) { return ''; } }
  function $(id) { return document.getElementById(id); }
  function missing(e) { var m = String(e && (e.message || e.code) || e); return /PGRST202|42883|does not exist|Could not find the function/i.test(m); }
  function errMsg(e) {
    var m = String(e && e.message || e);
    if (/already signed/.test(m)) return L('Already signed.', 'Sudah ditandatangani.');
    if (/^name$|name required/.test(m)) return L('Enter the full name.', 'Masukkan nama penuh.');
    if (/signature|upload|path/.test(m)) return L('Signature image not saved — try again.', 'Imej tandatangan tidak disimpan — cuba lagi.');
    if (/no access|not found|invalid/.test(m)) return L('You do not have access to this delivery order.', 'Anda tiada akses kepada DO ini.');
    if (/owner\/admin only/.test(m)) return L('Only owner/admin can reset.', 'Hanya pemilik/admin boleh set semula.');
    return m;
  }
  function rpc(fn, args) {
    return Promise.resolve(sb.rpc(fn, args)).then(function (r) {
      if (r.error) { if (missing(r.error)) D.off = true; throw r.error; }
      return r.data;
    });
  }
  D.state = function (id) { return rpc('dk_do_sign_state', { p_id: id }); };

  /* wa-doc labels for the Delivered-by link (WAD.t falls back to the key, so register ours) */
  (function () {
    var add = {
      en: { doSignDel: 'Request signature', doSignDelD: 'DO link — sign as Delivered by, no login', doSignRem: 'Reminder', doSignRemD: 'Nudge to sign as Delivered by' },
      bm: { doSignDel: 'Minta tandatangan', doSignDelD: 'Pautan DO — tandatangan sebagai Dihantar oleh, tanpa log masuk', doSignRem: 'Peringatan', doSignRemD: 'Ingatkan untuk tandatangan sebagai Dihantar oleh' }
    };
    ['en', 'bm'].forEach(function (l) {
      try { if (window.__WAD_S && window.__WAD_S[l]) Object.keys(add[l]).forEach(function (k) { if (window.__WAD_S[l][k] == null) window.__WAD_S[l][k] = add[l][k]; }); } catch (e) {}
      try { if (window.LANG && LANG[l] && LANG[l].waDoc) Object.keys(add[l]).forEach(function (k) { if (LANG[l].waDoc[k] == null) LANG[l].waDoc[k] = add[l][k]; }); } catch (e) {}
    });
  })();

  /* ---------- images (signed URL -> data URL, cached) ---------- */
  function toData(url) {
    return fetch(url).then(function (x) { return x.ok ? x.blob() : null; }).then(function (bl) {
      if (!bl) return '';
      return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(''); }; fr.readAsDataURL(bl); });
    });
  }
  function loadImgs(st) {
    var need = ((st && st.slots) || []).map(function (s) { return s.signed_at && s.storage_path; }).filter(function (p) { return p && !IMG[p]; });
    if (!need.length) return Promise.resolve();
    return Promise.resolve(sb.storage.from('doc-files').createSignedUrls(need, 600)).then(function (r) {
      return Promise.all(((r && r.data) || []).map(function (u, i) {
        if (!u || !u.signedUrl) return null;
        var p = u.path || need[i];
        return toData(u.signedUrl).then(function (d) { if (d) IMG[p] = d; }, function () {});
      }));
    }).catch(function () {});
  }
  // print / PDF boxes: [{label, name, at, img}]
  function boxes(st) {
    return ((st && st.slots) || []).map(function (s) {
      return { label: s.label, name: s.signer_name || '', at: s.signed_at ? dt(s.signed_at) : '', img: (s.signed_at && s.storage_path && IMG[s.storage_path]) || '' };
    });
  }
  D.sigsFor = function (id) {
    if (D.off || !window.sb) return Promise.resolve([]);
    return D.state(id).then(function (st) { return loadImgs(st).then(function () { return boxes(st); }); }).catch(function () { return []; });
  };

  /* ---------- css (app tokens -> dark/light follow the theme) ---------- */
  function css() {
    if ($('dds-css')) return;
    var s = document.createElement('style'); s.id = 'dds-css';
    s.textContent =
      '.dds-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:12px;color:var(--text);min-width:0}' +
      '.dds-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 10px;margin:0 0 8px}' +
      '.dds-t{font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px}' +
      '.dds-prog{font-size:11px;font-weight:700;color:var(--warning);white-space:nowrap}.dds-prog.dds-done{color:var(--success)}' +
      '.dds-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}' +
      '@media (min-width:700px){.dds-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
      '.dds-row{border:1px solid var(--border);border-radius:var(--radius-sm,8px);padding:8px 10px;display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;min-width:0}' +
      '.dds-row.dds-ok{border-color:var(--success)}' +
      '.dds-rl{flex:1 1 140px;min-width:0}.dds-rn{font-size:12px;font-weight:600}' +
      '.dds-rs{font-size:11px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dds-th{width:84px;height:34px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:6px;background:#fff;overflow:hidden;color:#94a3b8}' +
      '.dds-th img{max-width:100%;max-height:100%;object-fit:contain;display:block}' +
      '.dds-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;white-space:nowrap;border:1px solid var(--border);color:var(--text-2)}' +
      '.dds-chip.dds-ok{color:var(--success);border-color:var(--success)}' +
      '.dds-acts{display:flex;flex-wrap:wrap;gap:6px;flex-basis:100%}' +
      '.dds-acts .btn,.dds-foot .btn,#dds-modal .btn{white-space:nowrap}' +
      '.dds-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0 0}' +
      '.dds-hint{font-size:11px;color:var(--text-3);flex:1 1 200px;min-width:0}' +
      '.dds-reset{color:var(--danger)!important;border-color:var(--danger)!important}' +
      '#dds-modal .modal-box-body{display:flex;flex-direction:column;gap:10px}' +
      '.dds-pad{display:block;width:100%;height:160px;border:1px solid var(--border);border-radius:8px;background:#fff;touch-action:none;cursor:crosshair}' +
      '.dds-err{font-size:12px;color:var(--danger)}.dds-err:empty{display:none}' +
      '@media print{.dds-card,#dds-modal{display:none!important}}';
    document.head.appendChild(s);
  }

  /* ---------- card: mount(el, id, {pdoc, model, ref, onChange}, fallback) ---------- */
  D.mount = function (el, id, o, fallback) {
    css(); o = o || {}; if (!el) return;
    el.className = 'no-print'; el.style.minWidth = '0';
    el.innerHTML = '<div class="dds-card"><div class="dds-t"><i class="ti ti-signature"></i> ' + esc(L('Signatures', 'Tandatangan')) + '</div><div style="color:var(--text-3);font-size:13px;margin-top:6px">' + esc(L('Loading…', 'Memuatkan…')) + '</div></div>';
    var st = null;
    function apply() {
      var bx = boxes(st);
      if (o.pdoc && window.DKD) DKD.sigBoxes(o.pdoc, bx);
      if (o.model) o.model.sigs = bx; // Download PDF / Share PDF read model.sigs
    }
    function draw() {
      if (!el.isConnected && el.parentNode == null) return;
      var sl = st.slots || [], n = sl.filter(function (s) { return s.signed_at; }).length;
      var rows = sl.map(function (s) {
        var g = !!s.signed_at, im = g && s.storage_path && IMG[s.storage_path];
        var sub = g ? (s.signer_name || '-') + ' · ' + dt(s.signed_at) + (s.via === 'link' ? ' · WhatsApp' : '')
          : (s.link_at ? L('Link sent ', 'Pautan dihantar ') + dt(s.link_at) : L('Not signed', 'Belum ditandatangani'));
        var h = '<div class="dds-row' + (g ? ' dds-ok' : '') + '" data-slot="' + esc(s.slot) + '">' +
          '<span class="dds-th">' + (im ? '<img alt="" src="' + im + '">' : '<i class="ti ti-signature"></i>') + '</span>' +
          '<div class="dds-rl"><div class="dds-rn">' + esc(s.label) + '</div><div class="dds-rs">' + esc(sub) + '</div></div>' +
          (g ? '<span class="dds-chip dds-ok"><i class="ti ti-circle-check"></i> ' + esc(L('Signed', 'Ditandatangani')) + '</span>'
             : '<span class="dds-chip">' + esc(L('Pending', 'Menunggu')) + '</span>');
        if (!g) h += '<div class="dds-acts"><button type="button" class="btn btn-primary btn-sm" data-s="sign" data-r="' + esc(s.slot) + '"><i class="ti ti-writing-sign"></i> ' + esc(L('Sign', 'Tandatangan')) + '</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-s="share" data-r="' + esc(s.slot) + '"><i class="ti ti-brand-whatsapp"></i> ' + esc(s.slot === 'received' ? L('Send to customer', 'Hantar ke pelanggan') : L('Send link', 'Hantar pautan')) + '</button></div>';
        return h + '</div>';
      }).join('');
      el.innerHTML = '<div class="dds-card"><div class="dds-top"><div class="dds-t"><i class="ti ti-signature"></i> ' + esc(L('Signatures', 'Tandatangan')) + '</div>' +
        '<span class="dds-prog' + (n >= sl.length ? ' dds-done' : '') + '">' + esc(n + '/' + sl.length + ' ' + L('signed', 'ditandatangani')) + '</span></div>' +
        '<div class="dds-grid">' + rows + '</div>' +
        '<div class="dds-foot"><span class="dds-hint">' + esc(L('Sign in any order, in the app or by WhatsApp link (no login). Signing does not change the DO status — mark Delivered yourself.',
          'Tandatangan dalam apa-apa susunan, dalam app atau melalui pautan WhatsApp (tanpa log masuk). Tandatangan tidak tukar status DO — tanda Delivered sendiri.')) + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" data-s="refresh" aria-label="' + esc(L('Refresh', 'Muat semula')) + '"><i class="ti ti-refresh"></i></button>' +
        (st.can_reset && n > 0 ? '<button type="button" class="btn btn-outline btn-sm dds-reset" data-s="reset"><i class="ti ti-arrow-back-up"></i> ' + esc(L('Reset signatures', 'Set semula tandatangan')) + '</button>' : '') +
        '</div></div>';
    }
    function paint(ns) {
      if (!ns || !ns.slots) return reload();
      st = ns; draw(); apply();
      loadImgs(st).then(function () { draw(); apply(); });
    }
    function reload() {
      return D.state(id).then(function (ns) {
        if (!ns || !ns.slots) { el.innerHTML = ''; return; }
        paint(ns);
      }, function (e) {
        if (D.off && fallback) { fallback(); return; }
        el.innerHTML = '<div class="dds-card"><div class="dds-err">' + esc(errMsg(e)) + '</div></div>';
      });
    }
    var ctx = { id: id, ref: o.ref, model: o.model, done: function (ns) { paint(ns); if (o.onChange) o.onChange(ns); } };
    el.onclick = function (e) {
      var b = e.target.closest && e.target.closest('[data-s]'); if (!b || !st) return;
      var a = b.getAttribute('data-s'), r = b.getAttribute('data-r');
      var s = (st.slots || []).filter(function (x) { return x.slot === r; })[0];
      if (a === 'sign' && s) openSign(ctx, s);
      if (a === 'share' && s) share(ctx, s, reload);
      if (a === 'refresh') reload();
      if (a === 'reset') reset(ctx);
    };
    // customer may sign from the link while this page is open: refresh when the app comes back to the front
    var vis = function () { if (document.visibilityState === 'visible') { if (!el.isConnected) document.removeEventListener('visibilitychange', vis); else reload(); } };
    document.addEventListener('visibilitychange', vis);
    reload().then(function () {
      // deep link from a notification: ?sign=<slot>
      try {
        var want = window.DK && DK.cur && DK.cur.params && DK.cur.params.sign;
        if (want && st && String(DK.cur.params.id || DK.cur.params.hl) === String(id)) {
          DK.cur.params.sign = null;
          var s = (st.slots || []).filter(function (x) { return x.slot === want && !x.signed_at; })[0];
          if (s) openSign(ctx, s);
        }
      } catch (e) {}
    });
  };

  /* ---------- draw pad ---------- */
  function closeSign() { var m = $('dds-modal'); if (m) m.remove(); pad = null; }
  function openSign(ctx, s) {
    closeSign(); css();
    var ov = document.createElement('div');
    ov.id = 'dds-modal'; ov.className = 'modal-overlay active';
    ov.innerHTML = '<div class="modal-box" style="max-width:460px" role="dialog" aria-modal="true" aria-labelledby="dds-mt">' +
      '<div class="modal-box-header" id="dds-mt"><i class="ti ti-writing-sign"></i> ' + esc(L('Sign as ', 'Tandatangan sebagai ') + s.label) + (ctx.ref ? ' · ' + esc(ctx.ref) : '') + '</div>' +
      '<div class="modal-box-body">' +
      '<div class="form-group" style="margin:0"><label class="form-label" for="dds-name">' + esc(s.slot === 'received' ? L('Receiver name', 'Nama penerima') : L('Name', 'Nama')) + '</label>' +
      '<input id="dds-name" class="form-input" maxlength="120" autocomplete="name" value="' + esc(s.slot === 'received' ? '' : me()) + '"></div>' +
      '<div class="form-group" style="margin:0"><label class="form-label">' + esc(L('Draw the signature', 'Lukis tandatangan')) + '</label>' +
      '<canvas id="dds-pad" class="dds-pad" aria-label="' + esc(L('Signature pad', 'Pad tandatangan')) + '"></canvas>' +
      '<div style="font-size:11px;color:var(--text-3);margin-top:4px">' + esc(s.slot === 'received' ? L('Hand the phone to the receiver to sign with a finger.', 'Serahkan telefon kepada penerima untuk tandatangan dengan jari.') : L('Sign with your finger or mouse.', 'Tandatangan dengan jari atau tetikus.')) + '</div></div>' +
      '<div class="form-group" style="margin:0"><label class="form-label" for="dds-note">' + esc(L('Note (optional)', 'Nota (pilihan)')) + '</label><input id="dds-note" class="form-input" maxlength="500"></div>' +
      '<div class="dds-err" id="dds-err" role="alert"></div></div>' +
      '<div class="modal-box-footer" style="flex-wrap:wrap">' +
      '<button type="button" class="btn btn-outline" data-a="clear"><i class="ti ti-eraser"></i> ' + esc(L('Clear', 'Padam')) + '</button>' +
      '<button type="button" class="btn btn-outline" data-a="cancel">' + esc(L('Cancel', 'Batal')) + '</button>' +
      '<button type="button" class="btn btn-primary" data-a="save"><i class="ti ti-check"></i> ' + esc(L('Save signature', 'Simpan tandatangan')) + '</button></div></div>';
    ov.addEventListener('click', function (e) {
      if (e.target === ov) return closeSign();
      var a = e.target.closest && e.target.closest('[data-a]'); if (!a) return;
      var k = a.getAttribute('data-a');
      if (k === 'cancel') closeSign(); else if (k === 'clear') clearPad(); else if (k === 'save') saveSign(ctx, s, a);
    });
    document.body.appendChild(ov);
    initPad($('dds-pad'));
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
  function saveSign(ctx, s, btn) {
    var er = $('dds-err'), name = String(($('dds-name') || {}).value || '').trim(), note = String(($('dds-note') || {}).value || '').trim();
    var lbl = '<i class="ti ti-check"></i> ' + esc(L('Save signature', 'Simpan tandatangan'));
    var fail = function (m) { if (er) er.textContent = m; btn.disabled = false; btn.innerHTML = lbl; };
    if (name.length < 2) return fail(L('Enter the full name.', 'Masukkan nama penuh.'));
    if (!pad || !pad.ink) return fail(L('Draw the signature first.', 'Lukis tandatangan dahulu.'));
    var t = tid(); if (!t) return fail(L('Not signed in.', 'Belum log masuk.'));
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> ' + esc(L('Saving…', 'Menyimpan…'));
    if (er) er.textContent = '';
    var path = t + '/do-signatures/' + ctx.id + '/' + s.slot + '-' + Date.now() + '.png';
    padBlob().then(function (blob) {
      if (!blob) throw new Error(L('Could not read the signature.', 'Tandatangan tidak dapat dibaca.'));
      return Promise.resolve(sb.storage.from('doc-files').upload(path, blob, { contentType: 'image/png', upsert: false }));
    }).then(function (up) {
      if (up && up.error) throw up.error;
      return rpc('dk_do_sign', { p_id: ctx.id, p_slot: s.slot, p_name: name, p_path: path, p_note: note || null });
    }).then(function (r) {
      closeSign();
      toast(L('Signed', 'Ditandatangani') + (r ? ' (' + r.done + '/' + r.total + ')' : ''));
      try { auditLog('update', 'delivery_orders', ctx.id, null, { action: 'sign', slot: s.slot }); } catch (e) {}
      ctx.done(r && r.state);
    }).catch(function (e) { fail(L('Could not sign: ', 'Gagal tandatangan: ') + errMsg(e)); });
  }

  /* ---------- WhatsApp ---------- */
  function delText(ctx, lang, url, co, remind) {
    var ref = ctx.ref || 'DO';
    if (lang !== 'bm') return (remind ? 'Hi, reminder: ' : 'Hi, ') + 'please check Delivery Order ' + ref + ' and sign as Delivered by via the link below (no login needed).\nView & sign: ' + url + '\nThank you. – ' + co;
    return (remind ? 'Salam, peringatan: ' : 'Salam, ') + 'sila semak Delivery Order ' + ref + ' dan tandatangan sebagai Dihantar oleh melalui pautan di bawah (tiada log masuk).\nSemak & tandatangan: ' + url + '\nTerima kasih. – ' + co;
  }
  function share(ctx, s, after) {
    // Received by -> the DO confirm link to the customer (existing template + phone prefill)
    if (s.slot === 'received') {
      if (!window.DKS || !DKS.share) { toast(L('WhatsApp share is not available.', 'Kongsi WhatsApp tidak tersedia.'), 'error'); return; }
      DKS.share('do', ctx.id, { done: function () { if (after) setTimeout(after, 300); } });
      return;
    }
    var W = window.WAD;
    if (!W || typeof W.open !== 'function') { toast(L('WhatsApp share is not available.', 'Kongsi WhatsApp tidak tersedia.'), 'error'); return; }
    var link = null;
    var onShared = function (e) { if (!e.detail || String(e.detail.doc_id) !== String(ctx.id)) return; document.removeEventListener('wad:shared', onShared); if (after) setTimeout(after, 300); };
    document.addEventListener('wad:shared', onShared);
    W.open({
      docType: 'do', docId: ctx.id, docRef: s.label + ' · ' + (ctx.ref || 'DO'), to: null, phone: '', recipientKind: 'other',
      k: 'sign_req',
      tpls: [{ k: 'sign_req', label: 'doSignDel', desc: 'doSignDelD' }],
      build: function (k, lang) {
        var get = link ? Promise.resolve(link) : rpc('dk_do_sign_link_create', { p_id: ctx.id, p_slot: s.slot }).then(function (l) { link = l; return l; });
        return get.then(function (l) {
          var th = typeof W.theme === 'function' ? W.theme() : null;
          var url = W.base() + 'dk-public.html?do_sign=' + encodeURIComponent(l.token) + (lang === 'bm' ? '&lang=bm' : '') + (th ? '&theme=' + th : '');
          return { text: delText(ctx, lang, url, W.company(), false), link_id: l.link_id, expires_at: l.expires_at };
        }, function (e) { toast(errMsg(e), 'error'); throw e; });
      }
    });
  }

  function reset(ctx) {
    var why = prompt(L('Reset DO signatures? Signed slots are cleared and old links stop working. The DO status is not changed. Reason (optional):',
      'Set semula tandatangan DO? Slot yang ditandatangani dikosongkan dan pautan lama tidak berfungsi. Status DO tidak berubah. Sebab (pilihan):'), '');
    if (why === null) return;
    rpc('dk_do_sign_reset', { p_id: ctx.id, p_slot: null, p_reason: String(why || '').trim() || null }).then(function (r) {
      toast(L('Signatures reset', 'Tandatangan diset semula'));
      try { auditLog('update', 'delivery_orders', ctx.id, null, { action: 'reset_signatures' }); } catch (e) {}
      ctx.done(r && r.state);
    }, function (e) { toast(errMsg(e), 'error'); });
  }
})();
