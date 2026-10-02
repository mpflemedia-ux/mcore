(function () {
  /* Free vs paid must use the booked service price only — never page-wide /RM 0/ on #public-book-root (other free services would false-positive paid Consultation). */
  var lastBookedPrice = null;

  function parseRmPrice(text) {
    var m = String(text || '').match(/RM\s*([\d]+(?:\.\d+)?)/i);
    if (!m) return null;
    var n = Number(m[1]);
    return isFinite(n) ? n : null;
  }

  /** Price of the service in the open book form (subtitle "… · RM X.XX"). */
  function formServicePrice() {
    var form = document.getElementById('bk-form');
    if (!form) return null;
    var ps = form.querySelectorAll('p');
    for (var i = 0; i < ps.length; i++) {
      var n = parseRmPrice(ps[i].textContent);
      if (n != null) return n;
    }
    return null;
  }

  function pageIsFree() {
    var fromForm = formServicePrice();
    if (fromForm != null) {
      lastBookedPrice = fromForm;
      return fromForm <= 0;
    }
    /* After submit the form is gone; use last captured booked-service price. */
    if (lastBookedPrice != null) return lastBookedPrice <= 0;
    return false;
  }

  function relabel() {
    var fp = formServicePrice();
    if (fp != null) lastBookedPrice = fp;

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
        else if (/pay invoice/i.test(t)) p.remove();
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
