/* M-Core Projects - Public report styles. Same pattern as onboarding-css.js/sd-css.js/pj-wa-css.js:
   inject once, reused by both render modes in pj-pub-report.js. Only runs for the public-link page
   itself (gated on ?pj_report=, same as pj-pub-report.js) - never loaded for normal app pages. */
(function () {
  if (!new URLSearchParams(location.search).get('pj_report')) return;
  if (document.getElementById('pjp-css')) return;
  var css = '.pjp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:8px}.pjp-stats div{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px}.pjp-stats small{color:var(--text-3);font-size:11px}.pjp-stats b{display:block;font-size:17px}' +
    '.pjp-task{padding:8px 0;border-bottom:1px solid var(--border)}.pjp-task:last-child{border-bottom:0}.pjp-tag{font-size:10.5px;padding:1px 7px;border-radius:99px;background:var(--primary-light);color:var(--primary);white-space:nowrap}' +
    '.pjp-bar{height:5px;background:var(--border);border-radius:99px;margin-top:5px;overflow:hidden}.pjp-bar i{display:block;height:100%;background:var(--primary)}' +
    '.pjp-flag{font-size:10.5px;padding:1px 7px;border-radius:99px;font-weight:600}.pjp-dgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px}.pjp-dgrid small{display:block;color:var(--text-3);font-size:11px}.pjp-dgrid b{display:block;margin-top:2px;word-break:break-word}' +
    '.pjp-acts{display:flex;flex-direction:column;gap:10px}.pjp-act{display:flex;gap:8px}.pjp-act>i{font-size:16px;color:var(--text-2);margin-top:2px;flex-shrink:0}' +
    '.pjp-att{display:block;width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid var(--border);margin-top:4px}.pjp-att img{width:100%;height:100%;object-fit:cover;display:block}';
  var s = document.createElement('style'); s.id = 'pjp-css'; s.textContent = css;
  (document.head || document.documentElement).appendChild(s);
})();
