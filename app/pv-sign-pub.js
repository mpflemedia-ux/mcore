/* M-Core Payment Vouchers — public per-role signing (public-pv.html?pv_sign=<token>). v1
   One WhatsApp link = one role (Prepared By / Checked By / First Approval / Second Approval) on one PV or PVD.
   Shows the voucher (payee, bank, method, amount per line + total), the status of all slots (required count
   from the tenant threshold) and a draw pad; photo/PDF attachment optional. No login.
   Files go to doc-files/{tenant}/pv-sign/{sha256(token)}/ ; the slot is written by RPC pv_sign_public
   (supabase/pv_revamp_01.sql), which auto-approves at the required count. Styles: --psd-* tokens in public-pv.html. */
(function () {
  var Q = new URLSearchParams(location.search), tok = String(Q.get('pv_sign') || '').trim();
  if (window.__pvSignPub) return; window.__pvSignPub = 1;
  var bm = Q.get('lang') === 'bm', MAX = 10485760, sb = window.sb;
  document.documentElement.lang = bm ? 'ms' : 'en';
  var ROLES = [['prepared', 'Prepared By', 'Disediakan Oleh'], ['checked', 'Checked By', 'Disemak Oleh'], ['first', 'First Approval', 'Kelulusan Pertama'], ['second', 'Second Approval', 'Kelulusan Kedua']];
  var T = bm ? { pv: 'Baucar Bayaran', pvd: 'Penyaluran Baucar Bayaran', payee: 'Penerima', bank: 'Bank', method: 'Kaedah', amt: 'Jumlah', total: 'Jumlah Besar', none: 'Tiada baris', date: 'Tarikh',
      as: 'Tandatangan sebagai', sub: 'Semak baucar di atas, kemudian tandatangan di bawah. Tiada log masuk diperlukan.', st: 'Status tandatangan', you: 'anda', signed: 'Ditandatangani', pend: 'Belum', opt: 'Pilihan', of: 'ditandatangani', name: 'Nama anda', draw: 'Lukis tandatangan anda', clear: 'Padam', att: 'Lampiran (pilihan): gambar atau PDF dokumen bertandatangan', cam: 'Kamera', pick: 'Pilih fail', send: 'Hantar tandatangan', wait: 'Menghantar…', needName: 'Sila isi nama anda.', needSig: 'Sila lukis tandatangan dahulu.', big: 'Fail terlalu besar (maks 10 MB)', type: 'Jenis fail tidak disokong', ok: 'Terima kasih! Tandatangan anda telah direkodkan.', mine: 'Bahagian ini telah ditandatangani oleh {n} pada {d}.', all: 'Diluluskan — tandatangan lengkap.', fail: 'Tidak berjaya menghantar. Sila cuba lagi.', failLink: 'Pautan tamat atau dibatalkan — minta pengirim kongsi pautan baharu.', failNet: 'Ralat rangkaian. Semak sambungan dan cuba lagi.', taken: 'Bahagian ini sudah ditandatangani.', locked: 'Baucar ini sudah diluluskan dan dikunci.', rm: 'Buang', unavailable: 'Pautan tidak tersedia', missing: 'Token tiada.', conf: 'SULIT — Untuk kelulusan dalaman', st_draft: 'Draf', st_shared: 'Dikongsi', st_pending: 'Menunggu', st_approved: 'Diluluskan', st_converted: 'Ditukar', st_paid: 'Dibayar', st_void: 'Batal' }
    : { pv: 'Payment Voucher', pvd: 'Payment Voucher Disbursement', payee: 'Payee', bank: 'Bank', method: 'Method', amt: 'Amount', total: 'Grand Total', none: 'No lines', date: 'Date',
      as: 'Sign as', sub: 'Review the voucher above, then sign below. No login needed.', st: 'Signature status', you: 'you', signed: 'Signed', pend: 'Pending', opt: 'Optional', of: 'signed', name: 'Your name', draw: 'Draw your signature', clear: 'Clear', att: 'Attachment (optional): photo or PDF of the signed document', cam: 'Camera', pick: 'Choose file', send: 'Submit signature', wait: 'Sending…', needName: 'Please enter your name.', needSig: 'Please draw your signature first.', big: 'File too large (max 10 MB)', type: 'Unsupported file type', ok: 'Thank you! Your signature has been recorded.', mine: 'This slot was signed by {n} on {d}.', all: 'Approved — signatures complete.', fail: 'Could not send. Please try again.', failLink: 'Link expired or revoked — ask the sender for a new link.', failNet: 'Network error. Check connection and try again.', taken: 'This slot is already signed.', locked: 'This voucher is already approved and locked.', rm: 'Remove', unavailable: 'Link unavailable', missing: 'Missing token.', conf: 'CONFIDENTIAL — For internal approval', st_draft: 'Draft', st_shared: 'Shared', st_pending: 'Pending', st_approved: 'Approved', st_converted: 'Converted', st_paid: 'Paid', st_void: 'Void' };
  var OKT = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i, EXT = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rl(r) { for (var i = 0; i < ROLES.length; i++) if (ROLES[i][0] === r) return bm ? ROLES[i][2] : ROLES[i][1]; return r; }
  function fmt(v) { try { return new Date(v).toLocaleDateString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }); } catch (e) { return ''; } }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
  function shaText(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(hex); }
  function mimeOf(f) {
    var t = (f && f.type) || ''; if (OKT.test(t)) return t;
    var n = String((f && f.name) || '').toLowerCase(), m = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };
    var e = (n.match(/\.([a-z0-9]+)$/) || [])[1]; return (e && m[e]) || t || 'application/pdf';
  }
  function shrink(f) {
    if (!/^image\/(jpeg|png|webp)$/i.test(f.type) || f.size <= 1572864) return Promise.resolve(f);
    return new Promise(function (res) {
      var u = URL.createObjectURL(f), im = new Image();
      im.onload = function () {
        var s = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { res(b && b.size < f.size ? new File([b], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f); }, 'image/jpeg', 0.82);
      };
      im.onerror = function () { URL.revokeObjectURL(u); res(f); }; im.src = u;
    });
  }
  function mapFail(e) {
    var m = String((e && (e.message || e.error || e.error_description)) || e || '');
    if (/already signed/i.test(m)) return T.taken;
    if (/approved/i.test(m)) return T.locked;
    if (/expired|revoked|invalid token|row-level security|42501|403|401|policy/i.test(m)) return T.failLink;
    if (/network|failed to fetch|timeout|offline|load failed/i.test(m)) return T.failNet;
    return T.fail;
  }
  function clearPad(cv) { var c = cv.getContext('2d'); c.fillStyle = 'white'; c.fillRect(0, 0, cv.width, cv.height); delete cv.dataset.drawn; }
  function initPad(cv) {
    var r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width) || 600; cv.height = Math.round(r.height) || 160;
    clearPad(cv);
    var c = cv.getContext('2d'), down = false, last = null;
    c.strokeStyle = 'black'; c.lineWidth = 2.5; c.lineCap = 'round'; c.lineJoin = 'round';
    function pos(e) { var b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * (cv.width / b.width), y: (e.clientY - b.top) * (cv.height / b.height) }; }
    cv.addEventListener('pointerdown', function (e) { down = true; last = pos(e); try { cv.setPointerCapture(e.pointerId); } catch (x) {} c.beginPath(); c.arc(last.x, last.y, 1.2, 0, 6.3); c.fillStyle = 'black'; c.fill(); cv.dataset.drawn = '1'; e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { if (!down) return; var p = pos(e); c.beginPath(); c.moveTo(last.x, last.y); c.lineTo(p.x, p.y); c.stroke(); last = p; cv.dataset.drawn = '1'; e.preventDefault(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (k) { cv.addEventListener(k, function () { down = false; }); });
  }

  function rm(n) { return 'RM' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function dmy(v) { if (!v) return ''; var p = String(v).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(v); }
  function stl(s) { return T['st_' + s] || s; }
  function done(b) { return ['approved', 'converted', 'paid'].indexOf(b.status) >= 0; }

  function docHtml(b) {
    var rows = b.rows || [], kind = b.kind === 'pvd' ? T.pvd : T.pv;
    var table = rows.length ? rows.map(function (r) {
      return '<tr><td>' + esc(r.payee) + (r.description ? '<div class="ppv-desc">' + esc(r.description) + '</div>' : '') + '</td><td>' + esc(r.bank || '—') + '</td><td>' + esc(r.method || '') + '</td><td class="num psd-net">' + rm(r.amount) + '</td></tr>';
    }).join('') : '<tr><td colspan="4">' + esc(T.none) + '</td></tr>';
    var cards = rows.length ? rows.map(function (r) {
      return '<article class="psd-card"><div class="psd-card-name">' + esc(r.payee) + '</div>' +
        (r.description ? '<div class="ppv-desc" style="margin:-6px 0 8px">' + esc(r.description) + '</div>' : '') +
        '<div class="psd-row"><span class="k">' + esc(T.bank) + '</span><span class="v">' + esc(r.bank || '—') + '</span></div>' +
        '<div class="psd-row"><span class="k">' + esc(T.method) + '</span><span class="v">' + esc(r.method || '') + '</span></div>' +
        '<div class="psd-row psd-net-row"><span class="k">' + esc(T.amt) + '</span><span class="v">' + rm(r.amount) + '</span></div></article>';
    }).join('') : '<div class="psd-empty">' + esc(T.none) + '</div>';
    return '<div class="wrap" id="public-pv-root">' +
      (b.logo_url ? '<img src="' + esc(b.logo_url) + '" alt="" style="width:56px;height:56px;object-fit:contain;border-radius:8px;background:var(--psd-surface);margin-bottom:8px">' : '') +
      '<div class="name">' + esc(b.tenant_name || '') + '</div>' + (b.address ? '<div class="muted" style="font-weight:500">' + esc(b.address) + '</div>' : '') +
      '<div class="psd-head"><div class="muted">' + esc(kind) + '</div><div class="ref">' + esc(b.ref_no || '') + '</div></div>' +
      (b.title ? '<div style="font-weight:700">' + esc(b.title) + '</div>' : '') +
      '<div class="ppv-meta"><span class="ppv-chip' + (done(b) ? ' ppv-ok' : '') + '">' + esc(stl(b.status)) + '</span><span class="ppv-sub">' + esc(T.date + ': ' + dmy(b.date)) + '</span></div>' +
      '<div class="psd-scroll"><table class="psd-table"><thead><tr><th>' + esc(T.payee) + '</th><th>' + esc(T.bank) + '</th><th>' + esc(T.method) + '</th><th class="num">' + esc(T.amt) + '</th></tr></thead><tbody>' + table + '</tbody>' +
      '<tfoot><tr><td colspan="3" style="text-align:right">' + esc(T.total) + '</td><td class="num psd-net" style="font-size:14px">' + rm(b.total) + '</td></tr></tfoot></table></div>' +
      '<div class="psd-cards">' + cards + (rows.length ? '<div class="psd-grand"><span class="k">' + esc(T.total) + '</span><span class="v">' + rm(b.total) + '</span></div>' : '') + '</div>' +
      '<div class="conf">' + esc(T.conf) + '</div></div>';
  }
  function slotsHtml(b) {
    var sl = b.slots || [], req = sl.filter(function (s) { return s.required; }), n = req.filter(function (s) { return s.signed; }).length;
    return '<div class="psd-sg-st"><span class="psd-ap-lb">' + esc(T.st) + '</span><span class="psd-sg-n' + (n >= req.length ? ' psd-sg-done' : '') + '">' + n + '/' + req.length + ' ' + esc(T.of) + '</span></div>' +
      '<ul class="psd-sg-list">' + sl.map(function (s) {
        var me = s.role === b.role;
        return '<li class="psd-sg' + (me ? ' psd-sg-me' : '') + '"><span class="psd-sg-k"><b>' + esc(rl(s.role)) + '</b>' + (me ? ' <span class="psd-sg-you">(' + esc(T.you) + ')</span>' : '') +
          (s.signed && s.signer_name ? '<span class="psd-sg-w">' + esc(s.signer_name) + '</span>' : '') + '</span>' +
          '<span class="psd-sg-c ' + (s.signed ? 'psd-sg-ok' : 'psd-sg-pend') + '">' + esc(s.signed ? T.signed + ' · ' + fmt(s.signed_at) : (s.required ? T.pend : T.opt)) + '</span></li>';
      }).join('') + '</ul>';
  }
  function mySlot(b) { return (b.slots || []).filter(function (x) { return x.role === b.role; })[0] || {}; }

  function render(b, msg) {
    var root = document.getElementById('public-pv-root'); if (!root) return;
    var old = document.getElementById('pv-sign'); if (old) old.remove();
    var d = document.createElement('div'); d.id = 'pv-sign'; d.className = 'no-print';
    var s = mySlot(b), h = '<div style="font-weight:800;font-size:16px">' + esc(T.as) + ' ' + esc(rl(b.role)) + '</div>';
    if (done(b)) h += (msg ? '<div class="psd-ap-ok" style="margin:8px 0 4px">✓ ' + esc(msg) + '</div>' : '') + '<div class="psd-ap-ok" style="margin:8px 0 12px">✓ ' + esc(T.all) + '</div>' + slotsHtml(b);
    else if (s.signed) h += (msg ? '<div class="psd-ap-ok" style="margin:8px 0 4px">✓ ' + esc(msg) + '</div>' : '') + '<div class="psd-ap-sub">' + esc(T.mine.replace('{n}', s.signer_name || '').replace('{d}', fmt(s.signed_at))) + '</div>' + slotsHtml(b);
    else if (b.status === 'void') h += '<div class="psd-ap-err" style="display:block">' + esc(T.failLink) + '</div>';
    else {
      h += '<div class="psd-ap-sub">' + esc(T.sub) + '</div>' + slotsHtml(b) +
        '<label class="psd-ap-lb" style="display:block;margin-top:14px">' + esc(T.name) + '<input data-nm maxlength="120" data-no-titlecase="1" autocomplete="name" class="psd-ap-in"></label>' +
        '<div class="psd-ap-lb">' + esc(T.draw) + '</div><canvas data-sigcv style="margin-top:4px"></canvas>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 12px"><button type="button" data-clr class="psd-ap-btn psd-ap-btn-outline" style="flex:0 0 auto">' + esc(T.clear) + '</button></div>' +
        '<div class="psd-ap-lb">' + esc(T.att) + '</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin:6px 0">' +
        '<label class="psd-ap-btn psd-ap-btn-outline" style="flex:1 1 40%;min-width:120px;display:flex;align-items:center;justify-content:center;gap:6px">📷 ' + esc(T.cam) + '<input type="file" accept="image/*" capture="environment" hidden></label>' +
        '<label class="psd-ap-btn psd-ap-btn-outline" style="flex:1 1 40%;min-width:120px;display:flex;align-items:center;justify-content:center;gap:6px">📄 ' + esc(T.pick) + '<input type="file" accept="image/*,application/pdf,.heic,.heif" hidden></label></div>' +
        '<div data-l class="psd-sg-file" style="display:none"><span data-ln></span><button type="button" data-rm class="psd-ap-btn psd-ap-btn-outline" style="min-height:32px;padding:4px 10px;font-size:13px">' + esc(T.rm) + '</button></div>' +
        '<div data-e role="alert" class="psd-ap-err"></div>' +
        '<button type="button" data-s class="psd-ap-btn psd-ap-btn-primary" style="width:100%;margin-top:10px">' + esc(T.send) + '</button>';
    }
    d.innerHTML = h; root.appendChild(d);
    var cv = d.querySelector('[data-sigcv]'); if (!cv) return;
    initPad(cv);
    var file = null, E = d.querySelector('[data-e]'), S = d.querySelector('[data-s]'), Lb = d.querySelector('[data-l]');
    function err(m) { E.textContent = m; E.style.display = m ? 'block' : 'none'; }
    d.querySelector('[data-clr]').onclick = function () { clearPad(cv); };
    d.querySelectorAll('input[type=file]').forEach(function (inp) {
      inp.onchange = function () {
        var f = (inp.files || [])[0]; inp.value = ''; err(''); if (!f) return;
        if (!(OKT.test(f.type) || EXT.test(f.name))) return err(T.type); if (f.size > MAX) return err(T.big);
        file = f; d.querySelector('[data-ln]').textContent = '📎 ' + f.name; Lb.style.display = 'flex';
      };
    });
    d.querySelector('[data-rm]').onclick = function () { file = null; Lb.style.display = 'none'; };
    S.onclick = function () {
      var nm = d.querySelector('[data-nm]').value.trim();
      if (!nm) return err(T.needName);
      if (!cv.dataset.drawn) return err(T.needSig);
      err(''); S.disabled = true; S.textContent = T.wait;
      var pre, sigPath, attPath = null;
      shaText(tok).then(function (hh) {
        pre = b.tenant_id + '/pv-sign/' + hh + '/';
        return new Promise(function (res, rej) { cv.toBlob(function (bl) { bl ? res(bl) : rej(new Error(T.needSig)); }, 'image/png'); });
      }).then(function (png) {
        sigPath = pre + b.role + '-' + Date.now() + '.png';
        return sb.storage.from('doc-files').upload(sigPath, png, { contentType: 'image/png', upsert: false });
      }).then(function (u) {
        if (u.error) throw u.error;
        if (!file) return null;
        return shrink(file).then(function (f) {
          attPath = pre + 'att-' + Date.now() + '-' + String(f.name || 'file').replace(/[^\w.\-]+/g, '_').slice(-80);
          return sb.storage.from('doc-files').upload(attPath, f, { contentType: mimeOf(f), upsert: false });
        }).then(function (u2) { if (u2 && u2.error) throw u2.error; });
      }).then(function () {
        return sb.rpc('pv_sign_public', { p_token: tok, p_name: nm.slice(0, 120), p_path: sigPath, p_attach_path: attPath });
      }).then(function (r) {
        if (r.error) throw r.error;
        return sb.rpc('get_public_pv_sign', { p_token: tok });
      }).then(function (r) {
        if (r.error || !r.data) throw r.error || new Error('reload');
        show(r.data, T.ok);
      }).catch(function (e) { S.disabled = false; S.textContent = T.send; err(mapFail(e)); });
    };
  }
  function show(b, msg) {
    document.title = (b.kind === 'pvd' ? T.pvd : T.pv) + ' - ' + (b.tenant_name || '');
    document.getElementById('root').innerHTML = docHtml(b);
    render(b, msg);
  }
  (async function () {
    var root = document.getElementById('root');
    if (!tok) { root.innerHTML = '<div class="err"><h2>' + esc(T.unavailable) + '</h2><p>' + esc(T.missing) + '</p></div>'; return; }
    var r = await sb.rpc('get_public_pv_sign', { p_token: tok });
    if (r.error || !r.data) { root.innerHTML = '<div class="err"><h2>' + esc(T.unavailable) + '</h2><p>' + esc(mapFail(r.error || 'expired')) + '</p></div>'; return; }
    show(r.data);
  })();
})();
