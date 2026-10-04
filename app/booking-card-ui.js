/* Bookings card: default all dates + date/status/time asc-desc + amend/delete */
(function () {
  var STATE = { range: 'all', status: 'all', sort: 'starts', force: false };
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
  function toLocal(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function bounds() {
    var now = new Date();
    var start = new Date(now); start.setHours(0, 0, 0, 0);
    var end = new Date(now); end.setHours(23, 59, 59, 999);
    if (STATE.range === '7d') { end = new Date(start); end.setDate(end.getDate() + 7); end.setHours(23, 59, 59, 999); }
    if (STATE.range === 'upcoming') { start = now; end = new Date(start); end.setFullYear(end.getFullYear() + 2); }
    if (STATE.range === 'all') { start = new Date(now); start.setFullYear(start.getFullYear() - 1); end = new Date(now); end.setFullYear(end.getFullYear() + 2); }
    return { start: start.toISOString(), end: end.toISOString() };
  }
  function ensureTools() {
    var body = document.getElementById('db-book-body');
    if (!body) return;
    var bar = document.getElementById('bk-card-tools');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bk-card-tools';
      bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;align-items:center';
      body.parentNode.insertBefore(bar, body);
    }
    bar.innerHTML =
      '<select id="bk-range" class="form-input" style="width:auto;font-size:12px;padding:4px 6px">' +
      '<option value="upcoming">' + (isBm() ? 'Akan datang' : 'All upcoming') + '</option>' +
      '<option value="today">' + (isBm() ? 'Hari ini' : 'Today') + '</option>' +
      '<option value="7d">' + (isBm() ? '7 hari' : 'Next 7 days') + '</option>' +
      '<option value="all">' + (isBm() ? 'Semua tarikh' : 'All dates') + '</option></select>' +
      '<select id="bk-status" class="form-input" style="width:auto;font-size:12px;padding:4px 6px">' +
      '<option value="all">' + (isBm() ? 'Semua' : 'All') + '</option>' +
      '<option value="hold">Hold</option>' +
      '<option value="pending_payment">' + (isBm() ? 'Tunggu bayar' : 'Pending payment') + '</option>' +
      '<option value="confirmed">' + (isBm() ? 'Disahkan' : 'Confirmed') + '</option>' +
      '<option value="cancelled">' + (isBm() ? 'Dibatalkan' : 'Cancelled') + '</option>' +
      '<option value="expired">' + (isBm() ? 'Tamat' : 'Expired') + '</option></select>' +
      '<select id="bk-sort" class="form-input" style="width:auto;font-size:12px;padding:4px 6px">' +
      '<option value="starts">' + (isBm() ? 'Masa menaik' : 'Time ascending') + '</option>' +
      '<option value="starts_desc">' + (isBm() ? 'Masa menurun' : 'Time descending') + '</option>' +
      '<option value="status">Status</option></select>';
    var rangeEl = document.getElementById('bk-range');
    var statusEl = document.getElementById('bk-status');
    var sortEl = document.getElementById('bk-sort');
    if (rangeEl) rangeEl.value = STATE.range;
    if (statusEl) statusEl.value = STATE.status;
    if (sortEl) sortEl.value = STATE.sort;
    if (rangeEl) rangeEl.onchange = function () { STATE.range = this.value; STATE.force = true; paint(); };
    if (statusEl) statusEl.onchange = function () { STATE.status = this.value; STATE.force = true; paint(); };
    if (sortEl) sortEl.onchange = function () { STATE.sort = this.value; STATE.force = true; paint(); };
    var sub = document.querySelector('#db-sec-booking [style*="font-size:12px"]');
    if (sub && /Today \+|Hari ini \+/.test(sub.textContent || '')) {
      sub.textContent = isBm() ? 'Akan datang + link awam' : 'Upcoming + public link';
    }
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
  function actions(r) {
    var pending = r.status === 'hold' || r.status === 'pending_payment' || r.status === 'payment_failed';
    var live = pending || r.status === 'confirmed';
    var html = '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">';
    if (pending) {
      html += '<button type="button" class="db-btn" data-bk-act="cash" data-id="' + esc(r.id) + '">' + (isBm() ? 'Sahkan tunai' : 'Confirm cash') + '</button>';
      html += '<button type="button" class="db-btn" data-bk-act="release" data-id="' + esc(r.id) + '">' + (isBm() ? 'Lepaskan' : 'Release') + '</button>';
    }
    if (live) {
      html += '<button type="button" class="db-btn" data-bk-act="amend" data-id="' + esc(r.id) + '">' + (isBm() ? 'Pinda' : 'Amend') + '</button>';
      html += '<button type="button" class="db-btn" data-bk-act="delete" data-id="' + esc(r.id) + '">' + (isBm() ? 'Padam' : 'Delete') + '</button>';
    }
    html += '</div>';
    if (live) {
      html += '<form class="bk-amend-form" data-id="' + esc(r.id) + '" style="display:none;margin-top:8px;padding:8px;border:1px solid var(--border,#e2e8f0);border-radius:8px">' +
        '<div style="display:grid;gap:6px">' +
        '<input name="name" class="form-input" value="' + esc(r.customer_name || '') + '" placeholder="' + (isBm() ? 'Nama' : 'Name') + '">' +
        '<input name="phone" class="form-input" value="' + esc(r.customer_phone || '') + '" placeholder="' + (isBm() ? 'Telefon' : 'Phone') + '">' +
        '<input name="email" class="form-input" type="email" value="' + esc(r.customer_email || '') + '" placeholder="Email">' +
        '<input name="starts" class="form-input" type="datetime-local" value="' + esc(toLocal(r.starts_at)) + '">' +
        '<textarea name="notes" class="form-input" rows="2" placeholder="Notes">' + esc(r.notes || '') + '</textarea>' +
        '<div style="display:flex;gap:6px"><button type="submit" class="db-btn">' + (isBm() ? 'Simpan' : 'Save') + '</button>' +
        '<button type="button" class="db-btn" data-bk-act="amend-cancel">' + (isBm() ? 'Batal' : 'Cancel') + '</button></div></div></form>';
    }
    return html;
  }
  function clearListScroll(body) {
    if (!body) return;
    body.style.maxHeight = '';
    body.style.overflowY = '';
    body.style.overflowX = '';
  }
  function fitListScroll(body) {
    var rows = body.querySelectorAll('details[data-bk-row]');
    if (rows.length <= 5) { clearListScroll(body); return; }
    var h = 0;
    var i;
    for (i = 0; i < 5; i++) h += rows[i].offsetHeight;
    if (!h) h = 5 * 40;
    body.style.maxHeight = h + 'px';
    body.style.overflowY = 'auto';
    body.style.overflowX = 'hidden';
  }
  async function paint() {
    var card = document.getElementById('db-sec-booking');
    var body = document.getElementById('db-book-body');
    if (!card || !body || !window.sb || !APP.tenant) return;
    ensureTools();
    if (!STATE.force && body.querySelector('details[open]')) return;
    STATE.force = false;
    var b = bounds();
    var cols = 'id,customer_name,customer_email,customer_phone,starts_at,ends_at,status,quote_ref,payment_channel,created_at,notes,activity_id,booking_services(name)';
    var q = await sb.from('bookings')
      .select(cols + ',staff_id,employees(name,nickname)')
      .eq('tenant_id', APP.tenant.id)
      .gte('starts_at', b.start)
      .lte('starts_at', b.end)
      .order('starts_at', { ascending: STATE.sort !== 'starts_desc' });
    if (q.error) {
      q = await sb.from('bookings')
        .select(cols)
        .eq('tenant_id', APP.tenant.id)
        .gte('starts_at', b.start)
        .lte('starts_at', b.end)
        .order('starts_at', { ascending: STATE.sort !== 'starts_desc' });
    }
    if (q.error) {
      clearListScroll(body);
      body.textContent = q.error.message || (isBm() ? 'Gagal muat tempahan.' : 'Could not load bookings.');
      return;
    }
    var rows = q.data || [];
    var since = Date.now() - 15 * 60 * 1000;
    var fresh = rows.filter(function (r) {
      return (r.status === 'hold' || r.status === 'pending_payment') && new Date(r.created_at).getTime() >= since;
    }).length;
    setBadge(fresh);
    if (STATE.status !== 'all') rows = rows.filter(function (r) { return r.status === STATE.status; });
    if (STATE.range === 'upcoming') {
      rows = rows.filter(function (r) { return r.status !== 'expired' && r.status !== 'cancelled'; });
    }
    if (STATE.sort === 'status') {
      var order = { hold: 0, pending_payment: 1, confirmed: 2, payment_failed: 3, cancelled: 4, expired: 5 };
      rows.sort(function (a, c) { return (order[a.status] || 9) - (order[c.status] || 9); });
    } else {
      rows.sort(function (a, c) {
        var ta = new Date(a.starts_at).getTime();
        var tc = new Date(c.starts_at).getTime();
        if (isNaN(ta)) ta = 0;
        if (isNaN(tc)) tc = 0;
        return STATE.sort === 'starts_desc' ? (tc - ta) : (ta - tc);
      });
    }
    if (!rows.length) {
      clearListScroll(body);
      body.textContent = isBm() ? 'Tiada tempahan untuk tapisan ini.' : 'No bookings for this filter.';
      return;
    }
    body.innerHTML = rows.map(function (r) {
      var svc = r.booking_services && r.booking_services.name ? r.booking_services.name : 'Booking';
      var em = r.employees;
      if (Array.isArray(em)) em = em[0];
      var staff = '';
      if (em) staff = (em.nickname && String(em.nickname).trim()) || (em.name && String(em.name).trim()) || '';
      return '<details data-bk-row="' + esc(r.id) + '" style="padding:8px 0;border-bottom:1px solid var(--border,#e2e8f0)">' +
        '<summary style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:8px">' +
        '<span>' + esc(fmt(r.starts_at)) + ' · ' + esc(r.customer_name || '-') + ' · ' + esc(svc) +
        (staff ? ' · ' + esc(staff) : '') +
        (r.quote_ref ? ' · ' + esc(r.quote_ref) : '') + '</span><strong style="font-size:11px">' +
        esc(String(r.status || '').toUpperCase()) + '</strong></summary>' +
        '<div style="font-size:12px;color:var(--db-text3);margin-top:8px;line-height:1.5">' +
        (staff ? '<div>Staff: ' + esc(staff) + '</div>' : '') +
        '<div>' + (isBm() ? 'Nama' : 'Name') + ': ' + esc(r.customer_name || '-') + '</div>' +
        '<div>Email: ' + esc(r.customer_email || '-') + '</div>' +
        '<div>' + (isBm() ? 'Telefon' : 'Phone') + ': ' + esc(r.customer_phone || '-') + '</div>' +
        '<div>' + (isBm() ? 'Masa' : 'Time') + ': ' + esc(fmt(r.starts_at)) + '</div>' +
        '<div>Ref: ' + esc(r.quote_ref || '-') + '</div>' +
        '<div>' + (isBm() ? 'Bayaran' : 'Payment') + ': ' + esc(r.payment_channel || '-') + '</div>' +
        '<div>' + (isBm() ? 'Dicipta' : 'Created') + ': ' + esc(fmt(r.created_at)) + '</div></div>' +
        actions(r) +
        '</details>';
    }).join('');
    fitListScroll(body);
  }
  window.__bkCardPaint = function () { STATE.force = true; return paint(); };
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
