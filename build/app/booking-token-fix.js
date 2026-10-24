/* Copy + WhatsApp-share public booking link (?book=TOKEN). Survives ensure_booking_public_token RPC fail. v2 */
(function () {
  function bm() { return APP.language === 'bm'; }
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
  function msg(tok) {
    var co = (APP.tenant && (APP.tenant.name || APP.tenant.company_name)) || 'M-Core';
    var u = url(tok);
    return bm()
      ? ('Tempah slot dengan ' + co + ':\n' + u)
      : ('Book a slot with ' + co + ':\n' + u);
  }
  async function copy() {
    var tok = await token();
    if (!tok) { showToast(bm() ? 'Tidak boleh buat link tempahan' : 'Cannot create booking link — check tenants.booking_public_token', 'error'); return; }
    try { await navigator.clipboard.writeText(url(tok)); showToast(bm() ? 'Link disalin' : 'Link copied', 'success'); }
    catch (e) { prompt('Public booking link', url(tok)); }
  }
  async function shareWa() {
    var tok = await token();
    if (!tok) { showToast(bm() ? 'Tidak boleh buat link tempahan' : 'Cannot create booking link', 'error'); return; }
    var href = 'https://wa.me/?text=' + encodeURIComponent(msg(tok));
    try { window.open(href, '_blank', 'noopener'); }
    catch (e) { location.href = href; }
  }
  function ensureWa(copyBtn, id, cls) {
    if (!copyBtn || !copyBtn.parentNode) return null;
    var wa = document.getElementById(id);
    if (wa) return wa;
    wa = document.createElement('button');
    wa.type = 'button'; wa.id = id;
    if (cls) wa.className = cls;
    else wa.className = copyBtn.className || 'btn btn-outline btn-sm';
    wa.innerHTML = '<i class="ti ti-brand-whatsapp" aria-hidden="true"></i> ' + (bm() ? 'Kongsi link tempahan' : 'Share booking link');
    wa.setAttribute('aria-label', bm() ? 'Kongsi link tempahan di WhatsApp' : 'Share booking link on WhatsApp');
    copyBtn.parentNode.insertBefore(wa, copyBtn.nextSibling);
    return wa;
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
    var dWa = ensureWa(btn, 'db-book-wa', btn ? (btn.className || 'db-btn') : 'db-btn');
    if (dWa && !dWa._tokFixed) {
      dWa._tokFixed = true;
      dWa.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation(); shareWa(); }, true);
    }
    var sWa = ensureWa(sbtn, 'bk-link-wa', sbtn ? (sbtn.className || 'btn btn-outline btn-sm') : 'btn btn-outline btn-sm');
    if (sWa && !sWa._tokFixed) {
      sWa._tokFixed = true;
      /* outline next to primary copy */
      if (sbtn && /btn-primary/.test(sbtn.className || '')) sWa.className = 'btn btn-outline btn-sm';
      sWa.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation(); shareWa(); }, true);
    }
  }
  function boot() { bind(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setInterval(bind, 800);
})();
