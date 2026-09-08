/* Public invoice: force readable light-card colors + unclipped payment image.
   Loaded only when ?public_inv= is present (see boot snippet). */
(function () {
  function apply() {
    var root = document.getElementById('public-inv-root');
    if (!root) return;
    document.body.style.color = '#0f172a';
    document.body.style.background = '#F1F5F9';
    root.style.background = '#F1F5F9';
    root.style.color = '#0f172a';
    root.style.colorScheme = 'light';
    root.style.paddingBottom = '48px';
    var card = root.querySelector('div');
    if (card) {
      card.style.color = '#0f172a';
      card.style.overflow = 'visible';
      card.style.paddingBottom = '28px';
      card.style.marginBottom = '40px';
    }
    root.querySelectorAll('[style*="#94a3b8"]').forEach(function (el) {
      el.style.color = '#475569';
      el.style.fontWeight = el.style.fontWeight || '600';
    });
    root.querySelectorAll('img[alt="Payment QR"]').forEach(function (img) {
      img.style.display = 'block';
      img.style.margin = '0 auto';
      img.style.width = 'auto';
      img.style.maxWidth = 'min(280px, 100%)';
      img.style.maxHeight = '280px';
      img.style.height = 'auto';
      img.style.objectFit = 'contain';
    });
  }
  var obs = new MutationObserver(apply);
  if (document.getElementById('public-inv-root')) {
    obs.observe(document.getElementById('public-inv-root'), { childList: true, subtree: true });
    apply();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      var r = document.getElementById('public-inv-root');
      if (r) obs.observe(r, { childList: true, subtree: true });
      apply();
    });
    setTimeout(apply, 200);
    setTimeout(apply, 800);
    setTimeout(apply, 1600);
  }
})();
