/* dk-ops.js — DK Phase 4 · Operations (CRM, petty cash, products, stock, work orders, HR employees & applicants, POS history & shifts).
   Lists → DK.list cards at all widths (search, status chips, date chips, lazy load). Employees keep their bulk delete via card selection.
   Work order detail → generated WO slip document card (PDF / Print, light A4) + issued/completed signatures + timeline.
   Notifications: supabase/dk_phase4_ops.sql (server-side, no amounts). EN/BM, existing tokens only. */
(function () {
  if (window.DKOps) return;
  var S = window.DKOps = { v: 1 };
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }
  function fd(d) { return d ? (window.DK ? DK.date(d) : String(d).slice(0, 10)) : '-'; }
  function tid() { try { return APP.tenant.id; } catch (e) { return null; } }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }
  function main() { return document.getElementById('main'); }
  function cur() { return (window.DK && DK.cur) || { page: '', params: {} }; }
  function q(p) { return Promise.resolve(p).then(function (r) { if (r && r.error) throw r.error; return r ? r.data : null; }); }
  function slug(s) { return String(s || 'doc').replace(/[^A-Za-z0-9_-]+/g, '_'); }
  function tenant() { try { return typeof _pdocGetTenant === 'function' ? Promise.resolve(_pdocGetTenant()).catch(function () { return APP.tenant || {}; }) : Promise.resolve(APP.tenant || {}); } catch (e) { return Promise.resolve({}); } }
  function coSub(t) { var a = ''; try { a = typeof _pdocAddressLine === 'function' ? _pdocAddressLine(t) : (t.address || ''); } catch (e) {} return [a, t.phone].filter(Boolean).join(' · '); }
  function pname(p) { if (!p) return '-'; try { if (typeof prodName === 'function') return prodName(p); } catch (e) {} return (bm() ? p.name_bm : p.name_en) || p.name_en || p.name_bm || p.name || '-'; }
  function busy(b, p) { if (b) { b.disabled = true; b.classList.add('dk-busy'); } return Promise.resolve(p).catch(function (e) { toast(L('Failed: ', 'Gagal: ') + (e && e.message || e), 'error'); }).then(function () { if (b) { b.disabled = false; b.classList.remove('dk-busy'); } }); }
  var WST = { pending: ['Pending', 'Menunggu'], in_progress: ['In Progress', 'Dalam Proses'], completed: ['Completed', 'Selesai'], cancelled: ['Cancelled', 'Dibatalkan'] };
  function wst(s) { var x = WST[s]; return x ? L(x[0], x[1]) : (s || '-'); }
  function blankSigs(names) { return ['issued', 'completed'].map(function (s, i) { return { label: window.DKSign ? DKSign.slotLabel('wo', s) : s, name: (names || [])[i] || '', at: '' }; }); }
  function sigs(id, names) { var b = blankSigs(names); if (!window.DKSign || !DKSign.has('wo')) return Promise.resolve(b); return DKSign.sigsFor('wo', id).then(function (a) { return a && a.length ? a : b; }, function () { return b; }); }

  /* ---------- Work order slip ---------- */
  function woData(id) {
    var t = tid(); if (!t || !window.sb) return Promise.resolve(null);
    return Promise.all([
      q(sb.from('work_orders').select('*,products(name_en,name_bm,code,unit,stock_qty),user_profiles(full_name)').eq('id', id).eq('tenant_id', t).maybeSingle()),
      tenant()
    ]).then(function (a) {
      var w = a[0]; if (!w) return null;
      var bom = Array.isArray(w.bom_snapshot) ? w.bom_snapshot : [], ids = bom.map(function (c) { return c.component_id; }).filter(Boolean);
      var pr = ids.length ? q(sb.from('products').select('id,name_en,name_bm,code,unit').eq('tenant_id', t).in('id', ids)).catch(function () { return []; }) : Promise.resolve([]);
      return pr.then(function (ps) { var map = {}; (ps || []).forEach(function (p) { map[p.id] = p; }); return { w: w, t: a[1] || {}, bom: bom, map: map }; });
    });
  }
  function woRef(w) { return w.ref_no || w.wo_no || ('WO-' + String(w.id || '').slice(0, 8).toUpperCase()); }
  function woModel(d) {
    var w = d.w, t = d.t, p = w.products || {}, ref = woRef(w), unit = p.unit || '';
    var m = { co: t.name || (APP.tenant && APP.tenant.name) || '', sub: coSub(t), logo: t.logo_url || '', title: L('WORK ORDER', 'ARAHAN KERJA'),
      meta: [{ k: L('WO No.', 'No. WO'), v: ref }, { k: L('Date', 'Tarikh'), v: fd(w.created_at) }, { k: L('Status', 'Status'), v: wst(w.status) }, { k: L('Assigned to', 'Ditugaskan kepada'), v: (w.user_profiles && w.user_profiles.full_name) || '-' }],
      party: { name: pname(p), lines: [p.code ? L('SKU: ', 'SKU: ') + p.code : '', L('Quantity to produce: ', 'Kuantiti dikeluarkan: ') + (w.qty_to_produce == null ? '-' : w.qty_to_produce) + (unit ? ' ' + unit : '')].filter(Boolean) },
      cols: [L('Material / component', 'Bahan / komponen'), L('Code', 'Kod'), L('Qty needed', 'Kuantiti diperlukan')],
      rows: [], tots: [], notes: [], sigs: [], foot: t.name || '', file: 'WO_' + slug(ref) };
    if (w.completed_at) m.meta.push({ k: L('Completed', 'Disiapkan'), v: fd(w.completed_at) });
    if (d.bom.length) d.bom.forEach(function (c, i) { var cp = d.map[c.component_id]; m.rows.push([cp ? pname(cp) : '-', (cp && cp.code) || '', String(c.qty_needed == null ? '-' : c.qty_needed) + (cp && cp.unit ? ' ' + cp.unit : '')]); });
    else m.rows.push([w.materials_needed || L('No bill of materials recorded.', 'Tiada senarai bahan direkodkan.'), '', '-']);
    if (d.bom.length && w.materials_needed) m.notes.push({ k: L('Materials notes', 'Nota bahan'), v: w.materials_needed });
    if (w.notes) m.notes.push({ k: L('Notes', 'Nota'), v: w.notes });
    return m;
  }
  function mountWo(id) {
    var M = main(), hd = M && M.querySelector('.page-header'); if (!hd || M.dataset.dkWo === id) return;
    var info = hd.nextElementSibling; if (!info || !info.classList.contains('card') || !document.getElementById('wo-status-select')) return;
    M.dataset.dkWo = id;
    woData(id).then(function (d) {
      if (!d || !hd.isConnected) return;
      var m = woModel(d), p = DKD.paper(m);
      p.style.display = 'none'; p.classList.add('print-only');
      info.parentNode.insertBefore(p, info.nextSibling);
      var r = DKD.mount(p, { doc: 'wo', id: id, model: m, ref: woRef(d.w), partyLabel: L('Product', 'Produk'), name: m.file + '.pdf', title: m.file, print: false,
        actions: [{ label: L('Print', 'Cetak'), icon: 'ti-printer', cls: 'btn-outline', onClick: function (b) { woSlip(id, 'print', b); } }] }); // print with issued/completed boxes
      if (!r) return;
      p.style.display = '';
      r.el.style.maxWidth = '700px'; r.el.style.margin = '16px 0 0';
    }).catch(function (e) { console.warn('[dk-ops] wo', e); delete M.dataset.dkWo; });
  }
  S.woModel = woModel; S.woData = woData;
  function woSlip(id, how, b) {
    return busy(b, woData(id).then(function (d) {
      if (!d) return; var m = woModel(d);
      if (how === 'pdf') return DKD.file(m, m.file + '.pdf').then(DKD.download);
      return sigs(id, []).then(function (s) {
        m.sigs = s; var p = DKD.paper(m, { cls: 'dk-tmp' }); DKD.sigBoxes(p, s); (main() || document.body).appendChild(p);
        var gone = false, rm = function () { if (gone) return; gone = true; p.remove(); window.removeEventListener('afterprint', rm); };
        window.addEventListener('afterprint', rm); DKD.printOne(p, { title: m.file }); setTimeout(rm, 4500);
      });
    }));
  }

  /* ---------- lists ---------- */
  function regLists() {
    if (!window.DK || !DK.list) return;
    DK.list({ key: 'crm', sel: '#crm-table-wrap', fns: ['_crmLoad'], title: 0, sub: 2, party: -1, date: 5, amount: -1, status: -1, table: 'customers', emptyText: L('No customers yet.', 'Belum ada pelanggan.') });
    DK.list({ key: 'pc', sel: '#pc-list-wrap', fns: ['_pcLoadList'], title: 0, sub: -1, party: -1, date: 1, amount: 4, status: 5, table: 'petty_cash_floats', emptyText: L('No petty cash funds yet.', 'Belum ada dana tunai runcit.') });
    DK.list({ key: 'prod', sel: '#inv-table-wrap', fns: ['_invLoad'], title: 1, sub: 0, party: 2, date: -1, amount: 3, status: -1, table: 'products', emptyText: L('No products yet.', 'Belum ada produk.') });
    DK.list({ key: 'stock', sel: '#stock-table-wrap', fns: ['_stockLoadData', '_stockRenderTable'], title: 1, sub: 2, party: -1, date: 0, amount: -1, status: -1, emptyText: L('No stock movements yet.', 'Belum ada pergerakan stok.') });
    DK.list({ key: 'wo', sel: '#wo-list-wrap', doc: 'wo', fns: ['renderWOList', '_woRenderListTable'], title: 1, sub: 2, party: 3, date: 0, amount: -1, status: 4, table: 'work_orders', emptyText: L('No work orders yet.', 'Belum ada arahan kerja.'),
      extra: function (it) { return [
        { label: 'PDF', icon: 'ti-file-download', onClick: function (b) { woSlip(it.id, 'pdf', b); } },
        { label: L('Print', 'Cetak'), icon: 'ti-printer', onClick: function (b) { woSlip(it.id, 'print', b); } }]; } });
    DK.list({ key: 'emp', sel: '#emp-list-wrap', fns: ['renderEmployeeList'], title: 1, sub: 3, party: -1, date: -1, amount: -1, status: -1, table: 'employees', emptyText: L('No employees yet.', 'Belum ada pekerja.'),
      bulkActions: [{ label: L('Delete selected', 'Padam dipilih'), icon: 'ti-trash', cls: 'btn-outline dk-danger', run: function (ids) {
        if (typeof _hrEmpBulkDelete !== 'function') return;
        [].forEach.call(document.querySelectorAll('.hr-emp-check'), function (c) { c.checked = ids.indexOf(c.value) >= 0; });
        return _hrEmpBulkDelete();
      } }] });
    DK.list({ key: 'app', sel: '#app-list-wrap', fns: ['renderApplicantList', '_appRenderListTable'], title: 0, sub: 1, party: -1, date: 2, amount: -1, status: 3, table: 'job_applicants', emptyText: L('No applicants yet.', 'Belum ada pemohon.') });
    DK.list({ key: 'posh', sel: '#pos-hist-wrap', fns: ['_poshLoadTable', 'renderPOSHistory'], title: 0, sub: 4, party: 1, date: 2, amount: 3, status: 5, table: 'pos_transactions', emptyText: L('No POS sales in this range.', 'Tiada jualan POS dalam julat ini.') });
    DK.list({ key: 'shift', sel: '#poshift-wrap', fns: ['renderPOSShifts'], title: 0, sub: -1, party: -1, date: 1, amount: 4, status: 9, emptyText: L('No shifts in this range.', 'Tiada syif dalam julat ini.') });
  }
  function css() {
    if (document.getElementById('dk-ops-css')) return;
    var s = document.createElement('style'); s.id = 'dk-ops-css';
    s.textContent = '.btn.dk-danger{color:var(--danger);border-color:var(--danger)}.btn.dk-danger:hover{background:var(--danger);color:var(--bg-card)}';
    document.head.appendChild(s);
  }

  var tmr = null;
  function scan() {
    var c = cur(), p = c.params || {}; if (!main() || !window.DKD) return;
    try {
      if (c.page === 'production' && p.view === 'wo-detail' && p.id) mountWo(p.id);
      else delete main().dataset.dkWo;
    } catch (e) { console.warn('[dk-ops]', e); }
  }
  S.scan = scan;
  function boot() {
    if (!window.DK || !window.DKD || !document.getElementById('main')) return setTimeout(boot, 300);
    css(); regLists();
    new MutationObserver(function () { clearTimeout(tmr); tmr = setTimeout(scan, 120); }).observe(document.getElementById('main'), { childList: true });
    scan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
