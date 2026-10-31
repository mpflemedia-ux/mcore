/* PAYROLL_RECON_V2 — Reconciliation (payroll balance outstanding).
 * v2: button lives only in the HR & Payroll page header (injected after renderEmployeeList),
 *     no more page-sniffing via body text (sidebar label "HR & Payroll" matched on every page).
 *     Modal uses the shared .cob-modal/.cob-mbox pattern: header row title + Close (nowrap),
 *     padded stat cards, table in .cob-scroll so it never overflows the phone screen.
 */
(function () {
  if (window.PAYROLL_RECON_V2) return;
  window.PAYROLL_RECON_V2 = true;

  function L(en, bm) { try { return (window.APP && APP.language === 'bm') ? bm : en; } catch (e) { return en; } }
  function fmt(n) { return typeof formatRM === 'function' ? formatRM(n) : ('RM ' + Number(n || 0).toFixed(2)); }
  function r2(n) { return Math.round(Number(n || 0) * 100) / 100; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function bal(r) { return r.balance_outstanding != null ? r2(r.balance_outstanding) : r2((r.net_pay || 0) - (r.amount_paid || 0)); }

  (function css() {
    if (document.getElementById('prc-css')) return;
    var s = document.createElement('style'); s.id = 'prc-css';
    s.textContent = '#payroll-recon-root .cob-mbox{max-width:960px;max-height:90vh}' +
      '.prc-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border);flex-wrap:nowrap}' +
      '.prc-hd h3{margin:0;font-size:16px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.prc-hd .btn{white-space:nowrap;flex-shrink:0}' +
      '#payroll-recon-root .cob-mbody{padding:14px 16px}' +
      '.prc-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px}.prc-stats .cob-card{padding:10px 12px;min-width:0}' +
      '.prc-stats .v{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(max-width:640px){.prc-stats .v{font-size:17px}}.prc-mut{font-size:12px;color:var(--text-2)}' +
      '.prc-tw{border:1px solid var(--border);border-radius:var(--radius,12px)}.prc-tw .cob-tbl td.num,.prc-tw .cob-tbl td:first-child{white-space:nowrap}.prc-tw .cob-tbl td:nth-child(2){min-width:140px}';
    (document.head || document.documentElement).appendChild(s);
  })();

  function close() { var r = document.getElementById('payroll-recon-root'); if (r) { r.style.display = 'none'; r.innerHTML = ''; } }
  window.closePayrollRecon = close;

  function ensureRoot() {
    var root = document.getElementById('payroll-recon-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'payroll-recon-root';
      root.className = 'cob-modal';
      root.addEventListener('click', function (e) { if (e.target === root) close(); });
      document.body.appendChild(root);
    }
    root.style.display = 'flex';
    return root;
  }

  function shell(body) {
    return '<div class="cob-card cob-mbox" role="dialog" aria-modal="true" aria-labelledby="prc-title">' +
      '<div class="prc-hd"><h3 id="prc-title">' + L('Reconciliation', 'Rekonsiliasi') + '</h3>' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="closePayrollRecon()">' + L('Close', 'Tutup') + '</button></div>' +
      '<div class="cob-mbody">' + body + '</div></div>';
  }

  window.renderPayrollRecon = async function () {
    var el = ensureRoot();
    el.innerHTML = shell('<div class="prc-mut">' + L('Loading…', 'Memuatkan…') + '</div>');
    try {
      var tid = window.APP && APP.tenant && APP.tenant.id;
      if (!tid || !window.sb) { el.innerHTML = shell('<div class="prc-mut">' + L('No tenant', 'Tiada tenant') + '</div>'); return; }
      var q = await sb.from('payroll_records')
        .select('id,employee_id,year,month,net_pay,amount_paid,balance_outstanding,employees(name,staff_code)')
        .eq('tenant_id', tid)
        .order('year', { ascending: false }).order('month', { ascending: false }).limit(50);
      var rows = q.data || [];
      var outstanding = rows.filter(function (r) { return bal(r) > 0.01; });
      var totalOut = outstanding.reduce(function (s, r) { return s + bal(r); }, 0);
      var html = '<div class="prc-stats">' +
        '<div class="cob-card"><div class="prc-mut">' + L('Outstanding', 'Tertunggak') + '</div><div class="v">' + outstanding.length + '</div></div>' +
        '<div class="cob-card"><div class="prc-mut">' + L('Total', 'Jumlah') + '</div><div class="v">' + fmt(totalOut) + '</div></div></div>';
      html += '<div class="cob-scroll prc-tw"><table class="cob-tbl"><thead><tr><th>' + L('Staff ID', 'ID Staf') + '</th><th>' + L('Name', 'Nama') + '</th><th class="num">' + L('Net Pay', 'Gaji Bersih') + '</th><th class="num">' + L('Paid', 'Dibayar') + '</th><th class="num">' + L('Outstanding', 'Tertunggak') + '</th></tr></thead><tbody>';
      rows.forEach(function (r) {
        var emp = r.employees || {};
        html += '<tr><td>' + esc(emp.staff_code || '—') + '</td><td>' + esc(emp.name || '—') + '</td><td class="num">' + fmt(r.net_pay) + '</td><td class="num">' + fmt(r.amount_paid) + '</td><td class="num">' + fmt(bal(r)) + '</td></tr>';
      });
      if (!rows.length) html += '<tr><td colspan="5" class="prc-mut" style="text-align:center;padding:20px">' + L('No payroll records', 'Tiada rekod gaji') + '</td></tr>';
      html += '</tbody></table></div>';
      el.innerHTML = shell(html);
    } catch (e) {
      el.innerHTML = shell('<div style="color:var(--danger)">' + L('Error', 'Ralat') + '</div>');
    }
  };

  /* Button: only in the HR & Payroll (employee list) page header, next to Add Employee. */
  function injectBtn() {
    var old = document.getElementById('btn-payroll-recon');
    if (!window.APP || APP.currentPage !== 'hr') { if (old) old.remove(); return; }
    if (old) return;
    var bar = document.querySelector('#main > .page-header > div:last-child');
    if (!bar || !document.getElementById('emp-list-wrap')) return;
    var btn = document.createElement('button');
    btn.id = 'btn-payroll-recon';
    btn.type = 'button';
    btn.className = 'btn btn-outline btn-sm';
    btn.innerHTML = '<i class="ti ti-scale"></i> ' + esc(L('Reconciliation', 'Rekonsiliasi'));
    btn.onclick = function () { window.renderPayrollRecon(); };
    var add = bar.querySelector('.btn-primary');
    bar.insertBefore(btn, add || null);
  }

  function wrap() {
    var o = window.renderEmployeeList;
    if (typeof o !== 'function' || o._prcV2) return;
    window.renderEmployeeList = function () {
      var r = o.apply(this, arguments);
      try { injectBtn(); } catch (e) {}
      if (r && typeof r.then === 'function') r.then(function () { try { injectBtn(); } catch (e) {} });
      return r;
    };
    window.renderEmployeeList._prcV2 = true;
  }
  /* Leaving the page (or Back) closes the modal. */
  function wrapNav() {
    var o = window.openPage;
    if (typeof o !== 'function' || o._prcV2) return;
    window.openPage = function () { close(); return o.apply(this, arguments); };
    window.openPage._prcV2 = true;
  }
  function boot() { wrap(); wrapNav(); try { injectBtn(); } catch (e) {} }
  boot(); setTimeout(boot, 400); setTimeout(boot, 1500);
})();
