/* Public booking page (?book=TOKEN) - dark M-Core theme matching the public SR result page (sd-wa-result.js).
   Visual only: decorates the DOM that booking.js renders (classes, header, footer). RPCs, payloads, holds,
   payments and validation stay in booking.js / booking-free-confirm.js. Text EN/BM: booking-pub-i18n.js. v2 */
(function () {
  if (window._bkpTheme || !/[?&]book=/.test(location.search)) return; window._bkpTheme = 1;
  document.documentElement.classList.add('bkp');
  function cls(el, c) { if (el && el.classList) el.classList.add.apply(el.classList, c.split(' ')); }
  function lang() { return window.BKP && BKP.lang ? BKP.lang() : 'en'; }
  function L(en, bm) { return lang() === 'bm' ? bm : en; }
  function head(root) {
    var w = root.querySelector(':scope > .bkp-wrap');
    if (!w) {
      w = document.createElement('div'); w.className = 'bkp-wrap';
      Array.prototype.slice.call(root.children).forEach(function (c) { if (!c.classList.contains('bkp-modal') && !(c.style && c.style.position === 'fixed')) w.appendChild(c); });
      root.insertBefore(w, root.firstChild);
      var t = document.createElement('div'); t.className = 'bkp-top';
      t.innerHTML = '<div class="bkp-brand"><img src="./mcore-logo.png" alt="M-Core"><b>M-CORE</b></div><div class="cob-seg" role="group" aria-label="Language"><button type="button" data-bkl="en">EN</button><button type="button" data-bkl="bm">BM</button></div>';
      w.insertBefore(t, w.firstChild);
      t.querySelectorAll('[data-bkl]').forEach(function (b) { b.onclick = function () { if (window.BKP) BKP.set(b.getAttribute('data-bkl')); }; });
      var f = document.createElement('div'); f.className = 'bkp-foot'; w.appendChild(f);
    }
    w.querySelectorAll('[data-bkl]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-bkl') === lang()); b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false'); });
    var h1 = w.querySelector('h1'), tn = h1 ? h1.textContent.trim() : '';
    var ft = L('Powered by M-Core', 'Dikuasakan oleh M-Core') + (tn && root.querySelector('#bk-list, .bk-staff') ? ' · ' + L('Your data is only shared with ', 'Data anda hanya dikongsi dengan ') + tn : '');
    var foot = w.querySelector('.bkp-foot'); if (foot.textContent !== ft) foot.textContent = ft;
    if (foot !== w.lastElementChild) w.appendChild(foot);
    return w;
  }
  function main(w) {
    var card = w.querySelector(':scope > div:not(.bkp-top):not(.bkp-foot)'); if (!card) return;
    if (/^\s*(Loading booking|Memuatkan tempahan)/.test(card.textContent) && !card.children.length) { cls(card, 'bkp-card bkp-load'); return; }
    var h2 = card.querySelector(':scope > h2');
    if (h2) { cls(card, 'bkp-card'); if (!card.querySelector('.bkp-pill')) { var p = document.createElement('span'); p.className = 'bkp-pill err'; p.setAttribute('data-bkp-k', 'unavail'); card.insertBefore(p, h2); } return; }
    if (!card.querySelector('h1')) return;
    if (!card.classList.contains('bkp-main')) {
      cls(card, 'bkp-main');
      var hd = document.createElement('div'); hd.className = 'bkp-card bkp-head';
      var eb = card.firstElementChild; if (eb && !eb.querySelector('*')) { cls(eb, 'bkp-pill info'); }
      card.insertBefore(hd, card.firstChild);
      Array.prototype.slice.call(card.children).forEach(function (c) {
        if (c === hd) return;
        if (c.id === 'bk-list' || (c.tagName === 'DIV' && c.querySelector('#bk-list, p') && !c.querySelector('.bk-staff'))) return;
        hd.appendChild(c);
      });
    }
    card.querySelectorAll('label').forEach(function (lb) { if (lb.querySelector('#bk-date')) { cls(lb, 'bkp-date'); var hd2 = card.querySelector('.bkp-head'); if (hd2 && lb.parentNode !== hd2) hd2.appendChild(lb); } });
    var list = card.querySelector('#bk-list');
    if (list) Array.prototype.forEach.call(list.children, function (s) {
      if (s.tagName === 'P') { if (!s.parentNode.classList.contains('bkp-card')) { var c = document.createElement('div'); c.className = 'bkp-card bkp-empty'; c.innerHTML = '<i class="ti ti-calendar-off"></i>'; list.insertBefore(c, s); c.appendChild(s); } return; }
      if (s.classList.contains('bkp-svc')) return;
      cls(s, 'bkp-card bkp-svc');
      var k = s.children; cls(k[0], 'bkp-title'); cls(k[1], 'bkp-meta'); cls(k[2], 'bkp-slots');
      var sp = k[2] && k[2].querySelector(':scope > span'); if (sp && !k[2].querySelector('button')) { k[2].classList.remove('bkp-slots'); cls(k[2], 'bkp-empty'); if (!k[2].querySelector('.ti')) { var ic = document.createElement('i'); ic.className = 'ti ti-clock-off'; k[2].insertBefore(ic, sp); } }
    });
    card.querySelectorAll(':scope > div > p, :scope > p').forEach(function (p) { var b = p.closest('.bkp-card'); if (!b) { var c = document.createElement('div'); c.className = 'bkp-card bkp-empty'; c.innerHTML = '<i class="ti ti-info-circle"></i>'; p.parentNode.insertBefore(c, p); c.appendChild(p); } });
    card.querySelectorAll('.bk-staff').forEach(function (b) { var on = /#0E7490|rgb\(14, 116, 144\)/i.test(b.getAttribute('style') || ''); b.classList.toggle('bkp-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  }
  function modal(root) {
    Array.prototype.forEach.call(root.children, function (c) {
      if (c.classList.contains('bkp-wrap') || !(c.style && c.style.position === 'fixed')) return;
      cls(c, 'bkp-modal');
      var h = c.querySelector('h3'); if (!h) return;
      var form = c.querySelector('#bk-form');
      if (form) { var sub = form.querySelector('h3 + p'); cls(sub, 'bkp-sub'); form.querySelectorAll(':scope > div').forEach(function (d) { if (d.querySelector('button')) d.style.marginTop = '4px'; }); return; }
      var box = h.parentNode, a = box.querySelector('a[href]'); if (a) cls(a, 'bkp-pay');
      var pill = box.querySelector('.bkp-pill');
      if (!pill) { pill = document.createElement('span'); box.insertBefore(pill, h); }
      var booked = /^(Booked|Ditempah)$/.test(h.textContent.trim());
      pill.className = 'bkp-pill ' + (booked ? 'ok' : 'hold'); pill.setAttribute('data-bkp-k', booked ? 'pconf' : 'phold');
    });
    var sel = root.querySelector('.bk-slot.bkp-sel'); if (sel && !root.querySelector('#bk-form')) sel.classList.remove('bkp-sel');
  }
  var busy = false;
  function run() {
    if (busy) return; var root = document.getElementById('public-book-root'); if (!root) return;
    busy = true;
    try { var w = head(root); main(w); modal(root); if (window.BKP) BKP.tr(root); head(root); } catch (e) { console.warn('bkp', e); }
    busy = false;
  }
  window._bkpRun = run;
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#public-book-root .bk-slot:not([disabled])');
    if (!b) return; document.querySelectorAll('#public-book-root .bk-slot.bkp-sel').forEach(function (x) { x.classList.remove('bkp-sel'); }); b.classList.add('bkp-sel');
  }, true);
  function boot() {
    var mo = new MutationObserver(run);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    run();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
