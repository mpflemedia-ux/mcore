/* WhatsApp document share (Phase 1) - 3-step sheet (template+lang / recipient / preview+send). Same flow as pj-wa/sd-wa. v1 */
(function () {
  if (!window.WAD || WAD.open) return;
  var W = WAD, css = document.createElement('style');
  css.id = 'wad-css';
  css.textContent =
    '.wad-bg{--wb:var(--border-2,var(--border))}.wad-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;z-index:10050}' +
    '.wad-sh{background:var(--bg-card);color:var(--text);width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:16px 16px 0 0;padding:10px 16px calc(16px + env(safe-area-inset-bottom));border:1px solid var(--border);box-sizing:border-box}' +
    '@media(min-width:900px){.wad-bg{align-items:center}.wad-sh{max-width:420px;border-radius:16px}.wad-grab{display:none}}' +
    '.wad-grab{width:40px;height:4px;border-radius:2px;background:var(--wb);margin:0 auto 10px}' +
    '.wad-hd{display:flex;align-items:center;justify-content:space-between;gap:10px}.wad-ti{font-weight:700;font-size:17px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.wad-seg{display:inline-flex;border:1px solid var(--wb);border-radius:8px;overflow:hidden;flex:none}.wad-seg button{padding:6px 14px;font-size:13px;font-weight:600;color:var(--text-2);background:none;border:0;cursor:pointer;min-height:32px}.wad-seg .on{background:var(--primary-light);color:var(--primary)}' +
    '.wad-steps{display:flex;gap:6px;margin:10px 0 10px}.wad-steps span{flex:1;height:4px;border-radius:2px;background:var(--wb)}.wad-steps .on{background:var(--primary)}' +
    '.wad-sub{font-size:12.5px;color:var(--text-2);margin-bottom:8px}' +
    '.wad-opt{width:100%;text-align:left;border:1px solid var(--wb);border-radius:12px;padding:11px 12px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start;background:none;color:var(--text);cursor:pointer;font:inherit}.wad-opt.sel{border-color:var(--primary);background:var(--primary-light)}' +
    '.wad-rad{width:16px;height:16px;border-radius:50%;border:2px solid var(--text-3);margin-top:2px;flex:none;box-sizing:border-box}.wad-opt.sel .wad-rad{border:5px solid var(--primary)}' +
    '.wad-ol{font-weight:600;font-size:14px}.wad-od{font-size:12.5px;color:var(--text-2);margin-top:2px}' +
    '.wad-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:99px;font-size:11.5px;font-weight:600;vertical-align:middle;margin-left:4px}' +
    '.wad-ok{background:rgba(22,163,74,.15);color:#166534}.wad-warn{background:rgba(217,119,6,.16);color:#92400E}.wad-bad{background:rgba(220,38,38,.14);color:#B91C1C}.wad-inf{background:var(--primary-light);color:var(--primary)}' +
    '[data-theme="dark"] .wad-ok{color:#4ADE80}[data-theme="dark"] .wad-warn{color:#FBBF24}[data-theme="dark"] .wad-bad{color:#F87171}' +
    '.wad-lb{font-size:12.5px;color:var(--text-2);margin:4px 0 6px}.wad-in{width:100%;box-sizing:border-box;border:1px solid var(--wb);border-radius:8px;padding:10px 11px;font-size:15px;background:var(--bg);color:var(--text)}' +
    '.wad-msg{border-radius:8px;padding:9px 11px;font-size:13px;margin:8px 0}.wad-msg a{color:inherit;font-weight:700;cursor:pointer;text-decoration:underline}' +
    '.wad-msg.wad-warn{border:1px solid rgba(217,119,6,.45)}.wad-msg.wad-bad{border:1px solid rgba(220,38,38,.4)}.wad-msg.wad-inf{border:1px solid var(--border)}' +
    '.wad-bub{width:100%;box-sizing:border-box;background:#D9FDD3;color:#111B21;border:0;border-radius:10px 10px 2px 10px;padding:10px 12px;font:inherit;font-size:14px;line-height:1.45;min-height:150px;resize:vertical;margin-top:8px}' +
    '[data-theme="dark"] .wad-bub{background:#005C4B;color:#E9EDEF}' +
    '.wad-note{font-size:12px;color:var(--text-2);margin:8px 0 2px}' +
    '.wad-ft{display:flex;gap:10px;margin-top:12px}.wad-ft .btn{flex:1;min-height:44px;justify-content:center}.wad-ft .btn:last-child{flex:1.5}' +
    '.btn.wad-wa{background:#25D366;border-color:#25D366;color:#06260f}.btn.wad-wa:disabled{opacity:.5}' +
    '@media print{.wad-bg,.wad-line,.wad-btn{display:none!important}}';
  document.head.appendChild(css);
  var cur = null;
  function close() { if (cur && cur.bg) cur.bg.remove(); cur = null; document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  W.closeSheet = close;
  /* o: {title, docType, docId, docRef, lang, tpls:[{k,label,desc,badge,cls}], k, step, phone, to, walkin, build(k,lang)->Promise<{text,link_id,expires_at}>, file()->Promise<File|null>, recipientKind, guard()->Promise<bool>} */
  W.open = function (o) {
    close();
    var st = cur = { o: o, k: o.k || o.tpls[0].k, lang: o.lang || (W.bm() ? 'bm' : 'en'), step: o.step || 1, phone: o.phone || '', text: '', built: null, file: null, today: false };
    st.bg = document.createElement('div'); st.bg.className = 'wad-bg';
    st.bg.addEventListener('click', function (e) { if (e.target === st.bg) close(); });
    document.body.appendChild(st.bg); document.addEventListener('keydown', onKey);
    if (o.file) o.file().then(function (f) { st.file = f; if (cur === st && st.step === 3) paint(); }, function () {});
    if (o.guard) o.guard().then(function (b) { st.today = b; if (cur === st) paint(); });
    if (st.step === 3) build(); paint();
  };
  function t(k, v) { return W.t(k, cur.lang, v); }
  function build() {
    var st = cur; st.built = null; st.text = '';
    Promise.resolve(st.o.build(st.k, st.lang)).then(function (b) { if (cur !== st) return; st.built = b || {}; st.text = st.built.text || ''; paint(); },
      function (e) { if (cur !== st) return; st.built = { err: (e && e.message) || String(e) }; paint(); });
  }
  function phoneMsg(p) {
    if (cur.o.walkin && p.st === 'empty') return '<div class="wad-msg wad-inf">' + W.esc(t('pickWa')) + '</div>';
    if (p.st === 'fix') return '<div class="wad-msg wad-warn">⚠ ' + W.esc(t('noZero', { s: W.fmt(p.sug) })) + ' <a data-a="fix">' + W.esc(t('fix')) + '</a></div>';
    if (p.st === 'land') return '<div class="wad-msg wad-warn">⚠ ' + W.esc(t('land', { s: W.fmt(p.d) })) + '</div>';
    if (p.st === 'bad') return '<div class="wad-msg wad-bad">⚠ ' + W.esc(t('bad')) + '</div>';
    if (p.st === 'empty') return '<div class="wad-msg wad-inf">' + W.esc(t('pickWa')) + '</div>';
    return '';
  }
  function paint() {
    var st = cur; if (!st) return; var o = st.o, n = st.step, h = '', p = W.phone(st.phone);
    h += '<div class="wad-grab"></div><div class="wad-hd"><div class="wad-ti">' + W.esc(n === 3 ? (st.lang === 'bm' ? 'Pratonton' : 'Preview') : t('share') + ' ' + (o.docRef || '')) + '</div>' +
      '<div class="wad-seg"><button data-l="en" class="' + (st.lang === 'en' ? 'on' : '') + '">EN</button><button data-l="bm" class="' + (st.lang === 'bm' ? 'on' : '') + '">BM</button></div></div>' +
      '<div class="wad-steps"><span class="on"></span><span class="' + (n > 1 ? 'on' : '') + '"></span><span class="' + (n > 2 ? 'on' : '') + '"></span></div>' +
      '<div class="wad-sub">' + W.esc(t('step', { n: n }) + ' · ' + t('s' + n)) + '</div>';
    if (n === 1) {
      o.tpls.forEach(function (x) {
        h += '<button type="button" class="wad-opt' + (x.k === st.k ? ' sel' : '') + '" data-k="' + x.k + '"><span class="wad-rad"></span><span><div class="wad-ol">' + W.esc(t(x.label)) +
          (x.badge ? '<span class="wad-pill ' + (x.cls || 'wad-warn') + '">' + W.esc(x.badge(st.lang)) + '</span>' : '') + '</div><div class="wad-od">' + W.esc(t(x.desc)) + '</div></span></button>';
      });
      h += '<div class="wad-ft"><button class="btn btn-outline" data-a="cancel">' + W.esc(t('cancel')) + '</button><button class="btn btn-primary" data-a="next">' + W.esc(t('nextRcp')) + '</button></div>';
    } else {
      h += '<div class="wad-lb">' + W.esc(t('to')) + (o.to ? ' · ' + W.esc(o.to) : '') + '</div><input class="wad-in" id="wad-ph" data-no-titlecase="1" inputmode="tel" autocomplete="off" placeholder="012-345 6789" value="' + W.esc(st.phone) + '">' + '<div id="wad-pm">' + phoneMsg(p) + '</div>';
      if (o.walkin) h += '<div class="wad-note">' + W.esc(t('walkin')) + '</div>';
      if (n === 2) {
        h += '<div class="wad-note">' + W.esc(t('phoneHint')) + '</div><div class="wad-ft"><button class="btn btn-outline" data-a="back">' + W.esc(t('back')) + '</button><button class="btn btn-primary" data-a="next">' + W.esc(t('nextPrev')) + '</button></div>';
      } else {
        var b = st.built;
        var td = st.today && (!o.guarded || o.guarded(st.k));
        if (td) h += '<div class="wad-msg wad-warn">⚠ ' + W.esc(t('today')) + '</div>';
        if (b && b.err) h += '<div class="wad-msg wad-bad">' + W.esc(t('err') + b.err) + '</div>';
        h += '<textarea class="wad-bub" id="wad-tx" data-no-titlecase="1" ' + (b ? '' : 'disabled') + '>' + W.esc(b ? st.text : '…') + '</textarea>';
        h += '<div class="wad-note">' + W.esc(b && b.expires_at ? t('linkExp', { d: W.date(b.expires_at) }) : t('logged')) + '</div>';
        var canFile = !!(st.file && navigator.canShare && navigator.canShare({ files: [st.file] }));
        var dis = !b || b.err || td || p.st === 'bad' ? ' disabled' : '';
        h += '<div class="wad-ft"><button class="btn btn-outline" data-a="back">' + W.esc(t('back')) + '</button>' +
          (canFile ? '<button class="btn wad-wa" data-a="file"' + dis + '>' + W.esc(t('sharePdf')) + '</button>' : '') +
          '<button class="btn ' + (canFile ? 'btn-outline' : 'wad-wa') + '" data-a="send"' + dis + '>' + W.esc(canFile ? t('textOnly') : t('openWa')) + '</button></div>';
      }
    }
    st.bg.innerHTML = '<div class="wad-sh" role="dialog" aria-modal="true">' + h + '</div>';
    wire();
  }
  function wire() {
    var st = cur, r = st.bg;
    r.querySelectorAll('[data-l]').forEach(function (b) { b.onclick = function () { if (st.lang === b.dataset.l) return; st.lang = b.dataset.l; if (st.step === 3) build(); paint(); }; });
    r.querySelectorAll('[data-k]').forEach(function (b) { b.onclick = function () { st.k = b.dataset.k; paint(); }; });
    var ph = r.querySelector('#wad-ph');
    if (ph) ph.oninput = function () { st.phone = ph.value; var p = W.phone(st.phone); r.querySelector('#wad-pm').innerHTML = phoneMsg(p); wireFix();
      r.querySelectorAll('[data-a=send],[data-a=file]').forEach(function (x) { x.disabled = !st.built || !!st.built.err || (st.today && (!st.o.guarded || st.o.guarded(st.k))) || p.st === 'bad'; }); };
    var tx = r.querySelector('#wad-tx'); if (tx) tx.oninput = function () { st.text = tx.value; };
    wireFix();
    r.querySelectorAll('[data-a]').forEach(function (b) {
      var a = b.dataset.a; if (a === 'fix') return;
      b.onclick = function () {
        if (a === 'cancel') return close();
        if (a === 'back') { st.step = st.o.step === 3 && st.step === 3 ? 0 : st.step - 1; if (st.step < 1) return close(); return paint(); }
        if (a === 'next') { st.step++; if (st.step === 3) build(); return paint(); }
        if (a === 'send' || a === 'file') send(a === 'file');
      };
    });
  }
  function wireFix() { var f = cur.bg.querySelector('[data-a=fix]'); if (f) f.onclick = function () { var p = W.phone(cur.phone); if (p.sug) { cur.phone = '+' + p.sug; paint(); } }; }
  function send(asFile) {
    var st = cur, o = st.o, p = W.phone(st.phone), text = st.text, b = st.built || {};
    var row = { doc_type: o.docType, doc_id: o.docId, doc_ref: o.docRef, template: o.logKey ? o.logKey(st.k) : st.k, lang: st.lang, carrier: asFile ? 'file' : 'text',
      recipient_kind: o.recipientKind || 'customer', recipient_label: o.to, phone: p.d, walkin: o.walkin, link_id: b.link_id };
    var done = function () { W.log(row).then(function () { W.toast(W.t('sent', st.lang)); }, function (e) { W.toast(e && e.code === '23505' ? W.t('today', st.lang) : W.t('err', st.lang) + ((e && e.message) || e), e && e.code === '23505' ? 'warning' : 'error'); }); };
    if (asFile && st.file) {
      navigator.share({ files: [st.file], text: text }).then(function () { done(); close(); }, function (e) { if (e && e.name !== 'AbortError') W.toast(W.t('err', st.lang) + e.message, 'error'); });
      return;
    }
    window.open(W.waUrl(p.d, text), '_blank', 'noopener');
    done(); close();
  }
})();
