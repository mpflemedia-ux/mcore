/* Booking Inbox tabs CSS + claim highlight. v3 */
(function () {
  if (window.__bkinbCss) return; window.__bkinbCss = 1;
  var s = document.createElement('style'); s.id = 'bkinb-css';
  s.textContent = [
    '.bkinb{margin-top:10px;border-top:1px solid var(--border,var(--db-border,#2a3544));padding-top:8px}',
    '.bkinb-tabs{display:flex;gap:4px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin:0 0 10px;padding-bottom:2px}',
    '.bkinb-tabs::-webkit-scrollbar{display:none}',
    '.bkinb-tab{flex:0 0 auto;min-height:40px;padding:8px 12px;border:none;background:transparent;color:var(--text-2,var(--db-text3,#9aa8b8));font:600 12.5px/1.2 inherit;border-bottom:2px solid transparent;cursor:pointer}',
    '.bkinb-tab[aria-selected="true"]{color:var(--k-p,var(--primary,#2dd4bf));border-bottom-color:var(--k-p,var(--primary,#2dd4bf))}',
    '.bkinb-pane{display:none}.bkinb-pane.on{display:block}',
    '.bkinb-card{border:1px solid var(--border,var(--db-border,#2a3544));border-radius:10px;padding:10px;margin:0 0 8px;background:var(--card,var(--db-card,transparent))}',
    '.bkinb-hi{outline:2px solid var(--primary,#22d3ee);outline-offset:1px}',
    '.bkinb-amt{font-size:20px;font-weight:700;color:var(--k-p,var(--primary,#2dd4bf))}',
    '.bkinb-meta{font-size:12px;color:var(--text-2,var(--db-text3,#9aa8b8));margin-top:4px;line-height:1.45}',
    '.bkinb-act{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
    '.bkinb-act .db-btn,.bkinb-act .btn,.bkinb-act .pjw-btn{min-height:40px}',
    '.bkinb-hint{font-size:12px;color:var(--text-2,var(--db-text3,#9aa8b8));margin:6px 0 0;line-height:1.4}',
    '.bkinb-alert{border:1px solid var(--border,var(--db-border,#2a3544));border-radius:8px;padding:8px 10px;font-size:12.5px;margin:0 0 8px;color:var(--text,var(--db-text,#e8eef5))}',
    '.bkinb-doc{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border,var(--db-border,#2a3544));font-size:13px}',
    '.bkinb-doc:last-child{border-bottom:none}',
    '.bkinb-pill{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid var(--border,#2a3544)}',
    '.bkinb-pill.p{border-color:#f59e0b;color:#f59e0b}.bkinb-pill.ok{border-color:#34d399;color:#34d399}.bkinb-pill.bad{border-color:#f87171;color:#f87171}',
    '.bkinb-lb{position:fixed;inset:0;z-index:9200;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(0,0,0,.72);box-sizing:border-box}',
    '.bkinb-lb-panel{display:flex;flex-direction:column;width:min(920px,100%);max-height:min(92vh,920px);background:var(--bg-card,var(--card,#1a2330));border:1px solid var(--border,#2a3544);border-radius:14px;overflow:hidden}',
    '.bkinb-lb-hd,.bkinb-lb-ft{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border,#2a3544);flex:0 0 auto}',
    '.bkinb-lb-ft{border-bottom:none;border-top:1px solid var(--border,#2a3544);justify-content:flex-end;flex-wrap:wrap}',
    '.bkinb-lb-hd span{font:700 14px/1.2 inherit;color:var(--text,#e8eef5)}',
    '.bkinb-lb-body{flex:1 1 auto;min-height:0;overflow:auto;display:flex;align-items:center;justify-content:center;padding:10px;background:#0b0f14}',
    '.bkinb-lb-img{display:block;max-width:100%;max-height:min(72vh,780px);object-fit:contain;border-radius:6px;background:#fff}',
    '.bkinb-lb-pdf{width:100%;height:min(72vh,780px);border:0;border-radius:6px;background:#fff}',
    '.bkinb-lb-ph{padding:40px 16px;color:var(--text-2,#9aa8b8);text-align:center;font-size:13px}',
    '.bkinb-lb .db-btn{min-height:40px}'
  ].join('');
  document.head.appendChild(s);
})();
