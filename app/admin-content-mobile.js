(function () {
  function wrap() {
    var orig = window._adminContentTableHtml;
    if (typeof orig !== 'function' || orig._colFit) return;
    window._adminContentTableHtml = function (rows) {
      var html = orig.apply(this, arguments);
      if (!html || html.indexOf('<table') < 0) return html;
      html = html.replace(
        'max-height:370px;overflow:auto',
        'max-height:370px;overflow:auto;min-height:180px'
      );
      html = html.replace(
        'width:100%',
        'width:max-content;min-width:100%'
      );
      html = html.replace(
        'padding:3px 8px;border-radius:6px;color:#fff',
        'padding:3px 8px;border-radius:6px;color:#fff;white-space:nowrap'
      );
      html = html.replace(
        'max-width:220px',
        'min-width:220px;max-width:280px'
      );
      html = html.replace(
        /<tbody>[\s\S]*<\/tbody>/,
        function (body) {
          return body.replace(/<td>/g, '<td style="white-space:nowrap;vertical-align:top;padding:8px 10px">');
        }
      );
      return html;
    };
    window._adminContentTableHtml._colFit = true;
  }
  wrap();
  setTimeout(wrap, 400);
})();
