/* PAYROLL_RECON_V1 — button only on HR page, in flow
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
      root.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;overflow:auto;padding:16px';
      document.body.appendChild(root);
    }
    return root;
  }

  window.renderPayrollRecon = async function () {
    var el = ensureRoot();
    el.style.display = 'block';
    el.innerHTML = '<div class="cob-card" style="max-width:960px;margin:24px auto">' + L('Loading…', 'Memuatkan…') + '</div>';
    try {
      var tid = window.APP && APP.tenant && APP.tenant.id;
      if (!tid || !window.sb) { el.innerHTML = '<div class="cob-card" style="max-width:960px;margin:24px auto">' + L('No tenant', 'Tiada tenant') + '</div>'; return; }
      var q = await sb.from('payroll_records')
        .select('id,employee_id,year,month,net_pay,amount_paid,balance_outstanding,employees(name,staff_code)')
        .eq('tenant_id', tid)
        .order('year', { ascending: false }).order('month', { ascending: false }).limit(50);
      var rows = q.data || [];
      var outstanding = rows.filter(function (r) {
        var bal = r.balance_outstanding != null ? r2(r.balance_outstanding) : r2((r.net_pay || 0) - (r.amount_paid || 0));
        return bal > 0.01;
      });
      var totalOut = outstanding.reduce(function (s, r) {
        var bal = r.balance_outstanding != null ? r2(r.balance_outstanding) : r2((r.net_pay || 0) - (r.amount_paid || 0));
        return s + bal;
      }, 0);
      var html = '<div class="cob-card" style="max-width:960px;margin:24px auto;position:relative">';
      html += '<button class="btn btn-outline" style="position:absolute;top:12px;right:12px" onclick="document.getElementById(\'payroll-recon-root\').style.display=\'none\'">' + L('Close', 'Tutup') + '</button>';
      html += '<h3 style="margin:0 0 12px">' + L('Reconciliation', 'Reconciliation') + '</h3>';
      html += '<div class="cob-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px">';
      html += '<div class="cob-card"><div class="cob-muted">' + L('Outstanding', 'Outstanding') + '</div><div style="font-size:20px;font-weight:700">' + outstanding.length + '</div></div>';
      html += '<div class="cob-card"><div class="cob-muted">' + L('Total', 'Jumlah') + '</div><div style="font-size:20px;font-weight:700">' + fmt(totalOut) + '</div></div>';
      html += '</div><table class="cob-tbl"><thead><tr><th>Staff ID</th><th>' + L('Name', 'Nama') + '</th><th class="num">Gross</th><th class="num">Paid</th><th class="num">Outstanding</th></tr></thead><tbody>';
      rows.forEach(function (r) {
        var emp = r.employees || {};
        var bal = r.balance_outstanding != null ? r2(r.balance_outstanding) : r2((r.net_pay || 0) - (r.amount_paid || 0));
        html += '<tr><td>' + (emp.staff_code || '—') + '</td><td>' + (emp.name || '—') + '</td><td class="num">' + fmt(r.net_pay) + '</td><td class="num">' + fmt(r.amount_paid) + '</td><td class="num">' + fmt(bal) + '</td></tr>';
      });
      html += '</tbody></table></div>';
      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = '<div class="cob-card" style="max-width:960px;margin:24px auto">' + L('Error', 'Ralat') + '</div>';
    }
  };

  function isHrPage() {
    return /hr|payroll/i.test(location.hash || '') || document.querySelector('h1, h2') && /HR & Payroll|SDM & Gaji/i.test(document.body.innerText);
  }

  function injectIfHr() {
    if (!isHrPage() || document.getElementById('btn-payroll-recon')) return;
    var target = document.querySelector('.cob-root') || document.getElementById('main') || document.body;
    var btn = document.createElement('button');
    btn.id = 'btn-payroll-recon';
    btn.className = 'btn btn-primary';
    btn.style.cssText = 'margin:12px 16px;display:inline-block';
    btn.textContent = L('Reconciliation', 'Reconciliation');
    btn.onclick = renderPayrollRecon;
    target.appendChild(btn);
  }

  setTimeout(injectIfHr, 800);
  setTimeout(injectIfHr, 2000);
})();
