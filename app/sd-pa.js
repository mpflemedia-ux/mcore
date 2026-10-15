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
})();
