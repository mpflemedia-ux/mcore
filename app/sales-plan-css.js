/* Sales Plan — File 11/12: scoped styles (.sp-*). Injected with each paint; no global CSS changes. */
(function () {
  'use strict';
  var SP = window.SP;
  var C = [
    /* scoped tokens (light default, dark override) */
    '.sp-root{--sp-track:rgba(15,23,42,.10);--sp-ic-blue:#2563EB;--sp-ic-green:#16A34A;--sp-watch:#854D0E;--sp-bad:#B91C1C;--sp-in:var(--bg-card);--sp-in-b:var(--border-2)}',
    '[data-theme="dark"] .sp-root{--sp-track:rgba(231,233,235,.08);--sp-ic-blue:#93C5FD;--sp-ic-green:#86EFAC;--sp-watch:#FDE68A;--sp-bad:#FCA5A5;--sp-in:rgba(255,255,255,.06);--sp-in-b:rgba(255,255,255,.16)}',
    '.sp-root th,.sp-root .empty-state,.sp-root .stat-label,.sp-root ::placeholder{color:var(--text-2)}',
    '.sp-root .empty-state>i{font-size:40px;margin-bottom:10px;color:var(--text-2)}.sp-root .empty-state .btn i{font-size:16px;margin:0;opacity:1}.sp-root .empty-state h3{color:var(--text)}',
    '.sp-hint{font-size:12px;color:var(--text-2);line-height:1.45;margin-top:4px}',
    '.sp-t2{color:var(--text-2)}.sp-num{text-align:right;font-variant-numeric:tabular-nums}.sp-nowrap{white-space:nowrap}.sp-center{text-align:center}.sp-mb{margin:-4px 0 12px}',
    '.sp-dash{color:var(--text-2)}',
    '.sp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.sp-sec-title{display:flex;align-items:center;gap:6px;margin-bottom:10px}.sp-sec-title i{color:var(--primary)}',
    '.sp-iconbtn{width:40px;height:40px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:var(--text);font-size:20px;flex-shrink:0}',
    '.sp-iconbtn:hover{background:var(--sp-track)}.sp-iconbtn:focus-visible,.sp-chip:focus-visible,.sp-tab:focus-visible,.sp-row:focus-visible,.sp-pcard:focus-visible,.sp-seg button:focus-visible,.sp-switch:focus-visible,.sp-src:focus-visible,.sp-stat:focus-visible{outline:2px solid var(--primary);outline-offset:2px}',
    '.sp-del{width:34px;height:34px;font-size:17px;color:var(--sp-bad)}',
    '.sp-empty{padding:8px}.sp-empty-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px}',
    /* list */
    '.sp-list-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}',
    '.sp-head-actions{display:flex;gap:8px;flex-wrap:wrap}',
    '.sp-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}',
    '.sp-stat{display:flex;align-items:center;gap:12px;text-align:left;width:100%;color:inherit;font:inherit}',
    'button.sp-stat{cursor:pointer}button.sp-stat:hover{border-color:var(--border-2)}.sp-stat-txt{min-width:0}.sp-stat .stat-value{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '[data-theme="dark"] .sp-root .stat-icon.blue{color:var(--sp-ic-blue)}[data-theme="dark"] .sp-root .stat-icon.green{color:var(--sp-ic-green)}[data-theme="dark"] .sp-root .stat-icon.yellow{color:var(--sp-watch)}[data-theme="dark"] .sp-root .stat-icon.red{color:var(--sp-bad)}',
    '.sp-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap}',
    '.sp-chips,.sp-chiprow{display:flex;gap:6px;flex-wrap:wrap}',
    '.sp-chip{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:6px 12px;border-radius:99px;border:1px solid var(--border-2);font-size:13px;color:var(--text-2);background:transparent}',
    '.sp-chip:hover{color:var(--text)}.sp-chip.on{border-color:var(--primary);color:var(--primary);background:var(--primary-light);font-weight:600}',
    '.sp-search{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 12px;border-radius:var(--radius-sm);border:1px solid var(--sp-in-b);background:var(--sp-in);color:var(--text-2);min-width:240px}',
    '.sp-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font-size:14px;height:38px}',
    '.sp-search:focus-within{border-color:var(--primary)}',
    '.sp-table-card{padding:0;overflow:hidden}.sp-tscroll{overflow-x:auto;-webkit-overflow-scrolling:touch}',
    '.sp-table{width:100%;border-collapse:collapse;font-size:13px}',
    '.sp-table th{font-size:12px;font-weight:600;text-align:left;padding:10px 14px;border-bottom:1px solid var(--border);white-space:nowrap}',
    '.sp-table td{padding:11px 14px;border-bottom:1px solid var(--border);vertical-align:middle}.sp-table tr:last-child td{border-bottom:0}',
    '.sp-table td.sp-num,.sp-table .badge,.sp-pcard .badge{white-space:nowrap}',
    '.sp-row{cursor:pointer}.sp-row:hover td{background:var(--sp-track)}',
    '.sp-pname{font-weight:600;color:var(--text);overflow-wrap:anywhere}.sp-c-plan{min-width:200px;max-width:320px}.sp-c-prog{width:160px}',
    '.sp-srccell{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;color:var(--text-2)}',
    '.sp-prog{display:flex;align-items:center;gap:8px}.sp-bar{flex:1;min-width:70px;height:6px;border-radius:99px;background:var(--sp-track);overflow:hidden}',
    '.sp-bar>i{display:block;height:100%;border-radius:99px}.sp-pct{font-size:12px;min-width:44px;text-align:right;color:var(--text-2);font-variant-numeric:tabular-nums}',
    '.sp-cards{display:none;flex-direction:column;gap:10px}',
    '.sp-pcard{padding:14px;cursor:pointer}.sp-pcard-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.sp-pcard-name{min-width:0}',
    '.sp-pcard-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;margin:12px 0}',
    '.sp-pcard-grid span{display:block;font-size:11.5px;color:var(--text-2)}.sp-pcard-grid b{display:block;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
    '.sp-pcard-foot{display:flex;align-items:center;gap:12px}.sp-pcard-foot .sp-prog{flex:1}.sp-pcard-pic{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--text-2);white-space:nowrap}',
    '.sp-tpls{margin-top:16px}.sp-tpl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}',
    '.sp-tpl{padding:12px 14px;display:flex;align-items:center;gap:12px}.sp-tpl-ic{width:36px;height:36px;font-size:18px;flex-shrink:0}',
    '.sp-tpl-txt{flex:1;min-width:0}.sp-tpl-name{font-weight:600;font-size:13px;overflow-wrap:anywhere}.sp-tpl-list{display:flex;flex-direction:column;gap:10px}',
    ''
  ];
  SP.cssParts = (SP.cssParts || []).concat(C);
  SP.css = function () { return SP.cssParts.join(''); };
})();
