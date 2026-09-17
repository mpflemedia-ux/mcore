/* Dashboard: expire stale + Confirm cash / Release */
(function () {
  async function expire() {
    if (!window.sb) return;
    try { await sb.rpc('expire_stale_bookings'); } catch (e) {}
  }
  function bindCard() {
    var body = document.getElementById('db-book-body');
    if (!body || body._bkState) return;
    body._bkState = true;
    body.addEventListener('click', async function (e) {
      var btn = e.target.closest('[data-bk-act]');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var act = btn.getAttribute('data-bk-act');
      var r = act === 'cash'
        ? await sb.rpc('confirm_booking_cash', { p_booking_id: id })
        : await sb.rpc('release_booking', { p_booking_id: id });
      if (r.error) { showToast(r.error.message, 'error'); return; }
      showToast(act === 'cash' ? 'Cash confirmed' : 'Slot released', 'success');
      var card = document.getElementById('db-sec-booking');
      if (card) card.remove();
      if (typeof window.renderDashboard === 'function') renderDashboard();
    });
  }
  async function decorate() {
    await expire();
    bindCard();
    var body = document.getElementById('db-book-body');
    if (!body || !APP.tenant) return;
    var start = new Date(); start.setHours(0, 0, 0, 0);
    var end = new Date(); end.setHours(23, 59, 59, 999);
    var q = await sb.from('bookings').select('id,customer_name,starts_at,status,quote_ref,booking_services(name)').eq('tenant_id', APP.tenant.id).gte('starts_at', start.toISOString()).lte('starts_at', end.toISOString()).order('starts_at');
    if (q.error || !q.data) return;
    if (!q.data.length) return;
    body.innerHTML = q.data.map(function (r) {
      var svc = r.booking_services && r.booking_services.name ? r.booking_services.name : 'Booking';
      var pending = r.status === 'hold' || r.status === 'pending_payment' || r.status === 'payment_failed';
      var t = new Date(r.starts_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
      return '<div style="padding:8px 0;border-bottom:1px solid var(--border,#e2e8f0)"><div style="display:flex;justify-content:space-between;gap:8px"><span>' + t + ' · ' + (r.customer_name || '-') + ' · ' + svc + (r.quote_ref ? ' · ' + r.quote_ref : '') + '</span><strong style="font-size:11px">' + String(r.status || '').toUpperCase() + '</strong></div>' + (pending ? '<div style="margin-top:6px;display:flex;gap:6px"><button type="button" class="db-btn" data-bk-act="cash" data-id="' + r.id + '">Confirm cash</button><button type="button" class="db-btn" data-bk-act="release" data-id="' + r.id + '">Release</button></div>' : '') + '</div>';
    }).join('');
    bindCard();
  }
  function wrap() {
    ['renderDashboard', 'loadDashboardData'].forEach(function (name) {
      var orig = window[name];
      if (typeof orig !== 'function' || orig._bkSt) return;
      var w = async function () {
        var r = await orig.apply(this, arguments);
        setTimeout(decorate, 200);
        setTimeout(decorate, 800);
        return r;
      };
      w._bkSt = true; window[name] = w;
    });
  }
  function boot() { wrap(); decorate(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
