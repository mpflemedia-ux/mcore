/* Capture Print/Email clicks even if other handlers missing */
(function () {
  if (window._lvEmailClickBound) return;
  window._lvEmailClickBound = true;
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest && ev.target.closest('[data-slip]');
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    var tr = btn.closest('tr');
    var row = tr && tr.classList.contains('lv-detail-row') ? tr.previousElementSibling : tr;
    var id = row && row.getAttribute('data-leave-id');
    if (!id && window._leaveRequests && window._leaveRequests[0]) id = window._leaveRequests[0].id;
    var kind = btn.getAttribute('data-slip');
    if (kind === 'print') {
      if (typeof window._leaveSlipPrint === 'function') window._leaveSlipPrint(id);
      else if (typeof showToast === 'function') showToast('Print not loaded', 'error');
      return;
    }
    if (kind !== 'email') return;
    if (typeof showToast === 'function') showToast(APP.language === 'bm' ? 'Menghantar email...' : 'Sending email...', 'info');
    if (typeof window._leaveSlipEmail === 'function') {
      window._leaveSlipEmail(id);
      return;
    }
    sendDirect(id);
  }, true);

  async function sendDirect(id) {
    try {
      if (!id || !window.sb) throw new Error('No leave id');
      var q = await sb.from('leave_requests').select('id,leave_type,start_date,end_date,days_count,status,reason,employee_id').eq('id', id).maybeSingle();
      var l = q.data;
      if (!l) throw new Error('Leave not found');
      var e = await sb.from('employees').select('name,nickname,email').eq('id', l.employee_id).maybeSingle();
      var emp = e.data || {};
      if (!emp.email) throw new Error('Staff has no email');
      var sub = 'Leave Slip — ' + (emp.nickname || emp.name) + ' — ' + l.start_date;
      var text = 'Employee: ' + (emp.nickname || emp.name) + '\nType: ' + l.leave_type +
        '\nDates: ' + l.start_date + ' -> ' + l.end_date + '\nDays: ' + l.days_count +
        '\nReason: ' + (l.reason || '-') + '\nStatus: ' + l.status;
      var res = await sb.functions.invoke('send-email', {
        body: { tenant_id: APP.tenant.id, to: emp.email, subject: sub, text: text }
      });
      console.log('send-email', res);
      if (res.error) throw res.error;
      if (res.data && res.data.success === false) throw new Error(res.data.error || 'send failed');
      showToast('Slip sent to ' + emp.email, 'success');
    } catch (err) {
      console.error(err);
      showToast((err && err.message) || String(err), 'error');
    }
  }
})();
