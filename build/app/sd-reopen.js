/* M-Core Service Desk - reopen a 'closed' (Disahkan & ditutup) request. supabase/sd_reopen_01.sql adds reopen_count + reopened_at.
   Public result page (?sr_result=): hook SDR_X called by sd-wa-result.js show(); action 'reopen' goes to Edge Function sd-result.
   In app: platform admin request detail gets 'Reopen'. Both: status closed -> in_progress, SLA restarts from reopen time
   (due_at = reopen + same SLA window = bhBetween(created_at, old due_at)), paused/delivered/closed cleared, timeline event
   type 'status' with meta.reopen, bells to platform admins + tenant owner. Hidden until the SQL runs (column probe). */
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  function form(L, id) {
    return '<div class="sdro-f" id="' + id + '" style="display:none;margin-top:12px"><div class="form-group" style="margin:0 0 8px"><label class="form-label" for="' + id + '-t">' + L('Why reopen this request?', 'Kenapa buka semula request ini?') + ' *</label>' +
      '<textarea class="form-input" id="' + id + '-t" rows="3" maxlength="2000" data-no-titlecase="1" required placeholder="' + L('E.g. The figure for March is still wrong…', 'Contoh: Angka bulan Mac masih salah…') + '"></textarea>' +
      '<div class="cob-xs sdro-e" style="display:none;color:var(--danger);margin-top:4px">' + L('Please write the reason (at least 3 characters).', 'Sila tulis sebab (sekurang-kurangnya 3 aksara).') + '</div></div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-outline sdro-c" style="flex:1;justify-content:center;min-height:44px">' + L('Cancel', 'Batal') + '</button>' +
      '<button type="button" class="btn btn-primary sdro-s" style="flex:1;justify-content:center;min-height:44px"><i class="ti ti-send"></i> ' + L('Submit', 'Hantar') + '</button></div></div>';
  }
  function btn(L, id) { return '<button type="button" class="btn btn-outline" id="' + id + '" style="width:100%;justify-content:center;margin-top:12px;min-height:44px"><i class="ti ti-arrow-back-up"></i> ' + L('Reopen request', 'Buka semula request') + '</button>'; }
  function wire(host, openBtn, fid, submit) {
    var f = host.querySelector('#' + fid), t = f.querySelector('textarea'), e = f.querySelector('.sdro-e'), s = f.querySelector('.sdro-s');
    t.oninput = function () { if (t.value.trim().length >= 3) { e.style.display = 'none'; t.style.borderColor = ''; } };
    openBtn.onclick = function () { openBtn.style.display = 'none'; f.style.display = ''; t.focus(); };
    f.querySelector('.sdro-c').onclick = function () { f.style.display = 'none'; openBtn.style.display = ''; t.value = ''; e.style.display = 'none'; t.style.borderColor = ''; };
    s.onclick = function () {
      var v = t.value.trim();
      if (v.length < 3) { e.style.display = ''; t.style.borderColor = 'var(--danger)'; t.focus(); return; }
      e.style.display = 'none'; t.style.borderColor = ''; s.disabled = true;
      submit(v, function () { s.disabled = false; });
    };
  }
  /* ---- public result page ---- */
  window.SDR_X = function (o) {
    var d = o.d, L = function (en, bm) { return o.lang === 'bm' ? bm : en; }, root = o.root;
    var cards = root.querySelectorAll('.cob-root > .cob-card'), last = cards[cards.length - 1];
    if (d.reopened_at && d.status === 'in_progress') {
      var bg = root.querySelector('.cob-root > .cob-card .badge');
      if (bg) { bg.className = 'badge badge-blue'; bg.innerHTML = '<i class="ti ti-arrow-back-up"></i> ' + L('Reopened · in progress', 'Dibuka semula · dalam proses'); }
      if (last && !d.can_respond) { var n = last.querySelector('.cob-sm'); if (n && !o.msg) n.textContent = L('This request was reopened. We will update you soon.', 'Request ini telah dibuka semula. Kami akan maklumkan semula.'); var ic = last.querySelector('.ti'); if (ic) { ic.className = 'ti ti-arrow-back-up'; ic.style.color = 'var(--primary)'; } }
      return;
    }
    if (!d.can_reopen || !last || last.querySelector('#sdro-b')) return;
    last.insertAdjacentHTML('beforeend', btn(L, 'sdro-b') + form(L, 'sdro-p'));
    wire(last, last.querySelector('#sdro-b'), 'sdro-p', function (v, fail) {
      o.call({ action: 'reopen', comment: v }).then(function (j) {
        if (j && j.ok) { d.status = j.status || 'in_progress'; d.closed_at = null; d.can_reopen = false; d.reopened_at = new Date().toISOString(); o.show(); return; }
        fail(); o.show(j && j.error === 'rate' ? L('Too many attempts. Please try again later.', 'Terlalu banyak cubaan. Sila cuba sebentar lagi.') : L('Could not reopen this request. Please try again.', 'Request tidak dapat dibuka semula. Sila cuba lagi.'));
      }, fail);
    });
  };
  /* ---- in app (platform admin request detail) ---- */
  var SD = window.SD; if (!SD || SD._reopen) return; SD._reopen = 1;
  var has = null;
  SD.reopenOn = function () {
    if (has) return has;
    has = Promise.resolve().then(function () { return sb.from('service_requests').select('reopen_count,reopened_at').limit(1); })
      .then(function (r) { return !!(r && !r.error); }, function () { return false; });
    return has;
  };
  SD.reopen = function (r, reason, byName) {
    var now = new Date(), win = r.due_at ? Math.max(1, Math.round(SD.bhBetween(r.created_at, r.due_at))) : 0;
    var p = { status: 'in_progress', updated_at: now.toISOString(), closed_at: null, delivered_at: null, paused_at: null, sla_paused_seconds: 0, reopened_at: now.toISOString(), reopen_count: (+r.reopen_count || 0) + 1 };
    if (win) p.due_at = SD.addBH(now, win).toISOString();
    return sb.from('service_requests').update(p).eq('id', r.id).eq('status', 'closed').select().then(function (x) {
      if (x.error) throw x.error;
      if (!x.data || !x.data.length) throw new Error(SD.L('This request was changed by someone else. Reload.', 'Permohonan ini telah dikemas kini. Muat semula.'));
      var nr = x.data[0];
      return SD.event(nr, 'status', { from_status: 'closed', to_status: 'in_progress', body: reason, meta: { reopen: true, via: 'app', by_name: byName || null } }).catch(function () {}).then(function () {
        var t = nr.ref_no + ': ' + SD.L('reopened', 'dibuka semula');
        (SD.bellNew ? SD.bellNew(nr, t, reason) : SD.bellFor(nr, t, reason)); return nr;
      });
    });
  };
  var ev0 = SD.evTextX;
  SD.evTextX = function (e) {
    var m = e.meta || {};
    if (e.type === 'status' && m.reopen) return '<b>' + SD.L('Reopened by ', 'Dibuka semula oleh ') + esc(m.via === 'result_link' ? SD.L('client via result link', 'client melalui link hasil') : (m.by_name || SD.L('staff', 'staf'))) + '</b>';
    return ev0 ? ev0(e) : '';
  };
  var inj0 = SD.waInject;
  SD.waInject = function (m, r, ev, admin) {
    if (inj0) inj0(m, r, ev, admin);
    if (!admin || !SD.isPA() || r.status !== 'closed') return;
    SD.reopenOn().then(function (on) {
      if (!on || !m.isConnected || m.querySelector('#sdro-a')) return;
      var root = m.querySelector('.cob-root'); if (!root) return;
      var L = SD.L, box = document.createElement('div'); box.className = 'cob-card'; box.style.cssText = 'padding:16px;margin-bottom:24px';
      box.innerHTML = '<b style="font-size:15px">' + L('Closed request', 'Request ditutup') + '</b><div class="cob-xs" style="margin-top:2px">' + L('Reopen moves it back to In progress and restarts the SLA from now.', 'Buka semula akan pulangkan ke Dalam proses dan SLA bermula semula dari sekarang.') + '</div>' + btn(L, 'sdro-a') + form(L, 'sdro-i');
      root.appendChild(box);
      var u = (window.APP && APP.user) || {}, me = String(u.full_name || u.name || (u.user_metadata && u.user_metadata.full_name) || u.email || '').slice(0, 120);
      wire(box, box.querySelector('#sdro-a'), 'sdro-i', function (v, fail) {
        SD.reopen(r, v, me).then(function () { SD.toast(L('Request reopened', 'Request dibuka semula'), 'success'); return SD.detail(r.id, true); }).catch(function (e) { fail(); SD.toast(SD.err(e), 'error'); });
      });
    });
  };
})();
