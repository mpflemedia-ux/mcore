/* M-Core back-office support - internal notes on invoice / quotation / booking. Staff + PA only, never printed, never on public pages. PA notes carry no name. Needs bo_support_02.sql. v1 */
(function () {
  if (!window.BO || BO.notes) return;
  var B = BO, E = B.esc, t = B.t;
  B.add({
    en: { nT: 'Internal notes', nD: 'Only your team can see these. Never printed or shown to the customer.', nAdd: 'Add note', nPh: 'Write a note for your team…', nSave: 'Save note', nNone: 'No notes yet.', nDel: 'Delete', nDelQ: 'Delete this note?', nBk: 'Notes' },
    bm: { nT: 'Nota dalaman', nD: 'Hanya pasukan anda boleh lihat. Tidak dicetak dan tidak ditunjuk kepada pelanggan.', nAdd: 'Tambah nota', nPh: 'Tulis nota untuk pasukan anda…', nSave: 'Simpan nota', nNone: 'Belum ada nota.', nDel: 'Padam', nDelQ: 'Padam nota ini?', nBk: 'Nota' }
  });
  var css = document.createElement('style');
  css.textContent = '.bo-nt{border:1px solid var(--border);border-radius:10px;background:var(--bg-card);margin:0 0 12px;font-size:13.5px}.bo-nt>summary{list-style:none;cursor:pointer;padding:10px 12px;display:flex;gap:8px;align-items:center;font-weight:600}' +
    '.bo-nt>summary::-webkit-details-marker{display:none}.bo-nt .bo-nb{padding:0 12px 12px}.bo-ni{border-top:1px solid var(--border);padding:8px 0}.bo-ni p{margin:0;white-space:pre-wrap;word-break:break-word}' +
    '.bo-nm{font-size:12px;color:var(--text-2);margin-top:3px;display:flex;gap:8px;align-items:center}.bo-nm button{background:none;border:0;color:var(--text-2);text-decoration:underline;cursor:pointer;font:inherit;padding:4px 0;min-height:28px}' +
    '.bo-nta{width:100%;box-sizing:border-box;min-height:70px;border:1px solid var(--border-2,var(--border));border-radius:8px;padding:8px 10px;font:inherit;background:var(--bg);color:var(--text);resize:vertical;margin-top:8px}' +
    '.bo-nc{font-size:11.5px;font-weight:700;border-radius:99px;padding:1px 8px;background:var(--primary-light);color:#155E75}[data-theme="dark"] .bo-nc{color:var(--primary)}' +
    '@media print{.bo-nt,.bo-nbtn,#bo-nsh{display:none!important}}';
  document.head.appendChild(css);
  function me() { return B.inS() || B.isPA() ? null : ((window.APP && APP.user && (APP.user.full_name || APP.user.name || APP.user.email)) || null); }
  function list(type, id) { return Promise.resolve(sb.from('doc_notes').select('id,body,created_by,created_by_name,created_at').eq('tenant_id', B.tid()).eq('doc_type', type).eq('doc_id', id).is('deleted_at', null).order('created_at', { ascending: false }).limit(100)).then(function (r) { if (r.error) throw r.error; return r.data || []; }); }
  B.noteAdd = function (type, id, body) { return Promise.resolve(sb.from('doc_notes').insert({ tenant_id: B.tid(), doc_type: type, doc_id: id, body: body, created_by: B.uid(), created_by_name: me() }).select('id').single()).then(function (r) { if (r.error) throw r.error; return r.data; }); };
  function del(nid) { return Promise.resolve(sb.from('doc_notes').update({ deleted_at: new Date().toISOString() }).eq('id', nid).select('id')).then(function (r) { if (r.error) throw r.error; }); }
  /* body renderer shared by the inline block and the booking sheet */
  function body(host, type, id, onCount) {
    host.innerHTML = '<div style="font-size:12.5px;color:var(--text-2);margin-bottom:6px">' + E(t('nD')) + '</div><div data-l><div class="bo-nm">' + E(t('load')) + '</div></div>' +
      '<textarea class="bo-nta" data-no-titlecase="1" maxlength="2000" placeholder="' + E(t('nPh')) + '" aria-label="' + E(t('nAdd')) + '"></textarea><button type="button" class="btn btn-primary btn-sm" data-s style="margin-top:8px"><i class="ti ti-note"></i> ' + E(t('nSave')) + '</button>';
    var L = host.querySelector('[data-l]'), ta = host.querySelector('textarea'), sv = host.querySelector('[data-s]');
    function load() {
      list(type, id).then(function (a) {
        if (onCount) onCount(a.length);
        L.innerHTML = a.length ? a.map(function (n) {
          var mine = n.created_by && n.created_by === B.uid(), can = mine || B.owner();
          return '<div class="bo-ni"><p>' + E(n.body) + '</p><div class="bo-nm"><span>' + E(B.date(n.created_at) + ' ' + B.time(n.created_at) + (n.created_by_name ? ' · ' + n.created_by_name : '')) + '</span>' + (can ? '<button type="button" data-d="' + E(n.id) + '">' + E(t('nDel')) + '</button>' : '') + '</div></div>';
        }).join('') : '<div class="bo-nm" style="padding:4px 0">' + E(t('nNone')) + '</div>';
        L.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { if (!confirm(t('nDelQ'))) return; b.disabled = true; del(b.dataset.d).then(load, function (e) { b.disabled = false; B.toast(t('err') + ((e && e.message) || e), 'error'); }); }; });
      }, function (e) { L.innerHTML = '<div class="bo-nm">' + E(t('err') + ((e && e.message) || e)) + '</div>'; });
    }
    sv.onclick = function () {
      var v = ta.value.trim(); if (!v) return ta.focus();
      sv.disabled = true; B.noteAdd(type, id, v.slice(0, 2000)).then(function () { ta.value = ''; B.toast(t('saved')); load(); }, function (e) { B.toast(t('err') + ((e && e.message) || e), 'error'); }).then(function () { sv.disabled = false; });
    };
    load();
  }
  B.notes = body;
  function inline(type, id) {
    var hd = document.querySelector('#main .page-header'); if (!hd) return;
    var d = document.getElementById('bo-notes');
    if (d && d.dataset.id === id) return;
    if (d) d.remove();
    d = document.createElement('details'); d.id = 'bo-notes'; d.className = 'bo-nt no-print'; d.dataset.id = id;
    d.innerHTML = '<summary><i class="ti ti-lock" aria-hidden="true"></i> ' + E(t('nT')) + ' <span class="bo-nc" data-c>…</span><i class="ti ti-chevron-down" aria-hidden="true" style="margin-left:auto;color:var(--text-3)"></i></summary><div class="bo-nb"></div>';
    var a = document.getElementById('wd2-resp') || document.getElementById('wad-line') || hd; a.parentNode.insertBefore(d, a.nextSibling);
    body(d.querySelector('.bo-nb'), type, id, function (n) { d.querySelector('[data-c]').textContent = n; });
  }
  function sheet(id) {
    var bg = document.createElement('div'); bg.className = 'wad-bg'; bg.id = 'bo-nsh';
    bg.onclick = function (e) { if (e.target === bg) bg.remove(); };
    bg.innerHTML = '<div class="wad-sh" role="dialog" aria-modal="true"><div class="wad-grab"></div><div class="wad-hd"><div class="wad-ti"><i class="ti ti-lock"></i> ' + E(t('nT')) + '</div><button class="btn btn-outline btn-sm" data-x>' + E(t('close')) + '</button></div><div data-b style="margin-top:10px"></div></div>';
    document.body.appendChild(bg); bg.querySelector('[data-x]').onclick = function () { bg.remove(); };
    body(bg.querySelector('[data-b]'), 'booking', id, function (n) { var b = document.querySelector('[data-bo-bk="' + id + '"] b'); if (b) b.textContent = n ? ' · ' + n : ''; });
  }
  var pend = {};
  function ok() { return B.has('doc_notes'); }
  function scan() {
    [['inv', '_invPublicLink'], ['quo', '_quoPublicLink']].forEach(function (x) {
      var pb = document.querySelector('#main button[onclick^="' + x[1] + "('" + '"]'); if (!pb) return;
      var id = (pb.getAttribute('onclick').match(/\('([^']+)'/) || [])[1]; if (!id) return;
      var cur = document.getElementById('bo-notes'); if (cur && cur.dataset.id === id && cur.isConnected) return;
      if (pend[id]) return; pend[id] = 1;
      ok().then(function (y) { pend[id] = 0; if (y && B.tid() && pb.isConnected) inline(x[0], id); });
    });
    var rows = document.querySelectorAll('#db-sec-booking details[data-bk-row]:not([data-bon])'); if (!rows.length) return;
    rows.forEach(function (r) { r.dataset.bon = '1'; });
    ok().then(function (y) {
      if (!y) return; var ids = [];
      rows.forEach(function (r) {
        var act = r.querySelector('[data-bk-act="amend"]'); if (!act) return; var id = r.dataset.bkRow; ids.push(id);
        var b = document.createElement('button'); b.type = 'button'; b.className = 'db-btn bo-nbtn no-print'; b.dataset.boBk = id; b.innerHTML = '<i class="ti ti-lock"></i> ' + E(t('nBk')) + '<b></b>';
        b.onclick = function (e) { e.preventDefault(); sheet(id); }; act.parentNode.insertBefore(b, act);
      });
      if (ids.length) sb.from('doc_notes').select('doc_id').eq('tenant_id', B.tid()).eq('doc_type', 'booking').in('doc_id', ids).is('deleted_at', null).then(function (q) {
        var n = {}; (q.data || []).forEach(function (x) { n[x.doc_id] = (n[x.doc_id] || 0) + 1; });
        Object.keys(n).forEach(function (k) { var b = document.querySelector('[data-bo-bk="' + k + '"] b'); if (b) b.textContent = ' · ' + n[k]; });
      }, function () {});
    });
  }
  var tm = 0;
  new MutationObserver(function () { if (!tm) tm = setTimeout(function () { tm = 0; try { scan(); } catch (e) {} }, 180); }).observe(document.body, { childList: true, subtree: true });
})();
