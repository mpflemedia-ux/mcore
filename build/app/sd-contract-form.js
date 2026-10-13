/* M-Core Service Desk - admin contract form (create/edit) for the 'Kontrak Servis' tab. */
(function () {
  var SD = window.SD; if (!SD || SD._cform) return; SD._cform = 1;
  var S = SD.CS || { tenants: [] }, tName = function (id) { return SD.cTenant ? SD.cTenant(id) : ''; };
  SD.cForm = function (c) {
    c = c || {};
    var on = c.services || (SD.catalogList || []).map(function (x) { return x.code; });
    var pay = c.payment_status || 'unpaid';
    var fg = function (l, h) { return '<div class="form-group" style="margin-bottom:12px"><label class="form-label">' + l + '</label>' + h + '</div>'; };
    return '<form class="cob-card" style="padding:16px" id="sd-form" autocomplete="off"><b style="font-size:15px;display:block;margin-bottom:12px">' + SD.L('Contract details', 'Butiran kontrak') + '</b>' +
      fg(SD.L('Client', 'Klien'), '<input class="form-input" data-no-titlecase="1" id="sd-t" list="sd-tl" required placeholder="' + SD.L('Type to filter…', 'Taip untuk tapis…') + '" value="' + SD.esc(c.tenant_id ? tName(c.tenant_id) : '') + '"><datalist id="sd-tl">' + (SD.CS||S).tenants.map(function (t) { return '<option value="' + SD.esc(t.name) + '">'; }).join('') + '</datalist>') +
      '<div class="cob-g2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + fg(SD.L('Start date', 'Tarikh mula'), '<input type="date" class="form-input" id="sd-s" required value="' + (c.start_date || SD.monthStart()) + '">') +
      fg(SD.L('End date', 'Tarikh tamat'), '<input type="date" class="form-input" id="sd-e" required value="' + (c.end_date || '') + '">') +
      fg(SD.L('Invoice ref', 'Rujukan invois'), '<input class="form-input" data-no-titlecase="1" id="sd-i" value="' + SD.esc(c.invoice_ref || '') + '" placeholder="INV-…">') +
      fg(SD.L('Payment status', 'Status bayaran'), '<div class="cob-seg" id="sd-p"><button type="button" data-v="unpaid" class="' + (pay === 'unpaid' ? 'on' : '') + '">' + SD.L('Unpaid', 'Belum dibayar') + '</button><button type="button" data-v="paid" class="' + (pay === 'paid' ? 'on' : '') + '">' + SD.L('Paid', 'Dibayar') + '</button></div>') + '</div>' +
      '<label class="form-label">' + SD.L('Services in contract', 'Servis dalam kontrak') + '</label><div class="sd-cbx">' + (SD.catalogList || []).map(function (x) {
        return '<label><input type="checkbox" value="' + x.code + '"' + (on.indexOf(x.code) >= 0 ? ' checked' : '') + '><span>' + SD.esc(SD.L(x.name_en, x.name_bm)) + '</span></label>';
      }).join('') + '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      fg(SD.L('Quota / month', 'Kuota / bulan'), '<input type="number" min="0" class="form-input" id="sd-qt" value="' + (c.monthly_quota == null ? '' : c.monthly_quota) + '" placeholder="' + SD.L('Unlimited', 'Tanpa had') + '">') +
      fg(SD.L('SLA (business hours)', 'SLA (jam bekerja)'), '<input type="number" min="1" class="form-input" id="sd-sla" required value="' + (c.sla_hours || 48) + '">') +
      fg('Status', '<select class="form-input" id="sd-st">' + [['draft', 'Draft', 'Draf'], ['active', 'Active', 'Aktif'], ['cancelled', 'Cancelled', 'Batal']].map(function (x) { return '<option value="' + x[0] + '"' + ((c.status === 'expired' ? 'active' : c.status || 'draft') === x[0] ? ' selected' : '') + '>' + SD.L(x[1], x[2]) + '</option>'; }).join('') + '</select>') +
      fg(SD.L('Renewal fee / month (RM)', 'Yuran pembaharuan / bulan (RM)'), '<input type="number" min="0" step="0.01" class="form-input" id="sd-fee" value="' + (c.renew_monthly_fee == null ? 750 : c.renew_monthly_fee) + '">') + '</div>' +
      '<div class="row" style="padding:10px 0;border-top:1px solid var(--border)"><div class="grow"><b style="font-size:13px">' + SD.L('Free M-Core access', 'Akses M-Core percuma') + '</b><div class="cob-xs">' + SD.L('For the contract period', 'Sepanjang tempoh kontrak') + '</div></div><button type="button" class="cob-sw' + (c.mcore_access_free === false ? '' : ' on') + '" id="sd-free" aria-label="free"></button></div>' +
      '<div class="row sd-acts" style="margin-top:6px">' + (c.id ? '<button type="button" class="btn btn-outline btn-icon" id="sd-del" title="' + SD.L('Delete', 'Padam') + '" style="color:var(--danger)"><i class="ti ti-trash"></i></button>' : '') +
      '<button type="button" class="btn btn-outline" id="sd-cancel" style="flex:1">' + SD.L('Cancel', 'Batal') + '</button><button class="btn btn-primary" style="flex:1"><i class="ti ti-device-floppy"></i> ' + SD.L('Save contract', 'Simpan kontrak') + '</button></div></form>';
  };
  SD.cSave = function (ev) {
    ev.preventDefault();
    var f = document.getElementById('sd-form'), v = function (id) { return (document.getElementById(id) || {}).value; };
    var tn = (v('sd-t') || '').trim(), t = (SD.CS||S).tenants.find(function (x) { return x.name === tn; }) || (SD.CS||S).tenants.filter(function (x) { return x.name.toLowerCase().indexOf(tn.toLowerCase()) >= 0; })[0];
    if (!t || !tn) { SD.toast(SD.L('Pick a client from the list', 'Pilih klien daripada senarai'), 'error'); return Promise.resolve(false); }
    if (!v('sd-e') || v('sd-e') < v('sd-s')) { SD.toast(SD.L('End date must be after start date', 'Tarikh tamat mesti selepas tarikh mula'), 'error'); return Promise.resolve(false); }
    var rec = { tenant_id: t.id, start_date: v('sd-s'), end_date: v('sd-e'), invoice_ref: (v('sd-i') || '').trim() || null,
      payment_status: (f.querySelector('#sd-p .on') || {}).dataset ? f.querySelector('#sd-p .on').dataset.v : 'unpaid',
      services: Array.prototype.map.call(f.querySelectorAll('.sd-cbx input:checked'), function (x) { return x.value; }),
      monthly_quota: v('sd-qt') === '' ? null : Math.max(0, parseInt(v('sd-qt'), 10) || 0), sla_hours: Math.max(1, parseInt(v('sd-sla'), 10) || 48),
      status: v('sd-st'), renew_monthly_fee: Number(v('sd-fee') || 750), mcore_access_free: document.getElementById('sd-free').classList.contains('on'), updated_at: new Date().toISOString() };
    var q = SD.CS.sel && SD.CS.sel.id ? sb.from('service_contracts').update(rec).eq('id', SD.CS.sel.id).select().single() : sb.from('service_contracts').insert(rec).select().single();
    return q.then(function (r) { if (r.error) throw r.error; SD.CS.sel = r.data; SD.toast(SD.L('Contract saved', 'Kontrak disimpan'), 'success'); return true; }).catch(function (e) { SD.toast(SD.err(e), 'error'); return false; });
  };
})();
