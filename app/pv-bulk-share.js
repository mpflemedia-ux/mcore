/* Payment Vouchers — bulk WhatsApp share v2 (loads after pv-core.js, pv-signatures.js, dk-cards.js).
   v1 injected a checkbox <td> into the PV list <table> itself — that shifted every column index by
   one and broke dk-cards.js's column->field mapping for the whole list (payee name, status, amount
   all read the wrong cell). dk-cards.js already HAS its own generic multi-select ("Select" toggle +
   checkboxes on each card + a bulk-actions bar) via DK.list({..., bulkActions:[{label,icon,cls,run}]})
   — exactly how AR Aging's "WhatsApp reminders" bulk action works (dk-acct.js). This version adds a
   bulkActions entry to the EXISTING 'pv' registration (also from dk-acct.js) instead of touching the
   table, so the table's real column layout is never disturbed.
   Action: pick one signature role, generate a pv_sign_link_create token for every selected PV (same
   RPC the single-PV Share button already uses), open ONE WhatsApp compose with all the links. */
(function () {
  if (window.PVBS) return;
  window.PVBS = true;

  function boot() {
    if (!window.DK || typeof DK.list !== 'function' || !window.PVX) return setTimeout(boot, 300);
    var existing = (DK.lists || []).filter(function (c) { return c.key === 'pv'; })[0];
    if (!existing) return setTimeout(boot, 300); // wait for dk-acct.js's own 'pv' registration first
    if (existing.__pvbs) return; // already patched
    var cfg = {}; for (var k in existing) cfg[k] = existing[k];
    cfg.bulkActions = (existing.bulkActions || []).concat([{
      label: X.L('Share for signing', 'Kongsi untuk tandatangan'), icon: 'ti-brand-whatsapp', cls: 'btn-outline dk-wa',
      run: run
    }]);
    cfg.__pvbs = true;
    DK.list(cfg);
  }

  var X, L, esc, rm;
  function initX() { X = window.PVX; L = X.L; esc = X.esc; rm = X.rm; }

  function pickRole() {
    return new Promise(function (resolve) {
      var ov = document.createElement('div'); ov.className = 'modal-overlay active';
      ov.innerHTML = '<div class="modal-box" style="max-width:380px" role="dialog" aria-modal="true">' +
        '<div class="modal-box-header"><i class="ti ti-signature"></i> ' + esc(L('Share for signing as…', 'Kongsi untuk tandatangan sebagai…')) + '</div>' +
        '<div class="modal-box-body"><div class="form-group" style="margin:0"><select id="pvbs-role-pick" class="form-select">' +
        X.ROLES.map(function (r) { return '<option value="' + r.r + '">' + esc(X.roleLabel(r.r)) + '</option>'; }).join('') +
        '</select></div></div>' +
        '<div class="modal-box-footer"><button type="button" class="btn btn-outline" data-x>' + esc(L('Cancel', 'Batal')) + '</button>' +
        '<button type="button" class="btn btn-primary" data-ok>' + esc(L('Continue', 'Teruskan')) + '</button></div></div>';
      document.body.appendChild(ov);
      function close(v) { ov.remove(); resolve(v); }
      ov.querySelector('[data-x]').onclick = function () { close(null); };
      ov.addEventListener('click', function (e) { if (e.target === ov) close(null); });
      ov.querySelector('[data-ok]').onclick = function () { close(ov.querySelector('#pvbs-role-pick').value); };
    });
  }

  function roleText(lines, role, lang, co) {
    var en = lang !== 'bm', who = en ? X.ROLES.filter(function (x) { return x.r === role; })[0].en : X.ROLES.filter(function (x) { return x.r === role; })[0].bm;
    var head = en ? 'Hi, please review and sign ' + lines.length + ' Payment Vouchers as ' + who + ' (no login needed):'
      : 'Salam, sila semak dan tandatangan ' + lines.length + ' Baucar Bayaran sebagai ' + who + ' (tiada log masuk):';
    var body = lines.map(function (l) { return '• ' + l.ref + ' — ' + l.payee + ' — ' + rm(l.amount) + '\n  ' + l.url; }).join('\n\n');
    return head + '\n\n' + body + '\n\n' + (en ? 'Thank you. – ' : 'Terima kasih. – ') + co;
  }

  async function run(ids, its) {
    if (!window.WAD || typeof WAD.base !== 'function') { X.toast(L('WhatsApp share is not available.', 'Kongsi WhatsApp tidak tersedia.'), 'error'); return; }
    var role = await pickRole();
    if (!role) return;
    var lines = [], failed = [];
    for (var i = 0; i < its.length; i++) {
      var it = its[i];
      try {
        var r = await sb.rpc('pv_sign_link_create', { p_kind: 'pv', p_doc: it.id, p_role: role });
        if (r.error) throw r.error;
        var link = r.data, th = (typeof WAD.theme === 'function') ? WAD.theme() : null;
        var url = WAD.base() + 'public-pv.html?pv_sign=' + encodeURIComponent(link.token) + (APP.language === 'bm' ? '&lang=bm' : '') + (th ? '&theme=' + th : '');
        lines.push({ ref: it.title || '', payee: it.sub || '', amount: it.amtN || 0, url: url });
        if (/^draf/i.test(it.st || '')) { try { X.notify('pv_submitted', { kind: 'pv', id: it.id }); } catch (e) {} }
      } catch (e) {
        failed.push(it.title || it.id);
      }
    }
    if (!lines.length) { X.toast(L('Could not create any signing links.', 'Gagal cipta sebarang pautan tandatangan.'), 'error'); return; }
    var text = roleText(lines, role, APP.language, (typeof WAD.company === 'function') ? WAD.company() : (APP.tenant && APP.tenant.name) || 'M-Core');
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    if (failed.length) X.toast(L('Shared ' + lines.length + ' · skipped: ', 'Dikongsi ' + lines.length + ' · dilangkau: ') + failed.join(', '), 'warning');
    else X.toast(L('WhatsApp opened with ' + lines.length + ' links.', 'WhatsApp dibuka dengan ' + lines.length + ' pautan.'), 'success');
  }

  function start() {
    if (!window.PVX) return setTimeout(start, 300);
    initX();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
  start();
})();
