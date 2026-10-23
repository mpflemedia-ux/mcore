/* Public booking page (?book=TOKEN) - dark theme CSS. Tokens copied from the app's [data-theme=dark] values used by
   the public SR result page, scoped to #public-book-root so the page is dark for every visitor. WCAG AA on #262A2F/#1E2226. v1 */
(function () {
  if (window._bkpCss || !/[?&]book=/.test(location.search)) return; window._bkpCss = 1;
  var R = '#public-book-root';
  var css = document.createElement('style'); css.id = 'bkp-css';
  css.textContent = [
    'html.bkp,html.bkp body{background:#1E2226!important}',
    R + '{--bg:#1E2226;--bg-card:#262A2F;--text:#E7E9EB;--text-2:#B4BAC1;--text-3:#A9B4C2;--border:rgba(231,233,235,.12);--border-2:rgba(231,233,235,.22);--primary:#22D3EE;--primary-light:#0B2530;--on-primary:#0A0E12;',
    'background:var(--bg)!important;color:var(--text)!important;padding:18px 16px 40px!important;font-family:Inter,system-ui,sans-serif!important;color-scheme:dark;z-index:50}',
    R + ' *{color:inherit!important;box-sizing:border-box}',
    R + ' .bkp-wrap{max-width:520px;margin:0 auto}',
    R + ' .bkp-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:16px}',
    R + ' .bkp-brand{display:flex;align-items:center;gap:8px}' + R + ' .bkp-brand img{width:32px;height:32px;border-radius:6px;object-fit:cover}' + R + ' .bkp-brand b{font-size:16px;letter-spacing:.02em}',
    R + ' .cob-seg{display:inline-flex;border:1px solid var(--border-2);border-radius:8px;overflow:hidden}' + R + ' .cob-seg button{border:0;background:none;color:var(--text-2)!important;padding:7px 12px;min-height:34px;font-size:12.5px;cursor:pointer;font-family:inherit}' + R + ' .cob-seg button.on{background:var(--primary-light);color:var(--primary)!important;font-weight:600}',
    R + ' .bkp-card,' + R + ' .bkp-modal form,' + R + ' .bkp-modal>div{background:var(--bg-card)!important;border:1px solid var(--border)!important;border-radius:12px!important;padding:16px!important;margin:0 0 12px!important;max-width:none!important;box-shadow:none!important}',
    R + ' .bkp-main{background:none!important;border:0!important;padding:0!important;max-width:none!important;border-radius:0!important}',
    R + ' .bkp-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:none!important}',
    R + ' .bkp-pill.info{background:#0B2530;color:#A5F3FC!important}' + R + ' .bkp-pill.ok{background:#14532D;color:#86EFAC!important}' + R + ' .bkp-pill.hold{background:#451A03;color:#FDE68A!important}' + R + ' .bkp-pill.err{background:#450A0A;color:#FCA5A5!important}',
    R + ' h1{font-size:19px!important;font-weight:700!important;margin:8px 0 10px!important;overflow-wrap:anywhere}',
    R + ' h2,' + R + ' h3{font-size:16px!important;font-weight:700!important;margin:8px 0 6px!important;overflow-wrap:anywhere}',
    R + ' .bkp-sub,' + R + ' .bkp-meta,' + R + ' .bkp-modal p{color:var(--text-2)!important;font-size:13px!important}',
    R + ' .bkp-title{font-weight:700!important;font-size:15px!important;overflow-wrap:anywhere}',
    R + ' .bkp-meta{margin:2px 0 10px!important}',
    R + ' label{color:var(--text-2)!important;font-size:13px!important}',
    R + ' .bkp-date{display:flex!important;align-items:center;gap:10px;flex-wrap:wrap}',
    R + ' input{background:var(--bg)!important;color:var(--text)!important;border:1px solid var(--border-2)!important;border-radius:8px!important;padding:10px 12px!important;min-height:44px;font-size:15px!important;color-scheme:dark;font-family:inherit}',
    R + ' input::placeholder{color:#8B939C!important}' + R + ' input:focus{outline:2px solid var(--primary);outline-offset:1px}',
    R + ' #bk-date{margin-left:0!important;flex:1 1 160px;max-width:220px}',
    R + ' #bk-list{margin-top:0!important}',
    R + ' .bk-slot,' + R + ' .bk-staff{min-height:40px;padding:8px 14px!important;border-radius:8px!important;border:1px solid var(--border-2)!important;background:transparent!important;color:var(--text)!important;font-size:13.5px!important;font-weight:500;font-variant-numeric:tabular-nums;cursor:pointer;opacity:1!important}',
    R + ' .bk-slot:hover:not([disabled]),' + R + ' .bk-staff:hover{border-color:var(--primary)!important}',
    R + ' .bk-slot.bkp-sel,' + R + ' .bk-staff.bkp-on{background:var(--primary-light)!important;border-color:var(--primary)!important;color:var(--primary)!important;font-weight:600}',
    R + ' .bk-slot[disabled]{cursor:not-allowed;border-style:dashed!important;background:rgba(231,233,235,.03)!important;color:#8B939C!important;text-decoration:line-through;white-space:nowrap;font-size:12px!important;padding:8px 6px!important}',
    R + ' .bkp-slots{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px!important}',
    R + ' .bkp-empty{display:flex;align-items:center;gap:8px;color:var(--text-2)!important;font-size:13px}' + R + ' .bkp-empty .ti{font-size:20px;color:var(--text-3)!important}',
    R + ' .bkp-modal{background:rgba(10,14,18,.72)!important;align-items:flex-end!important}',
    R + ' .bkp-modal form,' + R + ' .bkp-modal>div{width:100%;max-width:440px!important;margin:0 auto!important}',
    '@media(min-width:641px){' + R + ' .bkp-modal{align-items:center!important}}',
    R + ' .bkp-modal form button{min-height:44px;padding:10px 16px!important;border-radius:8px!important;font-size:14px!important;font-weight:600;cursor:pointer;border:1px solid var(--border-2)!important;background:transparent!important;color:var(--text)!important}',
    R + ' .bkp-modal form button[type=submit]{background:var(--primary)!important;border-color:var(--primary)!important;color:var(--on-primary)!important}',
    R + ' .bkp-modal form input[name]{display:block}',
    R + ' .bkp-modal label{display:flex;align-items:center;justify-content:space-between;gap:10px}',
    R + ' .bkp-modal label input{width:84px!important;min-height:40px}',
    R + ' #bk-err{color:#FCA5A5!important;font-size:12.5px!important;margin-top:10px}',
    R + ' .bkp-pay{display:flex!important;align-items:center;justify-content:center;gap:8px;min-height:44px;margin-top:6px;border-radius:8px;background:var(--primary)!important;color:var(--on-primary)!important;font-weight:600;font-size:14px;text-decoration:none}',
    R + ' .bkp-hide{display:none!important}',
    R + ' .bkp-foot{text-align:center;margin-top:18px;font-size:11.5px;color:var(--text-3)!important}',
    R + ' .bkp-load{text-align:center;padding:24px;color:var(--text-2)!important}',
    '@media(min-width:1024px){' + R + '{padding-top:36px!important}' + R + ' .bkp-wrap{max-width:560px}}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(css);
})();
