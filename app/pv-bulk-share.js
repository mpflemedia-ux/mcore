/* Payment Vouchers — bulk WhatsApp share v4 (loads after pv-core.js).
   v1 injected a checkbox column into the PV list <table>, which broke dk-acct.js's column->field
   index mapping for the whole list (payee/status/amount all read the wrong cell).
   v2/v3 tried to patch dk-acct.js's DK.list({key:'pv',...}) registration (boot-time, then via a
   render hook) to add a bulkActions entry to dk-cards.js's own built-in multi-select — but the list
   broke again (payee/detail missing, status chips showing amounts) and the "Select" button never
   appeared, for reasons not fully pinned down. Given two attempts at integrating with dk-cards.js
   both regressed the list, this version does not touch the table or the DK registry at all: a
   small floating button opens its own modal with its own checkbox list (built straight from
   window._pvListCache, which renderPVList already populates) and its own role-pick + share step.
   Completely separate DOM, zero interaction with dk-cards.js. */
(function () {
  if (window.PVBS) return;
  window.PVBS = true;
  var X, L, esc, rm;

  function fmtDate(iso) { try { return X.dmy(iso); } catch (e) { return iso || ''; } }

  function ensureButton() {
    var host = document.getElementById('pv-status-filters');
    if (!host || document.getElementById('pvbs-open')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'pvbs-open'; b.className = 'btn btn-outline btn-sm';
    b.innerHTML = '<i class="ti ti-brand-whatsapp"></i> ' + esc(L('Share several for signing', 'Kongsi beberapa untuk tandatangan'));
    b.style.marginLeft = 'auto';
    b.onclick = openPicker;
    host.insertAdjacentElement('afterend', wrapBtn(b));
  }
  function wrapBtn(b) {
    var d = document.createElement('div'); d.className = 'no-print'; d.style.cssText = 'display:flex;margin-bottom:12px'; d.appendChild(b); return d;
  }

  function rowHtml(v) {
    var st = String(v.status || 'draft').toLowerCase();
    return '<label class="pvbs-row" style="display:flex;gap:10px;align-items:center;padding:8px 4px;border-bottom:1px solid var(--border);cursor:pointer">' +
      '<input type="checkbox" class="pvbs-pick" data-id="' + esc(v.id) + '" style="width:18px;height:18px;flex:0 0 auto"' + ((st === 'draft' || st === 'shared') ? '' : ' disabled') + '>' +
      '<span style="flex:1 1 auto;min-width:0"><b style="display:block;font-size:13px">' + esc(v.ref_no || '') + ' · ' + esc(v.payee_name || '') + '</b>' +
      '<small style="color:var(--text-3)">' + esc(fmtDate(v.voucher_date)) + ' · ' + esc(st) + '</small></span>' +
      '<b style="flex:0 0 auto;font-family:\'Space Grotesk\',var(--font)">' + esc(rm(v.amount)) + '</b></label>';
  }

  function openPicker() {
    var rows = window._pvListCache || [];
    if (!rows.length) { X.toast(L('No vouchers loaded.', 'Tiada baucar dimuatkan.'), 'error'); return; }
    var ov = document.createElement('div'); ov.className = 'modal-overlay active';
    ov.innerHTML = '<div class="modal-box" style="max-width:480px" role="dialog" aria-modal="true">' +
      '<div class="modal-box-header"><i class="ti ti-brand-whatsapp"></i> ' + esc(L('Share several for signing', 'Kongsi beberapa untuk tandatangan')) + '</div>' +
      '<div class="modal-box-body">' +
      '<div style="font-size:12px;color:var(--text-3);margin:0 0 8px">' + esc(L('Only Draft / Shared vouchers can be picked.', 'Hanya baucar Draf / Dikongsi boleh dipilih.')) + '</div>' +
      '<div id="pvbs-list" style="max-height:320px;overflow:auto;border:1px solid var(--border);border-radius:var(--radius-sm,var(--radius))">' + rows.map(rowHtml).join('') + '</div>' +
      '<div class="form-group" style="margin-top:12px"><label class="form-label">' + esc(L('Sign as', 'Tandatangan sebagai')) + '</label>' +
      '<select id="pvbs-role" class="form-select">' + X.ROLES.map(function (r) { return '<option value="' + r.r + '">' + esc(X.roleLabel(r.r)) + '</option>'; }).join('') + '</select></div>' +
      '</div>' +
      '<div class="modal-box-footer"><button type="button" class="btn btn-outline" data-x>' + esc(L('Cancel', 'Batal')) + '</button>' +
      '<button type="button" class="btn btn-primary" id="pvbs-share"><i class="ti ti-brand-whatsapp"></i> ' + esc(L('Share', 'Kongsi')) + '</button></div></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    ov.querySelector('[data-x]').onclick = close;
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('#pvbs-share').onclick = function () { shareChecked(ov, rows); };
  }

  async function shareChecked(ov, rows) {
    if (!window.WAD || typeof WAD.base !== 'function') { X.toast(L('WhatsApp share is not available.', 'Kongsi WhatsApp tidak tersedia.'), 'error'); return; }
    var byId = {}; rows.forEach(function (v) { byId[v.id] = v; });
    var ids = [].map.call(ov.querySelectorAll('.pvbs-pick:checked'), function (c) { return c.dataset.id; });
    if (!ids.length) { X.toast(L('Pick at least one voucher.', 'Pilih sekurang-kurangnya satu baucar.'), 'error'); return; }
    var role = ov.querySelector('#pvbs-role').value;
    var btn = ov.querySelector('#pvbs-share'); btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span>';
    var lines = [], failed = [];
    for (var i = 0; i < ids.length; i++) {
      var v = byId[ids[i]];
      try {
        var r = await sb.rpc('pv_sign_link_create', { p_kind: 'pv', p_doc: v.id, p_role: role });
        if (r.error) throw r.error;
        var link = r.data, th = (typeof WAD.theme === 'function') ? WAD.theme() : null;
        var url = WAD.base() + 'public-pv.html?pv_sign=' + encodeURIComponent(link.token) + (APP.language === 'bm' ? '&lang=bm' : '') + (th ? '&theme=' + th : '');
        lines.push({ ref: v.ref_no || '', payee: v.payee_name || '', amount: v.amount, url: url });
        if (String(v.status || 'draft').toLowerCase() === 'draft') { try { X.notify('pv_submitted', { kind: 'pv', id: v.id }); } catch (e) {} }
      } catch (e) {
        failed.push(v.ref_no || v.id);
      }
    }
    if (!lines.length) {
      btn.disabled = false; btn.innerHTML = '<i class="ti ti-brand-whatsapp"></i> ' + esc(L('Share', 'Kongsi'));
      X.toast(L('Could not create any signing links.', 'Gagal cipta sebarang pautan tandatangan.'), 'error');
      return;
    }
    var en = APP.language !== 'bm', who = en ? X.ROLES.filter(function (x) { return x.r === role; })[0].en : X.ROLES.filter(function (x) { return x.r === role; })[0].bm;
    var co = (typeof WAD.company === 'function') ? WAD.company() : (APP.tenant && APP.tenant.name) || 'M-Core';
    var head = en ? 'Hi, please review and sign ' + lines.length + ' Payment Vouchers as ' + who + ' (no login needed):'
      : 'Salam, sila semak dan tandatangan ' + lines.length + ' Baucar Bayaran sebagai ' + who + ' (tiada log masuk):';
    var body = lines.map(function (l) { return '• ' + l.ref + ' — ' + l.payee + ' — ' + rm(l.amount) + '\n  ' + l.url; }).join('\n\n');
    var text = head + '\n\n' + body + '\n\n' + (en ? 'Thank you. – ' : 'Terima kasih. – ') + co;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    if (failed.length) X.toast(L('Shared ' + lines.length + ' · skipped: ', 'Dikongsi ' + lines.length + ' · dilangkau: ') + failed.join(', '), 'warning');
    else X.toast(L('WhatsApp opened with ' + lines.length + ' links.', 'WhatsApp dibuka dengan ' + lines.length + ' pautan.'), 'success');
    ov.remove();
    if (typeof window.renderPVList === 'function') renderPVList();
  }

  function watch() {
    ensureButton();
    setTimeout(watch, 1000);
  }

  function start() {
    if (!window.PVX) { setTimeout(start, 300); return; }
    X = window.PVX; L = X.L; esc = X.esc; rm = X.rm;
    watch();
  }
  start();
})();
