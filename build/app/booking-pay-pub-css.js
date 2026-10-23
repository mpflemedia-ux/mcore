/* M-Core booking payment flow - public panel CSS + icons (dark on the booking page, .lt light on the public invoice page). WCAG AA on both. v1 */
(function () {
  if (window.BKPAYU) return;
  var U = window.BKPAYU = {};
  var I = { clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', copy: 'M9 9h10v10H9zM5 15V5h10', cam: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    file: 'M14 3H6v18h12V7zM14 3v4h4', ok: 'M5 12l5 5 9-10', x: 'M6 6l12 12M18 6L6 18', dl: 'M12 4v11m-5-5 5 5 5-5M5 20h14', up: 'M12 20V9m-5 5 5-5 5 5M5 4h14',
    wa: 'M4 20l1.3-4A8 8 0 1 1 8 18.7zM9 9c0 3 3 6 6 6l1-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z', link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1' };
  U.ic = function (n) { return '<svg class="bkpay-ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + I[n] + '"/></svg>'; };
  U.css = function () {
    if (document.getElementById('bkpay-css')) return;
    var X = ':is(#public-book-root,#public-inv-root) .bkpay', c = [
      X + '{--k-bg:#1E2226;--k-card:#262A2F;--k-t:#E7E9EB;--k-t2:#B4BAC1;--k-bd:rgba(231,233,235,.16);--k-p:#22D3EE;--k-pl:#0B2530;--k-on:#0A0E12;--k-okb:#14532D;--k-ok:#86EFAC;--k-wb:#451A03;--k-w:#FDE68A;--k-eb:#450A0A;--k-e:#FCA5A5;--k-wa:#25D366;--k-waon:#0A0E12;color:var(--k-t)!important;font:14px/1.45 Inter,system-ui,sans-serif;text-align:left}',
      X + '.lt{--k-bg:#F8FAFC;--k-card:#FFFFFF;--k-t:#0F172A;--k-t2:#475569;--k-bd:#CBD5E1;--k-p:#0E7490;--k-pl:#ECFEFF;--k-on:#FFFFFF;--k-okb:#DCFCE7;--k-ok:#166534;--k-wb:#FEF3C7;--k-w:#92400E;--k-eb:#FEE2E2;--k-e:#991B1B;--k-wa:#0E7A5F;--k-waon:#FFFFFF;margin:0 0 18px;padding:16px 14px;border:1px solid var(--k-bd);border-radius:12px;background:var(--k-bg)}',
      X + ' *{box-sizing:border-box;color:inherit}', X + ' .bkpay-ic{width:18px;height:18px;flex:0 0 auto;vertical-align:-4px}',
      X + ' .bkpay-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}',
      X + ' .bkpay-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;font-size:12px!important;font-weight:700}',
      X + ' .bkpay-pill.hold{background:var(--k-wb);color:var(--k-w)!important}' + X + ' .bkpay-pill.info{background:var(--k-pl);color:var(--k-p)!important}' + X + ' .bkpay-pill.ok{background:var(--k-okb);color:var(--k-ok)!important}' + X + ' .bkpay-pill.err{background:var(--k-eb);color:var(--k-e)!important}',
      X + ' .bkpay-timer{font-size:12.5px!important;color:var(--k-t2)!important;display:inline-flex;gap:4px;align-items:center}' + X + ' .bkpay-timer b{color:var(--k-w)!important}',
      X + ' h3.bkpay-ti{font-size:18px!important;font-weight:800!important;margin:12px 0 2px!important;color:var(--k-t)!important}',
      X + ' .bkpay-svc{font-size:13px!important;color:var(--k-t2)!important;margin:0 0 12px}',
      X + ' .bkpay-box{background:var(--k-bg);border:1px solid var(--k-bd);border-radius:12px;padding:12px;margin:10px 0}' + X + '.lt .bkpay-box{background:var(--k-card)}',
      X + ' .bkpay-amt{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap}' + X + ' .bkpay-amt span{font-size:12px!important;color:var(--k-t2)!important;display:block}',
      X + ' .bkpay-amt b{font-size:26px!important;font-weight:800;letter-spacing:-.01em;color:var(--k-t)!important}' + X + ' .bkpay-amt small{display:block;font-size:12.5px!important;color:var(--k-t2)!important}',
      X + ' .bkpay-ref{display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:10px;border-top:1px dashed var(--k-bd);flex-wrap:wrap}' + X + ' .bkpay-ref code{font:800 16px ui-monospace,Menlo,monospace;letter-spacing:.08em;color:var(--k-p)!important;background:var(--k-pl);padding:4px 8px;border-radius:6px}',
      X + ' .bkpay-hint{font-size:12.5px!important;color:var(--k-t2)!important;margin:6px 0 0!important}',
      X + ' .bkpay-step{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;margin:16px 0 8px;color:var(--k-t)!important}' + X + ' .bkpay-step i{font-style:normal;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--k-p);color:var(--k-on)!important;font-size:12px}',
      X + ' .bkpay-qr{display:flex;gap:14px;align-items:center;flex-wrap:wrap}' + X + ' .bkpay-qr img{width:148px;height:148px;object-fit:contain;background:#fff;border-radius:10px;padding:6px}',
      X + ' .bkpay-bank{flex:1;min-width:150px;font-size:13px}' + X + ' .bkpay-bank b{display:block;font-size:16px;letter-spacing:.04em;margin:2px 0 6px}',
      X + ' .bkpay-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:10px 14px;border-radius:10px;border:1px solid var(--k-bd);background:transparent;color:var(--k-t)!important;font:inherit;font-weight:700;font-size:14px!important;cursor:pointer;text-decoration:none!important}',
      X + ' .bkpay-btn.sm{min-height:36px;padding:6px 10px;font-size:13px!important}' + X + ' .bkpay-btn.pri{background:var(--k-p);border-color:var(--k-p);color:var(--k-on)!important;width:100%}' + X + ' .bkpay-btn.wa{background:var(--k-wa);border-color:var(--k-wa);color:var(--k-waon)!important;width:100%}',
      X + ' .bkpay-btn[disabled]{opacity:.6;cursor:wait}' + X + ' .bkpay-btn:focus-visible,' + X + ' input:focus-visible{outline:2px solid var(--k-p);outline-offset:2px}',
      X + ' .bkpay-pick{display:grid;grid-template-columns:1fr 1fr;gap:8px}' + X + ' .bkpay-pick input{display:none}',
      X + ' .bkpay-file{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--k-bd);border-radius:10px;margin-top:8px}' + X + ' .bkpay-file img{width:44px;height:44px;object-fit:cover;border-radius:6px}' + X + ' .bkpay-file span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}',
      X + ' label.bkpay-lb{display:block;font-size:13px!important;font-weight:600;color:var(--k-t2)!important;margin:10px 0 4px}',
      X + ' input.bkpay-in{width:100%;min-height:44px;padding:10px 12px!important;border-radius:8px!important;border:1px solid var(--k-bd)!important;background:var(--k-card)!important;color:var(--k-t)!important;font:inherit;font-size:16px!important}',
      X + ' .bkpay-err{display:none;margin:8px 0 0;padding:8px 10px;border-radius:8px;background:var(--k-eb);color:var(--k-e)!important;font-size:13px!important;font-weight:600}',
      X + ' .bkpay-or{display:flex;align-items:center;gap:10px;margin:14px 0;color:var(--k-t2)!important;font-size:12px!important}' + X + ' .bkpay-or:before,' + X + ' .bkpay-or:after{content:"";flex:1;border-top:1px solid var(--k-bd)}',
      X + ' .bkpay-note{font-size:12.5px!important;color:var(--k-t2)!important;margin:12px 0 0!important}',
      X + ' .bkpay-keep{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--k-bd);font-size:12.5px;color:var(--k-t2)!important;flex-wrap:wrap}',
      X + ' .bkpay-tl{list-style:none;margin:12px 0;padding:0}' + X + ' .bkpay-tl li{display:flex;gap:10px;align-items:flex-start;padding:0 0 14px;position:relative;color:var(--k-t2)!important}',
      X + ' .bkpay-tl li:before{content:"";position:absolute;left:11px;top:24px;bottom:2px;border-left:2px solid var(--k-bd)}' + X + ' .bkpay-tl li:last-child:before{display:none}',
      X + ' .bkpay-tl i{width:24px;height:24px;border-radius:50%;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border:2px solid var(--k-bd);font-style:normal}',
      X + ' .bkpay-tl li.d{color:var(--k-t)!important}' + X + ' .bkpay-tl li.d i{background:var(--k-okb);border-color:var(--k-okb);color:var(--k-ok)!important}' + X + ' .bkpay-tl li.c{color:var(--k-t)!important;font-weight:700}' + X + ' .bkpay-tl li.c i{border-color:var(--k-p);box-shadow:0 0 0 3px var(--k-pl)}',
      X + ' .bkpay-tl small{display:block;font-weight:400;font-size:12px!important;color:var(--k-t2)!important}',
      X + ' .bkpay-msg{padding:10px 12px;border-radius:10px;font-size:13.5px!important;margin:10px 0}' + X + ' .bkpay-msg.err{background:var(--k-eb);color:var(--k-e)!important}' + X + ' .bkpay-msg.ok{background:var(--k-okb);color:var(--k-ok)!important}' + X + ' .bkpay-msg.w{background:var(--k-wb);color:var(--k-w)!important}',
      X + ' .bkpay-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}',
      '#public-book-root .bkpay-host{max-width:520px!important;max-height:calc(100vh - 24px);overflow-y:auto}', '#public-book-root .bkpay-host>:not(.bkpay){display:none!important}',
      '@media (max-width:380px){' + X + ' .bkpay-row{grid-template-columns:1fr}' + X + ' .bkpay-qr img{width:128px;height:128px}}'
    ];
    var s = document.createElement('style'); s.id = 'bkpay-css'; s.textContent = c.join('\n'); document.head.appendChild(s);
  };
})();
