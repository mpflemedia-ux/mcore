/* Salary Disbursement — tools v2 (screen-only; loads after sd-mobile-cards.js).
   v2: 4-signature flow (sd-signatures.js) — 'shared' reads "Awaiting signatures"; unlock / reject / reset
   say signatures are voided and notify the preparer + HR managers.
   6  Status chips per employee (Edited / Advance / Statutory 0) on the desktop payee cell + mobile card head.
   7  "Copy last month" — fills EMPTY allowance/deduction slots from the previous month's payroll_records.
   8  Locking — shared / pending_review / approved disable every SD input + Save/Copy/Recalc, show a banner;
      approved gets "Unlock to edit" (canManageHR, confirm, batch -> draft, auditLog, notify HR).
   10 "Recalculate statutory" per card + toolbar (all) via the existing _calcPayroll (+ exempt wrapper).
   Notifications (NT.notify = bell + push): batch approved / rejected -> preparer (created_by) + HR
   managers; batch unlocked / signatures reset -> preparer + HR managers. Actor always excluded by NT.notify. No amounts in text.
   Save-toast fix (9) lives in _sdSaveAll itself (index.html) — this file only refreshes baselines. */
(function () {
  if (window.SD_TOOLS_V1) return;
  window.SD_TOOLS_V1 = true;

  var LOCKED = ['shared', 'pending_review', 'approved'];
  var HR_ROLES = ['owner', 'admin', 'hr', 'manager'];
  // [id prefix, record field, isTypeSelect]
  var FIELDS = [
    ['sd-epf-', 'epf_employee'], ['sd-socso-', 'socso_employee'], ['sd-eis-', 'eis_employee'], ['sd-pcb-', 'pcb'], ['sd-zakat-', 'zakat'],
    ['sd-epf-er-', 'epf_employer'], ['sd-socso-er-', 'socso_employer'], ['sd-eis-er-', 'eis_employer'],
    ['sd-atype1-', 'allowance_type_1', 1], ['sd-a1-', 'allowance_1'], ['sd-atype2-', 'allowance_type_2', 1], ['sd-a2-', 'allowance_2'],
    ['sd-atype3-', 'allowance_type_3', 1], ['sd-a3-', 'allowance_3'], ['sd-adv-', 'advance'],
    ['sd-dtype1-', 'deduction_type_1', 1], ['sd-d1-', 'deduction_1'], ['sd-dtype2-', 'deduction_type_2', 1], ['sd-d2-', 'deduction_2']
  ];
  // _sdMarkAmended already paints these five; we only paint the rest
  var CORE_MARKED = { 'sd-epf-': 1, 'sd-socso-': 1, 'sd-eis-': 1, 'sd-pcb-': 1, 'sd-zakat-': 1 };
  var COPY_SLOTS = [
    ['sd-atype1-', 'sd-a1-', 'allowance_type_1', 'allowance_1'], ['sd-atype2-', 'sd-a2-', 'allowance_type_2', 'allowance_2'],
    ['sd-atype3-', 'sd-a3-', 'allowance_type_3', 'allowance_3'],
    ['sd-dtype1-', 'sd-d1-', 'deduction_type_1', 'deduction_1'], ['sd-dtype2-', 'sd-d2-', 'deduction_type_2', 'deduction_2']
  ];
  var STAT_OUT = [
    ['sd-epf-', 'epf_employee'], ['sd-socso-', 'socso_employee'], ['sd-eis-', 'eis_employee'], ['sd-pcb-', 'pcb'], ['sd-zakat-', 'zakat'],
    ['sd-epf-er-', 'epf_employer'], ['sd-socso-er-', 'socso_employer'], ['sd-eis-er-', 'eis_employer']
  ];

  var flags = {};          // employee_id -> {epf_exempt, skip_employer_contrib, ic_no, basic_salary, zakat_enabled, zakat_amount}
  var flagsFor = null;     // table the flags were loaded for
  var flagsReady = false;
  var flagsP = null;
  var busy = false;

  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, ms) { return bm() ? ms : en; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function toast(m, t) { try { showToast(m, t || 'success'); } catch (e) {} }
  function recs() {
    var r = null;
    try { r = (typeof _sdRecords !== 'undefined') ? _sdRecords : null; } catch (e) { r = null; }
    if (!r) r = window._sdRecords;
    return Array.isArray(r) ? r : [];
  }
  function tid() { try { return APP.tenant.id; } catch (e) { return null; } }
  function uid() { try { return APP.user.id; } catch (e) { return null; } }
  function canHR() { try { return typeof canManageHR === 'function' ? !!canManageHR() : !!window.canManageHR(); } catch (e) { return false; } }
  function period() { return { m: Number(($('sd-month') || {}).value) || 0, y: Number(($('sd-year') || {}).value) || 0 }; }
  function periodLabel(m, y) {
    try { if (typeof _pdocMonthYearLabel === 'function') return _pdocMonthYearLabel(m, y, bm()); } catch (e) {}
    var en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var ms = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
    return (bm() ? ms : en)[Math.max(0, Math.min(11, m - 1))] + ' ' + y;
  }
  function onSd() { return !!$('sd-month') && !!$('sd-pdoc'); }
  function tableEl() { return document.querySelector('#sd-content .pdoc-sd-table'); }
  function batch() { return window._sdCurrentBatch || null; }
  function lockStatus() { var b = batch(); return b && LOCKED.indexOf(b.status) >= 0 ? b.status : null; }
  function num(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function truthy(v) { return v === true || v === 'true' || v === 1 || v === '1' || v === 't' || v === 'on'; }
  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }
  function amended(el, base, isType) {
    if (!el) return false;
    if (isType) return String(el.value || '') !== String(base || '');
    return num(el.value) !== num(base);
  }
  function lockMsg(st) {
    return st === 'approved' ? L('Locked — already approved. Unlock to edit.', 'Dikunci — sudah diluluskan. Buka kunci untuk edit.')
      : L('Locked — pending approval.', 'Dikunci — menunggu kelulusan.');
  }

  /* ---------- CSS (tokens only) ---------- */
  function css() {
    if ($('sdt-css')) return;
    var s = document.createElement('style');
    s.id = 'sdt-css';
    s.textContent =
      '.sdt-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}' +
      '.sdt-chips:empty{display:none}' +
      '.badge.sdt-chip{padding:1px 7px;font-size:10px;line-height:1.5;white-space:nowrap;background:var(--bg-card);border:1px solid currentColor}' +
      '.badge.sdt-ed{color:var(--warning)}' +
      '.badge.sdt-adv{color:var(--info)}' +
      '.badge.sdt-st0{color:var(--danger)}' +
      '.sdt-tools{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px}' +
      '.sdt-tools .btn{white-space:nowrap}' +
      '.page-header>div:has(> .sdt-tools){flex-wrap:wrap}' +
      '.sdt-lock{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 12px;padding:10px 14px;border:1px solid var(--warning);' +
        'border-radius:var(--radius);background:var(--bg-card);color:var(--text);font-size:13px}' +
      '.sdt-lock.sdt-approved{border-color:var(--success)}' +
      '.sdt-lock>i{font-size:18px;color:var(--warning)}' +
      '.sdt-lock.sdt-approved>i{color:var(--success)}' +
      '.sdt-lock .sdt-lock-txt{flex:1;min-width:180px;line-height:1.4}' +
      '.sdt-lock .btn{white-space:nowrap}' +
      '@media print{.sdt-chips,.sdt-tools,.sdt-lock{display:none!important}}';
    document.head.appendChild(s);
  }

  /* ---------- employee flags (epf_exempt / skip_employer_contrib), soft-fail ---------- */
  function loadFlags() {
    var table = tableEl();
    if (flagsP && flagsFor === table) return flagsP;
    flagsFor = table; flagsReady = false; flags = {};
    var ids = [];
    recs().forEach(function (r) { if (r.employee_id && ids.indexOf(r.employee_id) < 0) ids.push(r.employee_id); });
    if (!ids.length || !window.sb) { flagsReady = true; flagsP = Promise.resolve(flags); return flagsP; }
    var full = 'id,epf_exempt,skip_employer_contrib,ic_no,basic_salary,zakat_enabled,zakat_amount';
    var lite = 'id,ic_no,basic_salary,zakat_enabled,zakat_amount';
    function q(cols) { return Promise.resolve(sb.from('employees').select(cols).eq('tenant_id', tid()).in('id', ids)); }
    flagsP = q(full).then(function (r) {
      if (r && r.error) return q(lite); // exempt columns not migrated yet
      return r;
    }).then(function (r) {
      ((r && r.data) || []).forEach(function (e) {
        flags[e.id] = { epf_exempt: truthy(e.epf_exempt), skip_employer_contrib: truthy(e.skip_employer_contrib), ic_no: e.ic_no, basic_salary: e.basic_salary, zakat_enabled: e.zakat_enabled, zakat_amount: e.zakat_amount };
      });
      flagsReady = true;
      return flags;
    }, function () { flagsReady = true; return flags; });
    flagsP.then(function () { decorate(); });
    return flagsP;
  }

  /* ---------- 6: chips + amended borders on every input ---------- */
  function rowState(r) {
    var id = r.id, edited = false;
    FIELDS.forEach(function (f) {
      var el = $(f[0] + id);
      if (el && amended(el, r[f[1]], f[2])) edited = true;
    });
    var adv = Number(($('sd-adv-' + id) || {}).value) || 0;
    var outs = window._sdAdvancesByEmployee && window._sdAdvancesByEmployee[r.employee_id];
    var hasAdv = adv > 0 || !!(outs && outs.length);
    var basic = Number(r.basic_salary != null ? r.basic_salary : ((r.employees || {}).basic_salary)) || 0;
    var f = flags[r.employee_id] || {};
    var statSum = ['sd-epf-', 'sd-socso-', 'sd-eis-'].reduce(function (s, p) { return s + Math.abs(num(($(p + id) || {}).value)); }, 0);
    var stat0 = flagsReady && basic > 0 && !f.epf_exempt && statSum === 0 && !!$('sd-epf-' + id);
    return { edited: edited, adv: hasAdv, stat0: stat0 };
  }
  function chipsHtml(st) {
    var h = '';
    if (st.edited) h += '<span class="badge sdt-chip sdt-ed" title="' + esc(L('Changed from saved / auto value', 'Diubah dari nilai simpanan / auto')) + '">' + esc(L('Edited', 'Diubah')) + '</span>';
    if (st.adv) h += '<span class="badge sdt-chip sdt-adv" title="' + esc(L('Advance deducted or outstanding', 'Panjar dipotong atau masih tertunggak')) + '">' + esc(L('Advance', 'Panjar')) + '</span>';
    if (st.stat0) h += '<span class="badge sdt-chip sdt-st0" title="' + esc(L('EPF, SOCSO and EIS are all 0', 'EPF, SOCSO dan EIS semuanya 0')) + '">' + esc(L('Statutory 0', 'Caruman 0')) + '</span>';
    return h;
  }
  function setHtml(el, h) { if (el && el.innerHTML !== h) el.innerHTML = h; }
  function paintAmended(r) {
    FIELDS.forEach(function (f) {
      if (CORE_MARKED[f[0]]) return;
      var el = $(f[0] + r.id);
      if (!el) return;
      var a = amended(el, r[f[1]], f[2]);
      var bc = a ? 'var(--warning)' : '';
      if (el.style.borderColor !== bc && !(bc === '' && !el.style.borderColor)) el.style.borderColor = bc;
      var t = a ? L('Changed from saved / auto value', 'Diubah dari nilai simpanan / auto') : '';
      if ((el.getAttribute('title') || '') !== t && (a || el.getAttribute('data-sdt-t'))) {
        if (t) { el.title = t; el.setAttribute('data-sdt-t', '1'); } else { el.removeAttribute('title'); el.removeAttribute('data-sdt-t'); }
      }
    });
  }
  function paintChips() {
    recs().forEach(function (r) {
      var st = rowState(r), h = chipsHtml(st);
      var epf = $('sd-epf-' + r.id), tr = epf && epf.closest('tr');
      var payee = tr && tr.querySelector('.pdoc-sd-payee');
      if (payee && payee.parentNode) {
        var box = payee.parentNode.querySelector(':scope > .sdt-chips');
        if (!box) {
          box = document.createElement('div');
          box.className = 'sdt-chips no-print';
          box.setAttribute('data-row', r.id);
          payee.parentNode.insertBefore(box, payee.nextSibling);
        }
        setHtml(box, h);
      }
      var cardSlot = document.querySelector('#sdc-wrap [data-chips="' + String(r.id).replace(/"/g, '') + '"]');
      setHtml(cardSlot, h);
    });
  }

  /* ---------- toolbar (7 + 10 all) ---------- */
  function ensureToolbar() {
    var anchor = $('sd-share-btn') || $('sd-review-slot') || $('sd-batch-badge');
    if (!anchor || !anchor.parentNode) return;
    var box = $('sdt-tools');
    if (box && box.parentNode === anchor.parentNode && box.getAttribute('data-lang') === (bm() ? 'bm' : 'en')) return;
    if (box) box.remove();
    box = document.createElement('span');
    box.id = 'sdt-tools';
    box.className = 'sdt-tools no-print';
    box.setAttribute('data-lang', bm() ? 'bm' : 'en');
    box.innerHTML =
      '<button type="button" class="btn btn-outline btn-sm" id="sdt-copy"><i class="ti ti-copy"></i> ' + esc(L('Copy last month', 'Salin bulan lepas')) + '</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="sdt-recalc-all"><i class="ti ti-calculator"></i> ' + esc(L('Recalculate statutory', 'Kira semula caruman')) + '</button>';
    anchor.parentNode.insertBefore(box, anchor);
    $('sdt-copy').onclick = function () { copyLastMonth(); };
    $('sdt-recalc-all').onclick = function () { recalcRows(null); };
  }

  /* ---------- 8: lock ---------- */
  var STATUS_LBL = {
    shared: ['Awaiting signatures', 'Menunggu tandatangan'],
    pending_review: ['Signed copy awaiting review', 'Salinan bertandatangan menunggu semakan'],
    approved: ['Approved', 'Diluluskan']
  };
  function lockTargets() {
    var out = [];
    recs().forEach(function (r) {
      FIELDS.forEach(function (f) { var el = $(f[0] + r.id); if (el) out.push(el); });
      var s = $('sd-advsel-' + r.id); if (s) out.push(s);
    });
    document.querySelectorAll('#sdc-wrap [data-target], #sdc-wrap [data-act], button[onclick*="_sdSaveAll"], #sdc-save, #sdt-copy, #sdt-recalc-all').forEach(function (el) { out.push(el); });
    return out;
  }
  function applyLock() {
    var st = lockStatus();
    var ban = $('sdt-lock'), pdoc = $('sd-pdoc');
    if (st) {
      lockTargets().forEach(function (el) {
        if (!el.disabled) { el.disabled = true; el.setAttribute('data-sdt-locked', '1'); }
      });
      var tools = $('sdt-tools'); if (tools && tools.style.display !== 'none') tools.style.display = 'none';
      var lbl = STATUS_LBL[st] || [st, st];
      var html = '<i class="ti ti-lock"></i><span class="sdt-lock-txt"><b>' + esc(L('Locked', 'Dikunci')) + ' · ' + esc(L(lbl[0], lbl[1])) + '</b><br>' +
        esc(st === 'approved' ? L('Editing is disabled because this month is approved.', 'Tidak boleh edit kerana bulan ini telah diluluskan.')
          : st === 'shared' ? L('Amounts are locked while the 4 signatures are collected. HR can reset signatures to edit.', 'Jumlah dikunci semasa 4 tandatangan dikumpul. HR boleh set semula tandatangan untuk edit.')
          : L('Editing is disabled until the approval is reviewed.', 'Tidak boleh edit sehingga kelulusan disemak.')) + '</span>' +
        (st === 'approved' && canHR() ? '<button type="button" class="btn btn-outline btn-sm" id="sdt-unlock"><i class="ti ti-lock-open"></i> ' + esc(L('Unlock to edit', 'Buka untuk edit')) + '</button>' : '');
      if (pdoc && pdoc.parentNode) {
        if (!ban) {
          ban = document.createElement('div');
          ban.id = 'sdt-lock';
          ban.setAttribute('role', 'status');
          var before = $('sdc-wrap') && $('sdc-wrap').parentNode === pdoc.parentNode ? $('sdc-wrap') : pdoc;
          pdoc.parentNode.insertBefore(ban, before);
        }
        var cls = 'sdt-lock no-print' + (st === 'approved' ? ' sdt-approved' : '');
        if (ban.className !== cls) ban.className = cls;
        if (ban.getAttribute('data-h') !== html) { ban.innerHTML = html; ban.setAttribute('data-h', html); }
        var ub = $('sdt-unlock'); if (ub) ub.onclick = function () { unlock(); };
      }
    } else {
      document.querySelectorAll('[data-sdt-locked]').forEach(function (el) { el.disabled = false; el.removeAttribute('data-sdt-locked'); });
      var t2 = $('sdt-tools'); if (t2 && t2.style.display === 'none') t2.style.display = '';
      if (ban) ban.remove();
    }
  }

  async function unlock() {
    var b = batch();
    if (!b || b.status !== 'approved') return;
    if (!canHR()) { toast(L('Only HR managers can unlock.', 'Hanya pengurus HR boleh buka kunci.'), 'error'); return; }
    if (!window.confirm(L('Unlock this approved salary disbursement for editing? It goes back to Draft, all 4 signatures are voided and it must be signed again.',
      'Buka kunci penyaluran gaji yang telah diluluskan untuk diedit? Status kembali ke Draf, kesemua 4 tandatangan dibatalkan dan perlu ditandatangan semula.'))) return;
    var now = new Date().toISOString(), res;
    try {
      res = await sb.from('salary_disbursement_batches').update({ status: 'draft', reviewed_by: uid(), reviewed_at: now })
        .eq('id', b.id).eq('tenant_id', tid()).select('id,month,year,status,created_by');
    } catch (e) { res = { error: e }; }
    if (!res || res.error) { toast(L('Unlock failed: ', 'Gagal buka kunci: ') + ((res && res.error && res.error.message) || ''), 'error'); return; }
    var row = (res.data || [])[0];
    if (!row) { toast(L('Unlock failed — no permission to change this batch.', 'Gagal buka kunci — tiada kebenaran untuk ubah batch ini.'), 'error'); return; }
    try { auditLog('update', 'salary_disbursement_batches', b.id, { status: 'approved' }, { status: 'draft', action: 'unlock' }); } catch (e) {}
    toast(L('Unlocked — salary disbursement is editable again (Draft).', 'Kunci dibuka — penyaluran gaji boleh diedit semula (Draf).'), 'success');
    notifyBatch('unlocked', row);
    var p = period();
    try { if (typeof window._sdBatchStatus === 'function') await window._sdBatchStatus(p.m || row.month, p.y || row.year); } catch (e) {}
    decorate();
  }

  /* ---------- notifications (NT.notify = bell + push) ---------- */
  function notifyBatch(kind, b) {
    var NT = window.NT;
    if (!NT || typeof NT.notify !== 'function' || !b || !window.sb) return Promise.resolve(0);
    var me = uid();
    return Promise.resolve(sb.from('user_profiles').select('id,role').eq('tenant_id', tid())).then(function (r) {
      var ids = [];
      ((r && r.data) || []).forEach(function (u) {
        if (HR_ROLES.indexOf(String(u.role || '').toLowerCase()) >= 0 && ids.indexOf(u.id) < 0) ids.push(u.id);
      });
      if (b.created_by && ids.indexOf(b.created_by) < 0) ids.push(b.created_by); // preparer
      ids = ids.filter(function (id) { return String(id) !== String(me); });
      if (!ids.length) return 0;
      var per = periodLabel(Number(b.month), Number(b.year));
      var who = (window.APP && APP.user && (APP.user.name || APP.user.email)) || 'M-Core';
      var T = {
        approved: [L('Salary disbursement approved · ', 'Penyaluran gaji diluluskan · ') + per, L('Approved by ', 'Diluluskan oleh ') + who, 'ti-circle-check'],
        rejected: [L('Salary disbursement rejected · ', 'Penyaluran gaji ditolak · ') + per, L('Rejected by ', 'Ditolak oleh ') + who + L(' — signatures voided; open to see the reason and fix', ' — tandatangan dibatalkan; buka untuk lihat sebab dan betulkan'), 'ti-circle-x'],
        unlocked: [L('Salary disbursement unlocked · ', 'Penyaluran gaji dibuka kunci · ') + per, L('Unlocked by ', 'Dibuka oleh ') + who + L(' — back to Draft, signatures voided, needs signing again', ' — kembali ke Draf, tandatangan dibatalkan, perlu ditandatangan semula'), 'ti-lock-open'],
        reset: [L('Salary disbursement signatures reset · ', 'Tandatangan penyaluran gaji diset semula · ') + per, L('Reset by ', 'Diset semula oleh ') + who + L(' — back to Draft, signatures voided', ' — kembali ke Draf, tandatangan dibatalkan'), 'ti-rotate']
      }[kind];
      return NT.notify({
        users: ids, kind: 'for_you', type: 'approval.payroll',
        title: T[0], body: T[1],
        ref_table: 'salary_disbursement_batches', ref_id: b.id,
        group_key: 'sdb:' + b.id + ':' + kind + ':' + Date.now(),
        link: { page: 'hr', params: { view: 'salary-disbursement', month: Number(b.month), year: Number(b.year) }, icon: T[2] }
      });
    }).catch(function () { return 0; });
  }

  /* ---------- 7: copy last month ---------- */
  async function copyLastMonth() {
    if (busy) return;
    var st = lockStatus();
    if (st) { toast(lockMsg(st), 'error'); return; }
    var p = period();
    if (!p.m || !p.y) return;
    var pm = p.m === 1 ? 12 : p.m - 1, py = p.m === 1 ? p.y - 1 : p.y;
    var rs = recs();
    if (!rs.length) return;
    busy = true;
    try {
      var cols = 'employee_id,' + COPY_SLOTS.map(function (s) { return s[2] + ',' + s[3]; }).join(',');
      var res = await sb.from('payroll_records').select(cols).eq('tenant_id', tid()).eq('month', pm).eq('year', py);
      if (res.error) { toast(L('Could not load last month: ', 'Gagal muat bulan lepas: ') + (res.error.message || ''), 'error'); return; }
      var prev = {};
      (res.data || []).forEach(function (x) { if (x.employee_id && !prev[x.employee_id]) prev[x.employee_id] = x; });
      var plan = [], rowsHit = [];
      rs.forEach(function (r) {
        var pr = prev[r.employee_id];
        if (!pr) return;
        COPY_SLOTS.forEach(function (s) {
          var amtEl = $(s[1] + r.id), typeEl = $(s[0] + r.id);
          if (!amtEl) return;
          var pv = num(pr[s[3]]);
          if (num(amtEl.value) === 0 && pv > 0) {
            plan.push({ row: r.id, amtEl: amtEl, typeEl: typeEl, type: pr[s[2]] || '', amt: pv });
            if (rowsHit.indexOf(String(r.id)) < 0) rowsHit.push(String(r.id));
          }
        });
      });
      var lbl = periodLabel(pm, py);
      if (!plan.length) {
        toast(L('Nothing to copy — no empty allowance/deduction slots match ' + lbl + '.', 'Tiada untuk disalin — tiada slot elaun/potongan kosong yang sepadan dengan ' + lbl + '.'), 'warning');
        return;
      }
      if (!window.confirm(L('Copy ' + plan.length + ' allowance/deduction item(s) from ' + lbl + ' into ' + rowsHit.length + ' employee(s)? Only empty slots are filled; statutory, advance and basic are not touched.',
        'Salin ' + plan.length + ' item elaun/potongan dari ' + lbl + ' ke ' + rowsHit.length + ' pekerja? Hanya slot kosong diisi; caruman, panjar dan gaji pokok tidak disentuh.'))) return;
      plan.forEach(function (x) {
        if (x.typeEl && x.type) {
          var has = Array.prototype.some.call(x.typeEl.options || [], function (o) { return o.value === x.type; });
          if (!has) {
            x.typeEl.appendChild(new Option(x.type, x.type));
            var cs = document.querySelector('#sdc-wrap select[data-target="' + x.typeEl.id + '"]');
            if (cs) cs.appendChild(new Option(x.type, x.type));
          }
          x.typeEl.value = x.type;
          fire(x.typeEl, 'change');
        }
        x.amtEl.value = String(x.amt);
        fire(x.amtEl, 'input');
      });
      try { if (typeof window._sdRecalc === 'function') window._sdRecalc(); } catch (e) {}
      if (window._sdMobileCards && window._sdMobileCards.markDirty) window._sdMobileCards.markDirty(rowsHit);
      toast(L('Copied ' + plan.length + ' item(s) from ' + lbl + ' — remember to Save.', 'Disalin ' + plan.length + ' item dari ' + lbl + ' — jangan lupa Simpan.'), 'success');
    } finally { busy = false; decorate(); }
  }

  /* ---------- 10: recalculate statutory ---------- */
  async function recalcRows(ids) {
    if (busy) return;
    var st = lockStatus();
    if (st) { toast(lockMsg(st), 'error'); return; }
    var calcFn = window._calcPayroll;
    if (typeof calcFn !== 'function') { try { calcFn = _calcPayroll; } catch (e) { calcFn = null; } }
    if (typeof calcFn !== 'function') return;
    busy = true;
    try {
      await loadFlags();
      var want = ids ? ids.map(String) : null;
      var rs = recs().filter(function (r) {
        if (want) return want.indexOf(String(r.id)) >= 0;
        var epf = $('sd-epf-' + r.id), tr = epf && epf.closest('tr');
        return !!epf && !(tr && tr.style.display === 'none');
      });
      if (!rs.length) return;
      var plan = [], manual = 0;
      rs.forEach(function (r) {
        var emp = r.employees || {}, f = flags[r.employee_id] || {};
        var calc = calcFn({
          basic_salary: r.basic_salary != null ? r.basic_salary : (emp.basic_salary != null ? emp.basic_salary : f.basic_salary),
          ic_no: emp.ic_no != null ? emp.ic_no : f.ic_no,
          zakat_enabled: emp.zakat_enabled != null ? emp.zakat_enabled : f.zakat_enabled,
          zakat_amount: emp.zakat_amount != null ? emp.zakat_amount : f.zakat_amount,
          epf_exempt: !!f.epf_exempt,
          skip_employer_contrib: !!f.skip_employer_contrib,
          // live SD allowance slots: per-type EPF/SOCSO/PCB flags (Payroll & OT Settings) decide which count as wages
          allowances: [1, 2, 3].map(function (i) {
            var tEl = document.getElementById('sd-atype' + i + '-' + r.id), aEl = document.getElementById('sd-a' + i + '-' + r.id);
            return { type: tEl ? (tEl.value || 'other') : (r['allowance_type_' + i] || 'other'), amount: Number(aEl ? aEl.value : r['allowance_' + i]) || 0 };
          })
        }) || {};
        STAT_OUT.forEach(function (o) {
          var el = $(o[0] + r.id);
          if (!el) return;
          var nv = num(calc[o[1]]);
          if (num(el.value) === nv) return;
          if (amended(el, r[o[1]])) manual++;
          plan.push({ row: String(r.id), el: el, v: nv });
        });
      });
      if (!plan.length) { toast(L('Statutory already matches the calculation.', 'Caruman sudah sama dengan kiraan.'), 'success'); return; }
      if (manual > 0 && !window.confirm(L(manual + ' statutory value(s) were edited manually. Overwrite them with recalculated amounts?',
        manual + ' nilai caruman telah diubah secara manual. Tulis ganti dengan nilai kiraan semula?'))) return;
      var rowsHit = [];
      plan.forEach(function (x) {
        x.el.value = x.v.toFixed(2);
        fire(x.el, 'input');
        if (rowsHit.indexOf(x.row) < 0) rowsHit.push(x.row);
      });
      try { if (typeof window._sdRecalc === 'function') window._sdRecalc(); } catch (e) {}
      if (window._sdMobileCards && window._sdMobileCards.markDirty) window._sdMobileCards.markDirty(rowsHit);
      toast(L('Statutory recalculated for ' + rowsHit.length + ' employee(s) — remember to Save.', 'Caruman dikira semula untuk ' + rowsHit.length + ' pekerja — jangan lupa Simpan.'), 'success');
    } finally { busy = false; decorate(); }
  }

  /* ---------- decorate: idempotent, called from cards refresh + after batch status ---------- */
  var decorating = false;
  function decorate() {
    if (decorating || !onSd() || !tableEl()) return;
    decorating = true;
    try {
      css();
      if (flagsFor !== tableEl()) loadFlags();
      ensureToolbar();
      recs().forEach(paintAmended);
      paintChips();
      applyLock();
    } catch (e) {} finally { decorating = false; }
  }

  /* ---------- wrappers ---------- */
  function copyFlags(from, to) { try { Object.keys(from).forEach(function (k) { to[k] = from[k]; }); } catch (e) {} }
  function wrapBatchStatus() {
    var o = window._sdBatchStatus;
    if (typeof o !== 'function' || o._sdt1) return;
    var w = async function () {
      try { return await o.apply(this, arguments); } finally { try { decorate(); } catch (e) {} }
    };
    copyFlags(o, w); w._sdt1 = true;
    window._sdBatchStatus = w;
  }
  function wrapSave() {
    var o = window._sdSaveAll;
    if (typeof o !== 'function' || o._sdt1) return;
    var w = async function () {
      if (lockStatus()) { toast(lockMsg(lockStatus()), 'error'); window._sdLastSave = { total: 0, ok: [], failed: [], blocked: true }; return; }
      var out = await o.apply(this, arguments);
      // rows that saved: DB now equals the inputs -> new baseline so Edited / amber borders clear
      var ls = window._sdLastSave;
      if (ls && Array.isArray(ls.ok) && ls.ok.length && typeof window._sdRowValues === 'function') {
        recs().forEach(function (r) {
          if (ls.ok.indexOf(String(r.id)) < 0) return;
          var v = window._sdRowValues(r) || {};
          FIELDS.forEach(function (f) { if (Object.prototype.hasOwnProperty.call(v, f[1])) r[f[1]] = v[f[1]]; });
        });
        try { if (typeof window._sdRecalc === 'function') window._sdRecalc(); } catch (e) {}
      }
      decorate();
      return out;
    };
    copyFlags(o, w); w._sdt1 = true;
    window._sdSaveAll = w;
  }
  function wrapReview() {
    var o = window._sdReviewApply;
    if (typeof o !== 'function' || o._sdt1) return;
    var w = async function (id, action) {
      var before = null;
      try {
        var b = await sb.from('sd_approvals').select('id,batch_id,status').eq('id', id).eq('tenant_id', tid()).maybeSingle();
        before = b && b.data;
      } catch (e) {}
      var out = await o.apply(this, arguments);
      try {
        if (before && before.status === 'pending' && before.batch_id) {
          var a = await sb.from('salary_disbursement_batches').select('id,month,year,status,created_by').eq('id', before.batch_id).eq('tenant_id', tid()).maybeSingle();
          var row = a && a.data;
          if (row) {
            if (action === 'approve' && row.status === 'approved') await notifyBatch('approved', row);
            else if (action !== 'approve' && row.status === 'draft') await notifyBatch('rejected', row);
          }
        }
      } catch (e) {}
      return out;
    };
    copyFlags(o, w); w._sdt1 = true;
    window._sdReviewApply = w;
  }
  function wrapAll() { wrapBatchStatus(); wrapSave(); wrapReview(); }

  css();
  wrapAll();
  setTimeout(wrapAll, 800);
  setTimeout(wrapAll, 2500);

  window._sdTools = { decorate: decorate, recalcRows: recalcRows, copyLastMonth: copyLastMonth, unlock: unlock, notifyBatch: notifyBatch, rowState: rowState, _flags: function () { return flags; } };
})();
