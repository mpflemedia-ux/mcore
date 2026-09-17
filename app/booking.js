/* Customer booking — public page + dashboard card + settings link */
(function () {
  var HOLD_NOTE = 'Slot held 15 min until payment.';
  function qs(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' })[c];
    });
  }
  function fmtTime(iso) {
    try { return new Date(iso).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return iso; }
  }
  function slotTimes(svc, dateStr) {
    if (svc.kind === 'event' && svc.event_starts_at) {
      return [{ start: svc.event_starts_at, end: svc.event_ends_at || svc.event_starts_at }];
    }
    var d = dateStr || new Date().toISOString().slice(0, 10);
    var start = String(svc.day_start || '09:00').slice(0, 5);
    var end = String(svc.day_end || '18:00').slice(0, 5);
    var dur = Number(svc.duration_min || 60);
    var wd = new Date(d + 'T12:00:00').getDay();
    var mask = Number(svc.weekday_mask == null ? 127 : svc.weekday_mask);
    if (((mask >> wd) & 1) === 0) return [];
    var out = [];
    var partsS = start.split(':').map(Number);
    var partsE = end.split(':').map(Number);
    var cur = partsS[0] * 60 + partsS[1];
    var last = partsE[0] * 60 + partsE[1];
    while (cur + dur <= last) {
      var h1 = String(Math.floor(cur / 60)).padStart(2, '0');
      var m1 = String(cur % 60).padStart(2, '0');
      var n = cur + dur;
      var h2 = String(Math.floor(n / 60)).padStart(2, '0');
      var m2 = String(n % 60).padStart(2, '0');
      out.push({ start: d + 'T' + h1 + ':' + m1 + ':00+08:00', end: d + 'T' + h2 + ':' + m2 + ':00+08:00', label: h1 + ':' + m1 });
      cur += dur;
    }
    return out;
  }
  function takenCount(board, serviceId, startIso) {
    var rows = (board && board.booked) || [];
    var t0 = new Date(startIso).getTime();
    return rows.filter(function (b) {
      if (String(b.service_id) !== String(serviceId)) return false;
      return new Date(b.starts_at).getTime() <= t0 && t0 < new Date(b.ends_at).getTime();
    }).length;
  }
  async function showPublic() {
    var token = qs('book');
    if (!token || !window.sb) return false;
    var shell = document.getElementById('shell');
    if (shell) shell.classList.remove('active');
    var auth = document.getElementById('auth-page');
    if (auth) auth.style.display = 'none';
    var root = document.getElementById('public-book-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'public-book-root';
      root.style.cssText = 'min-height:100vh;background:#F8FAFC;padding:24px 16px;font-family:Inter,system-ui,sans-serif';
      document.body.appendChild(root);
    }
    var date = qs('date') || new Date().toISOString().slice(0, 10);
    root.innerHTML = '<div style="max-width:720px;margin:40px auto;color:#64748b;text-align:center">Loading booking…</div>';
    var res = await sb.rpc('get_public_booking_board', { p_token: token, p_date: date });
    if (res.error) {
      root.innerHTML = '<div style="max-width:520px;margin:60px auto;padding:24px;background:#fff;border-radius:12px"><h2>Booking unavailable</h2><p>' + esc(res.error.message) + '</p></div>';
      return true;
    }
    var board = res.data || {};
    var services = board.services || [];
    root.innerHTML = '<div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px"><div style="font-size:12px;color:#64748b;letter-spacing:.06em;text-transform:uppercase">Booking</div><h1 style="margin:4px 0 8px;font-size:22px">' + esc(board.tenant_name || 'Book a slot') + '</h1><label style="font-size:13px">Date <input id="bk-date" type="date" value="' + esc(date) + '" style="margin-left:8px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px"></label><div id="bk-list" style="margin-top:16px"></div></div>';
    document.getElementById('bk-date').onchange = function () {
      var u = new URL(location.href); u.searchParams.set('date', this.value); history.replaceState({}, '', u); showPublic();
    };
    var list = document.getElementById('bk-list');
    if (!services.length) { list.innerHTML = '<p style="color:#64748b">No services open yet.</p>'; return true; }
    list.innerHTML = services.map(function (svc) {
      var slots = slotTimes(svc, date).map(function (sl) {
        var full = takenCount(board, svc.id, sl.start) >= Number(svc.capacity || 1);
        return '<button type="button" class="bk-slot" data-sid="' + esc(svc.id) + '" data-start="' + esc(sl.start) + '" data-name="' + esc(svc.name) + '" data-price="' + esc(svc.price) + '" ' + (full ? 'disabled style="opacity:.4"' : '') + ' style="padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;cursor:pointer;font-size:13px">' + esc(sl.label || fmtTime(sl.start)) + (full ? ' · full' : '') + '</button>';
      }).join(' ');
      return '<div style="border-top:1px solid #e2e8f0;padding:14px 0"><div style="font-weight:700">' + esc(svc.name) + '</div><div style="font-size:12px;color:#64748b;margin:4px 0 8px">RM ' + Number(svc.price || 0).toFixed(2) + ' · ' + esc(svc.duration_min) + ' min</div><div style="display:flex;flex-wrap:wrap;gap:8px">' + (slots || '<span style="color:#94a3b8">No slot</span>') + '</div></div>';
    }).join('');
    list.querySelectorAll('.bk-slot:not([disabled])').forEach(function (btn) {
      btn.onclick = function () { openBookForm(token, btn.dataset); };
    });
    return true;
  }
  function openBookForm(token, ds) {
    var root = document.getElementById('public-book-root');
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:2000;padding:16px';
    box.innerHTML = '<form id="bk-form" style="background:#fff;border-radius:14px;padding:20px;max-width:420px;width:100%"><h3 style="margin:0 0 8px">Book ' + esc(ds.name) + '</h3><p style="color:#64748b;font-size:13px">' + esc(fmtTime(ds.start)) + ' · RM ' + Number(ds.price || 0).toFixed(2) + '</p><input required name="name" placeholder="Full name" style="width:100%;margin:0 0 8px;padding:10px;border:1px solid #cbd5e1;border-radius:8px"><input name="email" type="email" placeholder="Email" style="width:100%;margin:0 0 8px;padding:10px;border:1px solid #cbd5e1;border-radius:8px"><input name="phone" placeholder="Phone" style="width:100%;margin:0 0 12px;padding:10px;border:1px solid #cbd5e1;border-radius:8px"><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" id="bk-cancel">Cancel</button><button type="submit" style="background:#0E7490;color:#fff;border:0;border-radius:8px;padding:8px 14px">Confirm hold</button></div><p id="bk-err" style="color:#b91c1c;font-size:12px;display:none"></p></form>';
    root.appendChild(box);
    document.getElementById('bk-cancel').onclick = function () { box.remove(); };
    document.getElementById('bk-form').onsubmit = async function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      var err = document.getElementById('bk-err');
      var r = await sb.rpc('create_public_booking', { p_token: token, p_service_id: ds.sid, p_starts_at: ds.start, p_name: fd.get('name'), p_email: fd.get('email') || '', p_phone: fd.get('phone') || '' });
      if (r.error) { err.style.display = 'block'; err.textContent = r.error.message; return; }
      var d = r.data || {};
      var pay = d.pay_token ? (location.origin + '/app/?public_inv=' + encodeURIComponent(d.pay_token)) : '';
      box.innerHTML = '<div style="background:#fff;border-radius:14px;padding:22px;max-width:420px"><h3>Held</h3><p>' + HOLD_NOTE + '</p>' + (pay ? '<p><a href="' + pay + '">Pay invoice</a></p>' : '<p>Tenant will confirm payment.</p>') + '<p style="font-size:12px;color:#64748b">' + esc(d.service) + '</p></div>';
    };
  }
  async function ensureToken() {
    if (!window.sb || !APP.tenant) return null;
    var r = await sb.rpc('ensure_booking_public_token');
    if (r.error) return null;
    return r.data;
  }
  function publicUrl(tok) { return location.origin + '/app/?book=' + encodeURIComponent(tok); }
  async function renderDashCard() {
    if (!document.getElementById('dashboard-wrap') || document.getElementById('db-sec-booking')) return;
    var planner = document.getElementById('db-sec-planner');
    var card = document.createElement('div');
    card.className = 'db-card'; card.id = 'db-sec-booking'; card.style.marginBottom = '14px';
    var isBm = APP.language === 'bm';
    card.innerHTML = '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px"><div><div class="db-card-title"><i class="ti ti-calendar-plus"></i> ' + (isBm ? 'Tempahan' : 'Bookings') + '</div><div style="font-size:12px;color:var(--db-text3)">' + (isBm ? 'Hari ini + link awam' : 'Today + public link') + '</div></div><div style="display:flex;gap:6px"><button type="button" class="db-btn" id="db-book-copy">' + (isBm ? 'Salin link' : 'Copy link') + '</button><button type="button" class="db-btn" onclick="openPage(\'planner\')">Planner</button></div></div><div id="db-book-body" style="font-size:13px;color:var(--db-text3)">Loading…</div>';
    if (planner && planner.parentNode) planner.parentNode.insertBefore(card, planner.nextSibling);
    var body = document.getElementById('db-book-body');
    var copyBtn = document.getElementById('db-book-copy');
    if (copyBtn) copyBtn.onclick = async function () {
      var tok = await ensureToken();
      if (!tok) { showToast('Run booking SQL first', 'error'); return; }
      try { await navigator.clipboard.writeText(publicUrl(tok)); showToast(isBm ? 'Link disalin' : 'Link copied', 'success'); }
      catch (e) { prompt('Public booking link', publicUrl(tok)); }
    };
    if (!window.sb || !APP.tenant) return;
    var start = new Date(); start.setHours(0,0,0,0);
    var end = new Date(); end.setHours(23,59,59,999);
    var q = await sb.from('bookings').select('id,customer_name,starts_at,status,booking_services(name)').eq('tenant_id', APP.tenant.id).gte('starts_at', start.toISOString()).lte('starts_at', end.toISOString()).order('starts_at');
    if (q.error) { body.textContent = isBm ? 'Jalankan SQL booking dulu.' : 'Run booking SQL first.'; return; }
    var rows = q.data || [];
    if (!rows.length) { body.textContent = isBm ? 'Tiada tempahan hari ini — kongsi link awam.' : 'No bookings today — share the public link.'; return; }
    body.innerHTML = rows.map(function (r) {
      var svc = r.booking_services && r.booking_services.name ? r.booking_services.name : 'Booking';
      return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border,#e2e8f0)"><span>' + esc(fmtTime(r.starts_at)) + ' · ' + esc(r.customer_name || '-') + ' · ' + esc(svc) + '</span><strong style="font-size:11px;text-transform:uppercase">' + esc(r.status) + '</strong></div>';
    }).join('');
  }
  async function injectSettings() {
    if (location.hash.indexOf('settings') < 0 || document.getElementById('bk-settings-box')) return;
    var wrap = document.getElementById('role-perms-wrap');
    if (!wrap) return;
    var isBm = APP.language === 'bm';
    var box = document.createElement('div');
    box.id = 'bk-settings-box';
    box.style.cssText = 'border:1px solid var(--border);border-radius:10px;padding:14px;margin:16px 0';
    box.innerHTML = '<strong>' + (isBm ? 'Booking awam' : 'Public booking') + '</strong><div style="font-size:12px;color:var(--text-3);margin:6px 0 10px">' + (isBm ? 'Link customer pilih slot & tempah.' : 'Customer picks a slot and books.') + '</div><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="bk-svc-name" class="form-input" placeholder="Service / event" style="min-width:160px"><input id="bk-svc-price" class="form-input" type="number" step="0.01" placeholder="RM" style="width:100px"><input id="bk-svc-mins" class="form-input" type="number" value="60" style="width:80px"><button type="button" class="btn btn-outline btn-sm" id="bk-svc-add">Add service</button><button type="button" class="btn btn-primary btn-sm" id="bk-link-btn">Copy public link</button></div><div id="bk-svc-msg" style="font-size:12px;margin-top:8px"></div>';
    wrap.parentNode.insertBefore(box, wrap);
    document.getElementById('bk-link-btn').onclick = async function () {
      var tok = await ensureToken(); var msg = document.getElementById('bk-svc-msg');
      if (!tok) { msg.textContent = 'Run booking SQL first.'; return; }
      try { await navigator.clipboard.writeText(publicUrl(tok)); msg.textContent = publicUrl(tok); showToast('Copied', 'success'); }
      catch (e) { msg.textContent = publicUrl(tok); }
    };
    document.getElementById('bk-svc-add').onclick = async function () {
      var name = (document.getElementById('bk-svc-name').value || '').trim();
      var msg = document.getElementById('bk-svc-msg');
      if (!name) { msg.textContent = 'Name required'; return; }
      var r = await sb.from('booking_services').insert({ tenant_id: APP.tenant.id, name: name, kind: 'session', duration_min: Number(document.getElementById('bk-svc-mins').value || 60), price: Number(document.getElementById('bk-svc-price').value || 0), capacity: 1, is_active: true });
      msg.textContent = r.error ? r.error.message : (isBm ? 'Servis ditambah.' : 'Service added.');
    };
  }
  function wrapDash() {
    ['renderDashboard', 'loadDashboardData'].forEach(function (name) {
      var orig = window[name];
      if (typeof orig !== 'function' || orig._bkWrapped) return;
      var w = async function () { var r = await orig.apply(this, arguments); setTimeout(renderDashCard, 0); setTimeout(renderDashCard, 400); return r; };
      w._bkWrapped = true; window[name] = w;
    });
    var origS = window.renderSettings;
    if (typeof origS === 'function' && !origS._bkWrapped) {
      var ws = async function () { var r = await origS.apply(this, arguments); setTimeout(injectSettings, 0); setTimeout(injectSettings, 400); return r; };
      ws._bkWrapped = true; window.renderSettings = ws;
    }
  }
  async function boot() {
    wrapDash();
    if (qs('book')) { try { await showPublic(); } catch (e) { console.error(e); } return; }
    renderDashCard(); injectSettings();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 500);
})();
