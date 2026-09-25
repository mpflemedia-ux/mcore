(function () {
  function isNarrow() { return window.innerWidth < 760; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function badge(label, color) {
    return '<span style="display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;color:#fff;background:' +
      (color || '#64748B') + ';white-space:nowrap">' + esc(label) + '</span>';
  }
  function cards(rows) {
    var isBm = typeof APP !== 'undefined' && APP.language === 'bm';
    var catLabels = (typeof _contentCategoryLabels === 'function') ? _contentCategoryLabels(isBm) : {};
    var statusLabels = (typeof _contentStatusLabels === 'function') ? _contentStatusLabels(isBm) : {};
    var catColors = window._CONTENT_CATEGORY_COLORS || {};
    var stColors = window._CONTENT_STATUS_COLORS || {};
    if (!rows.length) {
      return '<div class="empty-state" style="padding:40px"><p>' + (isBm ? 'Tiada post sepadan.' : 'No matching posts.') + '</p></div>';
    }
    return '<div style="display:flex;flex-direction:column;gap:10px;padding:4px 0">' + rows.map(function (p) {
      var cat = catLabels[p.category] || p.category || '—';
      var st = statusLabels[p.status] || p.status || '—';
      var views = (p.views != null) ? Number(p.views).toLocaleString() : '—';
      var likes = (p.likes != null) ? Number(p.likes).toLocaleString() : '—';
      var posted = p.posted_at && typeof formatDate === 'function' ? formatDate(p.posted_at) : (p.posted_at || '—');
      return '<button type="button" onclick="openContentPostModal(\'' + p.id + '\')" style="text-align:left;width:100%;background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:12px;color:inherit;cursor:pointer">' +
        '<div style="font-weight:700;font-size:14px;line-height:1.35;white-space:normal;word-break:break-word;margin-bottom:8px">' + esc(p.title || '—') + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' +
          badge(cat, catColors[p.category]) + badge(st, stColors[p.status]) +
          '<span style="font-size:12px;color:var(--text-2);align-self:center">' + esc(p.platform || '—') + '</span>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--text-3)">' +
          (isBm ? 'Views' : 'Views') + ' ' + views + ' · Likes ' + likes + ' · ' + posted +
        '</div></button>';
    }).join('') + '</div>';
  }
  function wrap() {
    var orig = window._adminContentTableHtml;
    if (typeof orig !== 'function' || orig._mobile) return;
    window._adminContentTableHtml = function (rows) {
      if (isNarrow()) return cards(rows || []);
      var html = orig.apply(this, arguments);
      return String(html || '').replace(
        'width:100%',
        'width:100%;min-width:720px'
      ).replace(
        'padding:3px 8px;border-radius:6px;color:#fff',
        'padding:3px 8px;border-radius:6px;color:#fff;white-space:nowrap'
      );
    };
    window._adminContentTableHtml._mobile = true;
  }
  wrap();
  setTimeout(wrap, 400);
  window.addEventListener('resize', function () {
    if (typeof _adminContentRenderAll === 'function') {
      try { _adminContentRenderAll(); } catch (e) {}
    }
  });
})();
