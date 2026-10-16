/* M-Core back-office support - tenant side: "Sign off as the company" switch in the WhatsApp template card + "Opened, unpaid" invoice list (>3 days). Needs bo_support_01.sql. v1 */
(function () {
  if (!window.BO || BO.openedList) return;
  var B = BO, E = B.esc, t = B.t;
  function W() { return window.WAD; }
  function okSales() { return W() && W().allowed && W().allowed('sales'); }
  /* ---- 1) setting switch inside #wd2-card ---- */
  function hookSign() {
    var c = document.getElementById('wd2-card'); if (!c || c.dataset.bo || !c.querySelector('.card-title')) return;
    c.dataset.bo = '1';
    B.readyA().then(function (ok) {
      if (!ok || !B.owner() || !c.isConnected) return;
      return B.loadSet().then(function (on) {
        var box = c.querySelector('.card-title').parentNode.nextElementSibling || c, co = (W() && W().company()) || '';
        var d = document.createElement('label'); d.id = 'bo-sign'; d.style.cssText = 'display:flex;gap:10px;align-items:flex-start;cursor:pointer;padding:10px 12px;border:1px solid var(--border);border-radius:10px';
        d.innerHTML = '<input type="checkbox" id="bo-sign-t" style="width:18px;height:18px;margin-top:2px;flex:none"' + (on ? ' checked' : '') + '><span><span style="display:block;font-weight:600;font-size:14px">' + E(t('signT')) + '</span>' +
          '<span style="display:block;font-size:12.5px;color:var(--text-2);margin-top:2px">' + E(t('signD', { co: co })) + '</span></span>';
        box.insertBefore(d, box.lastElementChild);
        var cb = d.querySelector('input');
        cb.onchange = function () { cb.disabled = true; B.saveSet(cb.checked).then(function () { B.toast(t('saved')); }, function (e) { cb.checked = !cb.checked; B.toast(t('err') + ((e && e.message) || e), 'error'); }).then(function () { cb.disabled = false; }); };
      });
    });
  }
  /* ---- 2) Opened but unpaid (first opened >3 days ago, balance > 0) ---- */
  B.openedLoad = function () {
    var ago = new Date(Date.now() - 3 * 864e5).toISOString(), tid = B.tid();
    return Promise.resolve(sb.from('doc_views').select('doc_id,viewed_at').eq('tenant_id', tid).eq('doc_type', 'inv').order('viewed_at', { ascending: true }).limit(2000)).then(function (r) {
      var first = {}; ((r && r.data) || []).forEach(function (v) { if (!first[v.doc_id]) first[v.doc_id] = v.viewed_at; });
      var ids = Object.keys(first).filter(function (k) { return first[k] < ago; }).slice(0, 300);
      if (!ids.length) return [];
      return Promise.resolve(sb.from('invoices').select('id,ref_no,customer_name,total,paid_amt,due_date,status').eq('tenant_id', tid).in('id', ids).is('deleted_at', null)).then(function (q) {
        return ((q && q.data) || []).filter(function (i) { return !/cancel|draft|void/i.test(i.status || '') && Number(i.total || 0) - Number(i.paid_amt || 0) > 0.005; })
          .map(function (i) { i.first = first[i.id]; return i; }).sort(function (a, b) { return a.first < b.first ? -1 : 1; });
      });
    });
  };
  B.openedList = function () {
    var bg = document.createElement('div'); bg.className = 'wad-bg'; bg.id = 'bo-opl';
    bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    bg.innerHTML = '<div class="wad-sh" role="dialog" aria-modal="true" style="max-height:88vh"><div class="wad-grab"></div><div class="wad-hd"><div class="wad-ti">' + E(t('opTitle')) + '</div><button class="btn btn-outline btn-sm" data-x>' + E(t('close')) + '</button></div>' +
      '<div class="wad-sub" style="margin-top:8px">' + E(t('opSub')) + '</div><div id="bo-opb"><div class="wad-sub">' + E(t('load')) + '</div></div></div>';
    document.body.appendChild(bg); bg.querySelector('[data-x]').onclick = function () { bg.remove(); };
    B.openedLoad().then(function (l) {
      var el = bg.querySelector('#bo-opb');
      if (!l.length) { el.innerHTML = '<div class="wad-sub" style="padding:18px 0;text-align:center">' + E(t('none')) + '</div>'; return; }
      el.innerHTML = l.map(function (i, ix) {
        var bal = Number(i.total || 0) - Number(i.paid_amt || 0);
        return '<div class="wad-opt" style="cursor:default;align-items:center"><span style="flex:1;min-width:0"><div class="wad-ol" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a data-o="' + ix + '" style="cursor:pointer">' + E(i.ref_no || '-') + '</a> · ' + E(i.customer_name || '-') + '</div>' +
          '<div class="wad-od">' + E(t('firstOpen', { d: B.date(i.first) }) + ' · ' + t('bal', { a: B.money(bal) })) + '</div></span><button class="btn btn-sm wad-wa" data-r="' + ix + '"><i class="ti ti-brand-whatsapp"></i> ' + E(t('remind')) + '</button></div>';
      }).join('');
      el.querySelectorAll('[data-o]').forEach(function (a) { a.onclick = function () { bg.remove(); openPage('sales', { view: 'inv-detail', id: l[+a.dataset.o].id }); }; });
      el.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = function () { var i = l[+b.dataset.r]; bg.remove(); W().shareInv(i.id, { k: i.due_date && i.due_date < B.day() ? 'reminder' : 'send' }); }; });
    }, function (e) { bg.querySelector('#bo-opb').innerHTML = '<div class="wad-msg wad-bad">' + E(t('err') + ((e && e.message) || e)) + '</div>'; });
  };
  function hookList() {
    var f = document.getElementById('inv-status-filters'); if (!f || f.dataset.bo) return; f.dataset.bo = '1';
    B.readyA().then(function (ok) {
      if (!ok || !okSales()) return;
      return W().ready().then(function (w) {
        if (!w) return;
        return B.openedLoad().then(function (l) {
          if (!f.isConnected || !l.length) return;
          var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm btn-outline wad-btn no-print'; b.id = 'bo-opbtn';
          b.innerHTML = '<i class="ti ti-eye-check" style="color:#7C3AED"></i> ' + E(t('opBtn')) + ' · ' + l.length; b.onclick = B.openedList; f.appendChild(b);
        });
      });
    }).catch(function () {});
  }
  var tm = 0;
  new MutationObserver(function () { if (!tm) tm = setTimeout(function () { tm = 0; hookSign(); hookList(); }, 200); }).observe(document.body, { childList: true, subtree: true });
})();
