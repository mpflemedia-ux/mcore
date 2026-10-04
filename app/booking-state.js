/* Dashboard booking actions: expire + confirm/release/amend/delete + planner sync */
(function () {
  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type || 'success');
  }
  async function expire() {
    if (!window.sb) return;
    try { await sb.rpc('expire_stale_bookings'); } catch (e) {}
  }
  async function loadBooking(id) {
    var q = await sb.from('bookings')
      .select('id,tenant_id,service_id,customer_name,customer_email,customer_phone,starts_at,ends_at,status,quote_ref,notes,activity_id,booking_services(name,duration_min)')
      .eq('id', id)
      .maybeSingle();
    return q.data;
  }
  async function ensurePlanner(b) {
    if (!b || b.status !== 'confirmed' || !APP.tenant || !APP.user) return;
    var svc = b.booking_services && b.booking_services.name ? b.booking_services.name : 'Booking';
    var title = 'Booking ' + (b.quote_ref || '') + ': ' + svc + ' — ' + (b.customer_name || '');
    var notes = 'booking:' + b.id;
    if (b.activity_id) {
      var u = await sb.from('platform_activities').update({
        title: title,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        notes: notes,
        status: 'open',
        updated_at: new Date().toISOString()
      }).eq('id', b.activity_id);
      if (!u.error) return;
    }
    var ins = await sb.from('platform_activities').insert({
      owner_user_id: APP.user.id,
      tenant_id: APP.tenant.id,
      title: title,
      activity_type: 'appointment',
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      notes: notes,
      status: 'open'
    }).select('id').maybeSingle();
    if (ins.data && ins.data.id) {
      await sb.from('bookings').update({ activity_id: ins.data.id }).eq('id', b.id);
    }
  }
  async function cancelPlanner(b) {
    if (!b || !b.activity_id) return;
    await sb.from('platform_activities').update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    }).eq('id', b.activity_id);
  }
  async function amendBooking(id, form) {
    var b = await loadBooking(id);
    if (!b) { toast('Booking not found', 'error'); return; }
    var name = (form.name.value || '').trim();
    var phone = (form.phone.value || '').trim();
    var email = (form.email.value || '').trim();
    var notes = (form.notes.value || '').trim();
    var starts = form.starts.value ? new Date(form.starts.value) : new Date(b.starts_at);
    if (!name) { toast('Name required', 'error'); return; }
    if (isNaN(starts.getTime())) { toast('Invalid time', 'error'); return; }
    var dur = (b.booking_services && Number(b.booking_services.duration_min)) || 60;
    var ends = new Date(starts.getTime() + dur * 60000);
    var r = await sb.rpc('amend_booking', {
      p_booking_id: id,
      p_name: name,
      p_phone: phone,
      p_email: email,
      p_starts_at: starts.toISOString(),
      p_notes: notes
    });
    if (r.error) {
      var u = await sb.from('bookings').update({
        customer_name: name,
        customer_phone: phone || null,
        customer_email: email || null,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        notes: notes || null,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (u.error) { toast(u.error.message || r.error.message, 'error'); return; }
    }
    var fresh = await loadBooking(id);
    if (fresh && fresh.status === 'confirmed') await ensurePlanner(fresh);
    toast(APP.language === 'bm' ? 'Tempahan dipinda' : 'Booking amended');
  }
  async function removeTerminalBooking(id) {
    var q = sb.from('bookings').delete().eq('id', id).in('status', ['expired', 'cancelled']);
    if (APP.tenant && APP.tenant.id) q = q.eq('tenant_id', APP.tenant.id);
    var d = await q;
    if (d.error) return d.error;
    var still = await sb.from('bookings').select('id').eq('id', id).maybeSingle();
    if (still.error) return still.error;
    if (still.data) return { message: 'Booking was not removed' };
    return null;
  }
  async function deleteBooking(id) {
    var b = await loadBooking(id);
    var terminal = b && (b.status === 'expired' || b.status === 'cancelled');
    var ok = confirm(terminal
      ? (APP.language === 'bm' ? 'Padam tempahan ini dari senarai?' : 'Remove this booking from the list?')
      : (APP.language === 'bm' ? 'Padam / batal tempahan ini?' : 'Delete / cancel this booking?'));
    if (!ok) return;
    if (terminal) {
      await cancelPlanner(b);
      var err = await removeTerminalBooking(id);
      if (err) { toast(err.message || 'Delete failed', 'error'); return; }
      toast(APP.language === 'bm' ? 'Tempahan dipadam' : 'Booking deleted');
      return;
    }
    var r = await sb.rpc('cancel_booking', { p_booking_id: id });
    if (r.error) {
      var u = await sb.from('bookings').update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (u.error) { toast(u.error.message || r.error.message, 'error'); return; }
    }
    if (b) await cancelPlanner(b);
    toast(APP.language === 'bm' ? 'Tempahan dibatalkan' : 'Booking cancelled');
  }
  function bindCard() {
    var body = document.getElementById('db-book-body');
    if (!body || body._bkState) return;
    body._bkState = true;
    body.addEventListener('click', async function (e) {
      var cancelBtn = e.target.closest('[data-bk-act="amend-cancel"]');
      if (cancelBtn) {
        var form = cancelBtn.closest('.bk-amend-form');
        if (form) form.style.display = 'none';
        return;
      }
      var btn = e.target.closest('[data-bk-act]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var id = btn.getAttribute('data-id');
      var act = btn.getAttribute('data-bk-act');
      if (act === 'amend') {
        var row = btn.closest('details');
        var f = row && row.querySelector('.bk-amend-form');
        if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
        return;
      }
      if (act === 'delete') {
        await deleteBooking(id);
        if (typeof window.__bkCardPaint === 'function') window.__bkCardPaint();
        return;
      }
      if (act === 'cash' || act === 'release') {
        var r = act === 'cash'
          ? await sb.rpc('confirm_booking_cash', { p_booking_id: id })
          : await sb.rpc('release_booking', { p_booking_id: id });
        if (r.error) { toast(r.error.message, 'error'); return; }
        if (act === 'cash') {
          var b = await loadBooking(id);
          if (b) await ensurePlanner(b);
          toast(APP.language === 'bm' ? 'Disahkan — masuk planner' : 'Confirmed — added to planner');
        } else {
          var rel = await loadBooking(id);
          if (rel) await cancelPlanner(rel);
          toast(APP.language === 'bm' ? 'Slot dilepaskan' : 'Slot released');
        }
        if (typeof window.__bkCardPaint === 'function') window.__bkCardPaint();
      }
    });
    body.addEventListener('submit', async function (e) {
      var form = e.target.closest('.bk-amend-form');
      if (!form) return;
      e.preventDefault();
      e.stopPropagation();
      await amendBooking(form.getAttribute('data-id'), form);
      if (typeof window.__bkCardPaint === 'function') window.__bkCardPaint();
    });
  }
  async function decorate() {
    await expire();
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
