/* PAYROLL_RECON_V1
 * Reconciliation view: cards + list of outstanding from payroll_records + SD.
 * Uses existing data. Note via payment_note or simple update.
 * Notif via NT.notify if outstanding.
 */
(function () {
  if (window.PAYROLL_RECON_V1) return;
  window.PAYROLL_RECON_V1 = true;

  function L(en, bm) { return (window.APP && APP.language === 'bm') ? bm : en; }
  function fmt(n) { return typeof formatRM === 'function' ? formatRM(n) : ('RM ' + Number(n || 0).toFixed(2)); }
  function r2(n) { return Math.round(Number(n || 0) * 100) / 100; }

  window.renderPayrollRecon = async function () {
    var el = document.getElementById('payroll-recon-root');
    if (!el) return;
    el.innerHTML = '<div class="cob-card">' + L('Loading…', 'Memuatkan…') + '</div>';

    try {
      var tid = window.APP && APP.tenant && APP.tenant.id;
      if (!tid || !window.sb) { el.innerHTML = L('No tenant', 'Tiada tenant'); return; }

      // Cards + list (example computation from payroll_records)
      var q = await sb.from('payroll_records')
        .select('id,employee_id,year,month,net_pay,amount_paid,balance_outstanding,payment_note,employees(name,staff_code)')
        .eq('tenant_id', tid)
        .is('deleted_at', null)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(100);

      var rows = q.data || [];
      var outstanding = rows.filter(function (r) {
        var bal = r.balance_outstanding != null ? r2(r.balance_outstanding) : r2(r.net_pay - (r.amount_paid || 0));
        return bal > 0;
      });

      var totalOut = outstanding.reduce(function (s, r) {
        var bal = r.balance_outstanding != null ? r2(r.balance_outstanding) : r2(r.net_pay - (r.amount_paid || 0));
        return s + bal;
      }, 0);

      var html = '<div class="cob-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">';
      html += '<div class="cob-card"><div class="cob-muted">' + L('Outstanding Employees', 'Pekerja Outstanding') + '</div><div style="font-size:24px;font-weight:700">' + outstanding.length + '</div><div class="cob-xs">Contoh data / Example data</div></div>';
      html += '<div class="cob-card"><div class="cob-muted">' + L('Total Outstanding', 'Jumlah Outstanding') + '</div><div style="font-size:24px;font-weight:700">' + fmt(totalOut) + '</div><div class="cob-xs">Contoh data / Example data</div></div>';
      html += '<div class="cob-card"><div class="cob-muted">' + L('Statutory Pending', 'Statutory Pending') + '</div><div style="font-size:24px;font-weight:700">—</div><div class="cob-xs">Contoh data / Example data</div></div>';
      html += '</div>';

      html += '<div class="cob-card"><table class="cob-tbl"><tr><th>Staff ID</th><th>Name</th><th class="num">Gross</th><th class="num">Paid</th><th class="num">Outstanding</th><th>Status</th></tr>';
      rows.slice(0, 20).forEach(function (r) {
        var emp = r.employees || {};
        var bal = r.balance_outstanding != null ? r2(r.balance_outstanding) : r2((r.net_pay || 0) - (r.amount_paid || 0));
        var status = bal > 0 ? '<span class="badge" style="background:#f59e0b;color:#fff">Outstanding</span>' : '<span class="badge" style="background:#10b981;color:#fff">Settled</span>';
        html += '<tr><td>' + (emp.staff_code || '—') + '</td><td>' + (emp.name || '—') + '</td><td class="num">' + fmt(r.net_pay) + '</td><td class="num">' + fmt(r.amount_paid) + '</td><td class="num">' + fmt(bal) + '</td><td>' + status + '</td></tr>';
      });
      html += '</table><div class="cob-xs" style="margin-top:8px">Contoh data / Example data · ' + L('Showing recent records', 'Rekod terkini') + '</div></div>';

      el.innerHTML = html;

      // Optional notif if outstanding (once)
      if (outstanding.length && window.NT && typeof NT.notify === 'function') {
        NT.notify({
          type: 'payroll.outstanding',
          kind: 'for_you',
          title: L('Outstanding salary', 'Gaji outstanding'),
          body: L(outstanding.length + ' employee(s) have outstanding', outstanding.length + ' pekerja ada outstanding'),
          roles: ['owner', 'hr'],
          link: { page: 'payroll', params: { view: 'recon' } },
          group_key: 'payroll:outstanding:' + tid,
          tenant_id: tid
        });
      }
    } catch (e) {
      el.innerHTML = '<div class="cob-card">' + L('Error loading', 'Ralat memuatkan') + '</div>';
      console.error(e);
    }
  };
})();
