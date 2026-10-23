/* M-Core booking payment flow - public side. After "Confirm hold" the Held box becomes the pay panel (DuitNow QR, pay ref, upload receipt,
   WhatsApp backup, live status). Reopen with ?book=X&bkpay=TOKEN. On ?public_inv= of a booking invoice the same panel shows (light). v2 */
(function () {
  var Q = new URLSearchParams(location.search), onBook = Q.has('book'), onInv = !onBook && Q.get('public_inv');
  if ((!onBook && !onInv) || window.__bkpay) return; window.__bkpay = 1;
  var A = window.BKPAYA, U = window.BKPAYU; if (!A || !U || !U.html || !window.BKPAYI) return;
  var S = { tok: null, panel: null, v: null, inv: null, file: null, thumb: null, amt: null, err: '', busy: false, state: '', poll: 0 };
  function lang() { if (onBook && window.BKP) return BKP.lang(); return Q.get('lang') === 'bm' || /Paparan sahaja/.test(document.body ? document.body.textContent : '') ? 'bm' : 'en'; }
  function ctx() {
    var v = S.v || null, inv = S.inv || {}, n = A.need(v, inv), l = lang(), x = { lang: l, v: v, inv: inv, n: n, file: S.file, thumb: S.thumb, amt: S.amt, err: S.err, busy: S.busy };
    x.state = S.state = A.state(v, inv);
    var ph = inv.phone || '', ref = (v && v.ref_no) || inv.ref_no || '';
    var msg = BKPAYI.t(l, 'pWaMsg', { i: ref, a: A.rm(n.due || n.bal), b: v ? (v.quote_ref || '') + ' (' + v.pay_ref + ')' : '' }).trim();
    /* WhatsApp: customer picks the company number (tenant phone from the invoice) or any contact (wa.me without a number) */
    x.waAny = 'https://wa.me/?text=' + encodeURIComponent(msg); x.waOpen = S.waOpen;
    if (A.phone(ph)) { x.waHref = A.wa(ph, msg); x.waCo = inv.tenant_name || ''; x.waPh = ph; }
    if (onBook) { x.again = location.origin + '/app/?book=' + encodeURIComponent(Q.get('book')) + '&lang=' + l; x.link = location.origin + '/app/?book=' + encodeURIComponent(Q.get('book')) + '&bkpay=' + encodeURIComponent(S.tok); }
    else x.link = location.href.split('#')[0];
    if (!v) x.invHref = location.origin + '/app/?public_inv=' + encodeURIComponent(S.tok) + '&lang=' + l;
    return x;
  }
  function render() {
    if (!S.panel) return;
    var keep = document.activeElement && document.activeElement.id === 'bkpay-amt', a = S.panel.querySelector('#bkpay-amt'); if (a) S.amt = a.value;
    S.panel.innerHTML = U.html(ctx()); wire();
    if (keep) { var b = S.panel.querySelector('#bkpay-amt'); if (b) b.focus(); }
    S.panel.setAttribute('data-state', S.state);
  }
  function copy(btn) {
    var t = btn.getAttribute('data-copy'), done = function () { var o = btn.innerHTML; btn.innerHTML = U.ic('ok') + A.esc(BKPAYI.t(lang(), 'pCopied')); setTimeout(function () { btn.innerHTML = o; }, 1500); };
    try { navigator.clipboard.writeText(t).then(done, function () { prompt('', t); }); } catch (e) { prompt('', t); }
  }
  function wire() {
    var P = S.panel;
    P.querySelectorAll('[data-copy]').forEach(function (b) { b.onclick = function () { copy(b); }; });
    P.querySelectorAll('input[data-file]').forEach(function (i) { i.onchange = function () {
      var f = i.files && i.files[0]; i.value = ''; if (!f) return; var e = A.check(f); S.err = e; if (e) return render();
      S.file = f; S.thumb = null; if (/^image\/(jpeg|png|webp|gif)$/i.test(f.type)) { try { S.thumb = URL.createObjectURL(f); } catch (x) {} } render();
    }; });
    var rm = P.querySelector('[data-rm]'); if (rm) rm.onclick = function () { S.file = null; S.thumb = null; render(); };
    var am = P.querySelector('#bkpay-amt'); if (am) am.oninput = function () { S.amt = am.value; };
    var sd = P.querySelector('[data-send]'); if (sd) sd.onclick = send;
    P.querySelectorAll('[data-wa]').forEach(function (b) { b.onclick = function () { S.waOpen = !S.waOpen; render(); var f = S.panel.querySelector('.bkpay-wach a'); if (S.waOpen && f) f.focus(); }; });
  }
  function send() {
    var amt = Number(S.amt != null ? S.amt : A.need(S.v, S.inv).due);
    if (!S.file || !(amt > 0)) { S.err = 'pNeed'; return render(); }
    S.err = ''; S.busy = true; render();
    A.send(S.tok, S.v, S.file, amt).then(function () { S.file = null; S.thumb = null; S.amt = null; S.busy = false; return load(); },
      function (e) { S.busy = false; S.err = e && e.busy ? 'pBusy' : 'pFail'; render(); });
  }
  function load() {
    return A.load(S.tok).then(function (r) {
      if (r.inv) S.inv = r.inv;
      S.v = r.v || null;
      if (onInv && !S.v) { if (S.panel) S.panel.remove(); S.panel = null; return; }
      render();
    });
  }
  function tick() {
    if (!S.panel || !S.panel.isConnected) return;
    var before = S.state; if (A.state(S.v, S.inv) !== before) return render();
    var tm = S.panel.querySelector('[data-tm] b'); if (tm && S.v && S.v.hold_until) tm.textContent = BKPAYI.t(lang(), 'pLeft', { m: Math.max(0, Math.ceil((new Date(S.v.hold_until) - new Date()) / 60000)) });
    if (++S.poll % 2 === 0 && /^(pay|rev|rej|part)$/.test(S.state) && !S.busy && !S.file) load();
  }
  function mount(box, tok, lt) {
    if (box.querySelector('.bkpay') || box.closest('.bkpay')) return;
    U.css(); S.tok = tok;
    var p = document.createElement('div'); p.className = 'bkpay' + (lt ? ' lt' : ''); p.setAttribute('data-bkp-k', 'bkpay'); p.setAttribute('aria-live', 'polite');
    if (lt) { var c = box.firstElementChild; box.insertBefore(p, c && c.nextElementSibling ? c.nextElementSibling : c); }
    else { box.classList.add('bkpay-host'); box.appendChild(p); }
    S.panel = p; render(); load();
    if (!S.iv) S.iv = setInterval(tick, 10000);
  }
  function bookScan() {
    var root = document.getElementById('public-book-root'); if (!root) return;
    var a = [].filter.call(root.querySelectorAll('a[href*="public_inv="]:not([data-bkpay])'), function (e) { return !e.closest('.bkpay'); })[0]; if (!a) return;
    a.setAttribute('data-bkpay', '1');
    var tok; try { tok = new URL(a.href).searchParams.get('public_inv'); } catch (e) { return; }
    var p = a.closest('p'), box = p && p.parentNode; if (!tok || !box) return;
    try { var u = new URL(location.href); u.searchParams.set('bkpay', tok); history.replaceState(history.state, '', u); } catch (e) {}
    mount(box, tok, false);
  }
  function reopen() {
    var tok = Q.get('bkpay'), root = document.getElementById('public-book-root'); if (!tok || !root || root.querySelector('.bkpay') || (reopened && reopened.isConnected)) return;
    if (!root.querySelector('#bk-list, h2')) return; /* wait until booking.js drew the board (it re-renders the root once) */
    var m = document.createElement('div'); m.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:16px';
    m.innerHTML = '<div style="background:#fff;border-radius:14px;padding:22px;max-width:420px"><h3>Held</h3><p><a href="/app/?public_inv=' + encodeURIComponent(tok) + '">Pay invoice</a></p></div>';
    root.appendChild(m); reopened = m;
  }
  var reopened = null;
  function invScan() {
    var root = document.getElementById('public-inv-root') || (/public\.html/.test(location.pathname) && document.getElementById('root')); if (!root || S.panel || !/View-only|Paparan sahaja/.test(root.textContent || '')) return;
    var card = root.firstElementChild; if (!card) return;
    var st = document.getElementById('bkpay-inv-css'); if (!st) { st = document.createElement('style'); st.id = 'bkpay-inv-css'; document.head.appendChild(st); }
    S.tok = onInv; A.load(onInv).then(function (r) {
      if (!r.v || S.panel) return; S.v = r.v; S.inv = r.inv; st.textContent = '#pay-claim{display:none!important}';
      mount(card, onInv, true);
    });
    S.panel = S.panel || false;
  }
  var host = function () { return document.getElementById(onBook ? 'public-book-root' : 'public-inv-root') || document.getElementById('root'); };
  function run() { if (onBook) { reopen(); bookScan(); } else if (S.panel === null) invScan(); }
  new MutationObserver(run).observe(document.body || document.documentElement, { childList: true, subtree: true });
  var lastL = document.documentElement.lang; new MutationObserver(function () { var l = document.documentElement.lang; if (l === lastL) return; lastL = l; if (S.panel) render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if (host()) run();
  document.addEventListener('DOMContentLoaded', run);
})();
