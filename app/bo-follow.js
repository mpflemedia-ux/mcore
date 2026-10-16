/* M-Core back-office support - after a WhatsApp reminder: "Remind me in N days if unpaid". Due follow-ups ring a bell for the sender only (checked on app open + every 5 min). Needs bo_support_02.sql. v1 */
(function () {
  if (!window.BO || BO.follow) return;
  var B = BO, E = B.esc, t = B.t;
  B.add({
    en: { fQ: 'Remind me if still unpaid in', fD: '{n}d', fSet: 'OK. I will remind you on {d} if {r} is still unpaid.', fBell: 'Follow up: {r} is still unpaid', fBody: '{c} · balance {a} · you asked to be reminded', fNo: 'No thanks' },
    bm: { fQ: 'Ingatkan saya jika masih belum bayar dalam', fD: '{n} hari', fSet: 'OK. Saya akan ingatkan anda pada {d} jika {r} masih belum bayar.', fBell: 'Susulan: {r} masih belum bayar', fBody: '{c} · baki {a} · anda minta diingatkan', fNo: 'Tidak perlu' }
  });
  var css = document.createElement('style');
  css.textContent = '#bo-fu{position:fixed;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top));z-index:10040;background:var(--bg-card);color:var(--text);border:1px solid var(--border-2,var(--border));box-shadow:var(--shadow-lg);border-radius:12px;padding:10px 12px;width:min(520px,calc(100vw - 24px));box-sizing:border-box;font-size:13.5px}' +
    '#bo-fu .bo-fr{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}#bo-fu .btn{min-height:36px}@media print{#bo-fu{display:none!important}}';
  document.head.appendChild(css);
  function ok() { return B.has('doc_followups'); }
  function bar(d) {
    var old = document.getElementById('bo-fu'); if (old) old.remove();
    var el = document.createElement('div'); el.id = 'bo-fu'; el.setAttribute('role', 'status');
    el.innerHTML = '<div style="font-weight:600">' + E(t('fQ')) + ' · ' + E(d.doc_ref || '') + '</div><div class="bo-fr">' +
      [1, 3, 7].map(function (n) { return '<button type="button" class="btn btn-outline btn-sm" data-n="' + n + '">' + E(t('fD', { n: n })) + '</button>'; }).join('') +
      '<button type="button" class="btn btn-sm" data-x style="margin-left:auto;background:none;border:0;color:var(--text-2);text-decoration:underline">' + E(t('fNo')) + '</button></div>';
    var y = 8; ['#pa-banner', '.top-header', 'header', '#header'].forEach(function (q) { var h = document.querySelector(q); if (h && h.offsetHeight) y = Math.max(y, h.getBoundingClientRect().bottom + 8); });
    el.style.top = Math.round(y) + 'px'; document.body.appendChild(el);
    var tm = setTimeout(function () { el.remove(); }, 20000);
    el.querySelector('[data-x]').onclick = function () { clearTimeout(tm); el.remove(); };
    el.querySelectorAll('[data-n]').forEach(function (b) {
      b.onclick = function () {
        clearTimeout(tm); var due = new Date(Date.now() + (+b.dataset.n) * 864e5);
        Promise.resolve(sb.from('doc_followups').insert({ tenant_id: B.tid(), doc_type: 'inv', doc_id: d.doc_id, doc_ref: d.doc_ref || null, user_id: B.uid(), due_at: due.toISOString() })).then(function (r) {
          if (r.error) throw r.error; el.remove(); B.toast(t('fSet', { d: B.date(due.toISOString()), r: d.doc_ref || '' }));
        }).catch(function (e) { B.toast(t('err') + ((e && e.message) || e), 'error'); });
      };
    });
  }
  document.addEventListener('wad:shared', function (e) {
    var d = e.detail || {}; if (d.doc_type !== 'inv' || !/^reminder/.test(d.template || '') || !d.doc_id) return;
    ok().then(function (y) { if (y) setTimeout(function () { bar(d); }, 600); });
  });
  /* due check: my own follow-ups in this tenant */
  var busy = false;
  B.follow = function () {
    if (busy || document.hidden || !B.tid() || !B.uid() || !window.sb) return Promise.resolve();
    busy = true;
    return ok().then(function (y) {
      if (!y) return;
      return Promise.resolve(sb.from('doc_followups').select('id,doc_id,doc_ref').eq('tenant_id', B.tid()).eq('user_id', B.uid()).is('done_at', null).is('deleted_at', null).lte('due_at', new Date().toISOString()).limit(20)).then(function (r) {
        var a = (r && r.data) || []; if (!a.length) return;
        return Promise.resolve(sb.from('invoices').select('id,ref_no,customer_name,total,paid_amt,status').eq('tenant_id', B.tid()).in('id', a.map(function (x) { return x.doc_id; }))).then(function (q) {
          var inv = {}; ((q && q.data) || []).forEach(function (i) { inv[i.id] = i; });
          return Promise.all(a.map(function (f) {
            return Promise.resolve(sb.from('doc_followups').update({ done_at: new Date().toISOString() }).eq('id', f.id).is('done_at', null).select('id')).then(function (c) {
              if (!c || c.error || !(c.data || []).length) return;
              var i = inv[f.doc_id], bal = i ? Number(i.total || 0) - Number(i.paid_amt || 0) : 0;
              if (!i || bal <= 0.005 || /cancel|void/i.test(i.status || '')) return;
              var ti = t('fBell', { r: i.ref_no || f.doc_ref || '' }), bo = t('fBody', { c: i.customer_name || '-', a: B.money(bal) });
              /* NT.notify skips the sender, so the self-bell is inserted directly (same row shape as notif-core) */
              if (window.NT && NT.on) return Promise.resolve(sb.from('notifications').insert({ tenant_id: B.tid(), user_id: B.uid(), actor_id: null, title: ti.slice(0, 200), body: bo.slice(0, 500), category: 'sales', kind: 'for_you', type: 'sales.followup', priority: 0,
                link: { page: 'sales', params: { view: 'inv-detail', id: i.id }, icon: 'ti-bell-ringing' }, ref_table: 'doc_followups', ref_id: String(f.id), group_key: null })).then(function () { try { if (NT.refresh) NT.refresh(); } catch (e) {} });
              B.toast(ti + ' · ' + bo, 'warning');
            });
          }));
        });
      });
    }).catch(function () {}).then(function () { busy = false; });
  };
  setTimeout(B.follow, 7000); setInterval(B.follow, 5 * 60000);
})();
