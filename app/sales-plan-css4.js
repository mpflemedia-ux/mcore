/* Sales Plan — phase 2c styles: stock & financing cards, repayment bottom sheet, journal preview. */
(function () {
  'use strict';
  var SP = window.SP;
  SP.cssParts = (SP.cssParts || []).concat([
    '.sp-bgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}',
    '.sp-bcard{padding:14px 16px;display:flex;flex-direction:column;gap:6px;min-width:0}.sp-bcard-h{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.sp-bcard-t{min-width:0}.sp-bcard-h .badge{white-space:nowrap;flex-shrink:0}.sp-bcard-t b{font-size:15px}',
    '.sp-binb{display:flex;align-items:center;gap:5px;margin:0 0 4px}.sp-brow{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:13.5px;color:var(--text-2);padding:2px 0}.sp-brow b,.sp-bval{color:var(--text);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}',
    '.sp-brepaid{margin-top:6px}.sp-brepaid .sp-brow{font-size:12.5px}.sp-brepaid .sp-bar{height:6px;margin-top:4px}',
    '.sp-rplist{margin-top:8px;border-top:1px solid var(--border);padding-top:8px}.sp-rph{font-size:12px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px}',
    '.sp-rprow{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border);font-size:13px}.sp-rprow:last-child{border-bottom:0}',
    '.sp-bacts{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:8px}',
    '.sp-fsums{margin-bottom:12px}',
    '.sp-jprev{border:1px dashed var(--primary);border-radius:10px;padding:10px 12px;background:var(--primary-light)}.sp-jprev-h{display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px;color:var(--primary);margin-bottom:6px}',
    '.sp-jrow{display:grid;grid-template-columns:28px 1fr auto;gap:8px;font-size:13px;padding:3px 0;align-items:baseline}.sp-jrow b{font-variant-numeric:tabular-nums}.sp-jdc{color:var(--text-2);font-weight:600}.sp-jcr .sp-jdc{padding-left:10px}.sp-jcr .sp-jac{padding-left:12px}',
    '.sp-amtwrap{position:relative}.sp-amt{font-size:17px!important;font-weight:600;padding-right:84px!important}.sp-amttag{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:12.5px;color:var(--text-2);font-weight:600;pointer-events:none}',
    '.sp-split summary{cursor:pointer;font-size:13px;color:var(--primary);font-weight:600;padding:4px 0;min-height:32px}.sp-split[open] summary{margin-bottom:8px}',
    '.sp-sub{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--text-2);margin:6px 0 2px}',
    '.sp-sheet .sp-modal-box{max-width:520px}',
    '@media (max-width:900px){.sp-hide-sm{display:none}.sp-fsums{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '@media (max-width:640px){.sp-bgrid{grid-template-columns:1fr}.sp-bcard{padding:12px 14px}',
    '.sp-sheet.modal-overlay.active{align-items:flex-end}.sp-sheet .sp-modal-box{max-width:100%;width:100%;margin:0;border-radius:18px 18px 0 0;max-height:92vh;padding-top:6px;position:relative}',
    '.sp-sheet .sp-modal-box:before{content:"";position:absolute;top:6px;left:50%;width:44px;height:4px;margin-left:-22px;border-radius:4px;background:var(--border)}',
    '.sp-sheet .sp-modal-f{padding-bottom:calc(16px + env(safe-area-inset-bottom))}.sp-sheet .sp-modal-f .btn{flex:1;min-height:46px}}'
  ]);
})();
