/* M-Core booking payment flow - styles for the staff "Payments to review" queue (light + dark via app variables). v1 */
(function () {
  if (window.BKPAYQCSS) return;
  window.BKPAYQCSS = function () {
    if (document.getElementById('bkq-css')) return; var s = document.createElement('style'); s.id = 'bkq-css';
    s.textContent = '.bkq{position:fixed;inset:0;z-index:1400;background:var(--bg);color:var(--text);display:flex;flex-direction:column;--q-ok:#15803D;--q-w:#B45309;--q-b:#B91C1C}' +
      '[data-theme="dark"] .bkq{--q-ok:#86EFAC;--q-w:#FDE68A;--q-b:#FCA5A5}' +
      '.bkq-hd{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);background:var(--bg-card)}.bkq-hd>div{flex:1;min-width:0}' +
      '.bkq-ti{font:700 18px "Space Grotesk",sans-serif}.bkq-sub{font-size:12.5px;color:var(--text-2)}' +
      '.bkq-bd{flex:1;display:grid;grid-template-columns:320px minmax(0,1fr);min-height:0}.bkq-ls{overflow:auto;border-right:1px solid var(--border);padding:12px}' +
      '.bkq-it{display:block;width:100%;text-align:left;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--bg-card);margin-bottom:8px;color:var(--text);min-height:44px}' +
      '.bkq-it.on{border-color:var(--primary);box-shadow:inset 3px 0 0 var(--primary)}.bkq-it b{display:block;font-size:14px}.bkq-it small{display:block;font-size:12.5px;color:var(--text-2);margin-top:2px}' +
      '.bkq-dt{overflow:auto;padding:16px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-content:start}' +
      '.bkq-c{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px;min-width:0}.bkq-h{font-weight:700;font-size:14px;margin-bottom:10px;display:flex;gap:8px;align-items:center;justify-content:space-between}' +
      '.bkq-img-btn{display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in;line-height:0}.bkq-img{display:block;width:100%;max-height:68vh;object-fit:contain;border-radius:8px;background:#fff}.bkq-ph{padding:40px 12px;text-align:center;color:var(--text-2);border:1px dashed var(--border-2);border-radius:8px}' +
      '.bkq-kv{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);font-size:13.5px}.bkq-kv span{color:var(--text-2)}.bkq-kv b{text-align:right;overflow-wrap:anywhere}' +
      '.bkq-ck{margin:12px 0 0;padding:0}.bkq-ck li{list-style:none;display:flex;gap:8px;align-items:flex-start;padding:4px 0;font-size:13.5px}.bkq-ck .ok i{color:var(--q-ok)}.bkq-ck .warn i{color:var(--q-w)}.bkq-ck .bad{color:var(--q-b);font-weight:600}.bkq-ck .info i{color:var(--text-2)}' +
      '.bkq-msg{margin-top:10px;padding:10px;border-radius:8px;border:1px solid var(--q-w);font-size:13px}.bkq-act{display:flex;gap:10px;margin-top:12px;align-items:flex-end}.bkq-act .btn{min-height:44px}' +
      '.bkq-amt{flex:1}.bkq-amt label{display:block;font-size:12px;color:var(--text-2);margin-bottom:4px}.bkq-amt input{width:100%;min-height:44px;font-size:16px}' +
      '.bkq-rj{margin-top:12px}.bkq-rj textarea{width:100%;font-size:15px}.bkq-n{display:inline-block;min-width:20px;padding:0 6px;border-radius:10px;background:var(--primary);color:var(--on-primary);font-size:11.5px;font-weight:700;margin-left:4px;text-align:center}' +
      '.bkq-empty{padding:48px 16px;text-align:center;color:var(--text-2)}.bkq-back{display:none}' +
      '@media(max-width:899px){.bkq-bd{grid-template-columns:1fr}.bkq.det .bkq-ls,.bkq:not(.det) .bkq-dt{display:none}.bkq-dt{grid-template-columns:1fr;padding:12px}.bkq.det .bkq-back{display:inline-flex}' +
      '.bkq-act{position:sticky;bottom:0;background:var(--bg-card);padding:10px 0 2px}.bkq-img{max-height:42vh}}';
    document.head.appendChild(s);
  };
})();
