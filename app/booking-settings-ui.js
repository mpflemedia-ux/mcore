/* Rebuild Public booking settings: session/event, hours, weekdays, list */
(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function maskFromChecks() {
    var mask = 0;
    document.querySelectorAll('#bk-wd input[type=checkbox]').forEach(function (c) {
      if (c.checked) mask |= (1 << Number(c.value));
    });
    return mask || 127;
  }
  function toggleKind() {
    var kind = (document.querySelector('#bk-settings-box input[name=bk-kind]:checked') || {}).value || 'session';
    var sess = document.getElementById('bk-sess-fields');
    var evt = document.getElementById('bk-evt-fields');
    var dur = document.getElementById('bk-dur-wrap');
    if (sess) sess.style.display = kind === 'event' ? 'none' : 'block';
    if (evt) evt.style.display = kind === 'event' ? 'block' : 'none';
    if (dur) dur.style.display = kind === 'event' ? 'none' : 'inline-block';
  }
  async function loadList() {
    var list = document.getElementById('bk-svc-list');
    if (!list || !window.sb || !APP.tenant) return;
    var isBm = APP.language === 'bm';
    var q = await sb.from('booking_services').select('id,name,kind,price,is_active').eq('tenant_id', APP.tenant.id).order('created_at', { ascending: false });
    if (q.error) { list.textContent = q.error.message; return; }
    var rows = q.data || [];
    if (!rows.length) { list.innerHTML = '<div style="font-size:12px;color:var(--text-3)">' + (isBm ? 'Belum ada servis.' : 'No services yet.') + '</div>'; return; }
    list.innerHTML = rows.map(function (r) {
      return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px"><span>' +
        esc(r.name) + ' · ' + esc(r.kind) + ' · RM ' + Number(r.price || 0).toFixed(2) +
        (r.is_active ? '' : ' · off') + '</span>' +
        (r.is_active ? '<button type="button" class="btn btn-outline btn-sm bk-svc-off" data-id="' + esc(r.id) + '">' + (isBm ? 'Nyahaktif' : 'Deactivate') + '</button>' : '') +
        '</div>';
    }).join('');
    list.querySelectorAll('.bk-svc-off').forEach(function (btn) {
      btn.onclick = async function () {
        await sb.from('booking_services').update({ is_active: false }).eq('id', btn.getAttribute('data-id')).eq('tenant_id', APP.tenant.id);
        loadList();
      };
    });
  }
  function paint(box) {
    if (!box || box.getAttribute('data-bk-ui') === '2') return;
    box.setAttribute('data-bk-ui', '2');
    var isBm = APP.language === 'bm';
    var days = isBm
      ? [['0','Ahd'],['1','Isn'],['2','Sel'],['3','Rab'],['4','Kha'],['5','Jum'],['6','Sab']]
      : [['0','Sun'],['1','Mon'],['2','Tue'],['3','Wed'],['4','Thu'],['5','Fri'],['6','Sat']];
    var wd = days.map(function (d) {
      return '<label style="display:inline-flex;gap:4px;align-items:center;font-size:12px"><input type="checkbox" value="' + d[0] + '" checked> ' + d[1] + '</label>';
    }).join(' ');
    box.innerHTML =
      '<strong>' + (isBm ? 'Booking awam' : 'Public booking') + '</strong>' +
      '<div style="font-size:12px;color:var(--text-3);margin:6px 0 10px">' + (isBm ? 'Link customer pilih slot & tempah.' : 'Customer picks a slot and books.') + '</div>' +
      '<div style="display:flex;gap:12px;margin-bottom:8px;font-size:13px">' +
      '<label><input type="radio" name="bk-kind" value="session" checked> ' + (isBm ? 'Sesi' : 'Session') + '</label>' +
      '<label><input type="radio" name="bk-kind" value="event"> ' + (isBm ? 'Acara' : 'Event') + '</label></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<input id="bk-svc-name" class="form-input" placeholder="' + (isBm ? 'Nama servis / acara' : 'Service / event') + '" style="min-width:160px">' +
      '<input id="bk-svc-price" class="form-input" type="number" step="0.01" placeholder="RM" style="width:100px">' +
      '<span id="bk-dur-wrap"><input id="bk-svc-mins" class="form-input" type="number" value="60" style="width:80px"> <span style="font-size:11px">' + (isBm ? 'minit' : 'min') + '</span></span></div>' +
      '<div id="bk-sess-fields" style="margin-top:10px">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
      '<label style="font-size:12px">' + (isBm ? 'Mula' : 'Day start') + ' <input id="bk-day-start" type="time" value="09:00" class="form-input"></label>' +
      '<label style="font-size:12px">' + (isBm ? 'Tamat' : 'Day end') + ' <input id="bk-day-end" type="time" value="18:00" class="form-input"></label>' +
      '<label style="font-size:12px">' + (isBm ? 'Kapasiti' : 'Capacity') + ' <input id="bk-cap" type="number" min="1" value="1" class="form-input" style="width:70px"></label></div>' +
      '<div id="bk-wd" style="display:flex;flex-wrap:wrap;gap:8px">' + wd + '</div></div>' +
      '<div id="bk-evt-fields" style="display:none;margin-top:10px">' +
      '<label style="font-size:12px">' + (isBm ? 'Mula acara' : 'Event start') + ' <input id="bk-evt-start" type="datetime-local" class="form-input"></label> ' +
      '<label style="font-size:12px">' + (isBm ? 'Tamat acara' : 'Event end') + ' <input id="bk-evt-end" type="datetime-local" class="form-input"></label></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
      '<button type="button" class="btn btn-outline btn-sm" id="bk-svc-add">' + (isBm ? 'Tambah servis' : 'Add service') + '</button>' +
      '<button type="button" class="btn btn-primary btn-sm" id="bk-link-btn">' + (isBm ? 'Salin link awam' : 'Copy public link') + '</button></div>' +
      '<div id="bk-svc-msg" style="font-size:12px;margin-top:8px"></div>' +
      '<div style="font-size:12px;font-weight:600;margin:14px 0 6px">' + (isBm ? 'Servis sedia ada' : 'Existing services') + '</div>' +
      '<div id="bk-svc-list"></div>';
    box.querySelectorAll('input[name=bk-kind]').forEach(function (r) { r.onchange = toggleKind; });
    toggleKind();
    var add = document.getElementById('bk-svc-add');
    if (add) add.onclick = async function () {
      var name = (document.getElementById('bk-svc-name').value || '').trim();
      var msg = document.getElementById('bk-svc-msg');
      if (!name) { msg.textContent = isBm ? 'Nama diperlukan' : 'Name required'; return; }
      var kind = (document.querySelector('#bk-settings-box input[name=bk-kind]:checked') || {}).value || 'session';
      var row = { tenant_id: APP.tenant.id, name: name, kind: kind, price: Number(document.getElementById('bk-svc-price').value || 0), is_active: true };
      if (kind === 'event') {
        var es = document.getElementById('bk-evt-start').value;
        var ee = document.getElementById('bk-evt-end').value;
        if (!es) { msg.textContent = isBm ? 'Tarikh/masa mula diperlukan' : 'Event start required'; return; }
        row.event_starts_at = es.length === 16 ? es + ':00+08:00' : es;
        row.event_ends_at = ee ? (ee.length === 16 ? ee + ':00+08:00' : ee) : row.event_starts_at;
        row.duration_min = 60;
        row.capacity = Number((document.getElementById('bk-cap') || {}).value || 1);
      } else {
        row.duration_min = Number(document.getElementById('bk-svc-mins').value || 60);
        row.day_start = document.getElementById('bk-day-start').value || '09:00';
        row.day_end = document.getElementById('bk-day-end').value || '18:00';
        row.weekday_mask = maskFromChecks();
        row.capacity = Number(document.getElementById('bk-cap').value || 1);
      }
      var r = await sb.from('booking_services').insert(row);
      msg.textContent = r.error ? r.error.message : (isBm ? 'Servis ditambah.' : 'Service added.');
      if (!r.error) loadList();
    };
    var link = document.getElementById('bk-link-btn');
    if (link) link.onclick = async function () {
      var msg = document.getElementById('bk-svc-msg');
      var r = await sb.rpc('ensure_booking_public_token');
      var tok = r && r.data;
      if (!tok && APP.tenant) {
        var t = await sb.from('tenants').select('booking_public_token').eq('id', APP.tenant.id).maybeSingle();
        tok = t.data && t.data.booking_public_token;
      }
      if (!tok) { msg.textContent = 'Run booking SQL first.'; return; }
      var url = location.origin + '/app/?book=' + encodeURIComponent(tok);
      try { await navigator.clipboard.writeText(url); } catch (e) {}
      msg.textContent = url;
    };
    loadList();
  }
  function boot() {
    var box = document.getElementById('bk-settings-box');
    if (box) paint(box);
  }
  setInterval(boot, 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
