/* WhatsApp document share (Phase 1) - overdue reminder list (tiers, 1/day), public-link modal (expiry/revoke), "Opened" bell. v1 */
(function () {
  if (!window.WAD || WAD.openOverdue) return;
  var W = WAD, E = W.esc;
  /* ---- overdue list ---- */
  function load() {
    return sb.from('invoices').select('id,ref_no,customer_id,customer_name,total,paid_amt,due_date,status').eq('tenant_id', W.tid()).is('deleted_at', null)
      .lt('due_date', W.dayKey()).neq('status', 'paid').order('due_date', { ascending: true }).limit(300).then(function (r) {
        if (r.error) throw r.error;
        return (r.data || []).filter(function (i) { return !/cancel|draft|void/i.test(i.status || '') && Number(i.total || 0) - Number(i.paid_amt || 0) > 0.005; });
      });
  }
  function groups(list) {
    var g = {}, out = [];
    list.forEach(function (i) {
      var k = i.customer_id || ('n:' + (i.customer_name || '-'));
      if (!g[k]) out.push(g[k] = { key: k, cid: i.customer_id, name: i.customer_name || '-', inv: [], bal: 0, n: 0 });
      g[k].inv.push(i); g[k].bal += Number(i.total || 0) - Number(i.paid_amt || 0); g[k].n = Math.max(g[k].n, W.daysLate(i.due_date));
    });
    return out.sort(function (a, b) { return b.n - a.n; });
  }
  var TC = { friendly: 'wad-ok', firm: 'wad-warn', final: 'wad-bad' };
  W.openOverdue = function () {
    var bg = document.createElement('div'); bg.className = 'wad-bg'; bg.id = 'wad-od';
    bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    bg.innerHTML = '<div class="wad-sh" style="max-height:88vh"><div class="wad-grab"></div><div class="wad-hd"><div class="wad-ti">' + E(W.t('overdue')) + '</div><button class="btn btn-outline btn-sm" data-x>' + E(W.t('close')) + '</button></div><div id="wad-odl" style="margin-top:10px">…</div></div>';
    document.body.appendChild(bg); bg.querySelector('[data-x]').onclick = function () { bg.remove(); };
    load().then(function (list) {
      var ids = list.map(function (i) { return i.id; });
      return Promise.all([list,
        ids.length ? sb.from('doc_shares').select('doc_id').eq('doc_type', 'inv').in('doc_id', ids).like('template', 'reminder%').eq('share_day', W.dayKey()).is('deleted_at', null) : { data: [] },
        ids.length ? sb.from('doc_views').select('doc_id,viewed_at').eq('doc_type', 'inv').in('doc_id', ids).order('viewed_at', { ascending: false }).limit(500) : { data: [] }]);
    }).then(function (a) {
      var sent = {}, seen = {};
      (a[1].data || []).forEach(function (x) { sent[x.doc_id] = 1; });
      (a[2].data || []).forEach(function (x) { if (!seen[x.doc_id]) seen[x.doc_id] = x.viewed_at; });
      var gs = groups(a[0]), el = bg.querySelector('#wad-odl');
      if (!gs.length) { el.innerHTML = '<div class="wad-sub" style="padding:18px 0;text-align:center">' + E(W.t('noOverdue')) + '</div>'; return; }
      el.innerHTML = gs.map(function (g, ix) {
        var tier = W.tier(g.n), done = g.inv.every(function (i) { return sent[i.id]; }), op = g.inv.map(function (i) { return seen[i.id]; }).filter(Boolean).sort().pop();
        return '<div style="border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px;background:var(--bg)">' +
          '<div style="display:flex;justify-content:space-between;gap:10px"><strong style="min-width:0;overflow-wrap:anywhere">' + E(g.name) + '</strong><strong style="white-space:nowrap">' + E(W.money(g.bal)) + '</strong></div>' +
          '<div style="display:flex;justify-content:space-between;gap:10px;margin-top:4px;font-size:12.5px;color:var(--text-2)"><span>' + E(g.inv[0].ref_no + (g.inv.length > 1 ? ' +' + (g.inv.length - 1) : '') + ' · ' + W.t('days', null, { n: g.n })) + '</span>' +
          '<span class="wad-pill ' + TC[tier] + '">' + E(W.t('t' + tier.charAt(0).toUpperCase() + tier.slice(1))) + '</span></div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px"><span style="font-size:12.5px;color:var(--text-2)">' +
          E(done ? '✓ ' + W.t('today') : op ? '✓ ' + W.t('opened', null, { t: W.date(op) }) : '') + '</span>' +
          (done ? '' : '<button class="btn btn-sm wad-wa" data-g="' + ix + '" style="min-height:40px"><i class="ti ti-brand-whatsapp"></i> ' + E(W.t('remind')) + '</button>') + '</div></div>';
      }).join('');
      el.querySelectorAll('[data-g]').forEach(function (b) { b.onclick = function () { remind(gs[+b.dataset.g], sent); }; });
    }).catch(function (e) { bg.querySelector('#wad-odl').textContent = W.t('err') + ((e && e.message) || e); });
  };
  var pend = null;
  function remind(g, sent) {
    var todo = g.inv.filter(function (i) { return !sent[i.id]; });
    if (todo.length === 1) { var od = document.getElementById('wad-od'); if (od) od.remove(); return W.shareInv(todo[0].id, { k: 'reminder', step: 3 }); }
    var first = todo[0], tier = W.tier(g.n), bal = todo.reduce(function (s, i) { return s + Number(i.total || 0) - Number(i.paid_amt || 0); }, 0);
    var od2 = document.getElementById('wad-od'); if (od2) od2.remove();
    var ph = g.cid ? sb.from('customers').select('phone').eq('id', g.cid).maybeSingle().then(function (r) { return (r.data && r.data.phone) || ''; }, function () { return ''; }) : Promise.resolve('');
    ph.then(function (p) {
      pend = { id: first.id, rest: todo.slice(1) };
      W.open({ docType: 'inv', docId: first.id, docRef: first.ref_no, to: g.name, phone: p, step: 3, k: 'reminder',
        tpls: [{ k: 'reminder', label: 'reminder', desc: 'reminderD' }], logKey: function () { return 'reminder_' + tier; },
        build: function (k, lang) {
          var refs = todo.map(function (i) { return i.ref_no; }).join(', ');
          var c = { pl: 1, name: String(g.name).split(/\s+(sdn|bhd)\b/i)[0], n: g.n, due: W.date(first.due_date), by: W.plus7(), co: W.company(),
            what: W.t('invoices', lang, { n: todo.length }) + (lang === 'bm' ? ' berjumlah ' : ' totalling ') + W.money(bal) + ' (' + refs + ')' };
          return W.ensureLink('inv', first.id, lang).then(function (L) { c.link = L.url; return { text: W.tpl('reminder_' + tier, lang, c), link_id: L.id, expires_at: L.expires_at }; });
        } });
    });
  }
  document.addEventListener('wad:shared', function (e) {
    var d = e.detail || {}; if (!pend || d.doc_id !== pend.id) return;
    var rest = pend.rest; pend = null;
    rest.forEach(function (i) { W.log({ doc_type: 'inv', doc_id: i.id, doc_ref: i.ref_no, template: d.template, lang: d.lang, recipient_label: d.recipient_label, phone: null, link_id: null }).catch(function () {}); });
  });
  function hookList() {
    var f = document.getElementById('inv-status-filters');
    if (!f || f.dataset.wad) return; f.dataset.wad = '1';
    W.ready().then(function (ok) {
      if (!ok || !W.allowed('sales')) return;
      load().then(function (l) {
        if (!l.length || !f.isConnected) return;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm btn-outline wad-btn no-print';
        b.innerHTML = '<i class="ti ti-brand-whatsapp" style="color:#25D366"></i> ' + E(W.t('overdueN', null, { n: groups(l).length }));
        b.onclick = W.openOverdue; f.appendChild(b);
      }, function () {});
    });
  }
  /* ---- public-link modal: correct title + expiry + Revoke / New link ---- */
  function hookModal() {
    var m = document.querySelector('#public-link-modal.active .modal-box:not([data-wad])'), inp = m && m.querySelector('#public-link-input');
    if (!m || !inp) return; m.dataset.wad = '1';
    var u; try { u = new URL(inp.value); } catch (e) { return; }
    var type = u.searchParams.get('public_quo') ? 'quo' : 'inv', tok = u.searchParams.get(type === 'quo' ? 'public_quo' : 'public_inv');
    if (type === 'quo') { var hd = m.querySelector('.modal-box-header'); if (hd) hd.textContent = W.t('linkTitleQuo'); }
    W.ready().then(function (ok) {
      if (!ok || !W.allowed('sales')) return;
      sb.from(type === 'quo' ? 'quotations' : 'invoices').select('id').eq('tenant_id', W.tid()).eq('public_token', tok).maybeSingle().then(function (r) {
        var id = r.data && r.data.id; if (!id) return;
        var box = document.createElement('div'); box.className = 'wad-line'; box.style.margin = '8px 0 0';
        inp.parentNode.appendChild(box);
        var set = function (L) { inp.value = L.url; window._publicInvLink = L.url; box.innerHTML = '<span>' + E(W.t('expires', null, { d: W.date(L.expires_at) })) + '</span><a data-r>' + E(W.t('revoke')) + '</a><a data-n>' + E(W.t('newLink')) + '</a>'; wire(); };
        var wire = function () {
          box.querySelector('[data-r]').onclick = function () { W.revoke(type, id).then(function () { inp.value = ''; window._publicInvLink = ''; box.innerHTML = '<span class="wad-pill wad-bad" style="margin:0">' + E(W.t('revoked')) + '</span><a data-n>' + E(W.t('newLink')) + '</a>'; box.querySelector('[data-n]').onclick = fresh; W.toast(W.t('revokedOk')); }, err); };
          box.querySelector('[data-n]').onclick = fresh;
        };
        var fresh = function () { W.revoke(type, id).then(function () { return W.ensureLink(type, id); }).then(function (L) { set(L); W.toast(W.t('newOk')); }, err); };
        W.ensureLink(type, id).then(set, err);
      });
    });
  }
  function err(e) { W.toast(W.t('err') + ((e && e.message) || e), 'error'); }
  /* ---- "Opened" bell: any staff session claims new views once (notified_at), then tells the sender + owners ---- */
  function poll() {
    if (document.hidden || !W.tid() || W.inSupport() || !W.allowed('sales')) return;
    W.ready().then(function (ok) {
      if (!ok) return;
      sb.from('doc_views').select('id,doc_type,doc_id,viewed_at').eq('tenant_id', W.tid()).is('notified_at', null).limit(10).then(function (r) {
        (r.data || []).forEach(function (v) {
          sb.from('doc_views').update({ notified_at: new Date().toISOString() }).eq('id', v.id).is('notified_at', null).select('id').then(function (c) {
            if (!c.data || !c.data.length) return;
            Promise.all([sb.from(v.doc_type === 'quo' ? 'quotations' : 'invoices').select('ref_no,customer_name').eq('id', v.doc_id).maybeSingle(),
              sb.from('doc_shares').select('created_by').eq('doc_type', v.doc_type).eq('doc_id', v.doc_id).order('created_at', { ascending: false }).limit(1),
              sb.from('user_profiles').select('id,role').eq('tenant_id', W.tid())]).then(function (a) {
              var d = a[0].data || {}, s = (a[1].data || [])[0], us = {};
              if (s && s.created_by) us[s.created_by] = 1;
              (a[2].data || []).forEach(function (u) { if (/^owner$/i.test(u.role || '')) us[u.id] = 1; });
              var rows = Object.keys(us).map(function (uid) { return { tenant_id: W.tid(), user_id: uid, actor_id: W.uid(), title: W.t('openedBell', null, { r: d.ref_no || '' }).slice(0, 200), body: W.t('openedBody', null, { c: d.customer_name || '-', t: W.time(v.viewed_at) }), category: 'sales', kind: 'activity', type: 'sales.doc_opened', priority: 0, link: { page: 'sales', params: { view: v.doc_type === 'quo' ? 'quo-form' : 'inv-detail', id: v.doc_id } }, ref_table: v.doc_type === 'quo' ? 'quotations' : 'invoices', ref_id: String(v.doc_id) }; });
              if (rows.length) sb.from('notifications').insert(rows).then(function () {}, function () {});
              if (W.refreshLine) W.refreshLine();
            });
          });
        });
      }, function () {});
    });
  }
  setInterval(poll, 60000); setTimeout(poll, 8000);
  W.hookExtra = function () { hookList(); hookModal(); };
})();
