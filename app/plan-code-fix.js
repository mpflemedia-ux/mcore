(function () {
  function fromText(s) {
    var t = String(s || '').toLowerCase();
    if (!t) return '';
    if (/unlim|legacy|enterprise/.test(t)) return 'unlimited';
    if (/\bpro\b/.test(t)) return 'pro';
    if (/business|bisnes/.test(t)) return 'business';
    if (/starter|permulaan/.test(t)) return 'starter';
    if (/free|percuma/.test(t)) return 'free';
    return '';
  }
  function wrap() {
    var orig = window._resolveTenantPlanCode;
    if (typeof orig !== 'function' || orig._paidFix) return;
    window._resolveTenantPlanCode = function () {
      var code = orig.apply(this, arguments);
      if (code && code !== 'free') return code;
      var t = (typeof APP !== 'undefined' && APP.tenant) ? APP.tenant : {};
      var fromName = fromText(t.plan || t.plan_code || '');
      if (fromName && fromName !== 'free') return fromName;
      if (t.plan_id) return 'pro';
      try {
        if (sessionStorage.getItem('mcore_support_session')) return 'pro';
      } catch (e) {}
      return code;
    };
    window._resolveTenantPlanCode._paidFix = true;
  }
  wrap();
  setTimeout(wrap, 400);
})();
