/* M-Core Service Desk - platform admin bell recipients via view sd_platform_admins (supabase/sd_notify_platform_admin.sql).
   Until that SQL runs, falls back to the old user_profiles query (same result as before). */
(function () {
  var SD = window.SD; if (!SD || SD.paList) return;
  SD.paList = function () {
    var old = function () { return sb.from('user_profiles').select('id,tenant_id,role').eq('role', 'platform_admin'); };
    return Promise.resolve().then(function () { return sb.from('sd_platform_admins').select('id,tenant_id'); }).then(function (v) {
      if (!v || v.error) return old();
      return { data: (v.data || []).map(function (u) { return { id: u.id, tenant_id: u.tenant_id, role: 'platform_admin' }; }) };
    }, old);
  };
  /* new request (also reused by SD.escalate below): every platform admin + the tenant's
     owner(s); one row per user, never the submitter (SD.bell). type defaults to 'sd.new'
     (kind=action) since that's this function's main caller; escalate() passes 'sd.status'
     explicitly since an escalation reminder isn't itself a new, unactioned request. */
  SD.bellNew = function (r, title, body, type, gk) {
    type = type || 'sd.new';
    var rid = r && r.id ? String(r.id) : null, g = rid ? type + ':' + rid : (gk || null);
    var mk = function (u) { return { tenant_id: u.tenant_id, user_id: u.id, title: title, body: body || '', category: 'service_desk', kind: type === 'sd.new' ? 'action' : 'for_you', type: type, group_key: g, ref_table: 'service_requests', ref_id: rid }; };
    var own = Promise.resolve().then(function () { return sb.from('user_profiles').select('id,tenant_id,role').eq('tenant_id', r.tenant_id).eq('role', 'owner'); });
    return Promise.all([SD.paList().then(null, function () { return {}; }), own.then(null, function () { return {}; })]).then(function (x) {
      var seen = {}, rows = [];
      ((x[0] && x[0].data) || []).filter(function (u) { return String(u.role || '').toLowerCase() === 'platform_admin'; })
        .concat(((x[1] && x[1].data) || []).filter(function (u) { return SD.same(u.tenant_id, r.tenant_id); }))
        .forEach(function (u) { if (u.id && !seen[u.id]) { seen[u.id] = 1; rows.push(mk(u)); } });
      return SD.bell(rows);
    }, function () {});
  };

  /* badge: open request count on Admin Service Desk tab */
  SD.openBadge = function () {
    return sb.from('service_requests').select('id', { count: 'exact', head: true }).is('deleted_at', null).in('status', SD.OPEN || ['submitted','triaged','in_progress','waiting_client','delivered','revision']).then(function (r) {
      var n = r.count || 0;
      var el = document.getElementById('sd-open-badge');
      if (el) { el.textContent = String(n); el.style.display = n ? 'inline-flex' : 'none'; }
    }, function () {});
  };
  /* morning digest: once per day after 8am MYT, Telegram if linked */
  SD.digest = function () {
    var now = new Date();
    var myt = new Date(now.getTime() + 8*3600000);
    if (myt.getUTCHours() < 8) return;
    var key = 'sd_digest_' + myt.toISOString().slice(0,10);
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    sb.from('service_requests').select('id,status', { count: 'exact' }).is('deleted_at', null).in('status', SD.OPEN || ['submitted','triaged','in_progress']).then(function (r) {
      var n = r.count || 0;
      var late = (r.data || []).filter(function (x) { return x.status === 'submitted' || x.status === 'triaged'; }).length;
      var msg = (APP.language==='bm' ? 'M-Core · Digest pagi: ' : 'M-Core · Morning digest: ') + n + (APP.language==='bm' ? ' terbuka' : ' open');
      if (typeof _tgActivity === 'function') _tgActivity('service_desk', msg, { daily: true });
    }, function () {});
  };
  /* escalation: requests >4h without reply get a bell; >24h unopened get another.
     Was firing on EVERY admin page open (sd.status spam): now once per SR per stage per 20h on this device,
     and the DB trigger folds it into the recipient's unread sd.status row for that SR. */
  var escSeen = function (k) {
    try { var t = +localStorage.getItem(k) || 0; if (Date.now() - t < 20 * 3600000) return true; localStorage.setItem(k, String(Date.now())); } catch (e) {}
    return false;
  };
  SD.escalate = function () {
    if (SD._escAt && Date.now() - SD._escAt < 30 * 60000) return; SD._escAt = Date.now();
    var cut4 = new Date(Date.now() - 4*3600000).toISOString();
    var cut24 = new Date(Date.now() - 24*3600000).toISOString();
    sb.from('service_requests').select('id,ref_no,title,status,created_at,tenant_id').is('deleted_at', null).in('status', ['submitted','triaged']).lt('created_at', cut4).limit(20).then(function (r) {
      (r.data || []).forEach(function (x) {
        var old = new Date(x.created_at).getTime() < new Date(cut24).getTime();
        if (escSeen('sd_esc_' + x.id + (old ? '_24' : '_4'))) return;
        var title = x.ref_no + (old ? (APP.language==='bm'?' · 24j tiada buka':' · 24h unopened') : (APP.language==='bm'?' · 4j tiada balasan':' · 4h no reply'));
        SD.bellNew(x, title, x.title, 'sd.status');
      });
    }, function () {});
  };
  /* run digest + escalate once when PA opens admin */
  if (typeof window !== 'undefined') {
    var _orig = window.openPage;
    if (_orig && !_orig._sdDig) {
      var w = function (page, params) {
        var ret = _orig.apply(this, arguments);
        if (page === 'admin' && SD.isPA && SD.isPA()) {
          setTimeout(function () { SD.digest(); SD.escalate(); }, 800);
        }
        return ret;
      };
      w._sdDig = 1; window.openPage = w;
    }
  }

})();
