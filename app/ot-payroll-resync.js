/* OT_PAYROLL_RESYNC_V1
 * Shared OT re-sum → payroll_records.ot_amount + net_pay.
 * - Approve/Reject: if slip already exists for employee+period, update NOW.
 * - Run Payroll: post-pass re-sum (fixes payslip-statutory-partial wrap that dropped OT).
 * Idempotent re-sum only — NEVER incremental add. No new tables.
 */
(function () {
  if (window.OT_PAYROLL_RESYNC_V1) return;
  window.OT_PAYROLL_RESYNC_V1 = true;

  function isBm() {
    try { return APP.language === 'bm'; } catch (e) { return false; }
  }
  function r2(n) {
    return Math.round(Number(n || 0) * 100) / 100;
  }
  function monthEndYMD(year, month) {
    // Local calendar last day — avoid toISOString UTC shift (MYT Oct 31 → Oct 30).
    var d = new Date(year, month, 0);
    if (typeof _dbFmtYMD === 'function') return _dbFmtYMD(d);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function monthStartYMD(year, month) {
    return year + '-' + String(month).padStart(2, '0') + '-01';
  }
  function periodFromClaimDate(claimDate) {
    var s = String(claimDate || '').slice(0, 10);
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return { year: Number(m[1]), month: Number(m[2]) };
  }
  function fmtRM(n) {
    return typeof formatRM === 'function' ? formatRM(n) : ('RM ' + r2(n).toFixed(2));
  }

  /** Same filters as index.html _payrollRunExecute Phase 7 (fresh + already-attached). */
  async function _otFetchApprovedForPeriod(empId, month, year, existingPrId) {
    var monthStart = monthStartYMD(year, month);
    var monthEnd = monthEndYMD(year, month);
    var otRows = [];
    var lookupError = null;
    try {
      var fresh = await sb.from('ot_claims').select('id,amount,approved_amount')
        .eq('tenant_id', APP.tenant.id).eq('employee_id', empId).eq('status', 'approved')
        .is('payroll_record_id', null).is('deleted_at', null)
        .gte('claim_date', monthStart).lte('claim_date', monthEnd);
      if (fresh.error) {
        lookupError = fresh.error;
        console.error('ot_claims (unattached) lookup error', fresh.error);
      }
      otRows = otRows.concat(fresh.data || []);
      if (existingPrId) {
        var att = await sb.from('ot_claims').select('id,amount,approved_amount')
          .eq('tenant_id', APP.tenant.id).eq('employee_id', empId).eq('status', 'approved')
          .eq('payroll_record_id', existingPrId).is('deleted_at', null)
          .gte('claim_date', monthStart).lte('claim_date', monthEnd);
        if (att.error) {
          lookupError = att.error;
          console.error('ot_claims (already-attached) lookup error', att.error);
        }
        otRows = otRows.concat(att.data || []);
      }
    } catch (e) {
      lookupError = e;
      console.error('ot_claims lookup for payroll', e);
    }
    var otAmount = r2(otRows.reduce(function (s, c) {
      return s + Number(c.approved_amount != null ? c.approved_amount : c.amount || 0);
    }, 0));
    return { otRows: otRows, otAmount: otAmount, lookupError: lookupError, monthStart: monthStart, monthEnd: monthEnd };
  }
  window._otFetchApprovedForPeriod = _otFetchApprovedForPeriod;

  /** Net from existing payroll row fields + otAmount — matches _sdRowValues (preserves SD edits). */
  function _otNetFromRow(row, otAmount) {
    var totalAllowance = Number(row.allowance_1 || 0) + Number(row.allowance_2 || 0) + Number(row.allowance_3 || 0);
    var totalDeduction = Number(row.advance || 0) + Number(row.deduction_1 || 0) + Number(row.deduction_2 || 0);
    return r2(
      Number(row.basic_salary || 0) + totalAllowance + Number(row.commission || 0) + Number(otAmount || 0)
      - Number(row.epf_employee || 0) - Number(row.socso_employee || 0) - Number(row.eis_employee || 0)
      - Number(row.pcb || 0) - Number(row.zakat || 0) - totalDeduction
    );
  }
  window._otNetFromRow = _otNetFromRow;

  /**
   * Re-sum approved OT into existing payroll_records for employee+period.
   * Returns { updated, reason, otAmount, prId, lookupError }.
   * reason: 'updated' | 'no_slip' | 'no_tenant' | 'lookup_error' | 'write_error'
   */
  async function _otResyncExistingPayroll(empId, month, year) {
    if (!APP || !APP.tenant || !APP.tenant.id || !empId || !month || !year) {
      return { updated: false, reason: 'no_tenant', otAmount: 0 };
    }
    var prSel = await sb.from('payroll_records').select(
      'id,basic_salary,allowance_1,allowance_2,allowance_3,commission,advance,deduction_1,deduction_2,' +
      'epf_employee,socso_employee,eis_employee,pcb,zakat,ot_amount,net_pay,amount_paid,balance_outstanding'
    ).eq('tenant_id', APP.tenant.id).eq('employee_id', empId).eq('month', month).eq('year', year).maybeSingle();

    if (prSel.error && /ot_amount/i.test(prSel.error.message || '')) {
      prSel = await sb.from('payroll_records').select(
        'id,basic_salary,allowance_1,allowance_2,allowance_3,commission,advance,deduction_1,deduction_2,' +
        'epf_employee,socso_employee,eis_employee,pcb,zakat,net_pay,amount_paid,balance_outstanding'
      ).eq('tenant_id', APP.tenant.id).eq('employee_id', empId).eq('month', month).eq('year', year).maybeSingle();
    }
    if (prSel.error) {
      console.error('_otResyncExistingPayroll PR lookup', prSel.error);
      return { updated: false, reason: 'lookup_error', otAmount: 0, lookupError: prSel.error };
    }
    var row = prSel.data;
    if (!row || !row.id) {
      return { updated: false, reason: 'no_slip', otAmount: 0 };
    }

    var fetched = await _otFetchApprovedForPeriod(empId, month, year, row.id);
    if (fetched.lookupError) {
      return { updated: false, reason: 'lookup_error', otAmount: 0, lookupError: fetched.lookupError, prId: row.id };
    }
    var otAmount = fetched.otAmount;
    var netPay = _otNetFromRow(row, otAmount);
    var payload = { ot_amount: otAmount, net_pay: netPay };
    if (row.amount_paid != null || row.balance_outstanding != null) {
      payload.balance_outstanding = r2(netPay - Number(row.amount_paid || 0));
    }

    var up = await sb.from('payroll_records').update(payload).eq('id', row.id).eq('tenant_id', APP.tenant.id);
    if (up.error && /ot_amount/i.test(up.error.message || '')) {
      console.error('payroll_records.ot_amount column missing — run supabase/hr_ot_payroll_integration_01.sql', up.error);
      var soft = { net_pay: netPay };
      if (payload.balance_outstanding != null) soft.balance_outstanding = payload.balance_outstanding;
      up = await sb.from('payroll_records').update(soft).eq('id', row.id).eq('tenant_id', APP.tenant.id);
    }
    if (up.error) {
      console.error('_otResyncExistingPayroll write', up.error);
      return { updated: false, reason: 'write_error', otAmount: otAmount, prId: row.id, lookupError: up.error };
    }

    if (fetched.otRows.length) {
      var mark = await sb.from('ot_claims').update({ payroll_record_id: row.id }).in('id', fetched.otRows.map(function (c) { return c.id; }));
      if (mark.error) console.error('ot_claims mark paid failed', mark.error);
    }
    try { auditLog('update', 'payroll_records', row.id, { ot_amount: row.ot_amount, net_pay: row.net_pay }, payload); } catch (e) {}
    return { updated: true, reason: 'updated', otAmount: otAmount, prId: row.id };
  }
  window._otResyncExistingPayroll = _otResyncExistingPayroll;

  async function claimStatus(claimId) {
    var res = await sb.from('ot_claims').select('id,employee_id,claim_date,status')
      .eq('id', claimId).eq('tenant_id', APP.tenant.id).maybeSingle();
    return res;
  }

  async function resyncAfterClaimChange(claimId, expectStatus) {
    var bm = isBm();
    var res = await claimStatus(claimId);
    if (res.error || !res.data) {
      showToast(bm ? 'OT OK — gagal semak slip' : 'OT OK — could not check payslip', 'error');
      return;
    }
    var claim = res.data;
    if (String(claim.status) !== String(expectStatus)) return; // cancelled / failed early return
    var per = periodFromClaimDate(claim.claim_date);
    if (!per) {
      showToast(bm ? 'OT OK — tarikh tuntutan tidak sah untuk slip' : 'OT OK — claim date invalid for payslip', 'error');
      return;
    }
    var r = await _otResyncExistingPayroll(claim.employee_id, per.month, per.year);
    var approved = expectStatus === 'approved';
    if (r.reason === 'no_slip') {
      showToast(
        approved
          ? (bm ? 'OT diluluskan — masuk slip bila Run Payroll' : 'OT approved — applies on Run Payroll')
          : (bm ? 'OT ditolak — tiada slip tempoh ini' : 'OT rejected — no payslip for this period'),
        'success'
      );
      return;
    }
    if (r.reason === 'lookup_error' || r.reason === 'write_error') {
      showToast(
        bm
          ? ('OT OK — gagal sync slip: ' + ((r.lookupError && r.lookupError.message) || r.reason))
          : ('OT OK — payslip sync failed: ' + ((r.lookupError && r.lookupError.message) || r.reason)),
        'error'
      );
      return;
    }
    if (r.updated) {
      var otTxt = fmtRM(r.otAmount);
      showToast(
        approved
          ? (bm ? ('OT diluluskan · slip dikemaskini · OT ' + otTxt) : ('OT approved · payslip updated · OT ' + otTxt))
          : (bm ? ('OT ditolak · slip dikemaskini · OT ' + otTxt) : ('OT rejected · payslip updated · OT ' + otTxt)),
        'success'
      );
    }
  }

  async function callSilencingSuccessToast(fn, args) {
    var orig = window.showToast;
    var held = [];
    window.showToast = function (m, t) {
      if (t === 'success') { held.push({ m: m, t: t }); return; }
      return orig.apply(this, arguments);
    };
    try {
      return await fn.apply(null, args);
    } finally {
      window.showToast = orig;
    }
  }

  function wrapApprove() {
    var o = window._otApproveClaim;
    if (typeof o !== 'function' || o._otResync) return;
    window._otApproveClaim = async function (id, otHours) {
      await callSilencingSuccessToast(o, arguments);
      try { await resyncAfterClaimChange(id, 'approved'); } catch (e) {
        console.error('OT approve resync', e);
      }
    };
    window._otApproveClaim._otResync = true;
  }

  function wrapReject() {
    var o = window._otRejectClaim;
    if (typeof o !== 'function' || o._otResync) return;
    window._otRejectClaim = async function (id) {
      await callSilencingSuccessToast(o, arguments);
      try { await resyncAfterClaimChange(id, 'rejected'); } catch (e) {
        console.error('OT reject resync', e);
      }
    };
    window._otRejectClaim._otResync = true;
  }

  /** Post-pass after any _payrollRunExecute (incl. statutory wrap that dropped OT). */
  function wrapPayrollRun() {
    var o = window._payrollRunExecute;
    if (typeof o !== 'function' || o._otResync) return;
    window._payrollRunExecute = async function () {
      var bm = isBm();
      var month = Number((document.getElementById('payroll-month') || {}).value);
      var year = Number((document.getElementById('payroll-year') || {}).value);
      var checks = Array.from(document.querySelectorAll('.payroll-emp-check:checked'));
      var result = await o.apply(this, arguments);
      if (!month || !year || !checks.length) return result;
      var otTotal = 0, ok = 0, errN = 0, lastErr = null;
      for (var i = 0; i < checks.length; i++) {
        var empId = checks[i].value;
        try {
          var r = await _otResyncExistingPayroll(empId, month, year);
          if (r.updated) { ok++; otTotal += Number(r.otAmount || 0); }
          else if (r.reason === 'lookup_error' || r.reason === 'write_error') {
            errN++;
            lastErr = r.lookupError;
          }
        } catch (e) {
          errN++;
          lastErr = e;
          console.error('OT payroll post-pass', e);
        }
      }
      var el = document.getElementById('payroll-run-result');
      var otLabel = otTotal > 0
        ? (' · OT ' + fmtRM(otTotal))
        : (errN
          ? (bm ? ' · OT lookup gagal' : ' · OT lookup failed')
          : (bm ? ' · Tiada OT ditemui' : ' · No OT found'));
      if (el && /OT |Tiada OT|No OT/.test(el.innerHTML || '') === false) {
        el.innerHTML = (el.innerHTML || '') + '<span style="color:var(--text-2)">' + otLabel + '</span>';
      }
      if (errN && lastErr) {
        showToast(
          (bm ? 'Payroll OK — OT sync isu: ' : 'Payroll OK — OT sync issue: ') + (lastErr.message || String(lastErr)),
          'error'
        );
      } else if (otTotal > 0) {
        showToast((bm ? 'OT digabung ke slip' : 'OT merged into payslips') + otLabel, 'success');
      }
      return result;
    };
    window._payrollRunExecute._otResync = true;
    // Stop payslip-statutory-partial / pay-date delayed boots from replacing this wrap
    // (they check _statPartial / _payDateV1 and would drop OT post-pass).
    window._payrollRunExecute._statPartial = true;
    window._payrollRunExecute._payDateV1 = true;
  }

  /** Initial SD grandTotal must include ot_amount (live _sdRecalc already does via _sdRowValues). */
  function wrapSdGrandTotal() {
    var o = window.renderSalaryDisbursement;
    if (typeof o !== 'function' || o._otResyncGrand) return;
    window.renderSalaryDisbursement = function () {
      var r = o.apply(this, arguments);
      var fix = function () {
        try {
          if (typeof _sdRecalc === 'function') _sdRecalc();
        } catch (e) {}
      };
      if (r && typeof r.then === 'function') r.then(function () { setTimeout(fix, 80); });
      else setTimeout(fix, 80);
      return r;
    };
    window.renderSalaryDisbursement._otResyncGrand = true;
  }

  function boot() {
    wrapApprove();
    wrapReject();
    wrapPayrollRun();
    wrapSdGrandTotal();
  }
  boot();
  setTimeout(boot, 400);
  setTimeout(boot, 1200);
  setTimeout(boot, 2500);
})();
