/* dk-sign.js — generic signature / approval engine (window.DKSign). Slots per document type come from
   dk__slots (supabase/dk_phase0_kit.sql); RPCs dk_sign_state / dk_sign_request / dk_sign / dk_sign_reset.
   Panel on document card views, modal from list cards, print/PDF signature boxes. Tokens only; EN/BM. v1 */
(function () {
  if (window.DKSign) return;
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }
  function role() { try { return String(APP.user.role || '').toLowerCase(); } catch (e) { return ''; } }
  function me() { try { return APP.user.full_name || APP.user.name || ''; } catch (e) { return ''; } }
  function dt(d) { try { return window.DK ? DK.dt(d) : new Date(d).toLocaleString(); } catch (e) { return ''; } }
  // mirror of dk__slots (labels only; the server is the source of truth for who may sign)
  var SL = {
    quo: [['prepared', 'Prepared by', 'Disediakan oleh'], ['approved', 'Approved by', 'Diluluskan oleh']],
    do: [['delivered', 'Delivered by', 'Dihantar oleh'], ['received', 'Received by', 'Diterima oleh']],
    cn: [['prepared', 'Prepared by', 'Disediakan oleh'], ['approved', 'Approved by', 'Diluluskan oleh']],
    po: [['prepared', 'Prepared by', 'Disediakan oleh'], ['approved', 'Approved by', 'Diluluskan oleh']],
    grn: [['received', 'Received by', 'Diterima oleh'], ['checked', 'Checked by', 'Disemak oleh']],
    bill: [['verified', 'Verified by', 'Disahkan oleh'], ['approved', 'Approved for payment', 'Diluluskan untuk bayaran']],
    exp: [['claimant', 'Claimant', 'Penuntut'], ['approved', 'Approved by', 'Diluluskan oleh']],
    leave: [['applicant', 'Applicant', 'Pemohon'], ['approved', 'Approved by', 'Diluluskan oleh']],
    ot: [['claimant', 'Claimant', 'Penuntut'], ['approved', 'Approved by', 'Diluluskan oleh']],
    adv: [['requested', 'Requested by', 'Dipohon oleh'], ['approved', 'Approved by', 'Diluluskan oleh']],
    wo: [['issued', 'Issued by', 'Dikeluarkan oleh'], ['completed', 'Completed by', 'Disiapkan oleh']]
  };
  var MOD = { quo: 'sales', cn: 'sales', do: 'logistics', po: 'purchasing', grn: 'purchasing', bill: 'purchasing', wo: 'production' };
  var off = false; // set when the RPCs are missing (SQL not run yet)
  function has(doc) {
    if (off || !SL[doc] || !window.sb) return false;
    var m = MOD[doc]; try { return !m || typeof canAccess !== 'function' || !!canAccess(m); } catch (e) { return true; }
  }
  function slotLabel(doc, slot) { var s = (SL[doc] || []).filter(function (x) { return x[0] === slot; })[0]; return s ? L(s[1], s[2]) : slot; }
  function missing(e) { var m = String(e && (e.message || e.code) || e); return /PGRST202|42883|does not exist|Could not find the function/i.test(m); }
  function rpc(fn, args) {
    return sb.rpc(fn, args).then(function (r) {
      if (r.error) { if (missing(r.error)) { off = true; throw new Error(L('Signatures are not set up yet (run supabase/dk_phase0_kit.sql).', 'Tandatangan belum disediakan (jalankan supabase/dk_phase0_kit.sql).')); } throw r.error; }
      return r.data;
    });
  }
  function errMsg(e) {
    var m = String(e && e.message || e);
    if (/approver role required/.test(m)) return L('Only an approver (owner, admin, manager, finance, HR) can sign this slot.', 'Hanya pelulus (pemilik, admin, pengurus, kewangan, HR) boleh tandatangan slot ini.');
    if (/already signed/.test(m)) return L('Already signed.', 'Sudah ditandatangani.');
    if (/name required/.test(m)) return L('Type your full name to sign.', 'Taip nama penuh untuk tandatangan.');
    if (/no access|not found/.test(m)) return L('You do not have access to this document.', 'Anda tiada akses kepada dokumen ini.');
    return m;
  }
  function state(doc, id) { return rpc('dk_sign_state', { p_type: doc, p_id: id }); }
  // slots for print boxes / PDF: [{label, name, at}]
  function boxes(st) { return ((st && st.slots) || []).map(function (s) { return { label: s.label, name: s.signer_name || '', at: s.signed_at ? dt(s.signed_at) : '' }; }); }

  var css = '' +
    '.dks-p{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;min-width:0}' +
    '.dks-lb{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);margin:0 0 8px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center}' +
    '.dks-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}' +
    '.dks-s{border:1px dashed var(--border-2,var(--border));border-radius:var(--radius-sm,8px);padding:10px 12px;min-width:0;display:flex;flex-direction:column;gap:6px}' +
    '.dks-s.ok{border-style:solid;border-color:var(--success)}' +
    '.dks-s b{font-size:13px;color:var(--text)}.dks-s small{font-size:12px;color:var(--text-3);overflow-wrap:anywhere}' +
    '.dks-nm{font-size:15px;font-weight:700;color:var(--text);font-style:italic;overflow-wrap:anywhere}' +
    '.dks-st{font-size:11.5px;font-weight:700;white-space:nowrap}.dks-st.ok{color:var(--success)}.dks-st.wait{color:var(--warning)}.dks-st.no{color:var(--text-3)}' +
    '.dks-a{display:flex;flex-wrap:wrap;gap:6px}.dks-a .btn{white-space:nowrap}' +
    '.dks-bg{position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}' +
    '@media(min-width:700px){.dks-bg{align-items:center}}' +
    '.dks-m{background:var(--bg-card);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-lg,14px) var(--radius-lg,14px) 0 0;width:100%;max-width:460px;max-height:90vh;overflow:auto;padding:16px;box-sizing:border-box;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))}' +
    '@media(min-width:700px){.dks-m{border-radius:var(--radius-lg,14px)}}' +
    '.dks-m h3{margin:0 0 4px;font-size:16px}.dks-m p{margin:0 0 12px;color:var(--text-2);font-size:13px}' +
    '.dks-m .form-input{width:100%;box-sizing:border-box}.dks-m textarea.form-input{min-height:70px;resize:vertical}' +
    '.dks-ft{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:12px}.dks-ft .btn{white-space:nowrap}' +
    '.dks-err{color:var(--danger);font-size:13px;margin-top:8px}' +
    '@media print{.dks-p,.dks-bg{display:none!important}}';
  function addCss() { if (document.getElementById('dk-sign-css')) return; var s = document.createElement('style'); s.id = 'dk-sign-css'; s.textContent = css; document.head.appendChild(s); }

  function slotHtml(s, st) {
    var signed = !!s.signed_at, req = !signed && s.requested_at;
    var h = '<div class="dks-s' + (signed ? ' ok' : '') + '" data-slot="' + esc(s.slot) + '"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>' + esc(s.label) + '</b>' +
      '<span class="dks-st ' + (signed ? 'ok' : req ? 'wait' : 'no') + '">' + esc(signed ? L('Signed', 'Ditandatangani') : req ? L('Waiting', 'Menunggu') : L('Not signed', 'Belum')) + '</span></div>';
    if (signed) h += '<div class="dks-nm">' + esc(s.signer_name || '-') + '</div><small>' + esc(dt(s.signed_at)) + (s.via === 'link' ? ' · ' + esc(L('via link', 'melalui pautan')) : '') + (s.note ? ' — ' + esc(s.note) : '') + '</small>';
    else {
      if (req) h += '<small>' + esc(L('Requested ', 'Diminta ') + dt(s.requested_at)) + '</small>';
      h += '<div class="dks-a">' + (s.can ? '<button type="button" class="btn btn-primary btn-sm" data-a="sign"><i class="ti ti-signature"></i> ' + esc(L('Sign', 'Tandatangan')) + '</button>' : '') +
        '<button type="button" class="btn btn-outline btn-sm" data-a="ask"><i class="ti ti-bell"></i> ' + esc(req ? L('Remind', 'Ingatkan') : L('Ask to sign', 'Minta tandatangan')) + '</button></div>';
    }
    return h + '</div>';
  }
  /* panel(el, doc, id, {pdoc, ref, onChange}) */
  function panel(el, doc, id, o) {
    addCss(); o = o || {}; if (!el || !has(doc)) return;
    el.className = 'dks-p no-print';
    el.innerHTML = '<div class="dks-lb"><span>' + esc(L('Signatures', 'Tandatangan')) + '</span></div><div class="dks-ld" style="color:var(--text-3);font-size:13px">' + esc(L('Loading…', 'Memuatkan…')) + '</div>';
    var paint = function (st) {
      if (!st || !st.slots) { el.remove(); return; }
      if (o.pdoc && window.DKD) DKD.sigBoxes(o.pdoc, boxes(st));
      var all = st.slots.every(function (s) { return s.signed_at; }), any = st.slots.some(function (s) { return s.signed_at; });
      el.innerHTML = '<div class="dks-lb"><span>' + esc(L('Signatures', 'Tandatangan')) + ' · ' + st.slots.filter(function (s) { return s.signed_at; }).length + '/' + st.slots.length + '</span>' +
        (any && /^(owner|admin|platform_admin)$/.test(role()) ? '<button type="button" class="btn btn-outline btn-sm" data-a="reset" style="white-space:nowrap"><i class="ti ti-rotate"></i> ' + esc(L('Reset', 'Set semula')) + '</button>' : '') + '</div>' +
        '<div class="dks-g">' + st.slots.map(function (s) { return slotHtml(s, st); }).join('') + '</div>' +
        (all ? '<div style="margin-top:8px;font-size:12.5px;color:var(--success);font-weight:700"><i class="ti ti-circle-check"></i> ' + esc(L('Fully signed', 'Lengkap ditandatangani')) + '</div>' : '');
      el.querySelectorAll('[data-slot]').forEach(function (b) {
        var slot = b.dataset.slot, s = st.slots.filter(function (x) { return x.slot === slot; })[0];
        var sg = b.querySelector('[data-a=sign]'), ak = b.querySelector('[data-a=ask]');
        if (sg) sg.onclick = function () { signModal(doc, id, s, o.ref, function (ns) { paint(ns); if (o.onChange) o.onChange(ns); }); };
        if (ak) ak.onclick = function () {
          ak.classList.add('dk-busy');
          rpc('dk_sign_request', { p_type: doc, p_id: id, p_slot: slot }).then(function (r) {
            toast(r && r.notified ? L('Request sent (' + r.notified + ')', 'Permintaan dihantar (' + r.notified + ')') : L('Request saved — no one else to notify', 'Permintaan disimpan — tiada penerima lain'), r && r.notified ? 'success' : 'info');
            paint(r && r.state);
          }, function (e) { ak.classList.remove('dk-busy'); toast(errMsg(e), 'error'); });
        };
      });
      var rs = el.querySelector('[data-a=reset]');
      if (rs) rs.onclick = function () {
        var why = prompt(L('Reset all signatures on this document? Reason:', 'Set semula semua tandatangan dokumen ini? Sebab:'));
        if (why == null) return;
        rpc('dk_sign_reset', { p_type: doc, p_id: id, p_reason: why || null }).then(function () { toast(L('Signatures reset', 'Tandatangan diset semula')); return state(doc, id).then(paint); }, function (e) { toast(errMsg(e), 'error'); });
      };
    };
    state(doc, id).then(function (st) {
      paint(st);
      // deep link from the "Signature needed" notification: open the slot's sign dialog
      try {
        var want = window.DK && DK.cur && DK.cur.params && DK.cur.params.sign;
        if (want && String(DK.cur.params.id || DK.cur.params.hl) === String(id)) {
          DK.cur.params.sign = null; var s = (st.slots || []).filter(function (x) { return x.slot === want && x.can && !x.signed_at; })[0];
          if (s) signModal(doc, id, s, o.ref, function (ns) { paint(ns); if (o.onChange) o.onChange(ns); });
        }
      } catch (e) {}
    }, function (e) { if (off) el.remove(); else el.innerHTML = '<div class="dks-err">' + esc(errMsg(e)) + '</div>'; });
  }
  function signModal(doc, id, s, ref, done) {
    addCss();
    var bg = document.createElement('div'); bg.className = 'dks-bg';
    bg.innerHTML = '<div class="dks-m" role="dialog" aria-modal="true"><h3>' + esc(L('Sign', 'Tandatangan') + ' · ' + s.label) + '</h3><p>' + esc((ref ? ref + ' — ' : '') + L('Type your full name. This is recorded with the date and time.', 'Taip nama penuh anda. Ia direkod bersama tarikh dan masa.')) + '</p>' +
      '<label class="form-label">' + esc(L('Full name', 'Nama penuh')) + '</label><input class="form-input" data-f="n" maxlength="120" autocomplete="name" value="' + esc(me()) + '">' +
      '<label class="form-label" style="margin-top:10px">' + esc(L('Note (optional)', 'Nota (pilihan)')) + '</label><textarea class="form-input" data-f="t" maxlength="500"></textarea>' +
      '<div class="dks-err" hidden></div><div class="dks-ft"><button type="button" class="btn btn-outline" data-a="x">' + esc(L('Cancel', 'Batal')) + '</button>' +
      '<button type="button" class="btn btn-primary" data-a="ok"><i class="ti ti-signature"></i> ' + esc(L('Sign now', 'Tandatangan sekarang')) + '</button></div></div>';
    document.body.appendChild(bg);
    var close = function () { bg.remove(); }, er = bg.querySelector('.dks-err'), ok = bg.querySelector('[data-a=ok]');
    bg.onclick = function (e) { if (e.target === bg) close(); };
    bg.querySelector('[data-a=x]').onclick = close;
    ok.onclick = function () {
      var n = bg.querySelector('[data-f=n]').value.trim(), t = bg.querySelector('[data-f=t]').value.trim();
      if (n.length < 2) { er.hidden = false; er.textContent = errMsg('name required'); return; }
      ok.disabled = true; ok.classList.add('dk-busy');
      rpc('dk_sign', { p_type: doc, p_id: id, p_slot: s.slot, p_name: n, p_note: t || null }).then(function (r) {
        close(); toast(L('Signed', 'Ditandatangani') + (r ? ' (' + r.done + '/' + r.total + ')' : '')); if (done) done(r && r.state);
      }, function (e) { ok.disabled = false; ok.classList.remove('dk-busy'); er.hidden = false; er.textContent = errMsg(e); });
    };
    setTimeout(function () { var i = bg.querySelector('[data-f=n]'); if (i) i.focus(); }, 50);
  }
  /* open(doc, id, title, onDone) — modal with the full panel (from list cards) */
  function open(doc, id, title, onDone) {
    addCss();
    var bg = document.createElement('div'); bg.className = 'dks-bg';
    bg.innerHTML = '<div class="dks-m" role="dialog" aria-modal="true"><h3>' + esc(title || L('Signatures', 'Tandatangan')) + '</h3><div class="dks-in"></div><div class="dks-ft"><button type="button" class="btn btn-outline" data-a="x">' + esc(L('Close', 'Tutup')) + '</button></div></div>';
    document.body.appendChild(bg);
    var close = function () { bg.remove(); if (onDone) onDone(); };
    bg.onclick = function (e) { if (e.target === bg) close(); };
    bg.querySelector('[data-a=x]').onclick = close;
    var inner = document.createElement('div'); bg.querySelector('.dks-in').appendChild(inner);
    panel(inner, doc, id, { ref: title });
    inner.classList.remove('no-print'); inner.style.border = '0'; inner.style.padding = '0';
  }
  /* for PDF: model.sigs */
  function sigsFor(doc, id) { if (!has(doc)) return Promise.resolve([]); return state(doc, id).then(boxes, function () { return []; }); }

  /* on-open reminder check (cron does the same daily at 09:00 MYT): once a day per tenant on this device */
  function remindOnOpen() {
    try {
      if (!window.sb || !APP || !APP.tenant || !APP.user || !/^(owner|admin|platform_admin|finance|accountant|manager)$/.test(role())) return;
      var k = 'dk_remind_' + APP.tenant.id, d = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
      if (localStorage.getItem(k) === d) return; localStorage.setItem(k, d);
      sb.rpc('dk_remind_run').then(function (r) { if (r && r.error && missing(r.error)) localStorage.removeItem(k); }, function () {});
    } catch (e) {}
  }
  var rt = setInterval(function () { if (window.APP && APP.tenant && APP.user) { clearInterval(rt); setTimeout(remindOnOpen, 8000); } }, 2000);
  setTimeout(function () { clearInterval(rt); }, 120000);

  window.DKSign = { has: has, open: open, panel: panel, state: state, slotLabel: slotLabel, sigsFor: sigsFor, boxes: boxes, SL: SL };
})();
