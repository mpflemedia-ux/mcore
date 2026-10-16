/* WhatsApp document share (Phase 2) - bulk "Send one by one" from the Invoice list and the Overdue list (one tap per customer, each logged, 1 reminder/day). v1 */
(function () {
  if (!window.WAD2 || WAD2.bulk) return;
  var W = WAD, X = WAD2, E = W.esc, RUN = null;
  var st = document.createElement('style');
  st.textContent = '.wd2-it{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:var(--bg);cursor:pointer}.wd2-it input{width:20px;height:20px;margin:2px 0 0;flex:none;accent-color:var(--primary)}.wd2-it.off{opacity:.6;cursor:default}' +
    '#wd2-run{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(72px + env(safe-area-inset-bottom));z-index:10040;width:min(560px,calc(100% - 16px));box-sizing:border-box;background:var(--bg-card);color:var(--text);border:1px solid var(--primary);border-radius:14px;padding:10px 12px;box-shadow:0 8px 28px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center}' +
    '#wd2-run .wd2-rt{flex:1;min-width:0;font-size:13px}#wd2-run .wd2-rt b{display:block;font-size:14px}#wd2-run .wd2-rt span{color:var(--text-2);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#wd2-run .btn{min-height:42px}' +
    '@media(min-width:900px){#wd2-run{bottom:24px}}@media print{#wd2-run{display:none!important}}';
  document.head.appendChild(st);
  function t(k, v) { return X.t(k, null, v); }
  function load(overdueOnly) {
    var q = sb.from('invoices').select('id,ref_no,customer_id,customer_name,total,paid_amt,due_date,status').eq('tenant_id', W.tid()).is('deleted_at', null).neq('status', 'paid');
    if (overdueOnly) q = q.lt('due_date', W.dayKey());
    return q.order('due_date', { ascending: true }).limit(300).then(function (r) {
      if (r.error) throw r.error;
      var l = (r.data || []).filter(function (i) { return !/cancel|draft|void/i.test(i.status || '') && Number(i.total || 0) - Number(i.paid_amt || 0) > 0.005; });
      var ids = l.map(function (i) { return i.id; });
      return (ids.length ? sb.from('doc_shares').select('doc_id').eq('doc_type', 'inv').in('doc_id', ids).like('template', 'reminder%').eq('share_day', W.dayKey()).is('deleted_at', null) : Promise.resolve({ data: [] }))
        .then(function (s) { var d = {}; (s.data || []).forEach(function (x) { d[x.doc_id] = 1; }); l.forEach(function (i) { i._late = W.daysLate(i.due_date); i._today = i._late > 0 && !!d[i.id]; }); return l; });
    });
  }
  X.bulk = function (overdueOnly) {
    var bg = document.createElement('div'); bg.className = 'wad-bg'; bg.id = 'wd2-pick';
    bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    bg.innerHTML = '<div class="wad-sh" style="max-height:88vh"><div class="wad-grab"></div><div class="wad-hd"><div class="wad-ti">' + E(t('bulkTitle')) + '</div><button class="btn btn-outline btn-sm" data-x>' + E(W.t('close')) + '</button></div>' +
      '<div class="wad-sub" style="margin-top:8px">' + E(t('bulkD')) + '</div><div id="wd2-pl">…</div></div>';
    document.body.appendChild(bg); bg.querySelector('[data-x]').onclick = function () { bg.remove(); };
    load(overdueOnly).then(function (l) {
      var el = bg.querySelector('#wd2-pl');
      if (!l.length) { el.innerHTML = '<div class="wad-sub" style="padding:18px 0;text-align:center">' + E(t('noUnpaid')) + '</div>'; return; }
      el.innerHTML = '<label class="wd2-it" style="background:none"><input type="checkbox" id="wd2-all"><b style="font-size:14px">' + E(t('selAll')) + '</b></label>' + l.map(function (i, ix) {
        var tier = i._late > 0 ? W.tier(i._late) : null, cls = { friendly: 'wad-ok', firm: 'wad-warn', final: 'wad-bad' }[tier];
        return '<label class="wd2-it' + (i._today ? ' off' : '') + '"><input type="checkbox" data-i="' + ix + '"' + (i._today ? ' disabled' : '') + '><span style="flex:1;min-width:0">' +
          '<span style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:14px;overflow-wrap:anywhere">' + E(i.customer_name || '-') + '</b><b style="white-space:nowrap">' + E(W.money(Number(i.total || 0) - Number(i.paid_amt || 0))) + '</b></span>' +
          '<span style="display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--text-2);margin-top:3px"><span>' + E(i.ref_no + (i._late > 0 ? ' · ' + W.t('days', null, { n: i._late }) : '')) + '</span>' +
          (i._today ? '<span class="wad-pill wad-ok">' + E(t('sentToday')) + '</span>' : tier ? '<span class="wad-pill ' + cls + '">' + E(W.t('t' + tier.charAt(0).toUpperCase() + tier.slice(1))) + '</span>' : '') + '</span></span></label>';
      }).join('') + '<div class="wad-ft" style="position:sticky;bottom:0;background:var(--bg-card);padding-top:8px"><button class="btn wad-wa" data-go disabled>' + E(t('start', { n: 0 })) + '</button></div>';
      var boxes = el.querySelectorAll('[data-i]'), go = el.querySelector('[data-go]'), all = el.querySelector('#wd2-all');
      var upd = function () { var n = el.querySelectorAll('[data-i]:checked').length; go.disabled = !n; go.textContent = t('start', { n: n }); };
      boxes.forEach(function (b) { b.onchange = upd; });
      all.onchange = function () { boxes.forEach(function (b) { if (!b.disabled) b.checked = all.checked; }); upd(); };
      if (overdueOnly) { all.checked = true; all.onchange(); }
      go.onclick = function () {
        var q = []; el.querySelectorAll('[data-i]:checked').forEach(function (b) { q.push(l[+b.dataset.i]); });
        if (!q.length) return W.toast(t('noneSel'), 'error');
        bg.remove(); var od = document.getElementById('wad-od'); if (od) od.remove();
        start(q);
      };
    }).catch(function (e) { bg.querySelector('#wd2-pl').textContent = W.t('err') + ((e && e.message) || e); });
  };
  function start(q) { RUN = { q: q, i: 0, sent: 0, open: false }; openCur(); }
  function openCur() {
    var it = RUN.q[RUN.i]; bar(false); RUN.open = false; RUN.wait = true; RUN.cur = it.id;
    Promise.resolve(W.shareInv(it.id, { k: it._late > 0 ? 'reminder' : 'send', step: 3 })).then(function () { if (RUN && RUN.wait && !document.querySelector('.wad-bg')) { RUN.wait = false; bar(true); } });
  }
  document.addEventListener('wad:shared', function (e) { if (RUN && e.detail && e.detail.doc_id === RUN.cur) { RUN.sent++; RUN.done = RUN.done || {}; RUN.done[RUN.cur] = 1; if (document.getElementById('wd2-run')) bar(true); } });
  function bar(show) {
    var b = document.getElementById('wd2-run');
    if (!show) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'wd2-run'; document.body.appendChild(b); }
    var nx = RUN.q[RUN.i + 1], n = RUN.q.length;
    b.innerHTML = '<div class="wd2-rt"><b>' + E(t('runOf', { i: Math.min(RUN.i + 1, n), n: n })) + ' · ' + E(RUN.q[RUN.i].ref_no) + (RUN.done && RUN.done[RUN.q[RUN.i].id] ? ' ✓' : '') + '</b><span>' +
      E(nx ? t('runNext', { r: nx.ref_no, c: nx.customer_name || '-' }) : t('runDone', { s: RUN.sent, k: n - RUN.sent })) + '</span></div>' +
      '<button class="btn btn-outline btn-sm" data-s>' + E(nx ? t('stop') : W.t('close')) + '</button>' + (nx ? '<button class="btn wad-wa btn-sm" data-n>' + E(t('next')) + '</button>' : '');
    b.querySelector('[data-s]').onclick = function () { var r = RUN; RUN = null; bar(false); if (r) W.toast(X.t('runDone', null, { s: r.sent, k: r.q.length - r.sent })); };
    var nb = b.querySelector('[data-n]'); if (nb) nb.onclick = function () { RUN.i++; openCur(); };
  }
  /* when the share sheet closes during a run, show the Next bar */
  new MutationObserver(function () {
    if (!RUN) return; var on = !!document.querySelector('.wad-bg');
    if (RUN.wait && on) { RUN.wait = false; RUN.open = true; }
    else if (RUN.open && !on) { RUN.open = false; bar(true); }
  }).observe(document.body, { childList: true });
  /* hooks: Invoice list (next to Phase 1 Overdue button) + Overdue sheet header */
  function hook() {
    var f = document.getElementById('inv-status-filters');
    if (f && !f.dataset.wad2) {
      f.dataset.wad2 = '1';
      X.ready().then(function (ok) {
        if (!ok || !W.allowed('sales') || !f.isConnected) return;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm btn-outline wad-btn no-print';
        b.innerHTML = '<i class="ti ti-list-check"></i> ' + E(t('bulk')); b.onclick = function () { X.bulk(false); }; f.appendChild(b);
      });
    }
    var od = document.querySelector('#wad-od .wad-hd:not([data-wad2])');
    if (od) { od.dataset.wad2 = '1'; X.ready().then(function (ok) { if (!ok) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm wad-wa'; b.style.marginLeft = 'auto'; b.style.marginRight = '8px';
      b.innerHTML = '<i class="ti ti-list-check"></i> ' + E(t('bulk')); b.onclick = function () { X.bulk(true); }; od.insertBefore(b, od.lastElementChild); }); }
  }
  var tm = 0;
  new MutationObserver(function () { if (!tm) tm = setTimeout(function () { tm = 0; hook(); }, 150); }).observe(document.body, { childList: true, subtree: true });
  hook();
})();
