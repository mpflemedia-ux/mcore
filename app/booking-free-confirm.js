(function () {
  function isFree(ds, d) {
    var amt = d && d.amount != null ? Number(d.amount) : Number((ds && ds.price) || 0);
    return amt <= 0 || (d && d.status === 'confirmed');
  }
  function patchForm() {
    var form = document.getElementById('bk-form');
    if (!form || form.getAttribute('data-free-ui')) return;
    form.setAttribute('data-free-ui', '1');
    var priceTxt = form.querySelector('p');
    var free = priceTxt && /RM\s*0/.test(priceTxt.textContent || '');
    var btn = form.querySelector('button[type=submit]');
    if (btn && free) btn.textContent = 'Confirm booking';
    var orig = form.onsubmit;
    form.addEventListener('submit', function () {
      setTimeout(function () {
        var box = form.parentNode;
        if (!box) return;
        var h = box.querySelector('h3');
        if (h && h.textContent === 'Held' && free) {
          h.textContent = 'Booked';
          var ps = box.querySelectorAll('p');
          if (ps[0]) ps[0].textContent = 'Slot confirmed. No payment required.';
          if (ps[1] && /confirm payment/i.test(ps[1].textContent || '')) ps[1].remove();
        }
      }, 80);
    }, true);
  }
  var mo;
  try {
    mo = new MutationObserver(function () { patchForm(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  setInterval(patchForm, 600);
})();
