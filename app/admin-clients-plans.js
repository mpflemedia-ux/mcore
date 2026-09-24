(function () {
  function plansReady() {
    return !!(window._plansCache && window._plansCache.length);
  }
  function wrapLoad() {
    var orig = window._loadPlansCache;
    if (typeof orig !== 'function' || orig._retryEmpty) return;
    var w = async function () {
      if (plansReady()) return window._plansCache;
      try { window._plansCache = null; } catch (e) {}
      var list = await orig.apply(this, arguments);
      if (list && list.length) return list;
      try {
        var r = await sb.from('plans').select('id,code,name_en,name_bm');
        list = r.data || [];
        if (list.length) window._plansCache = list;
      } catch (e2) {}
      return window._plansCache || [];
    };
    w._retryEmpty = true;
    window._loadPlansCache = w;
  }
  function fillSelects() {
    var plans = window._plansCache || [];
    if (!plans.length) return;
    var isBm = typeof APP !== 'undefined' && APP.language === 'bm';
    document.querySelectorAll('select.admin-plan-select').forEach(function (sel) {
      var prev = sel.getAttribute('data-prev') || sel.value || '';
      if (!sel.options.length) {
        plans.forEach(function (p) {
          var o = document.createElement('option');
          o.value = p.id;
          o.textContent = (isBm ? p.name_bm : p.name_en) || p.code || p.id;
          sel.appendChild(o);
        });
      }
      if (prev) {
        var ok = false;
        for (var i = 0; i < sel.options.length; i++) {
          if (String(sel.options[i].value) === String(prev)) { ok = true; break; }
        }
        if (ok) sel.value = prev;
      }
    });
    var filter = document.getElementById('admin-cl-plan');
    if (filter && filter.options.length <= 1) {
      plans.forEach(function (p) {
        var o = document.createElement('option');
        o.value = p.id;
        o.textContent = (isBm ? p.name_bm : p.name_en) || p.code;
        filter.appendChild(o);
      });
    }
  }
  function wrapRender() {
    var orig = window.renderAdminClients;
    if (typeof orig !== 'function' || orig._plansWait) return;
    var w = async function () {
      wrapLoad();
      try { await window._loadPlansCache(); } catch (e) {}
      var ret = orig.apply(this, arguments);
      var after = async function () {
        if (!plansReady()) {
          try { await window._loadPlansCache(); } catch (e2) {}
        }
        fillSelects();
        try { if (typeof _adminClientsRenderTable === 'function' && plansReady()) _adminClientsRenderTable(); } catch (e3) {}
        fillSelects();
      };
      if (ret && typeof ret.then === 'function') return ret.then(function (v) { return after().then(function () { return v; }); });
      await after();
      return ret;
    };
    w._plansWait = true;
    window.renderAdminClients = w;
  }
  function boot() {
    wrapLoad();
    wrapRender();
    fillSelects();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 400);
  setTimeout(boot, 1200);
  setInterval(function () {
    if (document.querySelector('select.admin-plan-select') && !plansReady()) {
      wrapLoad();
      Promise.resolve(window._loadPlansCache && window._loadPlansCache()).then(fillSelects);
    } else fillSelects();
  }, 1000);
})();
