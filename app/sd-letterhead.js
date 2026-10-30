/* M-Core Service Desk - tenant Settings "Letterhead" card: upload/replace a PDF letterhead,
   used by the SR agent for drafted documents. Stored at service-files/<tenant>/_letterhead/
   (reuses the existing Service Desk storage bucket) + tenants.config->letterhead (path,
   updated_at) via the existing merge_tenant_config RPC -- same pattern as config->company_profile,
   no new table/column. Chains SD.settingsHook (loaded after sd-consent.js) rather than
   overwriting it, so both Settings cards (Support Access + Letterhead) show up. */
(function () {
  var SD = window.SD; if (!SD || SD._letterhead) return; SD._letterhead = 1;
  var prevHook = SD.settingsHook;
  SD.settingsHook = function () {
    if (typeof prevHook === 'function') prevHook();
    if (!SD.has.desk || !SD.isTA() || SD.isPA() || APP.currentPage !== 'settings') return;
    var m = SD.main(); if (!m || document.getElementById('sd-lh-card')) return;
    paint(m);
  };
  function paint(m) {
    var cfg = (APP.tenant && APP.tenant.config && APP.tenant.config.letterhead) || {};
    var d = document.createElement('div'); d.id = 'sd-lh-card'; d.className = 'card'; d.style.cssText = 'padding:14px 16px;margin-bottom:16px';
    d.innerHTML = '<div class="row" style="gap:12px;align-items:center;flex-wrap:wrap">' +
      '<i class="ti ti-file-text" style="font-size:22px;color:var(--primary)"></i>' +
      '<div style="flex:1;min-width:160px"><b>' + SD.L('Letterhead', 'Kepala Surat') + '</b><div style="font-size:12.5px;color:var(--text-3)">' + (cfg.path ? SD.L('Uploaded', 'Dimuat naik') + (cfg.updated_at ? ' · ' + SD.dt(cfg.updated_at) : '') : SD.L('Used by the service agent for drafted documents', 'Digunakan oleh agent servis untuk dokumen yang dijana')) + '</div></div>' +
      (cfg.path ? '<button class="btn btn-outline btn-sm" id="sd-lh-view"><i class="ti ti-eye"></i> ' + SD.L('View', 'Lihat') + '</button>' : '') +
      '<label class="btn btn-outline btn-sm" style="cursor:pointer"><i class="ti ti-upload"></i> ' + (cfg.path ? SD.L('Replace', 'Ganti') : SD.L('Upload', 'Muat naik')) + '<input type="file" accept="application/pdf" id="sd-lh-input" style="display:none"></label></div>' +
      '<div id="sd-lh-status" style="font-size:11px;color:var(--text-3);margin-top:6px"></div>';
    var ph = m.querySelector('.page-header'); if (ph && ph.parentNode === m) ph.after(d); else m.insertBefore(d, m.firstChild);
    var input = d.querySelector('#sd-lh-input');
    if (input) input.onchange = function () { upload(d, input); };
    var vw = d.querySelector('#sd-lh-view'); if (vw) vw.onclick = function () { SD.download(cfg.path); };
  }
  function upload(d, input) {
    var f = input.files[0]; input.value = ''; if (!f) return;
    var status = d.querySelector('#sd-lh-status');
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { SD.toast(SD.L('PDF only.', 'PDF sahaja.'), 'error'); return; }
    if (f.size > 10485760) { SD.toast(SD.L('Max 10 MB.', 'Maks 10 MB.'), 'error'); return; }
    status.textContent = SD.L('Uploading…', 'Memuat naik…');
    var path = SD.tid() + '/_letterhead/' + Date.now() + '-letterhead.pdf', nowIso = new Date().toISOString();
    sb.storage.from('service-files').upload(path, f, { contentType: 'application/pdf', upsert: false }).then(function (u) {
      if (u.error) throw u.error;
      return sb.rpc('merge_tenant_config', { p_tenant_id: SD.tid(), p_patch: { letterhead: { path: path, updated_at: nowIso } } });
    }).then(function (r) {
      if (r && r.error) throw r.error;
      APP.tenant.config = Object.assign({}, APP.tenant.config, { letterhead: { path: path, updated_at: nowIso } });
      SD.toast(SD.L('Saved.', 'Disimpan.'), 'success');
      d.remove(); paint(SD.main());
    }).catch(function (e) { status.textContent = ''; SD.toast(SD.err(e), 'error'); });
  }
})();
