/* Bookings card: badge + date/status/sort + row expand */
(function () {
  var STATE = { range: 'today', status: 'all', sort: 'starts' };
  function isBm() { return APP.language === 'bm'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function fmt(iso) {
    try { return new Date(iso).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }); }
    catch (e) { return iso || ''; }
  }
  function bounds() {
    var now = new Date();
    var start = new Date(now); start.setHours(0, 0, 0, 0);
    var end = new Date(now); end.setHours(23, 59, 59, 999);
    if (STATE.range === '7d') { end = new Date(start); end.setDate(end.getDate() + 7); end.setHours(23, 59, 59, 999); }
    if (STATE.range === 'upcoming') { start = now; end = new Date(start); end.setFullYear(end.getFullYear() + 2); }
    return { start: start.toISOString(), end: end.toISOString() };
  }
  function ensureTools(card) {
    if (document.getElementById('bk-card-tools')) return;
    var body = document.getElementById('db-book-body');
    if (!body) return;
    var bar = document.createElement('div');
    bar.id = 'bk-card-tools';
    bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;align-items:center';
    bar.innerHTML =
      '<select id="bk-range" class="form-input" style="width:auto;font-size:12px;padding:4px 6px">' +
      '<option value="today">' + (isBm() ? 'Hari ini' : 'Today') + '</option>' +
      '<option value="7d">' + (isBm() ? '7 hari' : 'Next 7 days') + '</option>' +
      '<option value="upcoming">' + (isBm() ? 'Akan datang' : 'All upcoming') + '</option></select>' +
      '<select id="bk-status" class="form-input" style="width:auto;font-size:12px;padding:4px 6px">' +
      '<option value="all">' + (isBm() ? 'Semua' : 'All') + '</option>' +
      '<option value="hold">Hold</option>' +
      '<option value="pending_payment">' + (isBm() ? 'Tunggu bayar' : 'Pending payment') + '</option>' +
      '<option value="confirmed">' + (isBm() ? 'Disahkan' : 'Confirmed') + '</option>' +
      '<option value="expired">' + (isBm() ? 'Tamat' : 'Expired') + '</option></select>' +
      '<select id="bk-sort" class="form-input" style="width:auto;font-size:12px;padding:4px 6px">' +
      '<option value="starts">' + (isBm() ? 'Masa' : 'Time') + '</option>' +
      '<option value="status">Status</option></select>';
    body.parentNode.insertBefore(bar, body);
    document.getElementById('bk-range').onchange = function () { STATE.range = this.value; paint(); };
    document.getElementById('bk-status').onchange = function () { STATE.status = this.value; paint(); };
    document.getElementById('bk-sort').onchange = function () { STATE.sort = this.value; paint(); };
  }
  function setBadge(n) {
    var title = document.querySelector('#db-sec-booking .db-card-title');
    if (!title) return;
    var dot = document.getElementById('bk-new-badge');
    if (!dot) {
      dot = document.createElement('span');
      dot.id = 'bk-new-badge';
      dot.style.cssText = 'margin-left:6px;min-width:16px;height:16px;padding:0 5px;border-radius:8px;background:#dc2626;color:#fff;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center';
      title.appendChild(dot);
    }
    if (n > 0) { dot.style.display = 'inline-flex'; dot.textContent = String(n); }
    else { dot.style.display = 'none'; }
  }
  async function paint() {
    var card = document.getElementById('db-sec-booking');
    var body = document.getElementById('db-book-body');
    if (!card || !body || !window.sb || !APP.tenant) return;
    ensureTools(card);
    var b = bounds();
    var q = await sb.from('bookings')
      .select('id,customer_name,customer_email,customer_phone,starts_at,status,quote_ref,payment_channel,created_at,notes,booking_services(name)')
      .eq('tenant_id', APP.tenant.id)
      .gte('starts_at', b.start)
      .lte('starts_at', b.end)
      .order('starts_at');
    if (q.error) return;
    var rows = q.data || [];
    var since = Date.now() - 15 * 60 * 1000;
    var fresh = rows.filter(function (r) {
      return (r.status === 'hold' || r.status === 'pending_payment') && new Date(r.created_at).getTime() >= since;
    }).length;
    setBadge(fresh);
    if (STATE.status !== 'all') rows = rows.filter(function (r) { return r.status === STATE.status; });
    if (STATE.sort === 'status') {
      var order = { hold: 0, pending_payment: 1, confirmed: 2, payment_failed: 3, expired: 4 };
      rows.sort(function (a, c) { return (order[a.status] || 9) - (order[c.status] || 9); });
    }
    if (!rows.length) {
      body.textContent = isBm() ? 'Tiada tempahan untuk tapisan ini.' : 'No bookings for this filter.';
      return;
    }
    body.innerHTML = rows.map(function (r) {
      var svc = r.booking_services && r.booking_services.name ? r.booking_services.name : 'Booking';
      var pending = r.status === 'hold' || r.status === 'pending_payment' || r.status === 'payment_failed';
      return '<details style="padding:8px 0;border-bottom:1px solid var(--border,#e2e8f0)">' +
        '<summary style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:8px">' +
        '<span>' + esc(fmt(r.starts_at)) + ' · ' + esc(r.customer_name || '-') + ' · ' + esc(svc) +
        (r.quote_ref ? ' · ' + esc(r.quote_ref) : '') + '</span><strong style="font-size:11px">' +
        esc(String(r.status || '').toUpperCase()) + '</strong></summary>' +
        '<div style="font-size:12px;color:var(--db-text3);margin-top:8px;line-height:1.5">' +
        '<div>' + (isBm() ? 'Nama' : 'Name') + ': ' + esc(r.customer_name || '-') + '</div>' +
        '<div>Email: ' + esc(r.customer_email || '-') + '</div>' +
        '<div>' + (isBm() ? 'Telefon' : 'Phone') + ': ' + esc(r.customer_phone || '-') + '</div>' +
        '<div>' + (isBm() ? 'Masa' : 'Time') + ': ' + esc(fmt(r.starts_at)) + '</div>' +
        '<div>Ref: ' + esc(r.quote_ref || '-') + '</div>' +
        '<div>' + (isBm() ? 'Bayaran' : 'Payment') + ': ' + esc(r.payment_channel || '-') + '</div>' +
        '<div>' + (isBm() ? 'Dicipta' : 'Created') + ': ' + esc(fmt(r.created_at)) + '</div></div>' +
        (pending
          ? '<div style="margin-top:6px;display:flex;gap:6px">' +
            '<button type="button" class="db-btn" data-bk-act="cash" data-id="' + esc(r.id) + '">' + (isBm() ? 'Sahkan tunai' : 'Confirm cash') + '</button>' +
            '<button type="button" class="db-btn" data-bk-act="release" data-id="' + esc(r.id) + '">' + (isBm() ? 'Lepaskan' : 'Release') + '</button></div>'
          : '') +
        '</details>';
    }).join('');
  }
  var last = 0;
  function boot() {
    if (!document.getElementById('db-sec-booking')) return;
    var now = Date.now();
    if (now - last < 800) return;
    last = now;
    paint();
  }
  setInterval(boot, 2500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
