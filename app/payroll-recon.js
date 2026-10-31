/* PAYROLL_RECON_V1 — final
 * Self-contained reconciliation view.
 * Injects button + root if missing. Uses existing cob-* classes.
 * Data from payroll_records. Notif via NT.notify.
 */
(function () {
  if (window.PAYROLL_RECON_V1) return;
  window.PAYROLL_RECON_V1 = true;

  function L(en, bm) { try { return (window.APP && APP.language === 'bm') ? bm : en; } catch (e) { return en; } }
  function fmt(n) { return typeof formatRM === 'function' ? formatRM(n) : ('RM ' + Number(n || 0).toFixed(2)); }
  function r2(n) { return Math.round(Number(n || 0) * 100) / 100; }

  function ensureRoot() {
    var root = document.getElementById('payroll-recon-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'payroll-recon-root';
      root.style.display = 'none';
      document.body.appendChild(root);
    }
    return root;
  }

  window.renderPayrollRecon = async function () {
    var el = ensureRoot();
    el.style.display = 'block';
    el.innerHTML = '<div class="cob-card">' + L('Loading…', 'Memuatkan…') + '</div>';

    try {
      var tid = window.APP && APP.tenant && APP.tenant.id;
      if (!tid || !window.sb) { el.innerHTML = '<div class="cob-card">' + L('No tenant', 'Tiada tenant') + '</div>'; return; }

      var q = await sb.from('payroll_records')
        .select('id,employee_id,year,month,net_pay,amount_paid,balance_outstanding,payment_note,employees(name,staff_code)')
        .eq('tenant_id', tid)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(50);

      var rows = q.data || [];
      var outstanding = rows.filter(function (r) {
        var bal = r.balance_outstanding != null ? r2(r.balance_outstanding) : r2((r.net_pay || 0) - (r.amount_paid || 0));
        return bal > 0.01;
      });
      var totalOut = outstanding.reduce(function (s, r) {
        var bal = r.balance_outstanding != null ? r2(r.balance_outstanding) : r2((r.net_pay || 0) - (r.amount_paid || 0));
        return s + bal;
      }, 0);

      var html = '<div style="margin-bottom:12px"><button class="btn btn-outline" onclick="document.getElementById(\'payroll-recon-root\').style.display=\'none\'">' + L('Close', 'Tutup') + '</button></div>';
      html += '<div class="cob-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">';
      html += '<div class="cob-card"><div class="cob-muted">' + L('Outstanding Employees', 'Pekerja Outstanding') + '</div><div style="font-size:22px;font-weight:700">' + outstanding.length + '</div></div>';
      html += '<div class="cob-card"><div class="cob-muted">' + L('Total Outstanding', 'Jumlah Outstanding') + '</div><div style="font-size:22px;font-weight:700">' + fmt(totalOut) + '</div></div>';
      html += '<div class="cob-card"><div class="cob-muted">' + L('Statutory Pending', 'Statutory Pending') + '</div><div style="font-size:22px;font-weight:700">—</div></div>';
      html += '</div>';

      html += '<div class="cob-card"><table class="cob-tbl"><thead><tr><th>Staff ID</th><th>' + L('Name', 'Nama') + '</th><th class="num">Gross</th><th class="num">Paid</th><th class="num">Outstanding</th><th>Status</th></tr></thead><tbody>';
      if (!rows.length) html += '<tr><td colspan="6" class="cob-muted">' + L('No payroll records', 'Tiada rekod payroll') + '</td></tr>';
      rows.forEach(function (r) {
        var emp = r.employees || {};
        var bal = r.balance_outstanding != null ? r2(r.balance_outstanding) : r2((r.net_pay || 0) - (r.amount_paid || 0));
        var status = bal > 0.01 ? '<span class="badge">' + L('Outstanding', 'Outstanding') + '</span>' : '<span class="badge">' + L('Settled', 'Settled') + '</span>';
        html += '<tr><td>' + (emp.staff_code || '—') + '</td><td>' + (emp.name || '—') + '</td><td class="num">' + fmt(r.net_pay) + '</td><td class="num">' + fmt(r.amount_paid) + '</td><td class="num">' + fmt(bal) + '</td><td>' + status + '</td></tr>';
      });
      html += '</tbody></table><div class="cob-xs" style="margin-top:8px">' + L('Data from payroll records', 'Data dari rekod payroll') + '</div></div>';

      el.innerHTML = html;

      if (outstanding.length && window.NT && typeof NT.notify === 'function') {
        NT.notify({
          type: 'payroll.outstanding',
          kind: 'for_you',
          title: L('Outstanding salary', 'Gaji outstanding'),
          body: L(outstanding.length + ' employee(s) have outstanding balance', outstanding.length + ' pekerja ada baki outstanding'),
          roles: ['owner', 'hr'],
          link: { page: 'payroll', params: { view: 'recon' } },
          group_key: 'payroll:outstanding:' + tid,
          tenant_id: tid
        });
      }
    } catch (e) {
      el.innerHTML = '<div class="cob-card">' + L('Error loading reconciliation', 'Ralat memuatkan reconciliation') + '</div>';
      console.error('[payroll-recon]', e);
    }
  };

  // Inject open button into header or main if possible
  function injectButton() {
    if (document.getElementById('btn-payroll-recon')) return;
    var btn = document.createElement('button');
    btn.id = 'btn-payroll-recon';
    btn.className = 'btn btn-outline';
    btn.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:40;white-space:nowrap';
    btn.innerHTML = '<i class="ti ti-report-money"></i> ' + L('Reconciliation', 'Reconciliation');
    btn.onclick = function () { renderPayrollRecon(); };
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton);
  } else {
    injectButton();
  }
})();
