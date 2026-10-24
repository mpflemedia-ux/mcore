/* M-Core booking payment flow - public panel look (dark on the booking page, light on the public invoice page). Markup only; events in booking-pay-pub.js. v2 */
(function () {
  var U = window.BKPAYU, A = window.BKPAYA; if (!U || !A || U.html) return;
  function T(x, k, v) { return A.esc(BKPAYI.t(x.lang, k, v)); }
  function hd(x, cls, txt, timer) { return '<div class="bkpay-hd"><span class="bkpay-pill ' + cls + '" role="status">' + txt + '</span>' + (timer || '') + '</div>'; }
  function timer(x) { var v = x.v; if (!v || !v.hold_until) return ''; var m = Math.max(0, Math.ceil((new Date(v.hold_until) - new Date()) / 60000));
    return '<span class="bkpay-timer" data-tm>' + U.ic('clock') + T(x, 'pHeld', { t: A.time(v.hold_until, x.lang === 'bm') }) + ' · <b>' + T(x, 'pLeft', { m: m }) + '</b></span>'; }
  function svc(x) { var v = x.v || {}; return '<div class="bkpay-svc">' + A.esc([v.service_name, v.starts_at ? A.time(v.starts_at, x.lang === 'bm') : '', v.quote_ref].filter(Boolean).join(' · ')) + '</div>'; }
  function amt(x) { var n = x.n;
    return '<div class="bkpay-box"><div class="bkpay-amt"><div><span>' + T(x, 'pNow') + '</span><b>' + A.rm(n.due) + '</b></div><small>' + (n.pct ? T(x, 'pDep', { p: n.pct, t: A.rm(n.total) }) + '<br>' + T(x, 'pBalLater', { b: A.rm(Math.max(0, n.total - n.req)) }) : T(x, 'pFull')) + '</small></div>' +
      (x.v ? '<div class="bkpay-ref"><span class="bkpay-hint" style="margin:0!important">' + T(x, 'pRef') + '</span><code>' + A.esc(x.v.pay_ref) + '</code><button type="button" class="bkpay-btn sm" data-copy="' + A.esc(x.v.pay_ref) + '">' + U.ic('copy') + T(x, 'pCopy') + '</button></div><p class="bkpay-hint">' + T(x, 'pRefHint') + '</p>' : '') + '</div>'; }
  function qr(x) { var i = x.inv || {}; if (!i.payment_qr_url && !i.account_number) return '';
    return '<div class="bkpay-step"><i>1</i>' + T(x, 'pStep1') + '</div><div class="bkpay-qr">' + (i.payment_qr_url ? '<img src="' + A.esc(i.payment_qr_url) + '" alt="DuitNow QR">' : '') +
      '<div class="bkpay-bank">' + A.esc(i.bank_name || '') + (i.account_number ? '<b>' + A.esc(i.account_number) + '</b>' : '') + '<div class="bkpay-hint" style="margin:0 0 8px!important">' + A.esc(i.account_name || '') + '</div>' +
      (i.account_number ? '<button type="button" class="bkpay-btn sm" data-copy="' + A.esc(String(i.account_number).replace(/\s/g, '')) + '">' + U.ic('copy') + T(x, 'pCopy') + '</button> ' : '') +
      (i.payment_qr_url ? '<a class="bkpay-btn sm" href="' + A.esc(i.payment_qr_url) + '" target="_blank" rel="noopener" download>' + U.ic('dl') + T(x, 'pSaveQr') + '</a>' : '') + '</div></div>'; }
  function upl(x, num) { var f = x.file;
    return '<div class="bkpay-step"><i>' + (num || 2) + '</i>' + T(x, 'pStep2') + '</div><div class="bkpay-pick"><label class="bkpay-btn">' + U.ic('cam') + T(x, 'pCam') + '<input type="file" accept="image/*" capture="environment" data-file></label>' +
      '<label class="bkpay-btn">' + U.ic('file') + T(x, 'pPick') + '<input type="file" accept="image/*,application/pdf,.heic,.heif" data-file></label></div>' +
      (f ? '<div class="bkpay-file">' + (x.thumb ? '<img src="' + x.thumb + '" alt="">' : U.ic('file')) + '<span>' + A.esc(f.name) + ' · ' + Math.max(1, Math.round(f.size / 1024)) + ' KB</span><button type="button" class="bkpay-btn sm" data-rm aria-label="' + T(x, 'pRemove') + '">' + U.ic('x') + '</button></div>' : '<p class="bkpay-hint">' + T(x, 'pFileHint') + '</p>') +
      '<label class="bkpay-lb" for="bkpay-amt">' + T(x, 'pAmt') + '</label><input id="bkpay-amt" class="bkpay-in" type="number" inputmode="decimal" step="0.01" min="0.01" data-no-titlecase="1" value="' + (x.amt != null ? x.amt : (x.n.due > 0 ? x.n.due.toFixed(2) : '')) + '">' +
      '<div class="bkpay-err" role="alert" data-err' + (x.err ? ' style="display:block"' : '') + '>' + (x.err ? T(x, x.err) : '') + '</div>' +
      '<button type="button" class="bkpay-btn pri" style="margin-top:12px" data-send' + (x.busy ? ' disabled' : '') + '>' + U.ic('up') + T(x, x.busy ? 'pSending' : 'pSend') + '</button>'; }
  function wa(x, k) { /* no company number: go straight to the contact picker; else show both choices inline */
    if (!x.waAny) return ''; var lbl = U.ic('wa') + T(x, k || 'pWa'), o = 'target="_blank" rel="noopener"';
    if (!x.waHref) return '<a class="bkpay-btn wa" href="' + A.esc(x.waAny) + '" ' + o + '>' + lbl + '</a>';
    return '<button type="button" class="bkpay-btn wa" data-wa aria-expanded="' + (x.waOpen ? 'true' : 'false') + '">' + lbl + '</button>' + (x.waOpen ? '<div class="bkpay-wach" role="group" aria-label="' + T(x, 'pWaWho') + '"><span class="bkpay-hint">' + T(x, 'pWaWho') + '</span>' +
      '<a class="bkpay-btn" href="' + A.esc(x.waHref) + '" ' + o + '>' + U.ic('wa') + '<span>' + T(x, 'pWaTo', { c: x.waCo || '-', p: '\u0001' }).replace('\u0001', '<span style="white-space:nowrap">' + A.esc(x.waPh) + '</span>') + '</span>' + '</a><a class="bkpay-btn" href="' + A.esc(x.waAny) + '" ' + o + '>' + U.ic('user') + T(x, 'pWaPick') + '</a></div>' : ''); }
  function keep(x) { return x.link ? '<div class="bkpay-keep"><span>' + T(x, 'pKeep') + '</span><button type="button" class="bkpay-btn sm" data-copy="' + A.esc(x.link) + '">' + U.ic('link') + T(x, 'pCopyLink') + '</button></div>' : ''; }
  function tl(x, cur) { var v = x.v || {}, st = [['sRecv', v.claim_at], ['sRev', v.claim_seen_at], ['sVer', null]], bm = x.lang === 'bm';
    return '<ol class="bkpay-tl">' + st.map(function (s, i) { var c = i < cur ? 'd' : (i === cur ? 'c' : ''); return '<li class="' + c + '"><i>' + (i < cur ? U.ic('ok') : '') + '</i><div>' + T(x, s[0]) + (s[1] && i <= cur ? '<small>' + A.esc(A.time(s[1], bm)) + '</small>' : '') + '</div></li>'; }).join('') + '</ol>'; }
  U.html = function (x) {
    var s = x.state, v = x.v || {}, n = x.n, bm = x.lang === 'bm', h = '';
    if (s === 'ok') {
      h = hd(x, 'ok', U.ic('ok') + T(x, 'sOk')) + '<h3 class="bkpay-ti">' + T(x, n.bal > 0.005 ? 'sConfBal' : 'sConf') + '</h3>' + svc(x) +
        '<div class="bkpay-box"><div class="bkpay-amt"><div><span>' + T(x, v.receipt_no ? 'sRcpt' : 'sPaid', { n: v.receipt_no || '' }) + '</span><b>' + A.rm(n.paid) + '</b></div><small>' + (n.bal > 0.005 ? T(x, 'sConfBal') + ' · ' + T(x, 'sBal', { b: A.rm(n.bal) }) : T(x, 'sPaid')) + '</small></div></div>' +
        (v.receipt_url ? '<div class="bkpay-row"><a class="bkpay-btn" href="' + A.esc(v.receipt_url) + '" target="_blank" rel="noopener">' + U.ic('dl') + T(x, 'sDl') + '</a><a class="bkpay-btn" href="https://wa.me/?text=' + encodeURIComponent(BKPAYI.t(x.lang, 'sShareMsg', { n: v.receipt_no || '', b: v.quote_ref || '', u: v.receipt_url })) + '" target="_blank" rel="noopener">' + U.ic('wa') + T(x, 'sShare') + '</a></div>' : '') +
        '<div style="margin-top:8px">' + wa(x, 'sAsk') + '</div>' + keep(x);
    } else if (s === 'rev') {
      h = hd(x, 'info', U.ic('clock') + T(x, 'sRev')) + '<h3 class="bkpay-ti">' + T(x, 'sReview') + '</h3>' + svc(x) + tl(x, v.claim_seen_at ? 1 : 0) +
        '<div class="bkpay-msg ok">' + T(x, 'sKept') + '</div>' + wa(x, 'sAsk') + keep(x);
    } else if (s === 'exp') {
      h = hd(x, 'err', U.ic('x') + T(x, 'sExp')) + '<h3 class="bkpay-ti">' + T(x, 'sExp') + '</h3>' + svc(x) + '<div class="bkpay-msg err">' + T(x, 'sExpD') + '</div>' +
        (x.again ? '<a class="bkpay-btn pri" href="' + A.esc(x.again) + '">' + T(x, 'sAgain') + '</a>' : '');
    } else if (s === 'basic') {
      h = '<p class="bkpay-note" style="margin:0 0 6px!important">' + T(x, 'sBasic') + '</p>' + amt(x) + qr(x) + '<div style="margin-top:12px">' + wa(x) + '</div>' + (x.invHref ? '<p class="bkpay-note"><a href="' + A.esc(x.invHref) + '" style="color:var(--k-p)!important;font-weight:700">' + T(x, 'sOpenInv') + '</a></p>' : '');
    } else {
      var top = s === 'rej' ? '<div class="bkpay-msg err"><b>' + T(x, 'sRej') + '</b><br>' + T(x, 'sRejWhy') + ': ' + A.esc(v.reject_reason || '-') + '<br>' + T(x, 'sRejNew', { t: A.time(v.hold_until, bm) }) + '</div>'
        : s === 'part' ? '<div class="bkpay-msg w"><b>' + T(x, 'sPart') + '</b><br>' + T(x, 'sPartMore', { a: A.rm(n.paid), b: A.rm(n.due), t: A.time(v.hold_until, bm) }) + '</div>' : '';
      h = hd(x, s === 'rej' ? 'err' : 'hold', T(x, s === 'rej' ? 'sRej' : (s === 'part' ? 'sPart' : 'pAwait')), timer(x)) + '<h3 class="bkpay-ti">' + T(x, 'pTitle') + '</h3>' + svc(x) + top + amt(x) + qr(x) + upl(x, (x.inv && (x.inv.payment_qr_url || x.inv.account_number)) ? 2 : 1) +
        '<div class="bkpay-or">' + T(x, 'pOr') + '</div>' + wa(x, 'pWaBackup') + '<p class="bkpay-note">' + T(x, 'pHoldHint') + '</p>' + keep(x);
    }
    return h;
  };
})();
