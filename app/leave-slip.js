/* Leave slip: branded print + Hostinger SMTP email (fallback mailto) */
(function () {
  var NAVY = '#0B1F3A';
  var GOLD = '#C4A35A';
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
    var tn = APP.tenant || {};
    try {
      var tq = await sb.from('tenants')
        .select('name,logo_url,address,address_line2,city,postcode,state,country,phone,sst_gst_no')
        .eq('id', APP.tenant.id).maybeSingle();
      if (tq.data) tn = tq.data;
    } catch (err) {}
    return { l: l, emp: emp, appr: appr, tenant: tn };
  }
  function addr(tn) {
    return [tn.address, tn.address_line2, [tn.postcode, tn.city].filter(Boolean).join(' '), tn.state, tn.country]
      .filter(Boolean).join(', ');
  }
  function slipHtml(d) {
    var l = d.l, emp = d.emp, tn = d.tenant || {};
    var half = l.is_half_day || Number(l.days_count) === 0.5;
    var sess = l.half_session === 'pm' ? (isBm() ? 'Petang' : 'PM') : (l.half_session === 'am' ? (isBm() ? 'Pagi' : 'AM') : '');
    var logo = tn.logo_url
      ? '<img src="' + esc(tn.logo_url) + '" alt="logo" style="height:56px;max-width:180px;object-fit:contain">'
      : '';
    var contact = [tn.phone, String(tn.name || '').toLowerCase().indexOf('phion') >= 0 ? 'hello@phion.my' : '']
      .filter(Boolean).join(' · ');
    return '<div style="font-family:Georgia,Times,serif;max-width:720px;margin:0 auto;color:' + NAVY + '">' +
      '<div style="background:' + NAVY + ';color:#fff;padding:18px 22px;display:flex;gap:16px;align-items:center">' +
      logo +
      '<div style="flex:1"><div style="font-size:20px;font-weight:700">' + esc(tn.name || '') + '</div>' +
      '<div style="font-size:12px;color:' + GOLD + ';margin-top:4px">' + (isBm() ? 'Slip Cuti' : 'Leave Slip') + '</div>' +
      '<div style="font-size:11px;color:#cbd5e1;margin-top:6px;line-height:1.45">' +
      esc(addr(tn)) + (contact ? '<br>' + esc(contact) : '') + '</div></div></div>' +
      '<div style="height:4px;background:' + GOLD + '"></div>' +
      '<div style="padding:18px 22px"><table style="width:100%;border-collapse:collapse;font-size:14px;font-family:Segoe UI,Arial,sans-serif">' +
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
      '</table></div></div>';
  }
  function row(k, v) {
    return '<tr><td style="padding:8px 0;border-bottom:1px solid #e8e0d0;width:34%;color:#5b6b7c">' + esc(k) +
      '</td><td style="padding:8px 0;border-bottom:1px solid #e8e0d0;color:' + NAVY + ';font-weight:600">' + esc(v) + '</td></tr>';
  }
  function printSlip(html) {
    var w = window.open('', '_blank');
    if (!w) { showToast(isBm() ? 'Benarkan pop-up' : 'Allow pop-up', 'error'); return; }
    w.document.write('<html><head><title>Leave Slip</title></head><body style="margin:0;background:#fff">' + html +
      '<script>setTimeout(function(){window.print()},300)<\/script></body></html>');
    w.document.close();
  }
  function mailText(d) {
    var half = d.l.is_half_day || Number(d.l.days_count) === 0.5;
    return (isBm() ? 'Assalamualaikum / Salam,\n\nLampirkan butiran cuti yang diluluskan:\n\n' : 'Hello,\n\nPlease find the approved leave details:\n\n') +
      (d.tenant && d.tenant.name ? d.tenant.name + '\n' : '') +
      (isBm() ? 'Pekerja: ' : 'Employee: ') + (d.emp.nickname || d.emp.name) + '\n' +
      (isBm() ? 'Jenis: ' : 'Type: ') + typeLabel(d.l.leave_type) + (half ? ' (half-day)' : '') + '\n' +
      (isBm() ? 'Tarikh: ' : 'Dates: ') + d.l.start_date + ' → ' + d.l.end_date + '\n' +
      (isBm() ? 'Hari: ' : 'Days: ') + d.l.days_count + '\n' +
      (isBm() ? 'Sebab: ' : 'Reason: ') + (d.l.reason || '-') + '\n' +
      'Status: ' + (d.l.status || '-') + '\n';
  }
  async function emailSlip(d) {
    var email = (d.emp && d.emp.email || '').trim();
    if (!email) {
      showToast(isBm() ? 'Staff tiada email pada rekod pekerja' : 'Staff has no email on employee record', 'error');
      return;
    }
    var sub = (isBm() ? 'Slip Cuti' : 'Leave Slip') + ' — ' + (d.emp.nickname || d.emp.name || '') + ' — ' + d.l.start_date;
    var text = mailText(d);
    try {
      var res = await sb.functions.invoke('send-email', {
        body: { to: email, subject: sub, text: text, html: slipHtml(d) }
      });
      if (res.error) throw res.error;
      if (res.data && res.data.success === false) throw new Error(res.data.error || 'send failed');
      showToast(isBm() ? 'Slip dihantar ke ' + email : 'Slip sent to ' + email, 'success');
      return;
    } catch (err) {
      showToast((isBm() ? 'SMTP belum siap. Buka email app. ' : 'SMTP not ready. Opening mail app. ') + (err.message || ''), 'error');
      window.location.href = 'mailto:' + encodeURIComponent(email) +
        '?subject=' + encodeURIComponent(sub) + '&body=' + encodeURIComponent(text);
    }
  }
  window._leaveSlipPrint = async function (id) {
    try { var d = await loadSlip(id); printSlip(slipHtml(d)); }
    catch (e) { showToast(e.message || String(e), 'error'); }
  };
  window._leaveSlipEmail = async function (id) {
    try { var d = await loadSlip(id); await emailSlip(d); }
    catch (e) { showToast(e.message || String(e), 'error'); }
  };
})();
