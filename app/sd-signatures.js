/* Salary Disbursement — 4 signatures v1 (needs supabase/sd_signatures_01.sql; loads after sd-tools.js).
   - Prepared By / Checked By / First Approval / Second Approval names live on the batch row
     (localStorage stays as fallback + one-time seed). Hidden #sig-input-* stay the source the
     page reads; sd-mobile-view.js mirrors them into the Signatures card and calls decorate().
   - Each slot: thumbnail + Signed/Pending chip + Sign (in-app draw pad) + Share link (WhatsApp,
     one link per role; the token's SHA-256 is all the DB keeps). Any order; a signed slot locks.
   - First signature -> batch 'shared' (amounts locked). 4/4 -> 'approved' (server RPC).
     Reject / Unlock / Reset -> Draft, all signatures voided (server trigger).
   - Print: 4-column grid (signature image, line, name, role, date) via printHtml().
   - Bell + push per signature come from the RPC (notifications insert -> push-send), no amounts.
   If the SQL is not run yet, sd_signatures errors -> everything here stays off (names-only card). */
(function () {
  if (window.SD_SIGS_V1) return;
  window.SD_SIGS_V1 = true;

  var R = [
    { k: 'preparedBy', r: 'prepared', col: 'prepared_by_name', en: 'Prepared By', bm: 'Disediakan Oleh' },
    { k: 'checkedBy', r: 'checked', col: 'checked_by_name', en: 'Checked By', bm: 'Disemak Oleh' },
    { k: 'firstApproval', r: 'first', col: 'first_approval_name', en: 'First Approval', bm: 'Kelulusan Pertama' },
    { k: 'secondApproval', r: 'second', col: 'second_approval_name', en: 'Second Approval', bm: 'Kelulusan Kedua' }
  ];
  var BCOLS = 'id,month,year,status,created_by,prepared_by_name,checked_by_name,first_approval_name,second_approval_name';
  var S = { ready: undefined, batch: null, sigs: {}, imgs: {}, ver: 0, seq: 0, saveT: null };

  function $(id) { return document.getElementById(id); }
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, ms) { return bm() ? ms : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tid() { try { return APP.tenant.id; } catch (e) { return null; } }
  function uid() { try { return APP.user.id; } catch (e) { return null; } }
  function me() { try { return String(APP.user.name || APP.user.full_name || APP.user.email || '').trim(); } catch (e) { return ''; } }
  function canHR() { try { return typeof canManageHR === 'function' ? !!canManageHR() : !!window.canManageHR(); } catch (e) { return false; } }
  function toast(m, t) { try { showToast(m, t || 'success'); } catch (e) {} }
  function period() { return { m: Number(($('sd-month') || {}).value) || 0, y: Number(($('sd-year') || {}).value) || 0 }; }
  function byK(k) { for (var i = 0; i < R.length; i++) if (R[i].k === k || R[i].r === k) return R[i]; return null; }
  function lbl(x) { return L(x.en, x.bm); }
  function count() { return R.filter(function (x) { return !!S.sigs[x.r]; }).length; }
  function status() { return (S.batch && S.batch.status) || (window._sdCurrentBatch && window._sdCurrentBatch.status) || 'draft'; }
  function approved() { return status() === 'approved'; }
  function dmy(iso) { var d = new Date(iso); if (isNaN(d)) return ''; return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); }
  function periodLabel(m, y) {
    try { if (typeof _pdocMonthYearLabel === 'function') return _pdocMonthYearLabel(m, y, bm()); } catch (e) {}
    return m + '/' + y;
  }
  function errMsg(e) { return String((e && (e.message || e.error_description)) || e || ''); }
  function bump() { S.ver++; refresh(); }
  function refresh() {
    var el = $('sdm-sigs'); if (el) decorate(el);
    syncHeader();
  }

  /* ---------- feature detect + load ---------- */
  function detect() {
    if (S.ready !== undefined) return Promise.resolve(S.ready);
    if (!window.sb) return Promise.resolve(false);
    return Promise.resolve(sb.from('sd_signatures').select('id').limit(1)).then(function (r) { S.ready = !(r && r.error); return S.ready; }, function () { S.ready = false; return false; });
  }
  async function load() {
    var my = ++S.seq;
    var ok = await detect();
    if (!ok || my !== S.seq) return;
    var cb = window._sdCurrentBatch;
    if (!cb) { S.batch = null; S.sigs = {}; bump(); return; }
    var a = await sb.from('salary_disbursement_batches').select(BCOLS).eq('id', cb.id).eq('tenant_id', tid()).maybeSingle();
    var s = await sb.from('sd_signatures').select('id,role,signer_name,signed_at,signed_via,storage_path,attachment_path').eq('batch_id', cb.id).is('voided_at', null);
    if (my !== S.seq) return;
    if (a.error || s.error) { if (a.error && /column/i.test(a.error.message || '')) S.ready = false; return; }
    S.batch = a.data || null;
    S.sigs = {};
    ((s && s.data) || []).forEach(function (x) { S.sigs[x.role] = x; });
    applyNames();
    bump();
    loadImgs();
  }
  function applyNames() {
    var b = S.batch; if (!b) return;
    var any = R.some(function (x) { return String(b[x.col] || '').trim(); }), changed = false;
    if (!any) { // first time on DB: seed from what the page has (localStorage prefill)
      if (canHR() && !approved()) saveNames(true);
      return;
    }
    R.forEach(function (x) {
      var inp = $('sig-input-' + x.k); if (!inp) return;
      var v = S.sigs[x.r] ? S.sigs[x.r].signer_name : String(b[x.col] || '');
      if (inp.value !== v && document.activeElement !== inp) { inp.value = v; changed = true; }
    });
    if (changed) { try { window._sdSaveSigs(); } catch (e) {} }
  }
  function loadImgs() {
    var need = R.map(function (x) { return S.sigs[x.r]; }).filter(function (g) { return g && g.storage_path && !S.imgs[g.storage_path]; }).map(function (g) { return g.storage_path; });
    if (!need.length) return;
    Promise.resolve(sb.storage.from('doc-files').createSignedUrls(need, 600)).then(function (r) {
      ((r && r.data) || []).forEach(function (u, i) {
        if (!u || !u.signedUrl) return;
        var p = u.path || need[i];
        fetch(u.signedUrl).then(function (x) { return x.blob(); }).then(function (bl) {
          return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(''); }; fr.readAsDataURL(bl); });
        }).then(function (d) { if (d) { S.imgs[p] = d; bump(); } }, function () {});
      });
    }, function () {});
  }

  /* ---------- names -> batch columns ---------- */
  function curNames() { var o = {}; R.forEach(function (x) { var i = $('sig-input-' + x.k); o[x.col] = i ? String(i.value || '').trim().slice(0, 120) || null : null; }); return o; }
  function saveNames(now) {
    clearTimeout(S.saveT);
    var go = function () {
      var b = S.batch; if (!S.ready || !b || approved() || !canHR()) return;
      var o = curNames(), patch = {};
      R.forEach(function (x) { if (!S.sigs[x.r] && (b[x.col] || null) !== o[x.col]) patch[x.col] = o[x.col]; });
      if (!Object.keys(patch).length) return;
      Promise.resolve(sb.from('salary_disbursement_batches').update(patch).eq('id', b.id).eq('tenant_id', tid())).then(function (r) {
        if (r && !r.error) Object.keys(patch).forEach(function (c) { b[c] = patch[c]; });
      }, function () {});
    };
    if (now) go(); else S.saveT = setTimeout(go, 400);
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.id || t.id.indexOf('sig-input-') !== 0) return;
    saveNames(false);
  }, true);

  async function ensureBatch() {
    var p = period(); if (!p.m || !p.y) throw new Error(L('Pick a month first.', 'Pilih bulan dahulu.'));
    var recs = null; try { recs = (typeof _sdRecords !== 'undefined') ? _sdRecords : window._sdRecords; } catch (e) { recs = window._sdRecords; }
    if (!Array.isArray(recs) || !recs.length) throw new Error(L('No records for this month.', 'Tiada rekod untuk bulan ini.'));
    var tot = 0; try { recs.forEach(function (r) { tot += Number(window._sdRowValues(r).net_pay) || 0; }); } catch (e) {}
    tot = Math.round(tot * 100) / 100;
    var b = window._sdCurrentBatch;
    if (b && approved()) throw new Error(L('Already approved — locked.', 'Sudah diluluskan — dikunci.'));
    if (b && ['shared', 'pending_review'].indexOf(b.status) >= 0) return b; // amounts locked: what is signed is what is saved
    var save = window._sdSaveAll;
    if (typeof save === 'function') {
      await save();
      var ls = window._sdLastSave;
      if (ls && (ls.blocked || (ls.failed && ls.failed.length))) throw new Error(L('Save failed — fix the rows first, then sign.', 'Simpan gagal — betulkan baris dahulu, kemudian tandatangan.'));
    }
    if (!b) {
      var ins = Object.assign({ tenant_id: tid(), month: p.m, year: p.y, status: 'draft', total_net_pay: tot, employee_count: recs.length }, curNames());
      var r = await sb.from('salary_disbursement_batches').insert(ins).select('id,status').single();
      if (r.error) throw r.error;
      b = r.data;
    } else {
      var u = await sb.from('salary_disbursement_batches').update(Object.assign({ total_net_pay: tot, employee_count: recs.length }, curNames())).eq('id', b.id).eq('tenant_id', tid());
      if (u.error) throw u.error;
    }
    window._sdCurrentBatch = b;
    return b;
  }
  async function reStatus() {
    var p = period();
    try { if (typeof window._sdBatchStatus === 'function') await window._sdBatchStatus(p.m, p.y); else await load(); } catch (e) {}
  }

  /* ---------- Signatures card decoration (called by sd-mobile-view ensureSigs every tick) ---------- */
  function rowHtml(x) {
    var g = S.sigs[x.r], ap = approved(), h = '';
    if (g) {
      var img = S.imgs[g.storage_path];
      h += '<span class="sds-th">' + (img ? '<img alt="" src="' + img + '">' : '<i class="ti ti-signature"></i>') + '</span>' +
        '<span class="sds-chip sds-ok"><i class="ti ti-check"></i> ' + esc(L('Signed', 'Ditandatangani') + ' · ' + dmy(g.signed_at) + (g.signed_via === 'link' ? ' · ' + L('via link', 'melalui pautan') : '')) + '</span>';
      if (g.attachment_path) h += '<span class="sds-acts"><button type="button" class="btn btn-outline btn-sm" data-sds="att" data-r="' + x.r + '"><i class="ti ti-paperclip"></i> ' + esc(L('Attachment', 'Lampiran')) + '</button></span>';
    } else {
      h += '<span class="sds-th sds-empty"><i class="ti ti-signature"></i></span>' +
        '<span class="sds-chip">' + esc(L('Pending', 'Belum')) + '</span>';
      if (!ap) h += '<span class="sds-acts"><button type="button" class="btn btn-outline btn-sm" data-sds="sign" data-r="' + x.r + '"><i class="ti ti-writing-sign"></i> ' + esc(L('Sign', 'Tandatangan')) + '</button>' +
        (canHR() ? '<button type="button" class="btn btn-outline btn-sm" data-sds="share" data-r="' + x.r + '"><i class="ti ti-brand-whatsapp"></i> ' + esc(L('Share link', 'Kongsi pautan')) + '</button>' : '') + '</span>';
    }
    return h;
  }
  function decorate(el) {
    el = el || $('sdm-sigs');
    if (!el || !S.ready) return;
    var n = count(), st = status();
    var key = [S.ver, bm() ? 'bm' : 'en', st, canHR() ? 1 : 0, S.batch ? S.batch.id : '-'].join('|');
    if (!el.__sdsBound) {
      el.__sdsBound = true;
      el.addEventListener('click', function (e) {
        var b = e.target && e.target.closest && e.target.closest('[data-sds]'); if (!b) return;
        var a = b.getAttribute('data-sds'), x = byK(b.getAttribute('data-r'));
        if (a === 'sign' && x) openSign(x);
        else if (a === 'share' && x) share(x);
        else if (a === 'att' && x) openAtt(x);
        else if (a === 'reset') reset();
      });
    }
    R.forEach(function (x) {
      var inp = el.querySelector('#sdm-sig-' + x.k);
      if (inp) { var ro = !!S.sigs[x.r] || approved(); if (inp.readOnly !== ro) inp.readOnly = ro; }
    });
    if (el.getAttribute('data-sds') === key) return;
    el.setAttribute('data-sds', key);
    R.forEach(function (x) {
      var box = el.querySelector('.sdm-sig-x[data-role="' + x.k + '"]');
      if (box) box.innerHTML = rowHtml(x);
    });
    var pn = el.querySelector('.sdm-sig-n');
    if (pn) pn.innerHTML = '<span class="sds-prog' + (n === 4 ? ' sds-done' : '') + '">' + esc(n + '/4 ' + L('signed', 'ditandatangani')) + '</span>';
    var ft = el.querySelector('.sdm-sig-foot');
    if (ft) {
      var showReset = canHR() && st !== 'approved' && (n > 0 || st === 'shared' || st === 'pending_review');
      ft.innerHTML = '<span class="sds-hint">' + esc(st === 'approved' ? L('All 4 signed — approved and locked.', 'Kesemua 4 telah ditandatangani — diluluskan dan dikunci.')
        : L('Sign in any order. First signature locks the amounts; 4/4 approves.', 'Tandatangan dalam apa-apa susunan. Tandatangan pertama mengunci jumlah; 4/4 meluluskan.')) + '</span>' +
        (showReset ? '<button type="button" class="btn btn-outline btn-sm sds-reset" data-sds="reset"><i class="ti ti-rotate"></i> ' + esc(L('Reset signatures & unlock', 'Set semula tandatangan & buka kunci')) + '</button>' : '');
    }
  }
  function syncHeader() {
    if (!S.ready) return;
    var sb2 = $('sd-share-btn'); if (sb2 && sb2.style.display !== 'none') sb2.style.display = 'none'; // replaced by per-role links
    var badge = $('sd-batch-badge'), sp = badge && badge.querySelector('.badge'), st = status();
    if (sp && S.batch && (st === 'shared' || st === 'draft' && count() > 0)) {
      var t = L('Awaiting signatures', 'Menunggu tandatangan') + ' ' + count() + '/4';
      if (sp.textContent !== t) sp.textContent = t;
    }
  }

  /* ---------- in-app Sign modal ---------- */
  var pad = null;
  function closeSign() { var m = $('sds-modal'); if (m) m.remove(); pad = null; }
  function openSign(x) {
    closeSign();
    var b = S.batch, nm = (b && b[x.col]) || String(($('sig-input-' + x.k) || {}).value || '').trim() || me();
    var ov = document.createElement('div');
    ov.id = 'sds-modal'; ov.className = 'modal-overlay active';
    ov.innerHTML = '<div class="modal-box" style="max-width:460px" role="dialog" aria-modal="true" aria-labelledby="sds-mt">' +
      '<div class="modal-box-header" id="sds-mt"><i class="ti ti-writing-sign"></i> ' + esc(L('Sign as ', 'Tandatangan sebagai ') + lbl(x)) + '</div>' +
      '<div class="modal-box-body">' +
      '<div class="form-group" style="margin:0"><label class="form-label" for="sds-name">' + esc(L('Name', 'Nama')) + '</label>' +
      '<input id="sds-name" class="form-input" maxlength="120" autocomplete="name" value="' + esc(nm) + '"></div>' +
      '<div class="form-group" style="margin:0"><label class="form-label">' + esc(L('Draw your signature', 'Lukis tandatangan anda')) + '</label>' +
      '<canvas id="sds-pad" class="sds-pad" aria-label="' + esc(L('Signature pad', 'Pad tandatangan')) + '"></canvas>' +
      '<div class="sds-pad-hint">' + esc(L('Sign with your finger or mouse.', 'Tandatangan dengan jari atau tetikus.')) + '</div></div>' +
      '<div class="sds-err" id="sds-err" role="alert"></div></div>' +
      '<div class="modal-box-footer" style="flex-wrap:wrap">' +
      '<button type="button" class="btn btn-outline" data-a="clear"><i class="ti ti-eraser"></i> ' + esc(L('Clear', 'Padam')) + '</button>' +
      '<button type="button" class="btn btn-outline" data-a="cancel">' + esc(L('Cancel', 'Batal')) + '</button>' +
      '<button type="button" class="btn btn-primary" data-a="save"><i class="ti ti-check"></i> ' + esc(L('Save signature', 'Simpan tandatangan')) + '</button></div></div>';
    ov.addEventListener('click', function (e) {
      if (e.target === ov) return closeSign();
      var a = e.target.closest && e.target.closest('[data-a]'); if (!a) return;
      var k = a.getAttribute('data-a');
      if (k === 'cancel') closeSign(); else if (k === 'clear') clearPad(); else if (k === 'save') saveSign(x, a);
    });
    document.body.appendChild(ov);
    initPad($('sds-pad'));
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
  async function saveSign(x, btn) {
    var er = $('sds-err'), name = String(($('sds-name') || {}).value || '').trim();
    var fail = function (m) { if (er) er.textContent = m; btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> ' + esc(L('Save signature', 'Simpan tandatangan')); };
    if (!name) return fail(L('Enter your name.', 'Masukkan nama anda.'));
    if (!pad || !pad.ink) return fail(L('Draw your signature first.', 'Lukis tandatangan anda dahulu.'));
    btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> ' + esc(L('Saving…', 'Menyimpan…'));
    if (er) er.textContent = '';
    try {
      var blob = await padBlob();
      if (!blob) throw new Error(L('Could not read the signature.', 'Tandatangan tidak dapat dibaca.'));
      var b = await ensureBatch();
      var path = tid() + '/sd-signatures/' + b.id + '/' + x.r + '-' + Date.now() + '.png';
      var up = await sb.storage.from('doc-files').upload(path, blob, { contentType: 'image/png', upsert: false });
      if (up.error) throw up.error;
      var r = await sb.rpc('sd_sign_app', { p_batch: b.id, p_role: x.r, p_name: name, p_path: path });
      if (r.error) throw r.error;
      var res = r.data || {};
      var inp = $('sig-input-' + x.k); if (inp) { inp.value = name; try { window._sdSaveSigs(); } catch (e) {} }
      closeSign();
      toast(res.approved ? L('Signed — 4/4, salary disbursement approved.', 'Ditandatangani — 4/4, penyaluran gaji diluluskan.')
        : L('Signed', 'Ditandatangani') + ' (' + (res.signed || count() + 1) + '/4).', 'success');
      await reStatus();
    } catch (e) { fail(L('Could not sign: ', 'Gagal tandatangan: ') + errMsg(e)); }
  }
  function openAtt(x) {
    var g = S.sigs[x.r]; if (!g || !g.attachment_path) return;
    var w = window.open('', '_blank');
    Promise.resolve(sb.storage.from('doc-files').createSignedUrl(g.attachment_path, 600)).then(function (r) {
      if (r && r.data && r.data.signedUrl) { if (w) w.location = r.data.signedUrl; else window.open(r.data.signedUrl, '_blank'); }
      else { if (w) w.close(); toast(L('Attachment not found.', 'Lampiran tidak dijumpai.'), 'error'); }
    }, function () { if (w) w.close(); });
  }

  /* ---------- per-role WhatsApp link ---------- */
  function roleText(x, lang, ref, link, co, remind) {
    var en = lang !== 'bm', who = en ? x.en : x.bm;
    if (en) return (remind ? 'Hi, reminder: ' : 'Hi, ') + 'please review the Salary Disbursement for ' + ref + ' and sign as ' + who + ' via the link below (no login needed).\nView & sign: ' + link + '\nThank you. – ' + co;
    return (remind ? 'Salam, peringatan: ' : 'Salam, ') + 'sila semak Penyaluran Gaji bagi ' + ref + ' dan tandatangan sebagai ' + who + ' melalui pautan di bawah (tiada log masuk).\nSemak & tandatangan: ' + link + '\nTerima kasih. – ' + co;
  }
  async function share(x) {
    var W = window.WAD;
    if (!W || typeof W.open !== 'function') { toast(L('WhatsApp share is not available.', 'Kongsi WhatsApp tidak tersedia.'), 'error'); return; }
    if (!canHR()) { toast(L('Only HR managers can share signing links.', 'Hanya pengurus HR boleh kongsi pautan tandatangan.'), 'error'); return; }
    var b;
    try { b = await ensureBatch(); } catch (e) { toast(errMsg(e), 'error'); return; }
    var p = period(), ref = periodLabel(p.m, p.y), batchId = b.id, link = null, wasDraft = ['draft', 'rejected'].indexOf(b.status) >= 0;
    function onShared(e) {
      if (!e.detail || e.detail.doc_type !== 'sd' || String(e.detail.doc_id) !== String(batchId)) return;
      document.removeEventListener('wad:shared', onShared);
      if (wasDraft) Promise.resolve(sb.from('salary_disbursement_batches').update({ status: 'shared', shared_at: new Date().toISOString() })
        .eq('id', batchId).eq('tenant_id', tid()).in('status', ['draft', 'rejected'])).then(reStatus, reStatus);
    }
    document.addEventListener('wad:shared', onShared);
    W.open({
      docType: 'sd', docId: batchId, docRef: lbl(x) + ' · ' + ref, to: null, phone: '',
      k: 'sd_send',
      tpls: [{ k: 'sd_send', label: 'sdShare', desc: 'sdShareD' }, { k: 'sd_remind', label: 'sdRemind', desc: 'sdRemindD' }],
      build: function (k, lang) {
        var get = link ? Promise.resolve(link) : Promise.resolve(sb.rpc('sd_sign_link_create', { p_batch: batchId, p_role: x.r })).then(function (r) {
          if (r.error) throw r.error; link = r.data; return link;
        });
        return get.then(function (l) {
          var th = typeof W.theme === 'function' ? W.theme() : null;
          var url = W.base() + 'public-sd.html?sd_sign=' + encodeURIComponent(l.token) + (lang === 'bm' ? '&lang=bm' : '') + (th ? '&theme=' + th : '');
          return { text: roleText(x, lang, ref, url, W.company(), k === 'sd_remind'), link_id: l.link_id, expires_at: l.expires_at };
        });
      }
    });
  }

  /* ---------- HR reset (in progress -> Draft, signatures voided) ---------- */
  async function reset() {
    var b = S.batch || window._sdCurrentBatch; if (!b) return;
    if (!canHR()) { toast(L('Only HR managers can reset signatures.', 'Hanya pengurus HR boleh set semula tandatangan.'), 'error'); return; }
    var reason = window.prompt(L('Reset all signatures and unlock for editing? All ' + count() + ' signature(s) will be voided and links stop working. Reason (optional):',
      'Set semula semua tandatangan dan buka kunci untuk edit? Kesemua ' + count() + ' tandatangan akan dibatalkan dan pautan tidak lagi berfungsi. Sebab (pilihan):'), '');
    if (reason === null) return;
    var r = await sb.rpc('sd_sign_reset', { p_batch: b.id, p_reason: String(reason || '').trim() || null });
    if (r.error) { toast(L('Reset failed: ', 'Gagal set semula: ') + errMsg(r.error), 'error'); return; }
    var d = r.data || {};
    try { auditLog('update', 'salary_disbursement_batches', b.id, { status: status() }, { status: 'draft', action: 'reset_signatures', voided: d.voided }); } catch (e) {}
    try { if (window._sdTools && _sdTools.notifyBatch) _sdTools.notifyBatch('reset', { id: b.id, month: d.month || b.month, year: d.year || b.year, created_by: d.created_by || b.created_by }); } catch (e) {}
    toast(L('Signatures reset — back to Draft.', 'Tandatangan diset semula — kembali ke Draf.'), 'success');
    await reStatus();
  }

  /* ---------- print grid (images as data URLs, so print never waits on the network) ---------- */
  function printHtml() {
    if (!S.ready) return '';
    var cells = R.map(function (x) {
      var g = S.sigs[x.r], nm = g ? g.signer_name : String(($('sig-input-' + x.k) || {}).value || '').trim();
      return { x: x, g: g, nm: nm, img: g && S.imgs[g.storage_path] };
    });
    if (!cells.some(function (c) { return c.nm || c.g; })) return '';
    return '<div class="sdm-p-sgrid">' + cells.map(function (c) {
      return '<div class="sdm-p-sg"><div class="sdm-p-sgi">' + (c.img ? '<img alt="" src="' + c.img + '">' : '') + '</div>' +
        '<div class="sdm-p-sgl"></div><div class="sdm-p-sgn">' + esc(c.nm || '\u00a0') + '</div>' +
        '<div class="sdm-p-sgr">' + esc(lbl(c.x)) + '</div>' +
        '<div class="sdm-p-sgd">' + esc(c.g ? L('Date', 'Tarikh') + ': ' + dmy(c.g.signed_at) : L('Date', 'Tarikh') + ': ') + '</div></div>';
    }).join('') + '</div>';
  }

  /* ---------- css (tokens only) ---------- */
  function css() {
    if ($('sds-css')) return;
    var s = document.createElement('style'); s.id = 'sds-css';
    s.textContent =
      '#sdm-sigs .sdc-row{flex-wrap:wrap;align-content:flex-start;padding:4px 0}' +
      '#sdm-sigs .sdm-sig-grid{align-items:start}' +
      '@media (min-width:900px){#sdm-sigs .sdm-sig-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
      '#sdm-sigs .sdc-cap{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}' +
      '.sdm-sig-x{flex-basis:100%;display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:4px 0 2px;min-width:0}' +
      '.sdm-sig-x:empty{display:none}' +
      '.sds-th{width:84px;height:34px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);overflow:hidden;color:var(--text-3)}' +
      '.sds-th img{max-width:100%;max-height:100%;object-fit:contain;display:block}' +
      '.sds-th.sds-empty{border-style:dashed}' +
      '.sds-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;white-space:nowrap;border:1px solid var(--border);color:var(--text-2)}' +
      '.sds-chip.sds-ok{color:var(--success);border-color:var(--success)}' +
      '.sds-acts{display:inline-flex;flex-wrap:wrap;gap:6px;margin-left:auto}' +
      '.sds-acts .btn,.sdm-sig-foot .btn{white-space:nowrap}' +
      '.sds-prog{font-size:11px;font-weight:700;white-space:nowrap;color:var(--warning);text-transform:none;letter-spacing:0}' +
      '.sds-prog.sds-done{color:var(--success)}' +
      '.sdm-sig-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:8px 0 0}' +
      '.sdm-sig-foot:empty{display:none}' +
      '.sds-hint{font-size:11px;color:var(--text-3);flex:1 1 200px;min-width:0}' +
      '.sds-reset{color:var(--danger);border-color:var(--danger)}' +
      '#sds-modal .modal-box-body{display:flex;flex-direction:column;gap:10px}' +
      '#sds-modal .modal-box-footer .btn{white-space:nowrap}' +
      '.sds-pad{display:block;width:100%;height:160px;border:1px solid var(--border);border-radius:8px;background:white;touch-action:none;cursor:crosshair}' +
      '.sds-pad-hint{font-size:11px;color:var(--text-3);margin-top:4px}' +
      '.sds-err{font-size:12px;color:var(--danger);min-height:0}' +
      '.sds-err:empty{display:none}' +
      '#sdm-print .sdm-p-sgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 14px;margin:14px 0 0;page-break-inside:avoid;break-inside:avoid}' +
      '#sdm-print .sdm-p-sg{display:flex;flex-direction:column;min-width:0;font-size:10px}' +
      '#sdm-print .sdm-p-sgi{height:46px;display:flex;align-items:flex-end;justify-content:center}' +
      '#sdm-print .sdm-p-sgi img{max-height:46px;max-width:100%;object-fit:contain}' +
      '#sdm-print .sdm-p-sgl{border-top:1px solid var(--text);margin:2px 0 3px}' +
      '#sdm-print .sdm-p-sgn{font-weight:700;font-size:11px;overflow-wrap:anywhere}' +
      '#sdm-print .sdm-p-sgr{color:var(--text-2)}' +
      '#sdm-print .sdm-p-sgd{color:var(--text-2)}';
    document.head.appendChild(s);
  }

  /* ---------- wrap _sdBatchStatus ---------- */
  function wrap() {
    var o = window._sdBatchStatus;
    if (typeof o !== 'function' || o._sds1) return;
    var w = async function () {
      try { return await o.apply(this, arguments); } finally { try { await load(); } catch (e) {} syncHeader(); }
    };
    Object.keys(o).forEach(function (k) { w[k] = o[k]; });
    w._sds1 = true;
    window._sdBatchStatus = w;
  }

  css();
  wrap();
  setTimeout(wrap, 900);
  setTimeout(wrap, 2700);
  // page may already be on screen (late script) -> load once
  setTimeout(function () { if ($('sd-batch-badge')) load(); }, 1200);

  window._sdSig = { decorate: decorate, printHtml: printHtml, load: load, reset: reset, share: share, openSign: openSign, _state: function () { return S; }, ready: function () { return !!S.ready; } };
})();
