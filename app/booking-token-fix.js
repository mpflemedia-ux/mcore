/* Copy booking link even if ensure_booking_public_token RPC fails */
(function () {
  async function token() {
    if (!window.sb || !APP.tenant) return null;
    try {
      var r = await sb.rpc('ensure_booking_public_token');
      if (!r.error && r.data) return r.data;
    } catch (e) {}
    var q = await sb.from('tenants').select('booking_public_token').eq('id', APP.tenant.id).maybeSingle();
    if (q.data && q.data.booking_public_token) return q.data.booking_public_token;
    var tok = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/-/g, '');
    var u = await sb.from('tenants').update({ booking_public_token: tok }).eq('id', APP.tenant.id).select('booking_public_token').maybeSingle();
    if (u.error) { console.warn(u.error); return null; }
    return (u.data && u.data.booking_public_token) || tok;
  }
  function url(tok) { return location.origin + '/app/?book=' + encodeURIComponent(tok); }
  async function copy() {
    var tok = await token();
    if (!tok) { showToast('Cannot create booking link — check tenants.booking_public_token', 'error'); return; }
    try { await navigator.clipboard.writeText(url(tok)); showToast(APP.language === 'bm' ? 'Link disalin' : 'Link copied', 'success'); }
    catch (e) { prompt('Public booking link', url(tok)); }
  }
  function bind() {
    var btn = document.getElementById('db-book-copy');
    if (btn && !btn._tokFixed) {
      btn._tokFixed = true;
      btn.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation(); copy(); }, true);
    }
    var sbtn = document.getElementById('bk-link-btn');
    if (sbtn && !sbtn._tokFixed) {
      sbtn._tokFixed = true;
      sbtn.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation(); copy(); }, true);
    }
  }
  function boot() { bind(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setInterval(bind, 800);
})();
