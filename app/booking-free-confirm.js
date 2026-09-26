(function () {
  function pageIsFree() {
    var root = document.getElementById('public-book-root') || document.body;
    return /RM\s*0(\.00)?/.test(root.textContent || '');
  }
  function relabel() {
    if (!pageIsFree()) return;
    document.querySelectorAll('h3').forEach(function (h) {
      if ((h.textContent || '').trim() !== 'Held') return;
      h.textContent = 'Booked';
      var box = h.parentElement;
      if (!box) return;
      Array.prototype.forEach.call(box.querySelectorAll('p'), function (p) {
        var t = p.textContent || '';
        if (/held 15 min/i.test(t)) p.textContent = 'Slot confirmed. No payment required.';
        else if (/confirm payment/i.test(t)) p.remove();
      });
    });
    document.querySelectorAll('#bk-form button[type=submit]').forEach(function (b) {
      if (/hold/i.test(b.textContent || '')) b.textContent = 'Confirm booking';
    });
  }
  setInterval(relabel, 200);
  try {
    new MutationObserver(relabel).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  } catch (e) {}
})();
