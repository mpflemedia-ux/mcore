/* WhatsApp document share (Phase 2) - staff side of Quotation Accept/Decline: apply customer answer, pill + Convert shortcut, bell. v1 */
(function () {
  if (!window.WAD2 || WAD2.applyResp) return;
  var W = WAD, X = WAD2, E = W.esc;
  function t(k, v) { return X.t(k, null, v); }
  function when(v) { return W.date(v).slice(0, 5) + ' ' + W.time(v); }
  /* copy the customer's answer onto the quotation (new columns from wa_doc_02.sql); status is left untouched */
  X.applyResp = function (r) {
    if (!r || r.applied_at) return Promise.resolve(r);
    return sb.from('quotations').update({ customer_response: r.response, customer_response_at: r.created_at, customer_response_reason: r.reason || null }).eq('id', r.doc_id).eq('tenant_id', W.tid())
      .then(function (u) { if (u.error) throw u.error; return sb.from('doc_responses').update({ applied_at: new Date().toISOString() }).eq('id', r.id).is('applied_at', null); })
      .then(function () { r.applied_at = 1; return r; }, function (e) { console.warn('[wa-doc2] apply response', e && e.message); return r; });
  };
  function line(id, host) {
    sb.from('doc_responses').select('id,doc_id,response,reason,responder_name,created_at,applied_at').eq('doc_type', 'quo').eq('doc_id', id).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).then(function (q) {
      var r = (q.data || [])[0]; if (!r) return;
      X.applyResp(r);
      return sb.from('quotations').select('status').eq('id', id).maybeSingle().then(function (s) {
        var el = document.getElementById('wd2-resp') || document.createElement('div');
        el.id = 'wd2-resp'; el.className = 'wad-line no-print';
        if (!el.parentNode) { var a = document.getElementById('wad-line') || host; a.parentNode.insertBefore(el, a.nextSibling); }
        var acc = r.response === 'accepted', conv = String((s.data && s.data.status) || '').toLowerCase() === 'converted';
        el.innerHTML = '<span class="wad-pill ' + (acc ? 'wad-ok' : 'wad-bad') + '" style="margin:0">' + (acc ? '✓ ' : '✕ ') + E(t(acc ? 'accPill' : 'decPill', { t: when(r.created_at) })) + '</span>' +
          (r.responder_name ? '<span>' + E(r.responder_name) + '</span>' : '') + (!acc && r.reason ? '<span>“' + E(r.reason) + '”</span>' : '') +
          (acc && !conv && typeof _quoConvert === 'function' ? '<button type="button" class="btn btn-primary btn-sm" data-cv><i class="ti ti-arrow-right"></i> ' + E(t('convert')) + '</button>' : '');
        var b = el.querySelector('[data-cv]'); if (b) b.onclick = function () { b.disabled = true; _quoConvert(id); };
      });
    }, function () {});
  }
  function hook() {
    var pb = document.querySelector('#main button[onclick^="_quoPublicLink(\'"]:not([data-wad2])');
    if (!pb) return; pb.dataset.wad2 = '1';
    var id = (pb.getAttribute('onclick').match(/\('([^']+)'/) || [])[1]; if (!id) return;
    X.ready().then(function (ok) { if (ok && W.allowed('sales') && pb.isConnected) line(id, document.querySelector('#main .page-header')); });
  }
  /* bell: any staff session claims new answers once (notified_at), applies them, tells the sender + owners */
  function poll() {
    if (document.hidden || !W.tid() || W.inSupport() || !W.allowed('sales')) return;
    X.ready().then(function (ok) {
      if (!ok) return;
      sb.from('doc_responses').select('id,doc_id,response,reason,responder_name,created_at,applied_at').eq('tenant_id', W.tid()).is('notified_at', null).is('deleted_at', null).limit(10).then(function (r) {
        (r.data || []).forEach(function (v) {
          sb.from('doc_responses').update({ notified_at: new Date().toISOString() }).eq('id', v.id).is('notified_at', null).select('id').then(function (c) {
            if (!c.data || !c.data.length) return;
            X.applyResp(v);
            Promise.all([sb.from('quotations').select('ref_no,customer_name').eq('id', v.doc_id).maybeSingle(),
              sb.from('doc_shares').select('created_by').eq('doc_type', 'quo').eq('doc_id', v.doc_id).order('created_at', { ascending: false }).limit(1),
              sb.from('user_profiles').select('id,role').eq('tenant_id', W.tid())]).then(function (a) {
              var d = a[0].data || {}, s = (a[1].data || [])[0], us = {}, acc = v.response === 'accepted';
              if (s && s.created_by) us[s.created_by] = 1;
              (a[2].data || []).forEach(function (u) { if (/^owner$/i.test(u.role || '')) us[u.id] = 1; });
              var rows = Object.keys(us).map(function (uid) { return { tenant_id: W.tid(), user_id: uid, actor_id: W.uid(), title: t(acc ? 'accBell' : 'decBell', { r: d.ref_no || '' }).slice(0, 200),
                body: t(acc ? 'accBody' : 'decBody', { c: v.responder_name || d.customer_name || '-', t: W.time(v.created_at), x: v.reason ? ' “' + String(v.reason).slice(0, 200) + '”' : '' }),
                category: 'sales', kind: 'for_you', type: acc ? 'sales.quote_accepted' : 'sales.quote_declined', priority: acc ? 1 : 0, link: { page: 'sales', params: { view: 'quo-form', id: v.doc_id } }, ref_table: 'quotations', ref_id: String(v.doc_id) }; });
              if (rows.length) sb.from('notifications').insert(rows).then(function () {}, function () {});
            });
          });
        });
      }, function () {});
    });
  }
  setInterval(poll, 60000); setTimeout(poll, 9000);
  var tm = 0;
  new MutationObserver(function () { if (!tm) tm = setTimeout(function () { tm = 0; hook(); }, 150); }).observe(document.body, { childList: true, subtree: true });
  hook();
  var bt = setInterval(function () { if (W.tid() && window.sb) { clearInterval(bt); X.ready(); } }, 1000);
})();
