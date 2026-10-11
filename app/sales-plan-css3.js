/* Sales Plan — phase 2b styles: overview, weekly update, milestones (scoped to .sp-root). */
(function () {
  'use strict';
  var SP = window.SP;
  SP.cssParts = (SP.cssParts || []).concat([
    '.sp-root{--sp-ok:#166534;--sp-ic-orange:#C2410C;--sp-ic-red:#B91C1C;--sp-bar-t:rgba(14,116,144,.32)}',
    '[data-theme="dark"] .sp-root{--sp-ok:#86EFAC;--sp-ic-orange:#FDBA74;--sp-ic-red:#FCA5A5;--sp-bar-t:rgba(34,211,238,.28)}',
    '.sp-ok{color:var(--sp-ok)!important}.sp-wt{color:var(--sp-watch)!important}.sp-bad{color:var(--sp-bad)!important}.sp-pad{padding:14px 2px}.sp-okic{color:var(--sp-ok)}',
    '.sp-ic{width:34px;height:34px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}',
    '.sp-ic-blue{background:rgba(37,99,235,.12);color:var(--sp-ic-blue)}.sp-ic-green{background:rgba(22,163,74,.12);color:var(--sp-ic-green)}.sp-ic-orange{background:rgba(234,88,12,.13);color:var(--sp-ic-orange)}.sp-ic-red{background:rgba(220,38,38,.12);color:var(--sp-ic-red)}',
    '.sp-warn-top{margin:0 0 14px}',
    '.sp-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}',
    '.sp-kpi{padding:14px 16px;min-width:0}.sp-kpi-h{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px}.sp-kpi-l{font-size:12.5px;color:var(--text-2);font-weight:500}',
    '.sp-kpi-v{display:flex;align-items:baseline;gap:4px;flex-wrap:wrap;margin-bottom:8px}.sp-kpi-v b{font-size:22px;font-weight:700;font-family:"Space Grotesk",Inter,sans-serif;font-variant-numeric:tabular-nums}.sp-kpi-v span{font-size:12.5px;color:var(--text-2)}',
    '.sp-kbar{height:6px;margin-bottom:8px}.sp-kpi-s{font-size:12px;color:var(--text-2);line-height:1.5}.sp-kpi-s b{color:var(--text)}',
    '.sp-mbadges{display:flex;gap:8px;flex-wrap:wrap}.sp-mbadge{display:inline-flex;align-items:center;gap:4px}.sp-mbadge b{color:var(--text);font-size:12px}',
    '.sp-orow{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:14px;margin-bottom:14px}',
    '.sp-ocard{padding:14px 16px;min-width:0}.sp-ocard-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;flex-wrap:wrap}.sp-ocard-h .sp-sec-title{margin:0}.sp-ocard-h .sp-hint{margin:0}',
    '.sp-legend{display:flex;gap:12px;font-size:12px;color:var(--text-2)}.sp-legend span{display:inline-flex;align-items:center;gap:5px}.sp-legend i{width:10px;height:10px;border-radius:3px;display:inline-block}',
    '.sp-lg-t{background:var(--sp-bar-t);border:1px solid var(--primary)}.sp-lg-a{background:var(--primary)}',
    '.sp-chart-wrap{overflow-x:auto}.sp-chart{width:100%;min-width:480px;height:auto;display:block}',
    '.sp-chart .sp-grid-l{stroke:var(--border);stroke-width:1}.sp-chart .sp-ax{fill:var(--text-2);font-size:11px}.sp-chart .sp-bt{fill:var(--sp-bar-t);stroke:var(--primary);stroke-width:1}.sp-chart .sp-ba{fill:var(--primary)}',
    '.sp-chart .sp-vl{fill:var(--text-2);font-size:10.5px}.sp-chart .sp-vla{fill:var(--primary);font-weight:700}.sp-chart-empty{padding:40px 10px;text-align:center}',
    '.sp-mtable td,.sp-mtable th{padding:9px 10px}.sp-mtable tfoot td{border-top:1px solid var(--border)}',
    '.sp-mrow{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px}.sp-mrow:last-of-type{border-bottom:0}',
    '.sp-mcode{font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--text-2)}.sp-mtitle{flex:1;min-width:0;overflow-wrap:anywhere}.sp-mdate{color:var(--text-2);white-space:nowrap;font-size:12.5px}',
    '.sp-link{display:inline-flex;align-items:center;gap:4px;color:var(--primary);font-size:13px;font-weight:600;margin-top:8px;min-height:36px}',
    '.sp-arow{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--border)}.sp-arow:last-child{border-bottom:0}.sp-atitle{font-size:13px;font-weight:600;overflow-wrap:anywhere}.sp-arow .sp-hint{margin-top:2px}',
    /* weekly */
    '.sp-srcbar{display:flex;align-items:center;gap:10px 16px;flex-wrap:wrap;padding:10px 14px;margin-bottom:12px}.sp-srcbar-l{font-size:13px;font-weight:600}',
    '.sp-radios{display:flex;gap:6px 14px;flex-wrap:wrap}.sp-radio{display:inline-flex;align-items:center;gap:7px;min-height:38px;font-size:13px;color:var(--text);padding:0 4px}.sp-radio:disabled{cursor:default;opacity:.85}',
    '.sp-radio i{width:17px;height:17px;border-radius:50%;border:2px solid var(--text-2);display:inline-block;flex-shrink:0}.sp-radio.on i{border-color:var(--primary);box-shadow:inset 0 0 0 3px var(--bg-card);background:var(--primary)}',
    '.sp-radio .sp-hint{margin:0}.sp-saved{margin:0 0 0 auto;display:inline-flex;align-items:center;gap:5px}.sp-srcbar-r{display:flex;gap:8px;flex-wrap:wrap}',
    '.sp-wsums{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:12px}.sp-wsum{padding:12px 14px;min-width:0}.sp-wsum .sp-kpi-v{margin:4px 0 0}.sp-wsum .sp-kpi-v b{font-size:20px}',
    '.sp-wbadges{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}',
    '.sp-wtable th{text-transform:uppercase;font-size:11px;letter-spacing:.3px}.sp-wtable td{padding:7px 10px;white-space:nowrap}.sp-wtable th{padding:10px}',
    '.sp-wtable tr.sp-cur td{background:var(--primary-light)}.sp-thisweek{display:inline-block;margin-left:6px;font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:99px;background:var(--primary-light);color:var(--primary);border:1px solid var(--primary)}',
    '.sp-win{width:96px;min-height:36px!important;padding:5px 8px!important;text-align:right;font-variant-numeric:tabular-nums;font-size:13px!important}',
    '.sp-wfoot{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--border);font-size:12px;color:var(--text-2)}',
    '.sp-edit-sw{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid var(--sp-in-b);background:var(--sp-in);margin-right:6px;vertical-align:-2px}',
    '.sp-wcards{display:none;flex-direction:column;gap:10px}.sp-wcard{padding:12px 14px}.sp-wcard.sp-cur{border-color:var(--primary)}.sp-wcard-h{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px}',
    '.sp-wcard-g{display:grid;grid-template-columns:1fr;gap:8px}.sp-wcard-g label{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--text-2)}.sp-wcard-g .sp-win{width:130px}',
    '.sp-wcard-f{display:flex;gap:16px;margin-top:10px;font-size:12.5px;color:var(--text-2)}.sp-wcard-f b{color:var(--text)}.sp-wk-foot{display:none}',
    /* milestones */
    '.sp-mhead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap}.sp-mhead .sp-hint{margin:0;flex:1;min-width:220px}',
    '.sp-mstable td{vertical-align:top}.sp-acts{white-space:nowrap;text-align:right}.sp-acts .btn{margin-right:4px}.sp-mnote{display:flex;gap:4px;align-items:flex-start}.sp-mcard-a{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}',
    '@media (max-width:1480px){.sp-win{width:78px}.sp-wtable td,.sp-wtable th{padding-left:7px;padding-right:7px}}',
    '@media (max-width:900px){.sp-kpis,.sp-wsums{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-orow{grid-template-columns:1fr}.sp-saved{margin-left:0;width:100%}}',
    '@media (max-width:640px){.sp-kpis,.sp-wsums{gap:8px}.sp-kpi,.sp-wsum{padding:12px}.sp-kpi-v b{font-size:18px}.sp-wsum .sp-kpi-v b{font-size:17px}.sp-ocard{padding:12px}',
    '.sp-mtable{min-width:0!important}.sp-mtable td,.sp-mtable th{padding:8px 4px;font-size:12px}.sp-mtable .badge{white-space:normal;text-align:center;line-height:1.25}.sp-wtable-card{display:none}.sp-wcards{display:flex;padding-bottom:84px}.sp-wk-foot{display:flex}.sp-srcbar-r [data-act="wk-save"]{display:none}.sp-mrow{flex-wrap:wrap}.sp-mtitle{flex-basis:60%}}'
  ]);
})();
