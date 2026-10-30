/* dk-acct.js — DK Phase 5 · Accounting & reports.
   Lists → DK.list cards at all widths: chart of accounts, journal entries, fiscal years, fixed assets, payment vouchers,
   disbursement batches, AR aging and AP aging (grand-total rows skipped; the card summary shows the total).
   AR aging → bulk payment reminders: tick invoices, then "WhatsApp reminders" sends ONE message per customer
   (all that customer's selected invoices + total balance) one by one through the shared DKS queue, or
   "Email reminders" lists a mailto link per customer (fallback when there is no phone). Nothing is sent automatically:
   every message opens in WhatsApp / the mail app for the user to send. Each WhatsApp reminder is logged on the invoices'
   timeline. Server side: supabase/dk_phase5_acct.sql (AP due-soon digest cron, template widen). EN/BM, tokens only. */
(function () {
  if (window.DKAcct) return;
  var S = window.DKAcct = { v: 1 };
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fd(d) { return d ? (window.DK ? DK.date(d) : String(d).slice(0, 10)) : ''; }
  function rm(n) { try { return formatRM(n); } catch (e) { return 'RM ' + Number(n || 0).toFixed(2); } }
  function tid() { try { return APP.tenant.id; } catch (e) { return null; } }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }
  function q(p) { return Promise.resolve(p).then(function (r) { if (r && r.error) throw r.error; return r ? r.data : null; }); }
  function co() { try { return (window.WAD && WAD.company && WAD.company()) || APP.tenant.name || 'M-Core'; } catch (e) { return 'M-Core'; } }
  function bal(i) { return Math.max(0, Number(i.total || 0) - Number(i.paid_amt || 0)); }
  var MAXREF = 8;

  /* ---------- AR reminders: group selected invoices per customer ---------- */
  var GROUP = {}; // key (oldest selected invoice id) -> { cid, name, phone, email, invs:[] }
  function groups(ids) {
    var t = tid(); if (!t || !ids.length) return Promise.resolve([]);
    return q(sb.from('invoices').select('id,ref_no,customer_id,customer_name,issue_date,due_date,total,paid_amt,status').eq('tenant_id', t).in('id', ids).is('deleted_at', null)).then(function (rows) {
      rows = (rows || []).filter(function (r) { return bal(r) > 0.005 && String(r.status || '').toLowerCase() !== 'cancelled'; });
      var by = {}, order = [];
      rows.sort(function (a, b) { return String(a.due_date || a.issue_date || '').localeCompare(String(b.due_date || b.issue_date || '')); });
      rows.forEach(function (r) { var k = r.customer_id || ('n:' + String(r.customer_name || '-').trim().toLowerCase()); if (!by[k]) { by[k] = { cid: r.customer_id || null, name: r.customer_name || '-', invs: [] }; order.push(k); } by[k].invs.push(r); });
      var cids = order.map(function (k) { return by[k].cid; }).filter(Boolean);
      var cp = cids.length ? q(sb.from('customers').select('id,name,phone,email').eq('tenant_id', t).in('id', cids)).catch(function () { return []; }) : Promise.resolve([]);
      return cp.then(function (cs) {
        var cm = {}; (cs || []).forEach(function (c) { cm[c.id] = c; });
        return order.map(function (k) {
          var g = by[k], c = g.cid && cm[g.cid];
          if (c) { g.name = g.name && g.name !== '-' ? g.name : (c.name || '-'); g.phone = c.phone || ''; g.email = c.email || ''; }
          g.key = g.invs[0].id; GROUP[g.key] = g; return g;
        });
      });
    });
  }
  function vars(g) {
    var tot = g.invs.reduce(function (s, i) { return s + bal(i); }, 0);
    var refs = g.invs.slice(0, MAXREF).map(function (i) { return (i.ref_no || '#') + ' (' + rm(bal(i)) + ')'; }).join(', ') + (g.invs.length > MAXREF ? ' +' + (g.invs.length - MAXREF) : '');
    var due = g.invs[0].due_date || g.invs[0].issue_date;
    return { name: g.name, ref: refs, refs: refs, amt: rm(tot), due: fd(due), total: tot };
  }
  S.groups = groups; S.vars = vars;
  function regShare() {
    if (!window.DKS || S._reg) return; S._reg = true;
    DKS.reg({ doc: 'arrem', mod: 'sales', tpls: ['ar_remind'],
      load: function (id) {
        var g = GROUP[id];
        var p = g ? Promise.resolve([g]) : groups([id]);
        return p.then(function (a) {
          g = a && a[0]; if (!g) return null;
          var v = vars(g);
          return { ref: g.invs.length === 1 ? (g.invs[0].ref_no || '') : L('Payment reminder', 'Peringatan bayaran') + ' · ' + g.invs.length, to: g.name, phone: g.phone || '', recipientKind: 'customer', vars: { name: v.name, refs: v.refs, amt: v.amt, due: v.due } };
        });
      },
      onShared: function (docId) {
        var g = GROUP[docId], t = tid(); if (!g || !t) return;
        var me = null; try { me = APP.user && (APP.user.id || null); } catch (e) {}
        var nm = null; try { nm = (APP.user && (APP.user.name || APP.user.email)) || null; } catch (e) {}
        var rows = g.invs.map(function (i) { return { tenant_id: t, doc_type: 'inv', doc_id: i.id, event: 'shared', actor_id: me, actor_name: nm ? String(nm).slice(0, 120) : null, note: 'WhatsApp · ' + L('payment reminder', 'peringatan bayaran') }; });
        try { Promise.resolve(sb.from('dk_doc_events').insert(rows)).catch(function () {}); } catch (e) {}
      } });
  }
  function waRemind(ids) {
    regShare();
    if (!window.DKS || !DKS.has('arrem')) { toast(L('WhatsApp share is not available — use Email reminders.', 'Kongsi WhatsApp tiada — guna Peringatan e-mel.'), 'warning'); return; }
    return groups(ids).then(function (gs) {
      if (!gs.length) return toast(L('Nothing outstanding in the selection.', 'Tiada baki tertunggak dalam pilihan.'), 'info');
      toast(L(gs.length + ' customer(s) — one reminder each.', gs.length + ' pelanggan — satu peringatan setiap seorang.'), 'info');
      DKS.queue('arrem', gs.map(function (g) { return g.key; }));
    });
  }
  function mailBody(g) {
    var v = vars(g), lang = bm() ? 'bm' : 'en', txt = '';
    try { txt = window.DKS ? DKS.render('ar_remind', lang, { name: v.name, ref: v.ref, refs: v.refs, amt: v.amt, due: v.due, co: co() }) : ''; } catch (e) {}
    if (!txt) txt = L('Hi ', 'Salam ') + v.name + ', ' + v.ref + ' · ' + v.amt;
    return txt;
  }
  function closeModal() { var m = document.getElementById('dk-arm'); if (m) m.remove(); }
  function mailRemind(ids) {
    return groups(ids).then(function (gs) {
      if (!gs.length) return toast(L('Nothing outstanding in the selection.', 'Tiada baki tertunggak dalam pilihan.'), 'info');
      closeModal();
      var subj = L('Payment reminder', 'Peringatan bayaran') + ' — ' + co();
      var h = '<div class="modal-box dk-arm-box" role="dialog" aria-modal="true" aria-labelledby="dk-arm-h"><div class="modal-box-header" id="dk-arm-h">' + esc(L('Email reminders', 'Peringatan e-mel')) + ' · ' + gs.length + '</div><div class="modal-box-body">' +
        '<p class="dk-arm-note">' + esc(L('Each link opens your mail app with the reminder ready. Nothing is sent until you press Send there.', 'Setiap pautan membuka aplikasi e-mel dengan peringatan sedia. Tiada yang dihantar sehingga anda tekan Hantar.')) + '</p>' +
        gs.map(function (g) {
          var v = vars(g), href = 'mailto:' + encodeURIComponent(g.email || '') + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(mailBody(g));
          return '<div class="dk-arm-row"><div class="dk-arm-main"><b>' + esc(g.name) + '</b><small>' + esc(g.invs.length + ' ' + L('invoice(s)', 'invois') + ' · ' + v.amt) + (g.email ? ' · ' + esc(g.email) : ' · ' + esc(L('no email on file', 'tiada e-mel'))) + '</small></div>' +
            '<a class="btn btn-outline btn-sm" href="' + esc(href) + '"><i class="ti ti-mail"></i> ' + esc(L('Email', 'E-mel')) + '</a></div>';
        }).join('') + '</div><div class="modal-box-footer"><button type="button" class="btn btn-outline btn-sm" data-x>' + esc(L('Close', 'Tutup')) + '</button></div></div>';
      var o = document.createElement('div'); o.className = 'modal-overlay active no-print'; o.id = 'dk-arm'; o.innerHTML = h;
      o.addEventListener('click', function (e) { if (e.target === o || (e.target.closest && e.target.closest('[data-x]'))) closeModal(); });
      document.body.appendChild(o);
    });
  }
  S.waRemind = waRemind; S.mailRemind = mailRemind;

  /* ---------- lists ---------- */
  function total(tr) { var c = tr.cells[0]; return !!(c && c.colSpan > 1); }
  function regLists() {
    if (!window.DK || !DK.list) return;
    DK.list({ key: 'coa', sel: '#coa-table-wrap', fns: ['_coaLoad'], title: 1, sub: 0, party: -1, date: -1, amount: -1, status: 2, table: 'chart_of_accounts', emptyText: L('No accounts yet.', 'Belum ada akaun.') });
    DK.list({ key: 'jnl', sel: '#jnl-table-wrap', fns: ['renderJournalList', '_jnlLoadTable'], title: 0, sub: 2, party: -1, date: 1, amount: 4, status: 3, table: 'journal_entries', emptyText: L('No journal entries yet.', 'Belum ada catatan jurnal.') });
    DK.list({ key: 'fy', sel: '#fy-table-wrap', fns: ['renderFiscalYears'], title: 0, sub: 1, party: -1, date: -1, amount: -1, status: 2, emptyText: L('No fiscal years yet.', 'Belum ada tahun kewangan.') });
    DK.list({ key: 'fa', sel: '#fa-list-wrap', fns: ['renderFixedAssets'], title: 1, sub: 0, party: 2, date: 3, amount: 6, status: 7, table: 'fixed_assets', emptyText: L('No fixed assets yet.', 'Belum ada aset tetap.') });
    DK.list({ key: 'pv', sel: '#pv-list-wrap', fns: ['renderPVList', '_pvRenderListTable'], title: 0, sub: 2, party: -1, date: 1, amount: 4, status: 5, table: 'payment_vouchers', emptyText: L('No payment vouchers yet.', 'Belum ada baucar bayaran.') });
    DK.list({ key: 'pvd', sel: '#pvd-list-wrap', fns: ['renderPVDList'], title: 0, sub: 2, party: -1, date: 1, amount: 4, status: 5, emptyText: L('No disbursement batches yet.', 'Belum ada kelompok pembayaran.') });
    DK.list({ key: 'ar', sel: '#ar-aging-body', doc: 'inv', fns: ['renderArAgingReport', '_arAgingApply'], title: 0, sub: 1, party: -1, date: 2, amount: 5, status: -1, table: 'invoices', skip: total,
      emptyText: L('No outstanding customer balances.', 'Tiada baki hutang pelanggan.'),
      bulkActions: [
        { label: L('WhatsApp reminders', 'Peringatan WhatsApp'), icon: 'ti-brand-whatsapp', cls: 'btn-outline dk-wa', run: function (ids) { return waRemind(ids); } },
        { label: L('Email reminders', 'Peringatan e-mel'), icon: 'ti-mail', cls: 'btn-outline', run: function (ids) { return mailRemind(ids); } }] });
    DK.list({ key: 'ap', sel: '#ap-aging-body', fns: ['renderApAgingReport', '_apAgingApply'], title: 0, sub: 1, party: -1, date: 2, amount: 5, status: -1, table: 'supplier_bills', skip: total, bulk: false,
      emptyText: L('No outstanding supplier balances.', 'Tiada baki hutang pembekal.') });
  }
  function css() {
    if (document.getElementById('dk-acct-css')) return;
    var s = document.createElement('style'); s.id = 'dk-acct-css';
    s.textContent = '.dk-arm-box{max-width:520px}.dk-arm-note{margin:0;font-size:12.5px;color:var(--text-3)}' +
      '.dk-arm-row{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;justify-content:space-between;border:1px solid var(--border);border-radius:var(--radius-sm,var(--radius));padding:10px 12px;min-width:0}' +
      '.dk-arm-main{flex:1 1 180px;min-width:0;display:flex;flex-direction:column;gap:2px}.dk-arm-main b{overflow-wrap:anywhere}.dk-arm-main small{color:var(--text-3);overflow-wrap:anywhere}' +
      '.dk-arm-row .btn,.dk-arm-box .modal-box-footer .btn{white-space:nowrap}.dk-arm-box .modal-box-footer{justify-content:flex-end;flex-wrap:wrap}';
    document.head.appendChild(s);
  }
  function boot() {
    if (!window.DK || !document.getElementById('main')) return setTimeout(boot, 300);
    css(); regLists(); regShare();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
