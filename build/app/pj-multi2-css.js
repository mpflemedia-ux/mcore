/* M-Core Projects phase 2 - styles: per-person bars, workload panel, My tasks banner, hidden-by-filter (theme vars only, light + dark). */
(function () {
  if (document.getElementById('pjm2-css')) return;
  var c = document.createElement('style'); c.id = 'pjm2-css';
  c.textContent = ':root{--pjm2-danger-ink:#b91c1c}body.dark,[data-theme=dark]{--pjm2-danger-ink:#f87171}#main .pjm2-off{display:none!important}.btn.pjm2-on{border-color:var(--primary);color:var(--primary-dark,var(--primary))}body.dark .btn.pjm2-on,[data-theme=dark] .btn.pjm2-on{color:var(--primary)}' +
    '.pjm2-ban{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;margin:4px 0;border:1px solid var(--primary);border-radius:10px;background:var(--primary-light);color:var(--text);font-size:13px}.pjm2-ban span{flex:1;min-width:0}.pjm2-ban .btn{min-height:36px}' +
    '.pjm2-pp{margin-top:8px;font-size:12px}.pjm2-row,.pjm2-wr{display:grid;grid-template-columns:minmax(0,1fr) minmax(60px,1.2fr) auto auto;align-items:center;gap:6px;min-height:40px;border-bottom:1px solid var(--border)}.pjm2-row:last-of-type{border-bottom:0}.pjm2-row{grid-template-columns:minmax(0,1fr) auto auto;row-gap:2px;padding:4px 0}.pjm2-row .pjm2-nm{grid-column:1/-1}' +
    '.pjm2-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-size:12.5px}.pjm2-nm .ti{color:var(--primary-dark,var(--primary));font-size:12px}' +
    '.pjm2-bar{display:block;height:6px;border-radius:99px;background:var(--border);overflow:hidden}.pjm2-bar i{display:block;height:100%;background:var(--primary)}.pjm2-v{font-size:12px;color:var(--text);white-space:nowrap}' +
    '.pj-detail .pjm2-row input{width:56px;margin:0;padding:4px 6px;min-height:36px}.pjm2-done{min-width:36px;min-height:36px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text-2);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}' +
    '.pjm2-work{padding:16px;margin:4px 0 8px}.pjm2-wh{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px}.pjm2-wh b{font-size:15px}.pjm2-wr{grid-template-columns:minmax(70px,1fr) minmax(80px,2fr) auto;row-gap:0}.pjm2-wr small{grid-column:1/-1;color:var(--text-2);font-size:11.5px;margin:-6px 0 6px}' +
    '.pjm2-wr.over .pjm2-bar i{background:var(--danger)}.pjm2-wr.over .pjm2-v,.pjm2-ovr{color:var(--pjm2-danger-ink);font-weight:700}' +
    'body.dark .pjm2-nm .ti,[data-theme=dark] .pjm2-nm .ti{color:var(--primary)}' +
    '.pjm2-one .pjw-opt .btn{flex:0 0 auto;min-height:40px}';
  document.head.appendChild(c);
})();
