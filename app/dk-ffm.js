/* dk-ffm.js — FFM hub tables → DK.list cards (all widths), same engine already used for
   Accounting/Sales/Purchases/Ops/Staff lists (dk-cards.js). Accounts and Funded tabs
   already render their own per-account .card markup in ffm-hub.js — only Products, Stock
   and Reconciliation still used plain <table>. No fns hook needed: dk-cards.js's own
   MutationObserver on #main already rescans on every ffm-hub.js re-render. EN/BM, tokens
   only. v1 */
(function () {
  if (window.DKFfm) return;
  var S = window.DKFfm = { v: 1 };
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }

  function regLists() {
    if (!window.DK || !DK.list) return;
    DK.list({ key: 'ffmprod', sel: '#ffm-prod-wrap', title: 0, sub: 1, party: -1, date: -1, amount: -1, status: 3,
      emptyText: L('No products yet.', 'Belum ada produk.') });
    // Status column auto-detected by header name (Status/Keadaan) — index shifts with account count.
    DK.list({ key: 'ffmstock', sel: '#ffm-stock-wrap', title: 0, sub: -1, party: -1, date: -1, amount: -1,
      emptyText: L('No FFM stock yet.', 'Belum ada stok FFM.') });
    DK.list({ key: 'ffmrecon', sel: '#ffm-recon-wrap', title: 0, sub: -1, party: -1, date: -1, amount: -1, status: 3,
      emptyText: L('All matched.', 'Semua sepadan.') });
  }
  function boot() {
    if (!window.DK || !window.DK.list || !document.getElementById('main')) return setTimeout(boot, 300);
    regLists();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
