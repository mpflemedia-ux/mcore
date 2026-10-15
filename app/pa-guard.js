/* M-Core PA Enter: inside a client tenant -> view-only write block (client side) + confirm before big actions. PA only. */
(function () {
  if (window._paGuard) return; window._paGuard = 1;
  var bypass = null;
  function P() { return window.PAE; }
  function on() { return P() && P().inSupport(); }
  var WRITE = /save|simpan|delete|remove|padam|hapus|submit|create|approve|reject|record|void|post|send|hantar|upload|import|mark|update|add|tambah|cipta|lulus|tolak|bayar|pay|cancel|batal|restore|duplicate/i;
  var BIG = /delete|padam|hapus|void|softdelete|_cpsave|bulkdelete|purge/i;
  function btnOf(t) { return t && t.closest ? t.closest('button,[role="button"],a.btn,input[type="submit"],[onclick]') : null; }
  function skip(b) { return !b || b.closest('#pa-banner,#sidebar,.sidebar,nav,.bottom-nav,.nav-item,.tabs,.tab,[role="tab"],.modal-close,.page-header .btn-back') || /close|tutup|cancel|batal|back|kembali/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.className || '')); }
  function sig(b) {
    var ic = b.querySelector ? Array.prototype.map.call(b.querySelectorAll('i'), function (i) { return i.className; }).join(' ') : '';
    return [(b.getAttribute('onclick') || ''), (b.id || ''), ic, (b.textContent || '').trim().slice(0, 40), (b.getAttribute('title') || '')].join(' ');
  }
  function isWrite(b) {
    var s = sig(b);
    if (/ti-trash|ti-device-floppy|ti-check|ti-send|ti-upload|ti-plus/.test(s)) return true;
    if (/btn-primary|btn-danger/.test(b.className || '') && !/ti-search|ti-filter|ti-eye|ti-download|ti-printer|ti-x/.test(s)) return true;
    return WRITE.test(s.replace(/ti-[a-z0-9-]+/g, ''));
  }
  function isBig(b) {
    var s = sig(b);
    if (/ti-trash/.test(s) && !b.closest('.modal td,.modal-content td,[class*="line-item"]')) return true;
    if (/_cpSave|saveCompany|doSaveRole|_rpSave|saveSettings/i.test(s)) return true;
    if (BIG.test(s.replace(/ti-[a-z0-9-]+/g, ''))) return true;
    return !!(document.querySelector('#cp-name,[id^="cp-"]') && /btn-primary/.test(b.className || '') && /simpan|save/i.test(s));
  }
  function L(a, b) { return P() ? P().L(a, b) : a; }
  function dlg(b, done) {
    var s = P().sess() || {}, d = document.createElement('div');
    d.id = 'pa-big'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    if (!document.getElementById('pa-big-css')) { var st = document.createElement('style'); st.id = 'pa-big-css'; st.textContent =
      '#pa-big{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:16px}' +
      '#pa-big .pa-big-card{background:var(--bg-card);color:var(--text);border:1px solid var(--border-2);box-shadow:var(--shadow-lg);max-width:420px;width:100%;max-height:calc(100% - 32px);overflow:auto;border-radius:12px;padding:16px;border-top:6px solid var(--pa-banner-bg,#c2410c)}' +
      '#pa-big .pa-big-t{display:block;font-size:15px;color:var(--text)}#pa-big .pa-big-m{font-size:13px;margin:8px 0;color:var(--text)}' +
      '#pa-big .pa-big-a{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-2);background:var(--bg);border:1px solid var(--border-2);border-radius:999px;padding:2px 10px;margin-bottom:12px}' +
      '#pa-big .pa-big-f{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}#pa-big .pa-big-f .btn{min-height:40px}';
      document.head.appendChild(st); }
    var act = (b.textContent || '').trim().slice(0, 60);
    d.innerHTML = '<div class="pa-big-card">' +
      '<b class="pa-big-t"><i class="ti ti-alert-triangle"></i> ' + L('Big action in a client workspace', 'Tindakan besar dalam ruang kerja klien') + '</b>' +
      '<div class="pa-big-m">' + L('You are inside', 'Anda berada dalam') + ' <b>' + P().esc(s.name) + '</b>. ' +
      L('This change affects the client\'s real data. Continue?', 'Perubahan ini menjejaskan data sebenar klien. Teruskan?') + '</div>' +
      (act ? '<span class="pa-big-a">' + L('Action', 'Tindakan') + ': ' + P().esc(act) + '</span>' : '') +
      '<div class="pa-big-f"><button type="button" class="btn btn-outline" data-a="0">' + L('Cancel', 'Batal') + '</button>' +
      '<button type="button" class="btn btn-danger" data-a="1" style="background:var(--pa-banner-bg,#c2410c);color:var(--pa-banner-fg,#fff);border:0">' + L('Yes, continue', 'Ya, teruskan') + '</button></div></div>';
    document.body.appendChild(d);
    d.querySelector('[data-a="1"]').focus();
    d.onclick = function (e) { var a = e.target.closest('[data-a]'); if (!a && e.target !== d) return; d.remove(); done(a && a.getAttribute('data-a') === '1'); };
  }
  document.addEventListener('click', function (e) {
    if (!on()) return;
    var b = btnOf(e.target); if (!b || skip(b) || b.closest('#pa-big')) return;
    if (bypass === b) { bypass = null; return; }
    if (P().viewOnly()) {
      if (isWrite(b)) { e.preventDefault(); e.stopImmediatePropagation(); try { showToast(L('View only: changes are blocked in this session', 'Lihat sahaja: perubahan disekat dalam sesi ini'), 'warning'); } catch (x) {} }
      return;
    }
    if (isBig(b)) {
      e.preventDefault(); e.stopImmediatePropagation();
      dlg(b, function (ok) {
        if (!ok) return;
        var s = P().sess() || {}; P().audit('support_big_action', s.tid, s.name);
        bypass = b; b.click();
      });
    }
  }, true);
  document.addEventListener('submit', function (e) {
    if (on() && P().viewOnly() && !(e.target.closest && e.target.closest('#pa-banner'))) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
})();
