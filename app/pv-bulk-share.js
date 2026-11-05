/* Payment Vouchers — bulk WhatsApp share v1 (loads after pv-core.js, pv-signatures.js).
   PV list only renders a plain <table> (index.html renderPVList/_pvRenderListTable); mobile
   card look comes from dk-cards.js auto-converting it client-side, so this patches the table
   render, not a dedicated card component.
   Adds a checkbox per draft/shared row + a sticky action bar: pick one signature role, generate
   a pv_sign_link_create token for every selected PV (same RPC the single-PV Share button uses —
   requires the real signed-in session, same as every other PV flow), and open ONE WhatsApp
   compose with all links in one message instead of one link per PV. */
(function () {
  if (window.PVBS || !window.PVX) return;
  window.PVBS = true;
  var X = window.PVX, L = X.L, esc = X.esc, rm = X.rm;
  var SEL = {};

  function selIds() { return Object.keys(SEL); }

  function idFromRow(tr) {
    var m = /id:'([0-9a-f-]{36})'/.exec(tr.getAttribute('onclick') || '');
    return m ? m[1] : null;
  }

  function paintChecks() {
    document.querySelectorAll('#pv-list-wrap input[data-pvbs]').forEach(function (cb) {
      cb.checked = !!SEL[cb.dataset.pvbs];
    });
  }

  function clearSel() { SEL = {}; paintBar(); paintChecks(); }

  function barHtml() {
    var n = selIds().length;
    if (!n) return '';
    return '<div id="pvbs-bar" style="position:sticky;bottom:10px;z-index:5;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-lg);padding:10px 14px;margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<b>' + n + ' ' + esc(L('selected', 'dipilih')) + '</b>' +
      '<select id="pvbs-role" class="form-select" style="width:auto">' + X.ROLES.map(function (r) { return '<option value="' + r.r + '">' + esc(X.roleLabel(r.r)) + '</option>'; }).join('') + '</select>' +
      '<button type="button" class="btn btn-primary btn-sm" id="pvbs-go"><i class="ti ti-brand-whatsapp"></i> ' + esc(L('Share all for signing', 'Kongsi semua untuk tandatangan')) + '</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="pvbs-clear">' + esc(L('Clear', 'Kosongkan')) + '</button>' +
      '</div>';
  }

  function paintBar() {
    var wrap = document.getElementById('pv-list-wrap');
    if (!wrap) return;
    var old = document.getElementById('pvbs-bar');
    if (old) old.remove();
    var html = barHtml();
    if (!html) return;
    wrap.insertAdjacentHTML('afterend', html);
    document.getElementById('pvbs-go').onclick = go;
    document.getElementById('pvbs-clear').onclick = clearSel;
  }

  function injectCheckboxes() {
    var table = document.querySelector('#pv-list-wrap table');
    if (!table) { paintBar(); return; }
    var thead = table.querySelector('thead tr');
    if (thead && !thead.querySelector('[data-pvbs-h]')) {
      var th = document.createElement('th'); th.setAttribute('data-pvbs-h', '1'); th.style.width = '28px';
      thead.insertBefore(th, thead.firstChild);
    }
    var byId = {}; (window._pvListCache || []).forEach(function (v) { byId[v.id] = v; });
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      if (tr.querySelector('[data-pvbs]')) return;
      var id = idFromRow(tr);
      var v = id && byId[id];
      var st = v ? String(v.status || 'draft').toLowerCase() : '';
      var td = document.createElement('td');
      td.onclick = function (e) { e.stopPropagation(); };
      if (v && (st === 'draft' || st === 'shared')) {
        td.innerHTML = '<input type="checkbox" data-pvbs="' + id + '" style="width:16px;height:16px">';
      }
      tr.insertBefore(td, tr.firstChild);
      if (v && (st === 'draft' || st === 'shared')) {
        td.querySelector('input').onchange = function (e) {
          if (e.target.checked) SEL[id] = v; else delete SEL[id];
          paintBar();
        };
      }
    });
    paintChecks();
    paintBar();
  }

  var E_SEP = '\n  ';
  function roleText(lines, role, lang, co) {
    var en = lang !== 'bm', who = en ? X.ROLES.filter(function (x) { return x.r === role; })[0].en : X.ROLES.filter(function (x) { return x.r === role; })[0].bm;
    var head = en ? 'Hi, please review and sign ' + lines.length + ' Payment Vouchers as ' + who + ' (no login needed):'
      : 'Salam, sila semak dan tandatangan ' + lines.length + ' Baucar Bayaran sebagai ' + who + ' (tiada log masuk):';
    var body = lines.map(function (l) { return '• ' + l.ref + ' — ' + l.payee + ' — ' + rm(l.amount) + E_SEP + l.url; }).join('\n\n');
    return head + '\n\n' + body + '\n\n' + (en ? 'Thank you. – ' : 'Terima kasih. – ') + co;
  }

  async function go() {
    if (!window.WAD || typeof WAD.base !== 'function') { X.toast(L('WhatsApp share is not available.', 'Kongsi WhatsApp tidak tersedia.'), 'error'); return; }
    var sel = document.getElementById('pvbs-role'), role = sel ? sel.value : 'first';
    var ids = selIds();
    if (!ids.length) return;
    var btn = document.getElementById('pvbs-go');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span>'; }
    var lines = [], failed = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i], v = SEL[id];
      try {
        var r = await sb.rpc('pv_sign_link_create', { p_kind: 'pv', p_doc: id, p_role: role });
        if (r.error) throw r.error;
        var link = r.data, th = (window.WAD && typeof WAD.theme === 'function') ? WAD.theme() : null;
        var url = WAD.base() + 'public-pv.html?pv_sign=' + encodeURIComponent(link.token) + (APP.language === 'bm' ? '&lang=bm' : '') + (th ? '&theme=' + th : '');
        lines.push({ ref: v.ref_no || '', payee: v.payee_name || '', amount: v.amount, url: url });
        if (String(v.status || 'draft').toLowerCase() === 'draft') { try { X.notify('pv_submitted', { kind: 'pv', id: id }); } catch (e) {} }
      } catch (e) {
        failed.push((v && v.ref_no) || id);
      }
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-brand-whatsapp"></i> ' + esc(L('Share all for signing', 'Kongsi semua untuk tandatangan')); }
    if (!lines.length) { X.toast(L('Could not create any signing links.', 'Gagal cipta sebarang pautan tandatangan.'), 'error'); return; }
    var text = roleText(lines, role, APP.language, (window.WAD && typeof WAD.company === 'function') ? WAD.company() : (APP.tenant && APP.tenant.name) || 'M-Core');
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    if (failed.length) X.toast(L('Shared ' + lines.length + ' · skipped: ', 'Dikongsi ' + lines.length + ' · dilangkau: ') + failed.join(', '), 'warning');
    else X.toast(L('WhatsApp opened with ' + lines.length + ' links.', 'WhatsApp dibuka dengan ' + lines.length + ' pautan.'), 'success');
    clearSel();
    if (typeof window.renderPVList === 'function') renderPVList();
  }

  var origTable = window._pvRenderListTable;
  if (typeof origTable === 'function') {
    window._pvRenderListTable = function () {
      var r = origTable.apply(this, arguments);
      setTimeout(injectCheckboxes, 0);
      return r;
    };
  }
  var origList = window.renderPVList;
  if (typeof origList === 'function') {
    window.renderPVList = function () {
      SEL = {};
      return origList.apply(this, arguments);
    };
  }
})();
