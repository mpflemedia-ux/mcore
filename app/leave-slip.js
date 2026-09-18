/* Leave slip: print + mailto staff email */
(function () {
  function isBm() { return APP.language === 'bm'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function typeLabel(ty) {
    var m = isBm()
      ? { annual: 'Cuti Tahunan', medical: 'Cuti Sakit', emergency: 'Cuti Kecemasan', unpaid: 'Cuti Tanpa Gaji' }
      : { annual: 'Annual Leave', medical: 'Medical Leave', emergency: 'Emergency Leave', unpaid: 'Unpaid Leave' };
    return m[ty] || ty || '-';
  }
  async function loadSlip(id) {
    var q = await sb.from('leave_requests')
      .select('id,leave_type,start_date,end_date,days_count,status,reason,is_half_day,half_session,employee_id,approved_by')
      .eq('id', id).maybeSingle();
    var l = q.data;
    if (!l) throw new Error(q.error && q.error.message || 'No leave');
    var e = await sb.from('employees').select('name,nickname,email,position,ic_no').eq('id', l.employee_id).maybeSingle();
    var emp = e.data || {};
    var appr = '';
    if (l.approved_by) {
      var u = await sb.from('user_profiles').select('full_name').eq('id', l.approved_by).maybeSingle();
      appr = (u.data && u.data.full_name) || '';
    }
    return { l: l, emp: emp, appr: appr, tenant: (APP.tenant && APP.tenant.name) || '' };
  }
  function slipHtml(d) {
    var l = d.l, emp = d.emp;
    var half = l.is_half_day || Number(l.days_count) === 0.5;
    var sess = l.half_session === 'pm' ? (isBm() ? 'Petang' : 'PM') : (l.half_session === 'am' ? (isBm() ? 'Pagi' : 'AM') : '');
    return '<div style="font-family:sans-serif;max-width:640px;margin:24px auto;color:#0f172a">' +
      '<h2 style="margin:0 0 4px">' + esc(d.tenant) + '</h2>' +
      '<div style="font-size:13px;color:#475569;margin-bottom:16px">' + (isBm() ? 'Slip Cuti' : 'Leave Slip') + '</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
      row(isBm() ? 'Pekerja' : 'Employee', (emp.nickname ? emp.nickname + ' — ' : '') + (emp.name || '-')) +
      row(isBm() ? 'Jawatan' : 'Position', emp.position || '-') +
      row('Email', emp.email || '-') +
      row(isBm() ? 'Jenis cuti' : 'Leave type', typeLabel(l.leave_type) + (half ? ' (' + (isBm() ? 'setengah hari' : 'half-day') + (sess ? ' ' + sess : '') + ')' : '')) +
      row(isBm() ? 'Tarikh mula' : 'Start', l.start_date) +
      row(isBm() ? 'Tarikh tamat' : 'End', l.end_date) +
      row(isBm() ? 'Bil. hari' : 'Days', l.days_count) +
      row('Status', l.status || '-') +
      row(isBm() ? 'Sebab' : 'Reason', l.reason || '-') +
      row(isBm() ? 'Diluluskan oleh' : 'Approved by', d.appr || '-') +
      '</table></div>';
  }
  function row(k, v) {
    return '<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;width:38%;color:#475569">' + esc(k) +
      '</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">' + esc(v) + '</td></tr>';
  }
  function printSlip(html) {
    var w = window.open('', '_blank');
    if (!w) { showToast(isBm() ? 'Benarkan pop-up' : 'Allow pop-up', 'error'); return; }
    w.document.write('<html><head><title>Leave Slip</title></head><body>' + html +
      '<script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
  }
  function emailSlip(d, html) {
    var email = (d.emp && d.emp.email || '').trim();
    if (!email) {
      showToast(isBm() ? 'Staff tiada email pada rekod pekerja' : 'Staff has no email on employee record', 'error');
      return;
    }
    var sub = (isBm() ? 'Slip Cuti' : 'Leave Slip') + ' — ' + (d.emp.nickname || d.emp.name || '') + ' — ' + d.l.start_date;
    var half = d.l.is_half_day || Number(d.l.days_count) === 0.5;
    var body =
      (isBm() ? 'Assalamualaikum / Salam,' : 'Hello,') + '\n\n' +
      (isBm() ? 'Lampirkan butiran cuti yang diluluskan:' : 'Please find the approved leave details:') + '\n\n' +
      (isBm() ? 'Pekerja: ' : 'Employee: ') + (d.emp.nickname || d.emp.name) + '\n' +
      (isBm() ? 'Jenis: ' : 'Type: ') + typeLabel(d.l.leave_type) + (half ? ' (half-day)' : '') + '\n' +
      (isBm() ? 'Tarikh: ' : 'Dates: ') + d.l.start_date + ' → ' + d.l.end_date + '\n' +
      (isBm() ? 'Hari: ' : 'Days: ') + d.l.days_count + '\n' +
      (isBm() ? 'Sebab: ' : 'Reason: ') + (d.l.reason || '-') + '\n' +
      'Status: ' + (d.l.status || '-') + '\n\n' +
      (d.tenant || 'M-Core');
    window.location.href = 'mailto:' + encodeURIComponent(email) +
      '?subject=' + encodeURIComponent(sub) +
      '&body=' + encodeURIComponent(body);
  }
  window._leaveSlipPrint = async function (id) {
    try {
      var d = await loadSlip(id);
      printSlip(slipHtml(d));
    } catch (e) { showToast(e.message || String(e), 'error'); }
  };
  window._leaveSlipEmail = async function (id) {
    try {
      var d = await loadSlip(id);
      emailSlip(d, slipHtml(d));
    } catch (e) { showToast(e.message || String(e), 'error'); }
  };
  function injectBtns(cell, id) {
    if (!id || cell.querySelector('.lv-slip-btns')) return;
    var bar = document.createElement('div');
    bar.className = 'lv-slip-btns';
    bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';
    bar.innerHTML =
      '<button type="button" class="btn btn-outline btn-sm" onclick="_leaveSlipPrint(\'' + id + '\')">' +
      (isBm() ? 'Cetak slip' : 'Print slip') + '</button>' +
      '<button type="button" class="btn btn-primary btn-sm" onclick="_leaveSlipEmail(\'' + id + '\')">' +
      (isBm() ? 'Emel ke staff' : 'Email staff') + '</button>';
    cell.appendChild(bar);
  }
  function scan() {
    document.querySelectorAll('.lv-detail-row td').forEach(function (td) {
      var tr = td.parentNode && td.parentNode.previousElementSibling;
      var id = tr && tr.getAttribute('data-leave-id');
      if (id) injectBtns(td, id);
    });
  }
  function wrapApprove() {
    var orig = window._leaveSetStatus;
    if (typeof orig !== 'function' || orig._slip) return;
    window._leaveSetStatus = async function (id, status) {
      var r = await orig.apply(this, arguments);
      if (status === 'approved') {
        setTimeout(function () {
          if (confirm(isBm() ? 'Hantar slip cuti ke email staff?' : 'Email leave slip to staff?')) {
            window._leaveSlipEmail(id);
          }
        }, 300);
      }
      return r;
    };
    window._leaveSetStatus._slip = true;
  }
  function boot() { wrapApprove(); scan(); }
  setInterval(boot, 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
