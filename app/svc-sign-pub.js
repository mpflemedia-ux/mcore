/* M-Core Service Commission — public per-role signing (public-svc.html?svc_sign=<token>). v2 (labels without staff/Owner-HR suffix; name prefilled from the typed slot name, svc_commission_03.sql)
   Same concept as public-sd.html / public-pv.html: one WhatsApp link = one role (Prepared by = staff, Approved by = Owner/HR)
   on one employee-month. Shows the statement (service log rows, NM heads, commission lines + total from the submitted /
   approved snapshot), the status of both slots and a draw pad. No login. No basic pay / IC / bank details.
   PNG goes to doc-files/{tenant}/svc-sign/{sha256(token)}/ ; the slot is written by RPC svc_sign_public
   (supabase/svc_commission_02.sql). Styles: --psd-* tokens in public-svc.html. */
(function () {
  var Q = new URLSearchParams(location.search), tok = String(Q.get('svc_sign') || '').trim();
  if (window.__svcSignPub) return; window.__svcSignPub = 1;
  var bm = Q.get('lang') === 'bm', sb = window.sb;
  document.documentElement.lang = bm ? 'ms' : 'en';
  var ROLES = [['prepared', 'Prepared by', 'Disediakan oleh'], ['approved', 'Approved by', 'Diluluskan oleh']];
  var MEN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MBM = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  var T = bm ? { doc: 'Penyata Komisen Servis', period: 'Tempoh', date: 'Tarikh', svc: 'Servis', price: 'Harga', st: 'Status', lead: 'Lead', comm: 'Komisen', none: 'Tiada log bulan ini',
      heads: 'Kepala NM', scomm: 'Komisen servis', pcomm: 'Komisen produk', bonus: 'Bonus conversion', total: 'Jumlah komisen', prod: 'Produk',
      as: 'Tandatangan sebagai', sub: 'Semak penyata di atas, kemudian tandatangan di bawah. Tiada log masuk diperlukan.', sgst: 'Status tandatangan', you: 'anda', signed: 'Ditandatangani', pend: 'Belum', of: 'ditandatangani',
      name: 'Nama anda', draw: 'Lukis tandatangan anda', clear: 'Padam', send: 'Hantar tandatangan', wait: 'Menghantar…', ok: 'Terima kasih — tandatangan anda telah direkodkan.',
      all: 'Penyata ini lengkap ditandatangani (2/2).', mine: 'Slot ini telah ditandatangani oleh {n} pada {d}.', needName: 'Masukkan nama anda.', needSig: 'Lukis tandatangan anda dahulu.',
      taken: 'Slot ini sudah ditandatangani.', gate: 'Penyata ini belum sedia untuk tandatangan slot ini.', failLink: 'Pautan ini telah tamat atau dibatalkan. Minta pautan baharu daripada HR.',
      failNet: 'Masalah rangkaian. Cuba lagi.', fail: 'Tandatangan gagal. Cuba lagi.', unavailable: 'Pautan tidak tersedia', missing: 'Pautan tidak lengkap.',
      conf: 'Sulit — untuk pekerja dan Owner/HR sahaja.', st_draft: 'Draf', st_submitted: 'Dihantar', st_approved: 'Diluluskan', note: 'Potongan berkanun dikira dalam slip gaji. Hanya bulan diluluskan dibayar.' }
    : { doc: 'Service Commission Statement', period: 'Period', date: 'Date', svc: 'Service', price: 'Price', st: 'Status', lead: 'Lead', comm: 'Commission', none: 'No logs this month',
      heads: 'NM heads', scomm: 'Service commission', pcomm: 'Product commission', bonus: 'Conversion bonus', total: 'Total commission', prod: 'Products',
      as: 'Sign as', sub: 'Review the statement above, then sign below. No login needed.', sgst: 'Signature status', you: 'you', signed: 'Signed', pend: 'Pending', of: 'signed',
      name: 'Your name', draw: 'Draw your signature', clear: 'Clear', send: 'Submit signature', wait: 'Sending…', ok: 'Thank you — your signature has been recorded.',
      all: 'This statement is fully signed (2/2).', mine: 'This slot was signed by {n} on {d}.', needName: 'Enter your name.', needSig: 'Draw your signature first.',
      taken: 'This slot is already signed.', gate: 'This statement is not ready for this signature yet.', failLink: 'This link has expired or was revoked. Ask HR for a new link.',
      failNet: 'Network problem. Please try again.', fail: 'Signing failed. Please try again.', unavailable: 'Link unavailable', missing: 'The link is incomplete.',
      conf: 'Confidential — for the employee and Owner/HR only.', st_draft: 'Draft', st_submitted: 'Submitted', st_approved: 'Approved', note: 'Statutory deductions are applied in the payslip. Only approved months are paid.' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rl(r) { for (var i = 0; i < ROLES.length; i++) if (ROLES[i][0] === r) return bm ? ROLES[i][2] : ROLES[i][1]; return r; }
  function fmt(v) { try { return new Date(v).toLocaleDateString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }); } catch (e) { return ''; } }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
  function shaText(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(hex); }
  function mapFail(e) {
    var m = String((e && (e.message || e.error || e.error_description)) || e || '');
    if (/already signed/i.test(m)) return T.taken;
    if (/first/i.test(m)) return T.gate;
    if (/expired|revoked|invalid token|not found|row-level security|42501|403|401|policy/i.test(m)) return T.failLink;
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
  function dm(v) { if (!v) return ''; var p = String(v).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : String(v); }
  function per(b) { return (bm ? MBM : MEN)[(b.month || 1) - 1] + ' ' + b.year; }
  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function slotsDone(b) { return (b.slots || []).filter(function (s) { return s.signed; }).length; }

  function docHtml(b) {
    var rows = b.rows || [], rt = b.rates || {};
    var table = rows.length ? rows.map(function (r) {
      return '<tr><td>' + esc(dm(r.date)) + '</td><td>' + esc(r.service) + '</td><td class="num">' + (r.price == null ? '—' : rm(r.price)) + '</td><td>' + esc(r.status || '—') + '</td><td>' + esc(r.lead || '—') + '</td>' +
        '<td class="num ' + (n(r.commission) > 0 ? 'psd-net' : 'psv-zero') + '">' + (n(r.commission) > 0 ? rm(r.commission) : '—') + '</td></tr>';
    }).join('') : '<tr><td colspan="6">' + esc(T.none) + '</td></tr>';
    var cards = rows.length ? rows.map(function (r) {
      return '<article class="psd-card"><div class="psd-card-name">' + esc(dm(r.date)) + ' · ' + esc(r.service) + '</div>' +
        '<div class="psd-row"><span class="k">' + esc(T.price) + '</span><span class="v">' + (r.price == null ? '—' : rm(r.price)) + '</span></div>' +
        '<div class="psd-row"><span class="k">' + esc(T.st + ' · ' + T.lead) + '</span><span class="v">' + esc((r.status || '—') + ' · ' + (r.lead || '—')) + '</span></div>' +
        '<div class="psd-row psd-net-row"><span class="k">' + esc(T.comm) + '</span><span class="v">' + (n(r.commission) > 0 ? rm(r.commission) : '—') + '</span></div></article>';
    }).join('') : '<div class="psd-empty">' + esc(T.none) + '</div>';
    var pr = n(rt.prod_rate_pct != null ? rt.prod_rate_pct : 5);
    var tots = [[T.heads, String(n(b.heads))], [T.scomm, rm(b.svc_commission)], [T.pcomm + ' (' + pr + '% × ' + rm(b.product_sales) + ')', rm(b.prod_commission)], [T.bonus, rm(b.bonus)]];
    var totHtml = '<div class="psd-card" style="margin-top:10px">' + tots.map(function (t) { return '<div class="psd-row"><span class="k">' + esc(t[0]) + '</span><span class="v">' + esc(t[1]) + '</span></div>'; }).join('') +
      '<div class="psd-row psd-net-row"><span class="k">' + esc(T.total) + '</span><span class="v">' + rm(b.commission_total) + '</span></div></div>';
    return '<div class="wrap" id="public-svc-root">' +
      (b.logo_url ? '<img src="' + esc(b.logo_url) + '" alt="" style="width:56px;height:56px;object-fit:contain;border-radius:8px;background:var(--psd-surface);margin-bottom:8px">' : '') +
      '<div class="name">' + esc(b.tenant_name || '') + '</div>' + (b.address ? '<div class="muted" style="font-weight:500">' + esc(b.address) + '</div>' : '') +
      '<div class="psd-head"><div class="muted">' + esc(T.doc) + '</div><div class="ref">' + esc(b.employee_name || '') + '</div></div>' +
      (b.position ? '<div class="psv-sub">' + esc(b.position) + '</div>' : '') +
      '<div class="psv-meta"><span class="psv-chip' + (b.status === 'approved' ? ' psv-ok' : '') + '">' + esc(T['st_' + b.status] || b.status) + '</span><span class="psv-sub">' + esc(T.period + ': ' + per(b)) + '</span></div>' +
      '<div class="psd-scroll"><table class="psd-table"><thead><tr><th>' + esc(T.date) + '</th><th>' + esc(T.svc) + '</th><th class="num">' + esc(T.price) + '</th><th>' + esc(T.st) + '</th><th>' + esc(T.lead) + '</th><th class="num">' + esc(T.comm) + '</th></tr></thead><tbody>' + table + '</tbody></table></div>' +
      '<div class="psd-cards">' + cards + '</div>' + totHtml +
      (b.product_note ? '<div class="psv-desc" style="margin-top:8px">' + esc(T.prod + ': ' + b.product_note) + '</div>' : '') +
      '<div class="psv-desc" style="margin-top:6px">' + esc(T.note) + '</div>' +
      '<div class="conf">' + esc(T.conf) + '</div></div>';
  }
  function slotsHtml(b) {
    var sl = b.slots || [], k = slotsDone(b);
    return '<div class="psd-sg-st"><span class="psd-ap-lb">' + esc(T.sgst) + '</span><span class="psd-sg-n' + (k >= sl.length ? ' psd-sg-done' : '') + '">' + k + '/' + sl.length + ' ' + esc(T.of) + '</span></div>' +
      '<ul class="psd-sg-list">' + sl.map(function (s) {
        var me = s.role === b.role;
        return '<li class="psd-sg' + (me ? ' psd-sg-me' : '') + '"><span class="psd-sg-k"><b>' + esc(rl(s.role)) + '</b>' + (me ? ' <span class="psd-sg-you">(' + esc(T.you) + ')</span>' : '') +
          (s.signed && s.signer_name ? '<span class="psd-sg-w">' + esc(s.signer_name) + '</span>' : '') + '</span>' +
          '<span class="psd-sg-c ' + (s.signed ? 'psd-sg-ok' : 'psd-sg-pend') + '">' + esc(s.signed ? T.signed + ' · ' + fmt(s.signed_at) : T.pend) + '</span></li>';
      }).join('') + '</ul>';
  }
  function mySlot(b) { return (b.slots || []).filter(function (x) { return x.role === b.role; })[0] || {}; }
  function gateOk(b) { return b.role === 'prepared' ? (b.status === 'submitted' || b.status === 'approved') : b.status === 'approved'; }

  function render(b, msg) {
    var root = document.getElementById('public-svc-root'); if (!root) return;
    var old = document.getElementById('svc-sign'); if (old) old.remove();
    var d = document.createElement('div'); d.id = 'svc-sign'; d.className = 'no-print';
    var s = mySlot(b), h = '<div style="font-weight:800;font-size:16px">' + esc(T.as) + ' ' + esc(rl(b.role)) + '</div>';
    var okMsg = msg ? '<div class="psd-ap-ok" style="margin:8px 0 4px">✓ ' + esc(msg) + '</div>' : '';
    if (slotsDone(b) >= 2) h += okMsg + '<div class="psd-ap-ok" style="margin:8px 0 12px">✓ ' + esc(T.all) + '</div>' + slotsHtml(b);
    else if (s.signed) h += okMsg + '<div class="psd-ap-sub">' + esc(T.mine.replace('{n}', s.signer_name || '').replace('{d}', fmt(s.signed_at))) + '</div>' + slotsHtml(b);
    else if (!gateOk(b)) h += '<div class="psd-ap-err" style="display:block">' + esc(T.gate) + '</div>' + slotsHtml(b);
    else {
      h += '<div class="psd-ap-sub">' + esc(T.sub) + '</div>' + slotsHtml(b) +
        '<label class="psd-ap-lb" style="display:block;margin-top:14px">' + esc(T.name) + '<input data-nm maxlength="120" data-no-titlecase="1" autocomplete="name" class="psd-ap-in" value="' + esc(s.name || (b.role === 'prepared' ? (b.employee_name || '') : '')) + '"></label>' +
        '<div class="psd-ap-lb">' + esc(T.draw) + '</div><canvas data-sigcv style="margin-top:4px"></canvas>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 12px"><button type="button" data-clr class="psd-ap-btn psd-ap-btn-outline" style="flex:0 0 auto">' + esc(T.clear) + '</button></div>' +
        '<div data-e role="alert" class="psd-ap-err"></div>' +
        '<button type="button" data-s class="psd-ap-btn psd-ap-btn-primary" style="width:100%;margin-top:10px">' + esc(T.send) + '</button>';
    }
    d.innerHTML = h; root.appendChild(d);
    var cv = d.querySelector('[data-sigcv]'); if (!cv) return;
    initPad(cv);
    var E = d.querySelector('[data-e]'), S = d.querySelector('[data-s]');
    function err(m) { E.textContent = m; E.style.display = m ? 'block' : 'none'; }
    d.querySelector('[data-clr]').onclick = function () { clearPad(cv); };
    S.onclick = function () {
      var nm = d.querySelector('[data-nm]').value.trim();
      if (!nm) return err(T.needName);
      if (!cv.dataset.drawn) return err(T.needSig);
      err(''); S.disabled = true; S.textContent = T.wait;
      var sigPath;
      shaText(tok).then(function (hh) {
        sigPath = b.tenant_id + '/svc-sign/' + hh + '/' + b.role + '-' + Date.now() + '.png';
        return new Promise(function (res, rej) { cv.toBlob(function (bl) { bl ? res(bl) : rej(new Error(T.needSig)); }, 'image/png'); });
      }).then(function (png) {
        return sb.storage.from('doc-files').upload(sigPath, png, { contentType: 'image/png', upsert: false });
      }).then(function (u) {
        if (u.error) throw u.error;
        return sb.rpc('svc_sign_public', { p_token: tok, p_name: nm.slice(0, 120), p_path: sigPath });
      }).then(function (r) {
        if (r.error) throw r.error;
        return sb.rpc('get_public_svc_sign', { p_token: tok });
      }).then(function (r) {
        if (r.error || !r.data) throw r.error || new Error('reload');
        show(r.data, T.ok);
      }).catch(function (e) { S.disabled = false; S.textContent = T.send; err(mapFail(e)); });
    };
  }
  function show(b, msg) {
    document.title = T.doc + ' - ' + (b.employee_name || '') + ' - ' + per(b);
    document.getElementById('root').innerHTML = docHtml(b);
    render(b, msg);
  }
  window.__svcSignShow = show; // harness / screenshot hook
  (async function () {
    var root = document.getElementById('root');
    if (!tok) { root.innerHTML = '<div class="err"><h2>' + esc(T.unavailable) + '</h2><p>' + esc(T.missing) + '</p></div>'; return; }
    var r = await sb.rpc('get_public_svc_sign', { p_token: tok });
    if (r.error || !r.data) { root.innerHTML = '<div class="err"><h2>' + esc(T.unavailable) + '</h2><p>' + esc(mapFail(r.error || 'expired')) + '</p></div>'; return; }
    show(r.data);
  })();
})();
