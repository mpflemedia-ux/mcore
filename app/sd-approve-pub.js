/* M-Core Salary Disbursement — public "Approve & sign" upload (sd_approvals + doc-files/.../sd-approvals/). File upload or draw-to-sign (canvas -> PNG, same upload path). v3 */
(function () {
  var tok = window.__sdToken;
  if (!tok || window.__sdApprovePub) return; window.__sdApprovePub = 1;
  var bm = new URLSearchParams(location.search).get('lang') === 'bm', done = false, MAX = 10485760;
  var T = bm ? { h: 'Luluskan & Tandatangan', d: 'Muat naik salinan dokumen ini yang telah ditandatangani.', open: 'Hantar dokumen bertandatangan', name: 'Nama anda', file: 'Fail (gambar atau PDF, maks 10 MB)', cam: 'Kamera', pick: 'Pilih fail', send: 'Hantar', cancel: 'Batal', wait: 'Menghantar…', need: 'Sila isi nama dan lampirkan satu fail.', big: 'Fail terlalu besar (maks 10 MB)', type: 'Jenis fail tidak disokong', ok: 'Terima kasih! Dokumen anda telah dihantar untuk disemak.', pend: 'Dihantar pada {d} · menunggu semakan', appr: 'Diluluskan', rej: 'Ditolak: {r}', fail: 'Tidak berjaya menghantar. Sila cuba lagi.', failRls: 'Tidak dapat muat naik. Pautan mungkin tamat — minta HR kongsi semula.', failRate: 'Terlalu banyak percubaan. Tunggu beberapa minit, kemudian cuba lagi.', failNet: 'Ralat rangkaian. Semak sambungan dan cuba lagi.', sigOpt: 'Lukis Tandatangan', sigClear: 'Padam', sigBack: 'Kembali', sigUse: 'Guna Tandatangan Ini', sigEmpty: 'Sila lukis tandatangan dahulu.', sigFile: 'Tandatangan (lukisan tangan)' }
    : { h: 'Approve & Sign', d: 'Upload a signed copy of this document.', open: 'Send signed document', name: 'Your name', file: 'File (photo or PDF, max 10 MB)', cam: 'Camera', pick: 'Choose file', send: 'Send', cancel: 'Cancel', wait: 'Sending…', need: 'Please enter your name and attach a file.', big: 'File too large (max 10 MB)', type: 'Unsupported file type', ok: 'Thank you! Your document has been sent for review.', pend: 'Sent on {d} · waiting for review', appr: 'Approved', rej: 'Rejected: {r}', fail: 'Could not send. Please try again.', failRls: 'Could not upload. Link may be expired — ask HR for a new share.', failRate: 'Too many attempts. Wait a few minutes, then try again.', failNet: 'Network error. Check connection and try again.', sigOpt: 'Draw Signature', sigClear: 'Clear', sigBack: 'Back', sigUse: 'Use This Signature', sigEmpty: 'Please draw your signature first.', sigFile: 'Signature (hand-drawn)' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function sha(b) { return crypto.subtle.digest('SHA-256', b).then(function (x) { return Array.prototype.map.call(new Uint8Array(x), function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }); }
  function fmt(v) { return new Date(v).toLocaleDateString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }); }
  function mapFail(e) {
    var m = String((e && (e.message || e.error || e.error_description || e.statusCode || e)) || '').toLowerCase();
    var st = String((e && (e.statusCode || e.status || e.code)) || '');
    if (/rate|too many|3 submission|429/.test(m) || st === '429') return T.failRate;
    if (/row-level security|rls|42501|permission|policy|access.?denied|jwt|unauthorized|403|401/.test(m) || st === '403' || st === '401' || st === '42501') return T.failRls;
    if (/network|failed to fetch|timeout|offline|load failed/.test(m)) return T.failNet;
    return T.fail;
  }
  var OKT = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i, EXT = /\.(jpe?g|png|webp|heic|heif|pdf)$/i;
  function mimeOf(f) {
    var t = (f && f.type) || ''; if (OKT.test(t)) return t;
    var n = String((f && f.name) || '').toLowerCase(), m = { pdf:'application/pdf', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', heic:'image/heic', heif:'image/heif' };
    var e = (n.match(/\.([a-z0-9]+)$/) || [])[1]; return (e && m[e]) || t || 'application/pdf';
  }
  var IN = 'display:block;width:100%;box-sizing:border-box;margin:4px 0 10px;padding:10px;border:1px solid #94a3b8;border-radius:8px;font:inherit;font-size:15px;color:#0f172a;background:#fff';
  var LB = 'font-size:13px;font-weight:700;color:#334155', BTN = 'min-height:44px;padding:10px 16px;border-radius:10px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;';
  function shrink(f) {
    if (!/^image\/(jpeg|png|webp)$/i.test(f.type) || f.size <= 1572864) return Promise.resolve(f);
    return new Promise(function (res) {
      var u = URL.createObjectURL(f), im = new Image();
      im.onload = function () { var s = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { res(b && b.size < f.size ? new File([b], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f); }, 'image/jpeg', 0.82); };
      im.onerror = function () { URL.revokeObjectURL(u); res(f); }; im.src = u;
    });
  }
  function clearPad(cv) {
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    delete cv.dataset.drawn;
  }
  function initPad(cv) {
    if (cv.dataset.inited) return; cv.dataset.inited = '1';
    var rect = cv.getBoundingClientRect();
    cv.width = Math.round(rect.width) || 600; cv.height = Math.round(rect.height) || 160;
    clearPad(cv);
    var ctx = cv.getContext('2d'), drawing = false, last = null;
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) }; }
    cv.addEventListener('pointerdown', function (e) { drawing = true; last = pos(e); try { cv.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { if (!drawing) return; var p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; cv.dataset.drawn = '1'; e.preventDefault(); });
    cv.addEventListener('pointerup', function () { drawing = false; });
    cv.addEventListener('pointerleave', function () { drawing = false; });
  }
  function box(root, html) {
    var d = document.createElement('div'); d.id = 'sd-approve'; d.className = 'no-print';
    d.style.cssText = 'margin-top:18px;padding:16px 14px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;color:#0f172a;text-align:left';
    d.innerHTML = html; root.appendChild(d); return d;
  }
  function form(root, b) {
    var file = null;
    var d = box(root, '<div style="font-weight:800;font-size:16px">' + T.h + '</div><div style="font-size:14px;color:#334155;margin:4px 0 12px">' + T.d + '</div>' +
      '<button type="button" data-o style="' + BTN + 'border:1px solid #0E7490;background:#fff;color:#0E7490;width:100%">✍️ ' + T.open + '</button><div data-f style="display:none">' +
      '<label style="' + LB + '">' + T.name + '<input data-nm maxlength="120" data-no-titlecase="1" style="' + IN + '"></label>' +
      '<div style="' + LB + '">' + T.file + '</div><div data-picks style="display:flex;flex-wrap:wrap;gap:8px;margin:6px 0">' +
        '<label style="' + BTN + 'flex:1 1 30%;min-width:108px;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid #94a3b8;background:#fff;color:#0f172a">📷 ' + T.cam + '<input type="file" accept="image/*" capture="environment" hidden></label>' +
        '<label style="' + BTN + 'flex:1 1 30%;min-width:108px;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid #94a3b8;background:#fff;color:#0f172a">📄 ' + T.pick + '<input type="file" accept="image/*,application/pdf,.heic,.heif" hidden></label>' +
        '<button type="button" data-sigopen style="' + BTN + 'flex:1 1 30%;min-width:108px;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid #94a3b8;background:#fff;color:#0f172a">✍️ ' + T.sigOpt + '</button></div>' +
      '<div data-sig style="display:none;margin:6px 0">' +
        '<canvas data-sigcv width="600" height="180" style="width:100%;height:160px;touch-action:none;border:1px solid #94a3b8;border-radius:8px;background:#fff;display:block"></canvas>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">' +
          '<button type="button" data-sigclear style="' + BTN + 'flex:1 1 30%;min-width:90px;white-space:nowrap;border:1px solid #94a3b8;background:#fff;color:#0f172a">' + T.sigClear + '</button>' +
          '<button type="button" data-sigback style="' + BTN + 'flex:1 1 30%;min-width:90px;white-space:nowrap;border:1px solid #94a3b8;background:#fff;color:#0f172a">' + T.sigBack + '</button>' +
          '<button type="button" data-sigok style="' + BTN + 'flex:1.4 1 40%;min-width:140px;white-space:nowrap;border:0;background:#0E7490;color:#fff">' + T.sigUse + '</button></div></div>' +
      '<div data-l style="font-size:14px;color:#0f172a"></div><div data-e role="alert" style="display:none;color:#991b1b;font-size:14px;font-weight:600;margin:8px 0"></div>' +
      '<div style="display:flex;gap:10px;margin-top:10px"><button type="button" data-c style="' + BTN + 'flex:1;border:1px solid #94a3b8;background:#fff;color:#0f172a">' + T.cancel + '</button><button type="button" data-s style="' + BTN + 'flex:1.4;border:0;background:#0E7490;color:#fff">' + T.send + '</button></div></div>');
    var F = d.querySelector('[data-f]'), O = d.querySelector('[data-o]'), L = d.querySelector('[data-l]'), E = d.querySelector('[data-e]'), S = d.querySelector('[data-s]');
    var picks = d.querySelector('[data-picks]'), sig = d.querySelector('[data-sig]'), cv = d.querySelector('[data-sigcv]');
    function err(m) { E.textContent = m; E.style.display = m ? 'block' : 'none'; }
    d.querySelectorAll('input[type=file]').forEach(function (inp) { inp.onchange = function () {
      var f = (inp.files || [])[0]; inp.value = ''; err(''); if (!f) return;
      if (!(OKT.test(f.type) || EXT.test(f.name))) return err(T.type); if (f.size > MAX) return err(T.big);
      file = f; L.textContent = f.name;
    }; });
    d.querySelector('[data-sigopen]').onclick = function () { picks.style.display = 'none'; sig.style.display = 'block'; initPad(cv); };
    d.querySelector('[data-sigback]').onclick = function () { sig.style.display = 'none'; picks.style.display = 'flex'; };
    d.querySelector('[data-sigclear]').onclick = function () { clearPad(cv); };
    d.querySelector('[data-sigok]').onclick = function () {
      if (!cv.dataset.drawn) return err(T.sigEmpty);
      cv.toBlob(function (blob) {
        if (!blob) return err(T.sigEmpty);
        file = new File([blob], 'tandatangan-' + Date.now() + '.png', { type: 'image/png' });
        L.textContent = T.sigFile; err('');
        sig.style.display = 'none'; picks.style.display = 'flex';
      }, 'image/png');
    };
    O.onclick = function () { F.style.display = 'block'; O.style.display = 'none'; };
    d.querySelector('[data-c]').onclick = function () { F.style.display = 'none'; O.style.display = 'block'; err(''); };
    S.onclick = function () {
      var nm = d.querySelector('[data-nm]').value.trim();
      if (!nm || !file) return err(T.need);
      err(''); S.disabled = true; S.textContent = T.wait;
      shrink(file).then(function (f) {
        return f.arrayBuffer().then(sha).then(function (h) {
          var nmSafe = String(f.name || 'signed').replace(/[^\w.\-]+/g, '_').slice(-80);
          var path = b.tenant_id + '/sd-approvals/' + tok + '/' + Date.now() + '-' + nmSafe;
          var ct = mimeOf(f);
          return sb.storage.from('doc-files').upload(path, f, { contentType: ct, upsert: false }).then(function (u) {
            if (u.error) throw u.error;
            return sb.from('sd_approvals').insert({ tenant_id: b.tenant_id, batch_id: b.batch_id, link_id: b.link_id, token: tok,
              approver_name: nm.slice(0, 120), storage_path: path, file_name: f.name, mime_type: ct, size_bytes: f.size });
          });
        });
      }).then(function (r) {
        if (r.error) throw r.error;
        d.innerHTML = '<div role="status" style="font-size:15px;font-weight:700;color:#166534">✓ ' + T.ok + '</div>';
      }).catch(function (e) { try { console.error('[sd-approve-pub]', e && (e.message || e)); } catch (x) {} err(mapFail(e)); S.disabled = false; S.textContent = T.send; });
    };
  }
  function apply() {
    if (done || typeof sb === 'undefined') return;
    var check = function () {
      var b = window.__sdBatch, root = document.getElementById('public-sd-root');
      if (!b || !root) { setTimeout(check, 150); return; }
      done = true;
      /* anon grant: id, link_id, status, created_at, deleted_at only — no reject_reason */
      sb.from('sd_approvals').select('id,link_id,status,created_at,deleted_at').eq('link_id', b.link_id).order('created_at', { ascending: false }).limit(1).then(function (c) {
        if (c.error) return; /* sd_approval_01.sql not run */
        var last = (c.data || [])[0];
        if (last && last.status === 'pending') return box(root, '<div role="status" style="font-size:15px;font-weight:700;color:#0E7490">⏳ ' + esc(T.pend.replace('{d}', fmt(last.created_at))) + '</div>');
        if (last && last.status === 'approved') return box(root, '<div role="status" style="font-size:15px;font-weight:700;color:#166534">✓ ' + esc(T.appr) + '</div>');
        form(root, b);
      });
    };
    check();
  }
  apply();
})();
