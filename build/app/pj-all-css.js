/* M-Core Projects All-projects view - styles (theme vars only, light + dark). */
(function () {
  if (document.getElementById('pja-css')) return;
  var c = document.createElement('style'); c.id = 'pja-css';
  c.textContent =
    '.pja-bar{display:none;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;margin-bottom:8px}' +
    '.pja-bar select{flex:1;min-width:0;min-height:40px;border:1px solid var(--border);background:var(--bg);color:var(--text);border-radius:8px;padding:6px 8px}' +
    '.pja-more-wrap{position:relative;flex:none}.pja-more{min-width:40px;min-height:40px;border:1px solid var(--border);background:var(--bg);color:var(--text);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}' +
    '.pja-menu{position:absolute;right:0;top:100%;margin-top:4px;z-index:30;min-width:160px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:4px;display:none}' +
    '.pja-menu.on{display:block}.pja-menu button{display:block;width:100%;text-align:left;background:none;border:0;color:var(--text);padding:10px 12px;border-radius:8px;min-height:40px;font-size:13px;cursor:pointer}.pja-menu button:hover{background:var(--primary-light)}.pja-menu button.danger{color:var(--danger,#b91c1c)}' +
    '.pja-all{border:1px dashed var(--border)}.pja-all.on{background:var(--primary-light);border-style:solid}' +
    '.pja-pill{display:inline-flex;align-items:center;gap:4px;max-width:100%;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:var(--bg);border:1px solid var(--border);color:var(--text);margin:4px 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.pja-pill i{width:7px;height:7px;border-radius:50%;flex:none}' +
    '.pja-sum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:4px 0 8px}.pja-sum div{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:8px 10px;min-width:0}.pja-sum small{display:block;color:var(--text-2);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pja-sum b{display:block;font-size:16px;color:var(--text);margin-top:2px}' +
    '.pja-sum .late b{color:var(--danger,#b91c1c)}body.dark .pja-sum .late b,[data-theme=dark] .pja-sum .late b{color:#f87171}' +
    '.pja-chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px;align-items:center}.pja-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--border);background:var(--bg-card);color:var(--text);border-radius:99px;padding:4px 6px 4px 10px;font-size:12px;min-height:32px}.pja-chip button{background:none;border:0;color:var(--text-2);min-width:28px;min-height:28px;border-radius:99px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}' +
    '#main .pja-off{display:none!important}' +
    '.pja-tools-extra{display:inline-flex;gap:6px;flex-wrap:wrap;align-items:center}' +
    '#pja-fs{min-height:40px}' +
    '.pja-sheet{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}' +
    '.pja-sheet[hidden]{display:none}.pja-panel{width:min(520px,100%);max-height:min(88vh,720px);display:flex;flex-direction:column;background:var(--bg-card);color:var(--text);border-radius:16px 16px 0 0;border:1px solid var(--border);border-bottom:0;overflow:hidden}.pja-panel-body{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:14px 14px 24px}.pja-panel-foot{flex:none;padding:10px 14px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--border);background:var(--bg-card)}body.pja-sheet-open #ai-chat-fab,body.pja-sheet-open #dash-home-fab,body.pja-sheet-open #scroll-top-btn,body.pja-sheet-open #ai-chat-panel{display:none!important;visibility:hidden!important;pointer-events:none!important}' +
    '@media(min-width:801px){.pja-sheet{align-items:center}.pja-panel{border-radius:16px;border-bottom:1px solid var(--border);max-height:80vh}}' +
    '.pja-panel h3{margin:0 0 10px;font-size:16px}.pja-sec{margin:10px 0}.pja-sec>b{display:block;font-size:12px;color:var(--text-2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.02em}' +
    '.pja-opts{display:flex;flex-wrap:wrap;gap:6px}.pja-opts label{display:inline-flex;align-items:center;gap:6px;min-height:36px;border:1px solid var(--border);border-radius:99px;padding:4px 10px;background:var(--bg);color:var(--text);font-size:12.5px;cursor:pointer}.pja-opts label.on{border-color:var(--primary);background:var(--primary-light);color:var(--primary-dark,var(--primary))}body.dark .pja-opts label.on,[data-theme=dark] .pja-opts label.on{color:var(--primary)}' +
    '.pja-opts input{accent-color:var(--primary)}.pja-panel select,.pja-panel input[type=text]{width:100%;min-height:40px;border:1px solid var(--border);background:var(--bg);color:var(--text);border-radius:8px;padding:6px 8px}' +
    '.pja-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.pja-actions .btn{min-height:40px;flex:1}' +
    '.pja-saved{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.pja-saved-chip{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--border);background:var(--bg);color:var(--text);border-radius:99px;padding:0 4px 0 10px;font-size:12.5px;min-height:36px}.pja-saved-chip button{background:none;border:0;color:var(--text);min-height:36px;padding:0 8px;cursor:pointer;border-radius:99px}.pja-saved-chip [data-del]{color:var(--text-2);min-width:32px;display:inline-flex;align-items:center;justify-content:center}.pja-save-row{display:flex;gap:8px;align-items:stretch;margin-top:8px}.pja-save-row input{flex:1;min-width:0}.pja-save-row .btn{flex:none;min-width:88px}' +
    '@media(max-width:800px){.pj-wrap.pja-compact .pj-side{max-height:none;overflow:visible;padding:0;border:0;background:transparent}.pj-wrap.pja-compact .pj-side-h,.pj-wrap.pja-compact .pj-proj{display:none}.pj-wrap.pja-compact .pja-bar{display:flex}.pj-wrap.pja-compact .pj-top .pj-tools #pj-g,#pj-tags{display:none}.pj-wrap.pja-compact .pj-top{gap:8px}.pj-wrap.pja-compact .pj-tools{width:100%}}' +
    '@media(min-width:801px){.pja-bar{display:none!important}.pj-side .pja-all{display:flex}}' +
    '.btn.pja-on{border-color:var(--primary);color:var(--primary-dark,var(--primary))}body.dark .btn.pja-on,[data-theme=dark] .btn.pja-on{color:var(--primary)}' +
    '.pja-col-h{display:flex;align-items:center;gap:6px}.pja-col-h i.dot{width:8px;height:8px;border-radius:50%;flex:none}' +
    '.pja-export{min-height:40px}';
  document.head.appendChild(c);
})();
