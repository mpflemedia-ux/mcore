/* WhatsApp document share (Phase 1) - tiny hooks: invoice detail, quotation, booking card, POS done. PA full access via W.allowed; WhatsApp pjw-btn polish. v3 */
(function () {
  if (!window.WAD || WAD.shareInv) return;
  var W = WAD, E = W.esc;
  var st = document.createElement('style');
  st.textContent = '.wad-line{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:12.5px;color:var(--text-2);margin:-6px 0 12px}.wad-line a{color:#155E75;cursor:pointer;font-weight:600}[data-theme="dark"] .wad-line a{color:var(--primary)}' +
    '.wad-hist{font-size:12.5px;color:var(--text-2);margin:-6px 0 12px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card)}.wad-hist div{padding:3px 0}' +
    '.db-btn.wad-btn{color:#128C7E}[data-theme="dark"] .db-btn.wad-btn{color:#25D366}';
  document.head.appendChild(st);
  function what(type, lang, ref, amt) { return type === 'quo' ? (lang === 'bm' ? 'sebut harga ' : 'quotation ') + ref + (lang === 'bm' ? ' berjumlah ' : ' for ') + amt : (lang === 'bm' ? 'invois ' : 'invoice ') + ref + (lang === 'bm' ? ' berjumlah ' : ' for ') + amt; }
  W.what = what;
  function plus7() { return W.date(new Date(Date.now() + 7 * 864e5).toISOString()); }
  W.plus7 = plus7;
  function custPhone(cid) { return cid ? sb.from('customers').select('phone').eq('id', cid).maybeSingle().then(function (r) { return (r.data && r.data.phone) || ''; }, function () { return ''; }) : Promise.resolve(''); }
  function short(n) { return String(n || '').split(/\s+(sdn|bhd|enterprise)\b/i)[0] || n; }
  /* invoice / quotation share */
  function shareDoc(type, id, opt) {
    opt = opt || {};
    var cols = type === 'inv' ? 'id,ref_no,customer_id,customer_name,total,paid_amt,due_date,status' : 'id,ref_no,customer_id,customer_name,total,valid_until,status';
    return sb.from(type === 'inv' ? 'invoices' : 'quotations').select(cols).eq('id', id).eq('tenant_id', W.tid()).single().then(function (r) {
      if (r.error || !r.data) throw r.error || new Error('Not found');
      var d = r.data;
      return custPhone(d.customer_id).then(function (ph) {
        var bal = Number(d.total || 0) - Number(d.paid_amt || 0), late = type === 'inv' && bal > 0.005 ? W.daysLate(d.due_date) : 0, tier = W.tier(late);
        var tl = function (l) { return W.t('t' + tier.charAt(0).toUpperCase() + tier.slice(1), l) + ' · ' + (l === 'bm' ? late + ' hari' : late + ' days'); };
        var tpls = type === 'inv' ? [{ k: 'send', label: 'newInv', desc: 'newInvD' }].concat(late > 0 ? [{ k: 'reminder', label: 'reminder', desc: 'reminderD', badge: tl, cls: tier === 'final' ? 'wad-bad' : 'wad-warn' }] : [], [{ k: 'thanks', label: 'thanks', desc: 'thanksD' }])
          : [{ k: 'send', label: 'newQuo', desc: 'newQuoD' }, { k: 'followup', label: 'followup', desc: 'followupD' }];
        var k = opt.k || (type === 'inv' ? (bal <= 0.005 ? 'thanks' : late > 0 ? 'reminder' : 'send') : (d.status === 'sent' ? 'followup' : 'send'));
        W.open({ docType: type, docId: id, docRef: d.ref_no, to: d.customer_name, phone: ph, tpls: tpls, k: k, step: opt.step,
          logKey: function (x) { return x === 'reminder' ? 'reminder_' + tier : x; },
          guarded: function (x) { return x === 'reminder'; },
          guard: type === 'inv' && late > 0 ? function () { return W.sentToday('inv', id); } : null,
          build: function (x, lang) {
            var c = { name: short(d.customer_name || ''), ref: d.ref_no, amt: W.money(d.total), bal: W.money(bal), due: W.date(type === 'inv' ? d.due_date : d.valid_until), n: late, by: plus7(), co: W.company() };
            c.what = what(type, lang, d.ref_no, x === 'reminder' ? c.bal : c.amt);
            var tk = x === 'reminder' ? 'reminder_' + tier : x === 'send' ? type + '_send' : x;
            if (x === 'thanks') return { text: W.tpl(tk, lang, c) };
            return W.ensureLink(type, id, lang).then(function (L) { c.link = L.url; return { text: W.tpl(tk, lang, c), link_id: L.id, expires_at: L.expires_at }; });
          } });
      });
    }).catch(function (e) { W.toast(W.t('err') + ((e && e.message) || e), 'error'); });
  }
  W.shareInv = function (id, o) { return shareDoc('inv', id, o); };
  W.shareQuo = function (id, o) { return shareDoc('quo', id, o); };
  function waBtn(cls, label) { var b = document.createElement('button'); b.type = 'button'; b.className = cls + ' wad-btn no-print'; b.innerHTML = '<i class="ti ti-brand-whatsapp"></i> ' + E(label || W.t('btn')); return b; }
  /* status + history line under the page header */
  function line(type, id, host) {
    var el = document.getElementById('wad-line') || document.createElement('div');
    el.id = 'wad-line'; el.className = 'wad-line no-print'; el.dataset.id = id;
    if (!el.parentNode) host.parentNode.insertBefore(el, host.nextSibling);
    W.history(type, id).then(function (h) {
      if (el.dataset.id !== id) return;
      var s = h.shares, p = '';
      if (h.view) p += '<span class="wad-pill wad-inf" style="margin:0">● ' + E(W.t('opened', null, { t: W.dayKey(h.view.viewed_at) === W.dayKey() ? W.time(h.view.viewed_at) : W.date(h.view.viewed_at) })) + '</span>';
      if (s.length) p += '<span class="wad-pill wad-ok" style="margin:0">' + E(W.t('waSent')) + '</span>';
      p += '<span>⟲ ' + E(s.length ? W.t('sentN', null, { n: s.length, d: W.date(s[0].created_at).slice(0, 5), u: s[0].created_by_name || '-' }) : W.t('none')) + '</span>';
      if (s.length) p += '<a data-h="1">' + E(W.t('history')) + '</a>';
      el.innerHTML = p;
      var a = el.querySelector('[data-h]');
      if (a) a.onclick = function () {
        var x = document.getElementById('wad-hist');
        if (x) return x.remove();
        x = document.createElement('div'); x.id = 'wad-hist'; x.className = 'wad-hist no-print';
        x.innerHTML = s.map(function (r) { return '<div>' + E(W.date(r.created_at) + ' ' + W.time(r.created_at) + ' · ' + r.template.replace('_', ' ') + ' · ' + (r.created_by_name || '-')) + '</div>'; }).join('');
        el.parentNode.insertBefore(x, el.nextSibling);
      };
    }, function () {});
  }
  W.refreshLine = function () { var el = document.getElementById('wad-line'); if (el) { var b = document.querySelector('#main [data-wad-doc]'); if (b) line(b.dataset.wadDoc, el.dataset.id, el.previousSibling); } };
  document.addEventListener('wad:shared', function () { setTimeout(W.refreshLine, 400); });
  function hookDoc(type, fn, mod) {
    var pb = document.querySelector('#main button[onclick^="' + fn + "('" + '"]:not([data-wad])');
    if (!pb) return; pb.dataset.wad = '1';
    var id = (pb.getAttribute('onclick').match(/\('([^']+)'/) || [])[1]; if (!id) return;
    W.ready().then(function (ok) {
      if (!ok || !W.allowed(mod) || !pb.isConnected) return;
      var b = waBtn('btn btn-sm wad-wa'); b.dataset.wadDoc = type;
      b.onclick = function () { shareDoc(type, id); };
      pb.parentNode.insertBefore(b, pb);
      var hd = document.querySelector('#main .page-header'); if (hd) line(type, id, hd);
    });
  }
  /* booking card (dashboard) */
  function hookBookings() {
    var rows = document.querySelectorAll('#db-sec-booking details[data-bk-row]:not([data-wad])');
    if (!rows.length) return;
    rows.forEach(function (r) { r.dataset.wad = '1'; });
    W.ready().then(function (ok) {
      if (!ok || !W.allowed('core')) return;
      var ids = [];
      rows.forEach(function (r) {
        var act = r.querySelector('[data-bk-act="amend"]'); if (!act) return;
        var id = r.dataset.bkRow, lab = 'WhatsApp';
        var b = waBtn('pjw-btn', lab); b.dataset.wadBk = id;
        b.setAttribute('aria-label', lab); b.title = lab; ids.push(id);
        b.onclick = function (e) { e.preventDefault(); shareBooking(id); };
        act.parentNode.insertBefore(b, act);
      });
      if (ids.length) sb.from('doc_shares').select('doc_id').eq('doc_type', 'booking').in('doc_id', ids).is('deleted_at', null).then(function (q) {
        var n = {}; (q.data || []).forEach(function (x) { n[x.doc_id] = (n[x.doc_id] || 0) + 1; });
        Object.keys(n).forEach(function (id) { var b = document.querySelector('[data-wad-bk="' + id + '"]'); if (b) b.innerHTML += ' · ' + n[id] + 'x'; });
      }, function () {});
    });
  }
  W.shareBk = function shareBooking(id) {
    sb.from('bookings').select('id,customer_name,customer_phone,starts_at,status,quote_ref,booking_services(name)').eq('id', id).single().then(function (r) {
      if (r.error || !r.data) throw r.error || new Error('Not found');
      var d = r.data, svc = (d.booking_services && d.booking_services.name) || 'Booking';
      var tmr = W.dayKey(d.starts_at) === W.dayKey(Date.now() + 864e5);
      W.open({ docType: 'booking', docId: id, docRef: d.quote_ref || W.date(d.starts_at), to: d.customer_name, phone: d.customer_phone || '', k: tmr ? 'remind_day' : 'confirm',
        tpls: [{ k: 'confirm', label: 'confirm', desc: 'confirmD' }, { k: 'remind_day', label: 'dayBefore', desc: 'dayBeforeD' }, { k: 'reschedule', label: 'resched', desc: 'reschedD' }],
        build: function (k, lang) { return { text: W.tpl(k, lang, { name: short(d.customer_name || ''), svc: svc, when: W.date(d.starts_at) + ' ' + W.time(d.starts_at), ref: d.quote_ref, co: W.company() }) }; } });
    }).catch(function (e) { W.toast(W.t('err') + ((e && e.message) || e), 'error'); });
  }
  /* POS done */
  function hookPos() {
    var ft = document.querySelector('#pos-receipt-modal.active .modal-box-footer:not([data-wad])');
    if (!ft) return; ft.dataset.wad = '1';
    W.ready().then(function (ok) {
      if (!ok || !W.allowed('pos')) return;
      var b = waBtn('btn btn-outline'); b.style.flex = '1';
      b.onclick = sharePos; ft.insertBefore(b, ft.lastElementChild);
    });
  }
  function sharePos() {
    var r = window._posLastReceipt; if (!r) return;
    var items = (r.items || []).slice(0, 8).map(function (i) { return i.qty + '× ' + i.name; }).join('\n');
    W.open({ docType: 'pos', docId: null, docRef: r.receiptNo, to: null, walkin: true, recipientKind: 'walkin', phone: '', step: 2,
      tpls: [{ k: 'receipt', label: 'receipt', desc: 'receiptD' }],
      file: typeof _posBuildReceiptPdf === 'function' ? function () { return _posBuildReceiptPdf(r).then(function (bytes) { return new File([bytes], 'Receipt_' + String(r.receiptNo || 'POS').replace(/[^\w-]/g, '') + '.pdf', { type: 'application/pdf' }); }); } : null,
      build: function (k, lang) { return { text: W.tpl('receipt', lang, { ref: r.receiptNo, amt: r.totalLabel, items: items, co: W.company() }) }; } });
  }
  var tm = 0;
  function scan() { tm = 0; try { hookDoc('inv', '_invPublicLink', 'sales'); hookDoc('quo', '_quoPublicLink', 'sales'); hookBookings(); hookPos(); if (W.hookExtra) W.hookExtra(); } catch (e) { console.warn('[wa-doc]', e); } }
  new MutationObserver(function () { if (!tm) tm = setTimeout(scan, 120); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  scan();
})();
