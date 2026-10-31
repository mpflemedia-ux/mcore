/* hr-profile.js — HR profile completion (P0/P3/P4/P5).
   - Employee form: department, employment type, contract end, 3 fixed allowances, annual leave days, opening leave balance.
   - Company Settings: employer statutory numbers (KWSP / PERKESO / LHDN E / HRDF / Zakat), masked.
   - Payroll & OT Settings: per-allowance-type EPF / SOCSO-EIS / PCB flags + annual leave carry-forward cap (tenants.config).
   - Run Payroll: data health check (IC / EPF no / bank account) — warn + confirm override before running.
   - Salary Disbursement: department totals.
   - Contract expiry reminder: hr_contract_remind() RPC once a day on open (server cron is the main path; bell + push via notifications).
   Soft-fails before supabase/migrations/20261031100000_hr_profile_completion.sql is run. EN/BM, existing tokens only. */
(function () {
  if (window.HRProfile) return;
  var H = window.HRProfile = { v: 1 };
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }
  function tid() { try { return APP.tenant.id; } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? String(el.value || '').trim() : ''; }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }
  function rm(n) { try { return formatRM(n); } catch (e) { return 'RM ' + Number(n || 0).toFixed(2); } }
  function uuid(v) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || '')); }
  function colMissing(err) { var m = String((err && (err.message || err.details)) || ''); return /column|schema cache|does not exist|PGRST204/i.test(m); }
  function allowTypes() { try { return SD_ALLOWANCE_TYPES.filter(function (a) { return a.key; }); } catch (e) { return [{ key: 'other', en: 'Other Allowance', bm: 'Elaun Lain' }]; } }
  function canHR() { try { return (typeof canManageHR === 'function' && canManageHR()) || (typeof isPlatformAdmin === 'function' && isPlatformAdmin()); } catch (e) { return false; } }
  var EMP_COLS = 'department,employment_type,contract_end_date,fixed_allowance_type_1,fixed_allowance_1,fixed_allowance_type_2,fixed_allowance_2,fixed_allowance_type_3,fixed_allowance_3,annual_leave_days,leave_opening_balance,leave_opening_year';
  H.EMP_COLS = EMP_COLS;
  function css() {
    if ($('hrp-css')) return;
    var s = document.createElement('style'); s.id = 'hrp-css';
    s.textContent = '.hrp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}' +
      '.hrp-allow{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:8px;margin-bottom:6px}' +
      '.hrp-sec{font-weight:600;font-size:13px;margin:4px 0 8px;color:var(--text)}' +
      '.hrp-hint{font-size:11px;color:var(--text-3);margin-top:4px}' +
      '.hrp-warn{font-size:12px;color:var(--warning);margin-top:6px}' +
      '.hrp-mask{display:flex;gap:6px;align-items:center}.hrp-mask .form-input{flex:1;min-width:0}.hrp-mask .btn{white-space:nowrap;flex:0 0 auto}' +
      '.hrp-flags table{width:100%}.hrp-flags td,.hrp-flags th{padding:6px 4px;font-size:13px}.hrp-flags td.c,.hrp-flags th.c{text-align:center;width:72px}' +
      '.hrp-health{border:1px solid var(--warning);background:var(--bg);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text-2);margin-bottom:12px}' +
      '.hrp-health.ok{border-color:var(--success);background:var(--bg)}' +
      '.hrp-health ul{margin:6px 0 0 18px;padding:0}.hrp-health li{margin:2px 0}' +
      '.hrp-dept table{width:100%}.hrp-dept td,.hrp-dept th{white-space:nowrap}';
    document.head.appendChild(s);
  }

  /* ================= Employee form ================= */
  function formEmpId() {
    var btn = document.querySelector('#main [onclick*="_employeeSave("]');
    var m = btn && String(btn.getAttribute('onclick') || '').match(/_employeeSave\('([0-9a-f-]{36})'/i);
    return m ? m[1] : null;
  }
  function typeOpts(sel) {
    return '<option value="">' + L('— None —', '— Tiada —') + '</option>' + allowTypes().map(function (a) {
      return '<option value="' + esc(a.key) + '"' + (a.key === sel ? ' selected' : '') + '>' + esc(bm() ? a.bm : a.en) + '</option>';
    }).join('');
  }
  function contractHint(d) {
    if (!d) return '';
    var days = Math.round((new Date(d + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
    if (days < 0) return L('Contract ended ' + (-days) + ' day(s) ago.', 'Kontrak tamat ' + (-days) + ' hari lalu.');
    if (days <= 30) return L('Contract ends in ' + days + ' day(s).', 'Kontrak tamat dalam ' + days + ' hari.');
    return '';
  }
  function mountForm() {
    var acc = $('emp-bank-acc'), nm = $('emp-name');
    if (!acc || !nm || $('hrp-box')) return;
    var card = nm.closest('.card'); var grid = nm.closest('.app-row2');
    if (!card || !grid) return;
    css();
    var id = formEmpId();
    var box = document.createElement('div');
    box.id = 'hrp-box';
    box.style.cssText = 'margin-top:14px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--bg)';
    var allowRows = [1, 2, 3].map(function (i) {
      return '<div class="hrp-allow"><select id="hrp-at' + i + '" class="form-select" aria-label="' + L('Allowance type', 'Jenis elaun') + ' ' + i + '">' + typeOpts('') + '</select>' +
        '<input id="hrp-a' + i + '" type="number" step="0.01" min="0" class="form-input" placeholder="0.00" aria-label="' + L('Amount (RM)', 'Jumlah (RM)') + ' ' + i + '"></div>';
    }).join('');
    box.innerHTML =
      '<div class="hrp-sec"><i class="ti ti-briefcase"></i> ' + L('Employment profile', 'Profil pekerjaan') + '</div>' +
      '<div class="hrp-grid">' +
        '<div class="form-group" style="margin:0"><label class="form-label" for="hrp-dept">' + L('Department', 'Jabatan') + '</label><input id="hrp-dept" class="form-input" list="hrp-dept-list" autocomplete="off"><datalist id="hrp-dept-list"></datalist></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label" for="hrp-etype">' + L('Employment type', 'Jenis pekerjaan') + '</label><select id="hrp-etype" class="form-select"><option value="">-</option><option value="permanent">' + L('Permanent', 'Tetap') + '</option><option value="contract">' + L('Contract', 'Kontrak') + '</option></select></div>' +
        '<div class="form-group" style="margin:0" id="hrp-cend-wrap"><label class="form-label" for="hrp-cend">' + L('Contract end date', 'Tarikh tamat kontrak') + '</label><input id="hrp-cend" type="date" class="form-input"><div id="hrp-cend-hint" class="hrp-warn"></div></div>' +
      '</div>' +
      '<div class="hrp-sec" style="margin-top:12px"><i class="ti ti-coins"></i> ' + L('Fixed monthly allowances', 'Elaun tetap bulanan') + '</div>' +
      allowRows +
      '<div class="hrp-hint">' + L('Prefilled into Run Payroll and Salary Disbursement (still editable there). EPF / SOCSO / PCB treatment per type is set in Payroll & OT Settings.', 'Diisi automatik ke Jalankan Payroll dan Penyaluran Gaji (masih boleh diubah). Layanan KWSP / PERKESO / PCB ikut jenis ditetapkan di Tetapan Gaji & OT.') + '</div>' +
      '<div class="hrp-sec" style="margin-top:12px"><i class="ti ti-plane-departure"></i> ' + L('Annual leave', 'Cuti tahunan') + '</div>' +
      '<div class="hrp-grid">' +
        '<div class="form-group" style="margin:0"><label class="form-label" for="hrp-ald">' + L('Entitlement (days/year)', 'Kelayakan (hari/tahun)') + '</label><input id="hrp-ald" type="number" step="0.01" min="0" class="form-input" placeholder="14"></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label" for="hrp-lob">' + L('Leave balance at go-live (days)', 'Baki cuti semasa mula guna (hari)') + '</label><input id="hrp-lob" type="number" step="0.01" min="0" class="form-input" placeholder="0"></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label" for="hrp-loy">' + L('Balance as at year', 'Baki bagi tahun') + '</label><input id="hrp-loy" type="number" step="1" min="2000" max="2100" class="form-input" placeholder="' + new Date().getFullYear() + '"></div>' +
      '</div>' +
      '<div class="hrp-hint">' + L('Blank entitlement = default 14 days. Balance at go-live replaces the entitlement for that year only (leave taken in M-Core that year is deducted).', 'Kelayakan kosong = default 14 hari. Baki semasa mula guna menggantikan kelayakan untuk tahun itu sahaja (cuti diambil dalam M-Core tahun itu ditolak).') + '</div>';
    grid.parentNode.insertBefore(box, grid.nextSibling);
    var et = $('hrp-etype'), ce = $('hrp-cend');
    function syncType() { var w = $('hrp-cend-wrap'); if (w) w.style.opacity = et.value === 'contract' ? '1' : '.6'; var h = $('hrp-cend-hint'); if (h) h.textContent = et.value === 'contract' ? contractHint(ce.value) : ''; }
    et.addEventListener('change', syncType); ce.addEventListener('change', syncType);
    if (!window.sb || !tid()) return;
    sb.from('employees').select('department').eq('tenant_id', tid()).is('deleted_at', null).then(function (r) {
      if (r.error) return;
      var set = {}; (r.data || []).forEach(function (e) { var d = String(e.department || '').trim(); if (d) set[d] = 1; });
      var dl = $('hrp-dept-list'); if (dl) dl.innerHTML = Object.keys(set).sort().map(function (d) { return '<option value="' + esc(d) + '">'; }).join('');
    });
    if (!id) return;
    sb.from('employees').select(EMP_COLS).eq('id', id).eq('tenant_id', tid()).maybeSingle().then(function (r) {
      if (r.error) {
        if (colMissing(r.error)) { var h = document.createElement('div'); h.className = 'hrp-warn'; h.textContent = L('HR profile fields need the 2026-10-31 HR SQL to be run first.', 'Medan profil HR perlukan SQL HR 2026-10-31 dijalankan dahulu.'); box.appendChild(h); }
        return;
      }
      var e = r.data || {};
      $('hrp-dept').value = e.department || '';
      et.value = e.employment_type || '';
      ce.value = e.contract_end_date ? String(e.contract_end_date).slice(0, 10) : '';
      [1, 2, 3].forEach(function (i) {
        var s = $('hrp-at' + i); if (s) s.innerHTML = typeOpts(e['fixed_allowance_type_' + i] || (Number(e['fixed_allowance_' + i]) > 0 ? 'other' : ''));
        var a = $('hrp-a' + i); if (a) a.value = Number(e['fixed_allowance_' + i]) > 0 ? e['fixed_allowance_' + i] : '';
      });
      $('hrp-ald').value = e.annual_leave_days != null ? e.annual_leave_days : '';
      $('hrp-lob').value = e.leave_opening_balance != null ? e.leave_opening_balance : '';
      $('hrp-loy').value = e.leave_opening_year != null ? e.leave_opening_year : '';
      syncType();
    });
  }
  function numOrNull(v) { if (v === '' || v == null) return null; var n = Number(v); return isFinite(n) ? n : null; }
  function snapForm() {
    if (!$('hrp-box')) return null;
    var p = {
      department: val('hrp-dept') || null,
      employment_type: val('hrp-etype') || null,
      contract_end_date: val('hrp-cend') || null,
      annual_leave_days: numOrNull(val('hrp-ald')),
      leave_opening_balance: numOrNull(val('hrp-lob')),
      leave_opening_year: numOrNull(val('hrp-loy'))
    };
    if (p.leave_opening_balance != null && p.leave_opening_year == null) p.leave_opening_year = new Date().getFullYear();
    var slots = [1, 2, 3].map(function (i) { var a = Math.max(0, Number(val('hrp-a' + i)) || 0); return { type: a > 0 ? (val('hrp-at' + i) || 'other') : null, amount: a > 0 ? Math.round(a * 100) / 100 : 0 }; })
      .filter(function (s) { return s.amount > 0; });
    [1, 2, 3].forEach(function (i) { var s = slots[i - 1]; p['fixed_allowance_type_' + i] = s ? s.type : null; p['fixed_allowance_' + i] = s ? s.amount : 0; });
    return p;
  }
  async function lookupNewId() {
    var ic = val('emp-ic'), name = val('emp-name');
    if (ic) { var q = await sb.from('employees').select('id').eq('tenant_id', tid()).eq('ic_no', ic).is('deleted_at', null).order('created_at', { ascending: false }).limit(1); if (q.data && q.data[0]) return q.data[0].id; }
    if (name) { var q2 = await sb.from('employees').select('id').eq('tenant_id', tid()).eq('name', name).is('deleted_at', null).order('created_at', { ascending: false }).limit(1); if (q2.data && q2.data[0]) return q2.data[0].id; }
    return null;
  }
  function wrapSave() {
    var o = window._employeeSave;
    if (typeof o !== 'function' || o._hrpSave) return;
    var w = async function (id) {
      var snap = snapForm();
      var name = val('emp-name'), ic = val('emp-ic');
      var valid = !!name && (!ic || (typeof validateIC !== 'function' || validateIC(ic)));
      var eid = uuid(id) ? id : null;
      var r = await o.apply(this, arguments);
      if (!snap || !valid || !window.sb || !tid()) return r;
      try {
        if (!eid) eid = await lookupNewId();
        if (!eid) return r;
        var u = await sb.from('employees').update(snap).eq('id', eid).eq('tenant_id', tid());
        if (u.error) toast(colMissing(u.error) ? L('Saved. HR profile fields need the 2026-10-31 HR SQL first.', 'Disimpan. Medan profil HR perlukan SQL HR 2026-10-31 dahulu.') : (L('HR profile not saved: ', 'Profil HR tidak disimpan: ') + u.error.message), colMissing(u.error) ? 'warning' : 'error');
      } catch (e) { console.warn('[hr-profile] save', e); }
      return r;
    };
    for (var k in o) { try { w[k] = o[k]; } catch (e) {} }
    w._hrpSave = true;
    window._employeeSave = w;
  }

  /* ================= Company Settings: employer statutory numbers ================= */
  var TN = [
    ['kwsp_no', 'EPF / KWSP employer no.', 'No. majikan KWSP'],
    ['perkeso_no', 'SOCSO / PERKESO employer code', 'Kod majikan PERKESO'],
    ['lhdn_e_no', 'LHDN employer no. (E)', 'No. majikan LHDN (E)'],
    ['hrdf_no', 'HRD Corp (HRDF) no.', 'No. HRD Corp (HRDF)'],
    ['zakat_no', 'Zakat employer no.', 'No. majikan zakat']
  ];
  H.TN = TN;
  function mountCompany() {
    var sst = $('cp-sst-gst');
    if (!sst || $('hrp-statno')) return;
    var grid = sst.closest('div[style*="grid-template-columns"]'); if (!grid) return;
    css();
    var sec = document.createElement('div'); sec.id = 'hrp-statno';
    sec.innerHTML = '<div style="font-weight:700;margin-bottom:4px">' + L('Employer statutory numbers', 'Nombor berkanun majikan') + '</div>' +
      '<div class="hrp-hint" style="margin:0 0 10px">' + L('Sensitive — hidden by default. Shown on payslips (KWSP / PERKESO / LHDN) when filled. Saved with the Save button below.', 'Sensitif — disembunyi secara default. Dipapar di slip gaji (KWSP / PERKESO / LHDN) jika diisi. Disimpan dengan butang Simpan di bawah.') + '</div>' +
      '<div class="hrp-grid" style="margin-bottom:20px">' + TN.map(function (f) {
        return '<div class="form-group" style="margin:0"><label class="form-label" for="hrp-tn-' + f[0] + '">' + esc(L(f[1], f[2])) + '</label>' +
          '<div class="hrp-mask"><input id="hrp-tn-' + f[0] + '" class="form-input" type="password" autocomplete="off" data-no-titlecase="1" spellcheck="false">' +
          '<button type="button" class="btn btn-outline btn-sm" aria-label="' + L('Show / hide', 'Papar / sembunyi') + '" onclick="HRProfile.toggleMask(\'hrp-tn-' + f[0] + '\',this)"><i class="ti ti-eye"></i></button></div></div>';
      }).join('') + '</div>';
    grid.parentNode.insertBefore(sec, grid.nextSibling);
    if (!window.sb || !tid()) return;
    sb.from('tenants').select(TN.map(function (f) { return f[0]; }).join(',')).eq('id', tid()).maybeSingle().then(function (r) {
      if (r.error) { if (colMissing(r.error)) { var h = document.createElement('div'); h.className = 'hrp-warn'; h.textContent = L('Run the 2026-10-31 HR SQL to enable these fields.', 'Jalankan SQL HR 2026-10-31 untuk aktifkan medan ini.'); sec.insertBefore(h, sec.children[2]); } return; }
      var d = r.data || {}; TN.forEach(function (f) { var el = $('hrp-tn-' + f[0]); if (el) el.value = d[f[0]] || ''; });
    });
  }
  H.toggleMask = function (id, b) {
    var el = $(id); if (!el) return; var show = el.type === 'password'; el.type = show ? 'text' : 'password';
    if (b) b.innerHTML = '<i class="ti ' + (show ? 'ti-eye-off' : 'ti-eye') + '"></i>';
  };
  function wrapCpSave() {
    var o = window._cpSave;
    if (typeof o !== 'function' || o._hrpTn) return;
    var w = async function () {
      var vals = null;
      if ($('hrp-statno')) { vals = {}; TN.forEach(function (f) { vals[f[0]] = val('hrp-tn-' + f[0]).toUpperCase(); }); }
      var r = await o.apply(this, arguments);
      if (vals && window.sb && tid()) {
        try {
          var x = await sb.rpc('update_tenant_statutory_nos', { p_tenant_id: tid(), p_vals: vals });
          if (x.error) toast((/function|PGRST202/i.test(x.error.message || '') ? L('Statutory numbers need the 2026-10-31 HR SQL first.', 'Nombor berkanun perlukan SQL HR 2026-10-31 dahulu.') : (L('Statutory numbers not saved: ', 'Nombor berkanun tidak disimpan: ') + x.error.message)), 'warning');
          else { try { window._pdocTenantCache = null; _pdocTenantCache = null; } catch (e) {} }
        } catch (e) { console.warn('[hr-profile] statno', e); }
      }
      return r;
    };
    for (var k in o) { try { w[k] = o[k]; } catch (e) {} }
    w._hrpTn = true; window._cpSave = w;
  }

  /* ================= Payroll & OT Settings: allowance flags + leave carry cap ================= */
  function flags() { try { return _payrollAllowanceFlags(); } catch (e) { return {}; } }
  function mountOT() {
    if (!$('ot-auto-detect') || $('hrp-flags')) return;
    var first = $('ot-auto-detect').closest('.card'); if (!first) return;
    css();
    var f = flags(), cap = (APP.tenant && APP.tenant.config && APP.tenant.config.leave_carry_cap) || '';
    var card = document.createElement('div'); card.className = 'card hrp-flags'; card.id = 'hrp-flags';
    card.style.cssText = 'max-width:700px;padding:20px;margin-bottom:16px';
    card.innerHTML = '<div style="font-weight:600;margin-bottom:6px">' + L('Allowances — statutory treatment', 'Elaun — layanan berkanun') + '</div>' +
      '<div class="hrp-hint" style="margin:0 0 10px">' + L('Tick where an allowance type counts as wages. Default: fixed cash allowances count for EPF, SOCSO/EIS and PCB; transport/travel does not (PCB-exempt up to RM6,000/yr). Check with your accountant.', 'Tanda jika jenis elaun dikira sebagai upah. Default: elaun tunai tetap dikira untuk KWSP, PERKESO/SIP dan PCB; pengangkutan/perjalanan tidak (dikecualikan PCB hingga RM6,000/tahun). Semak dengan akauntan.') + '</div>' +
      '<div style="overflow-x:auto"><table><thead><tr><th>' + L('Allowance type', 'Jenis elaun') + '</th><th class="c">EPF</th><th class="c">SOCSO/EIS</th><th class="c">PCB</th></tr></thead><tbody>' +
      allowTypes().map(function (a) { var x = f[a.key] || {}; return '<tr><td>' + esc(bm() ? a.bm : a.en) + '</td>' + ['epf', 'socso', 'pcb'].map(function (k) {
        return '<td class="c"><input type="checkbox" class="hrp-flag" data-type="' + esc(a.key) + '" data-k="' + k + '"' + (x[k] ? ' checked' : '') + ' aria-label="' + esc((bm() ? a.bm : a.en) + ' ' + k.toUpperCase()) + '"></td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div>' +
      '<div class="form-group" style="margin:14px 0 0;max-width:260px"><label class="form-label" for="hrp-carry">' + L('Annual leave carry-forward cap (days)', 'Had bawa ke hadapan cuti tahunan (hari)') + '</label><input id="hrp-carry" type="number" step="0.5" min="0" class="form-input" placeholder="0" value="' + esc(cap) + '"><div class="hrp-hint">' + L('0 / blank = unused leave lapses at year end.', '0 / kosong = cuti tidak digunakan luput hujung tahun.') + '</div></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px"><button class="btn btn-primary btn-sm" type="button" id="hrp-flags-save" onclick="HRProfile.saveFlags(this)"><i class="ti ti-device-floppy"></i> ' + L('Save', 'Simpan') + '</button></div>';
    first.parentNode.insertBefore(card, first.nextSibling);
  }
  H.saveFlags = async function (b) {
    var out = {};
    allowTypes().forEach(function (a) { out[a.key] = { epf: false, socso: false, pcb: false }; });
    [].forEach.call(document.querySelectorAll('.hrp-flag'), function (c) { var t = c.getAttribute('data-type'); if (out[t]) out[t][c.getAttribute('data-k')] = !!c.checked; });
    var cap = Math.max(0, Number(val('hrp-carry')) || 0);
    if (b) { b.disabled = true; b.classList.add('dk-busy'); }
    try { await _tenantConfigPatch({ payroll_allowance_flags: out, leave_carry_cap: cap }); toast(L('Settings saved.', 'Tetapan disimpan.')); }
    catch (e) { toast(L('Failed: ', 'Gagal: ') + (e && e.message || e), 'error'); }
    finally { if (b) { b.disabled = false; b.classList.remove('dk-busy'); } }
  };

  /* ================= Run Payroll: data health check (P3) ================= */
  var health = { rows: [], at: 0 };
  async function loadHealth() {
    if (!window.sb || !tid()) return [];
    var q = await sb.from('employees').select('id,name,ic_no,epf_no,bank_account_no,epf_exempt').eq('tenant_id', tid()).is('deleted_at', null);
    if (q.error) q = await sb.from('employees').select('id,name,ic_no,epf_no,bank_account_no').eq('tenant_id', tid()).is('deleted_at', null);
    var rows = [];
    (q.data || []).forEach(function (e) {
      var miss = [];
      if (String(e.ic_no || '').replace(/\D/g, '').length !== 12) miss.push('ic');
      if (!String(e.epf_no || '').trim() && !e.epf_exempt) miss.push('epf');
      if (!String(e.bank_account_no || '').replace(/\D/g, '')) miss.push('bank');
      if (miss.length) rows.push({ id: e.id, name: e.name, miss: miss });
    });
    health = { rows: rows, at: Date.now() };
    return rows;
  }
  function missLabel(k) { return k === 'ic' ? L('IC', 'IC') : k === 'epf' ? L('EPF no.', 'No. KWSP') : L('bank account', 'akaun bank'); }
  function mountRun() {
    var wrap = $('payroll-emp-wrap');
    if (!wrap || $('hrp-health')) return;
    css();
    var box = document.createElement('div'); box.id = 'hrp-health'; box.className = 'hrp-health ok';
    box.innerHTML = '<i class="ti ti-loader"></i> ' + L('Checking employee data…', 'Menyemak data pekerja…');
    wrap.parentNode.insertBefore(box, wrap);
    loadHealth().then(function (rows) {
      if (!box.isConnected) return;
      if (!rows.length) { box.className = 'hrp-health ok'; box.innerHTML = '<i class="ti ti-circle-check" style="color:var(--success)"></i> ' + L('Data health: all employees have IC, EPF no. and bank account.', 'Kesihatan data: semua pekerja ada IC, No. KWSP dan akaun bank.'); return; }
      box.className = 'hrp-health';
      box.innerHTML = '<i class="ti ti-alert-triangle" style="color:var(--warning)"></i> <b>' + L('Data health check', 'Semakan kesihatan data') + '</b> — ' +
        L(rows.length + ' employee(s) missing details. Fix before generating, or override when running.', rows.length + ' pekerja kurang maklumat. Betulkan sebelum jana, atau teruskan (override) semasa jalankan.') +
        '<ul>' + rows.map(function (r) { return '<li><a href="#" onclick="event.preventDefault();openPage(\'hr\',{view:\'employee-form\',id:\'' + r.id + '\'})">' + esc(r.name || '-') + '</a> — ' + r.miss.map(missLabel).join(', ') + '</li>'; }).join('') + '</ul>';
    });
  }
  function wrapRun() {
    var o = window._payrollRunExecute;
    if (typeof o !== 'function' || o._hrpHealth) return;
    var w = async function () {
      try {
        var sel = [].map.call(document.querySelectorAll('.payroll-emp-check:checked'), function (c) { return String(c.value); });
        var rows = (Date.now() - health.at < 120000) ? health.rows : await loadHealth();
        var bad = rows.filter(function (r) { return sel.indexOf(String(r.id)) >= 0; });
        if (bad.length) {
          var msg = L('Data health check: ' + bad.length + ' selected employee(s) are missing IC / EPF no. / bank account:\n\n', 'Semakan kesihatan data: ' + bad.length + ' pekerja dipilih kurang IC / No. KWSP / akaun bank:\n\n') +
            bad.slice(0, 12).map(function (r) { return '• ' + (r.name || '-') + ' — ' + r.miss.map(missLabel).join(', '); }).join('\n') + (bad.length > 12 ? '\n…' : '') +
            L('\n\nRun payroll anyway?', '\n\nTeruskan jalankan payroll?');
          if (!window.confirm(msg)) return;
        }
      } catch (e) { console.warn('[hr-profile] health', e); }
      return o.apply(this, arguments);
    };
    for (var k in o) { try { w[k] = o[k]; } catch (e) {} }
    w._hrpHealth = true; window._payrollRunExecute = w;
  }

  /* ================= Salary Disbursement: department totals (P5) ================= */
  var deptMap = {}, deptFor = '';
  function sdRecs() { try { return _sdRecords || []; } catch (e) { return []; } }
  function renderDept() {
    var box = $('hrp-dept'); if (!box) return;
    var recs = sdRecs(); if (!recs.length) { box.style.display = 'none'; return; }
    var g = {};
    recs.forEach(function (r) {
      var v; try { v = _sdRowValues(r); } catch (e) { v = r; }
      var d = deptMap[r.employee_id] || L('No department', 'Tiada jabatan');
      var x = g[d] = g[d] || { n: 0, gross: 0, net: 0, er: 0 };
      x.n++;
      x.gross += Number(r.basic_salary || 0) + Number(v.allowance_1 || 0) + Number(v.allowance_2 || 0) + Number(v.allowance_3 || 0) + Number(v.commission || 0) + Number(v.ot_amount || 0);
      x.net += Number(v.net_pay || 0);
      x.er += Number(r.epf_employer || 0) + Number(r.socso_employer || 0) + Number(r.eis_employer || 0);
    });
    var keys = Object.keys(g).sort();
    if (keys.length < 2 && !Object.keys(deptMap).length) { box.style.display = 'none'; return; }
    box.style.display = '';
    box.innerHTML = '<div style="font-weight:600;font-size:13px;margin-bottom:6px">' + L('Totals by department', 'Jumlah ikut jabatan') + '</div><div style="overflow-x:auto"><table><thead><tr><th>' + L('Department', 'Jabatan') + '</th><th style="text-align:right">' + L('Staff', 'Staf') + '</th><th style="text-align:right">' + L('Gross', 'Kasar') + '</th><th style="text-align:right">' + L('Net pay', 'Gaji bersih') + '</th><th style="text-align:right">' + L('Employer contrib.', 'Caruman majikan') + '</th><th style="text-align:right">' + L('Company cost', 'Kos syarikat') + '</th></tr></thead><tbody>' +
      keys.map(function (k) { var x = g[k]; return '<tr><td>' + esc(k) + '</td><td style="text-align:right">' + x.n + '</td><td style="text-align:right">' + rm(x.gross) + '</td><td style="text-align:right">' + rm(x.net) + '</td><td style="text-align:right">' + rm(x.er) + '</td><td style="text-align:right">' + rm(x.gross + x.er) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }
  function mountSD() {
    var sum = document.querySelector('#main .pdoc-sd-summary');
    if (!sum || $('hrp-dept')) return;
    css();
    var box = document.createElement('div'); box.id = 'hrp-dept'; box.className = 'hrp-dept no-print';
    box.style.cssText = 'padding:12px 24px;border-bottom:1px solid var(--border);display:none';
    sum.parentNode.insertBefore(box, sum.nextSibling);
    var ids = sdRecs().map(function (r) { return r.employee_id; }).filter(Boolean), key = ids.join(',');
    if (!ids.length || !window.sb) return;
    if (key === deptFor) { renderDept(); return; }
    sb.from('employees').select('id,department').eq('tenant_id', tid()).in('id', ids).then(function (r) {
      if (r.error) return;
      deptMap = {}; deptFor = key;
      (r.data || []).forEach(function (e) { var d = String(e.department || '').trim(); if (d) deptMap[e.id] = d; });
      renderDept();
    });
  }
  function wrapRecalc() {
    var o = window._sdRecalc;
    if (typeof o !== 'function' || o._hrpDept) return;
    var w = function () { var r = o.apply(this, arguments); try { renderDept(); } catch (e) {} return r; };
    for (var k in o) { try { w[k] = o[k]; } catch (e) {} }
    w._hrpDept = true; window._sdRecalc = w;
  }

  /* ================= Contract expiry reminder (P4) — once a day on open ================= */
  function remind() {
    if (!window.sb || !tid() || !canHR()) return;
    var k = 'hrp_ctr_' + tid(), d = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem(k) === d) return; localStorage.setItem(k, d); } catch (e) {}
    sb.rpc('hr_contract_remind').then(function () {}, function () {});
  }

  /* ================= boot ================= */
  var tmr = null;
  function scan() {
    try { mountForm(); } catch (e) { console.warn('[hr-profile] form', e); }
    try { mountCompany(); } catch (e) { console.warn('[hr-profile] company', e); }
    try { mountOT(); } catch (e) { console.warn('[hr-profile] ot', e); }
    try { mountRun(); } catch (e) { console.warn('[hr-profile] run', e); }
    try { mountSD(); } catch (e) { console.warn('[hr-profile] sd', e); }
  }
  function wraps() { wrapSave(); wrapCpSave(); wrapRun(); wrapRecalc(); }
  H.scan = scan;
  function boot() {
    var m = document.getElementById('main');
    if (!m) return setTimeout(boot, 300);
    wraps();
    new MutationObserver(function () { clearTimeout(tmr); tmr = setTimeout(scan, 80); }).observe(m, { childList: true, subtree: true });
    scan();
    setInterval(wraps, 1000);
    var tries = 0, iv = setInterval(function () { tries++; if (tid() && APP.user) { clearInterval(iv); remind(); } else if (tries > 60) clearInterval(iv); }, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
