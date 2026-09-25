(function () {
  function label(e) {
    var n = String((e && e.nickname) || '').trim();
    return n || String((e && e.name) || '').trim();
  }
  async function rows() {
    if (!window.sb || !APP || !APP.tenant) return [];
    var r = await sb.from('employees').select('id,name,nickname')
      .eq('tenant_id', APP.tenant.id).is('deleted_at', null).limit(400);
    return r.data || [];
  }
  function patchCtx(list) {
    try {
      var ctx = window._dbInsightCtx;
      var w = ctx && ctx.attendance && ctx.attendance.worstEmployee;
      if (!w) return;
      var e = list.find(function (x) { return String(x.id) === String(w.id); })
        || list.find(function (x) { return String(x.name || '') === String(w.name || ''); });
      if (e) {
        w.name = label(e);
        w.nickname = e.nickname;
      }
    } catch (e2) {}
  }
  function relabelDom(list) {
    var pairs = list.filter(function (e) {
      return e && e.name && e.nickname && String(e.nickname).trim() && String(e.name).trim() !== String(e.nickname).trim();
    }).map(function (e) {
      return { from: String(e.name).trim(), to: String(e.nickname).trim() };
    }).sort(function (a, b) { return b.from.length - a.from.length; });
    if (!pairs.length) return;
    document.querySelectorAll('.db-ai-insight, #db-ai-attendance').forEach(function (el) {
      var html = el.innerHTML;
      var next = html;
      pairs.forEach(function (p) {
        if (next.indexOf(p.from) >= 0) next = next.split(p.from).join(p.to);
      });
      if (next !== html) el.innerHTML = next;
    });
  }
  async function apply() {
    try {
      var list = await rows();
      if (!list.length) return;
      patchCtx(list);
      relabelDom(list);
    } catch (e) {}
  }
  function wrap() {
    ['_dbFillCardInsights', '_dbInsightFallbackBody', 'loadDashboardData'].forEach(function (name) {
      var orig = window[name];
      if (typeof orig !== 'function' || orig._insNick) return;
      var w = function () {
        var ret = orig.apply(this, arguments);
        if (ret && typeof ret.then === 'function') ret.then(function () { setTimeout(apply, 30); });
        else setTimeout(apply, 30);
        return ret;
      };
      w._insNick = true;
      window[name] = w;
    });
  }
  function boot() {
    wrap();
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 500);
  setTimeout(apply, 1500);
  setTimeout(apply, 3500);
})();
