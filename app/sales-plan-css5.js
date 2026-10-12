/* Sales Plan — phase 2d styles: weekly report (screen + print, scoped to .sp-rpt) and import preview. */
(function () {
  'use strict';
  var SP = window.SP;
  SP.cssParts = (SP.cssParts || []).concat([
    '.sp-rpt-tb{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 auto 14px;max-width:980px}.sp-rpt-tb .btn-primary{margin-left:auto}',
    '.sp-rpt-wl{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-2)}.sp-rpt-wl .form-select{min-width:190px;min-height:38px}',
    '.sp-rpt{max-width:980px;margin:0 auto;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:14px;padding:28px 32px}',
    '.sp-rpt-h{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid var(--primary);padding-bottom:14px;margin-bottom:18px}.sp-rpt-h h1{font-size:22px;margin:2px 0 4px;color:var(--text)}',
    '.sp-rpt-k{font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--primary)}.sp-rpt-m{font-size:13px;color:var(--text-2);line-height:1.5}.sp-rpt-m.r{text-align:right}',
    '.sp-rpt-kp{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:18px}.sp-rpt-kp>div{border:1px solid var(--border);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}',
    '.sp-rpt-kp span{font-size:12px;color:var(--text-2)}.sp-rpt-kp b{font-size:17px;font-variant-numeric:tabular-nums}.sp-rpt-kp small{font-size:12px;color:var(--text-2)}.sp-rpt-st{justify-content:center}',
    '.sp-rpt-s{margin-bottom:18px;break-inside:avoid}.sp-rpt-s h2{font-size:15px;margin:0 0 8px;color:var(--text)}.sp-rpt-tw{overflow-x:auto}',
    '.sp-rpt-t{width:100%;border-collapse:collapse;font-size:13px}.sp-rpt-t th{text-align:left;font-size:12px;color:var(--text-2);font-weight:600;border-bottom:1px solid var(--border);padding:6px 8px;white-space:nowrap}.sp-rpt-t td{padding:6px 8px;border-bottom:1px solid var(--border);font-variant-numeric:tabular-nums}.sp-rpt-t .r{text-align:right}',
    '.sp-rs{font-weight:600;white-space:nowrap}.sp-rs-on,.sp-rs-ach,.sp-rs-paid{color:var(--success)}.sp-rs-watch,.sp-rs-risk{color:var(--warning)}.sp-rs-off,.sp-rs-overdue{color:var(--danger)}.sp-rs-nu,.sp-rs-ip,.sp-rs-pend,.sp-rs-self{color:var(--primary)}.sp-rs-ns,.sp-rs-nt,.sp-rs-nd{color:var(--text-2)}',
    '.sp-rpt-al{margin:0;padding-left:18px;font-size:13px;line-height:1.6}.sp-rpt-danger b{color:var(--danger)}.sp-rpt-warning b{color:var(--warning)}.sp-rpt-n,.sp-rpt-e{font-size:13px;color:var(--text-2);margin:0 0 8px}',
    '.sp-rpt-f{border-top:1px solid var(--border);padding-top:10px;font-size:11px;color:var(--text-2);text-align:right}',
    '.sp-chiprow .sp-chip{flex-shrink:1;min-width:0;max-width:100%;min-height:40px;white-space:normal;text-align:left;line-height:1.35}.sp-chiprow .sp-chip>span{min-width:0;overflow-wrap:anywhere}.sp-chiprow .sp-chip>i{flex-shrink:0}',
    '@media (max-width:900px){.sp-rpt-kp{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-rpt-st{grid-column:span 2}}',
    '@media (max-width:640px){.sp-rpt{padding:16px 14px;border-radius:12px}.sp-rpt-h{flex-direction:column}.sp-rpt-m.r{text-align:left}.sp-rpt-h h1{font-size:19px}.sp-rpt-wl{flex:1}.sp-rpt-wl .form-select{min-width:0;flex:1}.sp-rpt-tb .btn-primary{margin-left:0;width:100%;justify-content:center}.sp-rpt-t{font-size:12px}.sp-rpt-t th,.sp-rpt-t td{padding:5px 6px}.sp-rpt-t td:first-child{min-width:130px}.sp-rpt-kp b{font-size:15px}}',
    '@media print{.sp-rpt-tb{display:none!important}.sp-rpt{max-width:none;border:0;border-radius:0;padding:0;background:#fff!important;color:#000!important}.sp-rpt *{color:#000!important;background:transparent!important;box-shadow:none!important}',
    '.sp-rpt .sp-rpt-k,.sp-rpt .sp-rs-on,.sp-rpt .sp-rs-ach,.sp-rpt .sp-rs-paid{color:#166534!important}.sp-rpt .sp-rs-off,.sp-rpt .sp-rs-overdue,.sp-rpt .sp-rpt-danger b{color:#991B1B!important}.sp-rpt .sp-rs-watch,.sp-rpt .sp-rs-risk,.sp-rpt .sp-rpt-warning b{color:#854D0E!important}',
    '.sp-rpt-h{border-bottom-color:#000!important}.sp-rpt-kp{grid-template-columns:repeat(5,1fr)!important}.sp-rpt-kp>div,.sp-rpt-t th,.sp-rpt-t td{border-color:#999!important}.sp-rpt-tw{overflow:visible!important}.sp-rpt-t tr{break-inside:avoid}.sp-rpt-t thead{display:table-header-group}}',
    '.sp-imp .sp-modal-box{max-width:640px}.sp-imp-c{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.sp-imp-c span{border:1px solid var(--border);border-radius:999px;padding:4px 10px;font-size:13px;color:var(--text-2)}.sp-imp-c b{color:var(--text)}',
    '.sp-imp-l{max-height:46vh;overflow:auto;border:1px solid var(--border);border-radius:10px}.sp-imp-r{display:flex;flex-direction:column;gap:2px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:13px}.sp-imp-r:last-child{border-bottom:0}.sp-imp-r span{color:var(--text-2);overflow-wrap:anywhere}',
    '.sp-imp-sk{font-size:13px;margin:6px 0}.sp-imp-sk summary{cursor:pointer;color:var(--warning);font-weight:600;min-height:28px}.sp-imp-sk ul{margin:4px 0 0;padding-left:18px;color:var(--text-2)}.sp-imp-e{font-size:14px;color:var(--text-2)}'
  ]);
})();
