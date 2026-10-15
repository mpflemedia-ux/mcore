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
  /* new request: every platform admin + the tenant's owner(s); one row per user, never the submitter (SD.bell). */
  SD.bellNew = function (r, title, body) {
    var mk = function (u) { return { tenant_id: u.tenant_id, user_id: u.id, title: title, body: body || '', category: 'service_desk' }; };
    var own = Promise.resolve().then(function () { return sb.from('user_profiles').select('id,tenant_id,role').eq('tenant_id', r.tenant_id).eq('role', 'owner'); });
    return Promise.all([SD.paList().then(null, function () { return {}; }), own.then(null, function () { return {}; })]).then(function (x) {
      var seen = {}, rows = [];
      ((x[0] && x[0].data) || []).filter(function (u) { return String(u.role || '').toLowerCase() === 'platform_admin'; })
        .concat(((x[1] && x[1].data) || []).filter(function (u) { return SD.same(u.tenant_id, r.tenant_id); }))
        .forEach(function (u) { if (u.id && !seen[u.id]) { seen[u.id] = 1; rows.push(mk(u)); } });
      return SD.bell(rows);
    }, function () {});
  };
})();
