/* Employment status: probation / permanent — form, gates, letters */
(function () {
  function isBm() { return APP.language === 'bm'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function dmy(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d.getTime())) {
      var p = String(iso).slice(0, 10).split('-');
      if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
      return String(iso);
    }
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }
  function endDate(emp) {
    if (emp.probation_end_date) return emp.probation_end_date;
    var start = emp.probation_start_date || (emp.created_at && String(emp.created_at).slice(0, 10));
    if (!start) return null;
    var d = new Date(start + 'T00:00:00');
    d.setMonth(d.getMonth() + Number(emp.probation_months || 6));
    return d.toISOString().slice(0, 10);
  }
  async function myEmployee() {
    if (!window.sb || !APP.tenant || !APP.user) return null;
    var email = APP.user.email || APP.user.user_metadata && APP.user.user_metadata.email;
    if (!email) return null;
    var q = await sb.from('employees').select('*').eq('tenant_id', APP.tenant.id).ilike('email', email).limit(1);
    return (q.data && q.data[0]) || null;
  }
  window._probationMyEmp = myEmployee;

  function printLetter(kind, emp, extra) {
    var co = (APP.tenant && APP.tenant.name) || 'Company';
    var title = kind === 'confirm'
      ? (isBm() ? 'Surat Pengesahan Tetap' : 'Confirmation of Permanent Employment')
      : (isBm() ? 'Surat Lanjutan Tempoh Percubaan' : 'Probation Extension Letter');
    var body = kind === 'confirm'
      ? ('This letter confirms that <b>' + esc(emp.name) + '</b> is appointed as permanent staff effective <b>' + dmy(extra.effective) + '</b>, with reference to the original letter of appointment.')
      : ('The probation period for <b>' + esc(emp.name) + '</b> originally ending <b>' + dmy(extra.prevEnd) + '</b> is extended to <b>' + dmy(extra.newEnd) + '</b>.<br>Reason: ' + esc(extra.reason || '-'));
    var w = window.open('', '_blank');
    w.document.write('<!doctype html><html><head><title>' + title + '</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;color:#0f172a}h1{color:#1e3a5f;border-bottom:3px solid #c9a227;padding-bottom:8px;font-size:22px}.gold{color:#c9a227}.sign{margin-top:64px}</style></head><body>');
    w.document.write('<div class="gold">' + esc(co) + '</div><h1>' + title + '</h1><p>' + dmy(new Date().toISOString()) + '</p><p>' + body + '</p>');
    w.document.write('<div class="sign">________________________<br>CEO / Authorized Signatory<br>' + esc(co) + '</div>');
    w.document.write('<script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
  }

  function reasonDialog(title, onOk) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px';
    wrap.innerHTML = '<div style="background:var(--card,#fff);color:inherit;border-radius:12px;padding:18px;max-width:420px;width:100%"><h3 style="margin:0 0 8px">' + esc(title) + '</h3><textarea id="prb-reason" class="form-input" rows="4" placeholder="' + (isBm() ? 'Sebab / nota (wajib)' : 'Reason / notes (required)') + '"></textarea><div id="prb-extra"></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button type="button" class="btn btn-outline" id="prb-cancel">' + (isBm() ? 'Batal' : 'Cancel') + '</button><button type="button" class="btn btn-primary" id="prb-ok">OK</button></div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('#prb-cancel').onclick = function () { wrap.remove(); };
    wrap.querySelector('#prb-ok').onclick = function () {
      var reason = (document.getElementById('prb-reason').value || '').trim();
      if (!reason) { showToast(isBm() ? 'Sebab wajib diisi' : 'Reason is required', 'error'); return; }
      onOk(reason, wrap);
    };
    return wrap;
  }

  async function loadLog(empId, host) {
    if (!host) return;
    var q = await sb.from('employee_probation_log').select('*').eq('employee_id', empId).order('acted_at', { ascending: false });
    var rows = q.data || [];
    if (!rows.length) { host.innerHTML = '<div style="font-size:12px;color:var(--text-3)">' + (isBm() ? 'Tiada rekod tindakan.' : 'No action history.') + '</div>'; return; }
    host.innerHTML = rows.map(function (r) {
      return '<div style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--border)">' +
        esc(r.action) + ' · ' + dmy(r.acted_at) + ' · ' + esc(r.reason) +
        (r.new_months ? ' · ' + r.new_months + ' mo' : '') + '</div>';
    }).join('');
  }

  async function injectForm() {
    if (!document.getElementById('emp-name')) return;
    if (document.getElementById('prb-box')) return;
    var params = {};
    try { params = (typeof _pageParams === 'function') ? _pageParams() : (APP.pageParams || {}); } catch (e) {}
    var id = params.id || (location.hash.match(/id=([0-9a-f-]{36})/i) || [])[1];
    var emp = {};
    if (id && window.sb) {
      var q = await sb.from('employees').select('*').eq('id', id).eq('tenant_id', APP.tenant.id).maybeSingle();
      emp = q.data || {};
    }
    var status = emp.employment_status || 'probation';
    var box = document.createElement('div');
    box.id = 'prb-box';
    box.className = 'form-group';
    box.style.gridColumn = '1 / -1';
    var badge = status === 'permanent'
      ? (isBm() ? 'Tetap (disahkan ' + dmy(emp.confirmed_at) + ')' : 'Permanent (confirmed ' + dmy(emp.confirmed_at) + ')')
      : (isBm() ? 'Percubaan (tamat ' + dmy(endDate(emp)) + ', lanjutan ' + (emp.probation_extension_count || 0) + 'x)' : 'Probation (ends ' + dmy(endDate(emp)) + ', extended ' + (emp.probation_extension_count || 0) + 'x)');
    box.innerHTML =
      '<div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-top:8px">' +
      '<strong>' + (isBm() ? 'Status Pekerjaan' : 'Employment Status') + '</strong>' +
      '<div id="prb-badge" style="margin:6px 0;font-size:13px">' + badge + '</div>' +
      '<label style="font-size:12px">' + (isBm() ? 'Bulan percubaan' : 'Probation months') + '</label>' +
      '<input id="prb-months" class="form-input" type="number" min="1" value="' + (emp.probation_months || 6) + '" style="width:100px;margin:4px 8px 8px 0">' +
      '<label style="display:block;font-size:13px;margin:4px 0"><input type="checkbox" id="prb-al" ' + (emp.allow_leave_during_probation ? 'checked' : '') + '> Allow annual leave during probation</label>' +
      '<label style="display:block;font-size:13px;margin:4px 0"><input type="checkbox" id="prb-am" ' + (emp.allow_medical_claim_during_probation ? 'checked' : '') + '> Allow medical/hospitalisation claim during probation</label>' +
      '<label style="display:block;font-size:13px;margin:4px 0"><input type="checkbox" id="prb-ac" ' + (emp.allow_sales_commission_during_probation ? 'checked' : '') + '> Allow sales commission eligibility during probation</label>' +
      '<label style="display:block;font-size:13px;margin:4px 0"><input type="checkbox" id="prb-af" ' + (emp.allow_full_access_during_probation ? 'checked' : '') + '> Allow full module/system access during probation</label>' +
      (status === 'probation' && id
        ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
          '<button type="button" class="btn btn-primary btn-sm" id="prb-confirm">' + (isBm() ? 'Sahkan tetap' : 'Confirm as Permanent') + '</button>' +
          '<button type="button" class="btn btn-outline btn-sm" id="prb-extend">' + (isBm() ? 'Lanjut percubaan' : 'Extend Probation') + '</button></div>'
        : '') +
      '<div style="font-size:12px;font-weight:600;margin:12px 0 4px">' + (isBm() ? 'Rekod tindakan' : 'Action log') + '</div>' +
      '<div id="prb-log"></div></div>';
    var anchor = document.getElementById('emp-position');
    var host = anchor ? anchor.closest('.form-group') : document.getElementById('emp-name').closest('div');
    if (host && host.parentNode) host.parentNode.insertBefore(box, host.nextSibling);
    if (id) loadLog(id, document.getElementById('prb-log'));

    var origSave = window._employeeSave;
    if (typeof origSave === 'function' && !origSave._prb) {
      window._employeeSave = async function () {
        var r = await origSave.apply(this, arguments);
        var eid = id || arguments[0];
        if (eid && window.sb) {
          await sb.from('employees').update({
            probation_months: Number(document.getElementById('prb-months') && document.getElementById('prb-months').value || 6),
            allow_leave_during_probation: !!(document.getElementById('prb-al') && document.getElementById('prb-al').checked),
            allow_medical_claim_during_probation: !!(document.getElementById('prb-am') && document.getElementById('prb-am').checked),
            allow_sales_commission_during_probation: !!(document.getElementById('prb-ac') && document.getElementById('prb-ac').checked),
            allow_full_access_during_probation: !!(document.getElementById('prb-af') && document.getElementById('prb-af').checked)
          }).eq('id', eid).eq('tenant_id', APP.tenant.id);
        }
        return r;
      };
      window._employeeSave._prb = true;
    }

    var cbtn = document.getElementById('prb-confirm');
    if (cbtn) cbtn.onclick = function () {
      reasonDialog(isBm() ? 'Sahkan sebagai tetap' : 'Confirm as Permanent', async function (reason, wrap) {
        var now = new Date().toISOString();
        var prev = emp.probation_months;
        var up = await sb.from('employees').update({ employment_status: 'permanent', confirmed_at: now }).eq('id', id).eq('tenant_id', APP.tenant.id);
        if (up.error) { showToast(up.error.message, 'error'); return; }
        await sb.from('employee_probation_log').insert({ tenant_id: APP.tenant.id, employee_id: id, action: 'confirmed', reason: reason, previous_months: prev, new_months: prev, acted_by: APP.user && APP.user.id });
        wrap.remove();
        showToast(isBm() ? 'Disahkan tetap' : 'Confirmed permanent', 'success');
        printLetter('confirm', emp, { effective: now });
        if (typeof renderEmployeeForm === 'function') renderEmployeeForm(id);
      });
    };
    var ebtn = document.getElementById('prb-extend');
    if (ebtn) ebtn.onclick = function () {
      var dlg = reasonDialog(isBm() ? 'Lanjut percubaan' : 'Extend Probation', async function (reason, wrap) {
        var extra = wrap.querySelector('#prb-new-months');
        var neu = Number(extra && extra.value || emp.probation_months || 6);
        var cap = Number(emp.probation_max_months_cap || 12);
        if (neu > cap) { showToast((isBm() ? 'Melebihi had ' : 'Exceeds cap of ') + cap + ' months', 'error'); return; }
        var up = await sb.from('employees').update({ probation_months: neu, probation_extension_count: Number(emp.probation_extension_count || 0) + 1 }).eq('id', id).eq('tenant_id', APP.tenant.id);
        if (up.error) { showToast(up.error.message, 'error'); return; }
        await sb.from('employee_probation_log').insert({ tenant_id: APP.tenant.id, employee_id: id, action: 'extended', reason: reason, previous_months: emp.probation_months, new_months: neu, acted_by: APP.user && APP.user.id });
        wrap.remove();
        showToast(isBm() ? 'Percubaan dilanjut' : 'Probation extended', 'success');
        var fresh = Object.assign({}, emp, { probation_months: neu });
        printLetter('extend', emp, { prevEnd: endDate(emp), newEnd: endDate(fresh), reason: reason });
        if (typeof renderEmployeeForm === 'function') renderEmployeeForm(id);
      });
      dlg.querySelector('#prb-extra').innerHTML = '<label style="font-size:12px;display:block;margin-top:8px">' + (isBm() ? 'Bulan baru' : 'New months') + '</label><input id="prb-new-months" class="form-input" type="number" min="1" value="' + (Number(emp.probation_months || 6) + 1) + '">';
    };
  }

  function wrapLeave() {
    var orig = window._leaveSave;
    if (typeof orig !== 'function' || orig._prb) return;
    window._leaveSave = async function () {
      var employeeId = document.getElementById('lv-employee') && document.getElementById('lv-employee').value;
      var leaveType = document.getElementById('lv-type') && document.getElementById('lv-type').value;
      if (employeeId && leaveType === 'annual') {
        var q = await sb.from('employees').select('employment_status,allow_leave_during_probation').eq('id', employeeId).maybeSingle();
        var e = q.data;
        if (e && e.employment_status === 'probation' && !e.allow_leave_during_probation) {
          showToast(isBm() ? 'Permohonan cuti tahunan hanya selepas disahkan tetap' : 'Annual leave applications are available after probation is confirmed', 'error');
          return;
        }
      }
      return orig.apply(this, arguments);
    };
    window._leaveSave._prb = true;
  }
  function wrapExp() {
    var orig = window._expSave;
    if (typeof orig !== 'function' || orig._prb) return;
    window._expSave = async function () {
      var desc = ((document.getElementById('ef-desc') || {}).value || '').toLowerCase();
      var cat = ((document.getElementById('ef-category') || {}).selectedOptions || [{}])[0];
      var catTxt = ((cat && cat.textContent) || '').toLowerCase();
      var medical = /medical|hospital|klinik|ward|panel|inpatient|outpatient/.test(desc + ' ' + catTxt);
      if (medical) {
        var me = await myEmployee();
        if (me && me.employment_status === 'probation' && !me.allow_medical_claim_during_probation) {
          showToast(isBm() ? 'Tuntutan perubatan hanya selepas disahkan tetap' : 'Medical/hospitalisation claims are available after probation is confirmed', 'error');
          return;
        }
      }
      return orig.apply(this, arguments);
    };
    window._expSave._prb = true;
  }
  function wrapAccess() {
    var orig = window.canAccess;
    if (typeof orig !== 'function' || orig._prb) return;
    window.canAccess = function (module) {
      var ok = orig.apply(this, arguments);
      if (!ok) return false;
      var emp = window._prbCachedEmp;
      if (!emp || emp.employment_status !== 'probation' || emp.allow_full_access_during_probation) return ok;
      var blocked = { sales: 1, accounting: 1, inventory: 1, purchasing: 1, admin: 1, reports: 1, vouchers: 1 };
      if (blocked[module]) return false;
      return ok;
    };
    window.canAccess._prb = true;
    myEmployee().then(function (e) { window._prbCachedEmp = e; });
  }
  function wrapCommission() {
    var orig = window._commissionCaptureForSale;
    if (typeof orig !== 'function' || orig._prb) return;
    window._commissionCaptureForSale = async function (sourceType, sourceId) {
      try {
        var headerTable = sourceType === 'invoice' ? 'invoices' : 'pos_transactions';
        var { data: header } = await sb.from(headerTable).select('sales_person_id').eq('id', sourceId).maybeSingle();
        if (header && header.sales_person_id) {
          var q = await sb.from('employees').select('employment_status,allow_sales_commission_during_probation').eq('id', header.sales_person_id).maybeSingle();
          var e = q.data;
          if (e && e.employment_status === 'probation' && !e.allow_sales_commission_during_probation) return;
        }
      } catch (err) {}
      return orig.apply(this, arguments);
    };
    window._commissionCaptureForSale._prb = true;
  }

  function settingsBox() {
    if (location.hash.indexOf('settings') < 0 || document.getElementById('prb-set-box')) return;
    var wrap = document.getElementById('bk-settings-box') || document.getElementById('role-perms-wrap');
    if (!wrap) return;
    var box = document.createElement('div');
    box.id = 'prb-set-box';
    box.style.cssText = 'border:1px solid var(--border);border-radius:10px;padding:12px;margin:12px 0';
    var on = !!(APP.tenant && APP.tenant.config && APP.tenant.config.probation_notify_employee);
    box.innerHTML = '<strong>' + (isBm() ? 'Peringatan percubaan' : 'Probation reminders') + '</strong>' +
      '<label style="display:block;margin-top:8px;font-size:13px"><input type="checkbox" id="prb-notify-emp" ' + (on ? 'checked' : '') + '> ' +
      (isBm() ? 'Maklumkan pekerja terus' : 'Also notify the employee directly') + '</label>';
    wrap.parentNode.insertBefore(box, wrap.nextSibling);
    document.getElementById('prb-notify-emp').onchange = async function () {
      var cfg = Object.assign({}, (APP.tenant && APP.tenant.config) || {});
      cfg.probation_notify_employee = this.checked;
      await sb.from('tenants').update({ config: cfg }).eq('id', APP.tenant.id);
      APP.tenant.config = cfg;
    };
  }

  var origForm = window.renderEmployeeForm;
  if (typeof origForm === 'function' && !origForm._prb) {
    window.renderEmployeeForm = async function () {
      var r = await origForm.apply(this, arguments);
      setTimeout(injectForm, 50);
      setTimeout(injectForm, 400);
      return r;
    };
    window.renderEmployeeForm._prb = true;
  }
  function boot() {
    wrapLeave(); wrapExp(); wrapAccess(); wrapCommission(); settingsBox(); injectForm();
  }
  setInterval(boot, 1500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
