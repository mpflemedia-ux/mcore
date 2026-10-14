/* M-Core Service Desk - styles. Builds on app theme vars (light + dark) and onboarding .cob-* primitives. */
(function () {
  if (document.getElementById('sd-css')) return;
  var s = document.createElement('style'); s.id = 'sd-css';
  s.textContent = [
    '.sd-g2{display:grid;grid-template-columns:minmax(0,1fr) 460px;gap:14px;align-items:start}.sd-col{display:flex;flex-direction:column;gap:14px;min-width:0}',
    '.sd-cbx{display:grid;grid-template-columns:1fr 1fr;gap:7px 12px;margin:6px 0 12px}.sd-cbx label{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;cursor:pointer;line-height:1.35}',
    '.sd-cbx input,.sd-pick input{width:18px;height:18px;accent-color:var(--primary);flex-shrink:0;margin:0}',
    '.sd-sum{display:grid;grid-template-columns:1fr 1fr;gap:12px 18px;margin-top:12px;font-size:13px}.sd-sum>div{min-width:0}.sd-sum b{display:block;overflow-wrap:anywhere;word-break:break-word}',
    '.sd-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:14px}',
    '.sd-board{display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));gap:12px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch}',
    '.sd-colm{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:10px;min-height:160px}',
    '.sd-colm>h4{display:flex;align-items:center;gap:6px;font-size:13px;margin:0 0 10px}.sd-colm>h4 .n{margin-left:auto;font-size:11px;background:var(--bg-card);border:1px solid var(--border);border-radius:99px;padding:0 7px}',
    '.sd-tk{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;margin-bottom:8px;cursor:pointer;display:block;width:100%;text-align:left;color:var(--text);font:inherit}',
    '.sd-tk:hover{border-color:var(--primary)}.sd-ref{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--text-2)}',
    '.sd-cnt{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px}.sd-cnt>div{padding:10px 4px;text-align:center}.sd-cnt b{display:block;font-size:19px}',
    '.sd-li{display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;align-items:flex-start;width:100%;background:none;border-left:0;border-right:0;border-top:0;text-align:left;color:var(--text);font:inherit}',
    '.sd-li:last-child{border-bottom:0}.sd-li:hover{background:var(--cob-sel,var(--primary-light))}',
    '.sd-fab{position:fixed;left:16px;bottom:22px;z-index:60;border-radius:99px!important;padding:12px 20px!important;box-shadow:var(--shadow-lg)}',
    '.sd-tl{position:relative}.sd-ev{display:flex;gap:10px;padding:8px 0}.sd-ev>i{font-size:18px;width:22px;flex-shrink:0;color:var(--text-2)}',
    '.sd-ev.int{background:var(--warning-bg,rgba(217,119,6,.08));border-radius:var(--radius-sm);padding:8px}',
    '.sd-file{display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--border)}.sd-file:first-of-type{border-top:0}',
    '.sd-step{display:flex;gap:6px;margin-bottom:14px}.sd-step i{flex:1;height:5px;border-radius:99px;background:var(--border)}.sd-step i.on{background:var(--primary)}',
    '.sd-pick label{display:flex;gap:10px;align-items:center;padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;cursor:pointer;background:var(--bg-card)}',
    '.sd-pick label:has(input:checked){border-color:var(--primary);box-shadow:0 0 0 1px var(--primary)}',
    '.sd-mods{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sd-acts{display:flex;gap:8px;flex-wrap:wrap}.sd-acts .btn{justify-content:center}',
    '.sd-chip{display:inline-flex;margin-left:6px;vertical-align:middle}.sd-chip .badge{font-size:10px;padding:1px 6px}',
    '@media(max-width:1100px){.sd-g2{grid-template-columns:1fr}}',
    '@media(max-width:768px){.sd-board{grid-template-columns:minmax(0,1fr);overflow-x:visible}.sd-colm{min-width:0;width:100%;min-height:0}.sd-colm:not(:has(.sd-tk)){padding:8px 10px}.sd-colm:not(:has(.sd-tk))>h4{margin:0;color:var(--text-2)}.sd-colm:not(:has(.sd-tk))>:not(h4){display:none}}',
    '@media(max-width:640px){.sd-flt>.cob-chips{flex-basis:100%}.sd-flt>input{width:100%!important}.sd-cbx,.sd-mods{grid-template-columns:1fr}.sd-acts .btn{flex:1;min-height:44px}.sd-kpis{grid-template-columns:1fr 1fr}.sd-fab{bottom:18px}}',
    '@media print{body.sd-printing *{visibility:hidden!important}body.sd-printing .sd-pack,body.sd-printing .sd-pack *{visibility:visible!important}',
    'body.sd-printing .sd-pack{position:absolute;left:0;top:0;width:100%}body.sd-printing .no-print,body.sd-printing .sd-noprint{display:none!important}.sd-pack .cob-card{break-inside:avoid}}'
  ].join('\n');
  document.head.appendChild(s);
})();
