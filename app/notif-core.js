/* M-Core bell v2 — core: probe, settings, notify() template, rows, realtime. Hidden until notif_01 SQL has run. */
(function () {
  var NT = window.NT = window.NT || {};
  NT.on = false; NT.probed = null; NT.S = null; NT.rows = []; NT.live = [];
  NT.L = function (en, bm) { return (window.APP && APP.language === 'bm') ? bm : en; };
  NT.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  NT.tid = function () { return (window.APP && APP.tenant && APP.tenant.id) || null; };
  NT.uid = function () { return (window.APP && APP.user && APP.user.id) || null; };
  NT.role = function () { return String((window.APP && APP.user && APP.user.role) || '').toLowerCase(); };
  NT.same = function (a, b) { return String(a) === String(b); };
  NT.isAdm = function () { try { return isTenantAdmin(); } catch (e) { return false; } };
  NT.isPA = function () { try { return isPlatformAdmin(); } catch (e) { return false; } };
  NT.hr = function () { try { return canManageHR(); } catch (e) { return false; } };
  NT.day = function (d) { var x = d ? new Date(d) : new Date(); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
  NT.missing = function (e) { var m = String((e && (e.message || e.code)) || ''); return /does not exist|schema cache|42P01|42703|PGRST20[045]|column/i.test(m); };
  NT.probe = function (force) {
    if (NT.probed && !force) return NT.probed;
    NT.probed = Promise.all([
      sb.from('notifications').select('id,kind,group_key,deleted_at').limit(1),
      sb.from('notification_settings').select('id').limit(1)
    ]).then(function (r) { NT.on = !r[0].error && !r[1].error; return NT.on; }, function () { NT.on = false; return false; });
    return NT.probed;
  };
  /* ---- settings: type x channel, defaults by role (no setup needed) ---- */
  NT.TYPES = ['approval', 'sd', 'assigned', 'overdue', 'contract', 'activity'];
  NT.defaults = function () {
    var adm = NT.isAdm() || NT.isPA();
    return { m: { approval: { b: 1, p: 1, t: adm ? 1 : 0 }, sd: { b: 1, p: 1, t: 0 }, assigned: { b: 1, p: 1, t: 0 }, overdue: { b: adm ? 1 : 0, p: 0, t: 0 }, contract: { b: 1, p: 0, t: adm ? 1 : 0 }, activity: { b: adm ? 1 : 0, p: 0, t: 0 } },
      q: { on: 0, from: '22:00', to: '07:00', days: [1, 2, 3, 4, 5], hi: 1 }, digest: { on: 1, at: '08:00' }, sn: {}, pin: [] };
  };
  NT.merge = function (s) {
    var d = NT.defaults(); s = s || {};
    NT.TYPES.forEach(function (k) { if (s.m && s.m[k]) d.m[k] = Object.assign(d.m[k], s.m[k]); });
    if (s.q) d.q = Object.assign(d.q, s.q); if (s.digest) d.digest = Object.assign(d.digest, s.digest);
    d.sn = s.sn || {}; d.pin = Array.isArray(s.pin) ? s.pin : []; return d;
  };
  NT.lsKey = function () { return 'mcore_nt_set_' + NT.tid() + '_' + NT.uid(); };
  NT.loadSettings = function () {
    NT._sk = NT.lsKey();
    try { NT.S = NT.merge(JSON.parse(localStorage.getItem(NT.lsKey()) || 'null')); } catch (e) { NT.S = NT.merge(); }
    return sb.from('notification_settings').select('settings').eq('tenant_id', NT.tid()).eq('user_id', NT.uid()).is('deleted_at', null).maybeSingle().then(function (r) {
      if (r && r.data) { NT.S = NT.merge(r.data.settings); try { localStorage.setItem(NT.lsKey(), JSON.stringify(NT.S)); } catch (e) {} } else if (r && !r.error) NT.S = NT.merge();
      return NT.S;
    }, function () { return NT.S; });
  };
  NT.saveSettings = function (patch) {
    var now = Date.now(); NT.S = Object.assign(NT.S || NT.merge(), patch || {});
    Object.keys(NT.S.sn).forEach(function (k) { if (new Date(NT.S.sn[k]).getTime() < now) delete NT.S.sn[k]; });
    NT.S.pin = NT.S.pin.slice(-50);
    try { localStorage.setItem(NT.lsKey(), JSON.stringify(NT.S)); } catch (e) {}
    return sb.from('notification_settings').upsert({ tenant_id: NT.tid(), user_id: NT.uid(), settings: NT.S, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,user_id' }).then(function (r) { return !r.error; }, function () { return false; });
  };
  NT.quiet = function (s, prio) {
    s = s || NT.S; if (!s || !s.q || !s.q.on) return false; if (prio && s.q.hi) return false;
    var d = new Date(), wd = d.getDay() || 7, hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    var f = s.q.from || '22:00', t = s.q.to || '07:00', inR = f <= t ? (hm >= f && hm < t) : (hm >= f || hm < t);
    var dayOk = !s.q.days || !s.q.days.length || s.q.days.indexOf(f > t && hm < t ? ((wd + 5) % 7) + 1 : wd) >= 0;
    return inR && dayOk;
  };
  NT.ch = function (cat, c, s) { s = s || NT.S || NT.defaults(); var m = s.m[cat] || s.m.activity; return !!(m && m[c]); };
  /* ---- legacy rows (no kind) and trigger rows are classified here ---- */
  NT.ACT_RE = /^(Kehadiran direkod|Entri jurnal baru|Produk baru ditambah|Invois baru|Pekerja baru ditambah|Bayaran diterima|Baucar bayaran baru|Jualan POS baru|PO baru|Tuntutan perbelanjaan baru|GRN direkod)/;
  NT.classify = function (n) {
    var k = n.kind, c = String(n.category || '');
    if (!k) {
      if (/^(sales|finance|inventory|purchasing)$/.test(c) || (c === 'hr' && n.ref_table && !n.type) || NT.ACT_RE.test(n.title || '')) k = 'activity';
      else if (c === 'service_desk' && /pindaan|revision/i.test(n.title || '')) { k = 'action'; n.priority = 1; }
      else k = 'for_you';
    }
    n._k = k;
    n._cat = k === 'activity' ? 'activity' : (n.type && n.type.split('.')[0]) || (c === 'service_desk' ? 'sd' : (c === 'hr' ? 'approval' : 'assigned'));
    if (NT.TYPES.indexOf(n._cat) < 0) {
      // DB-trigger types (hr.leave_submitted, purchasing.bill_new, finance.dk_ap_due …) -> a settings bucket
      var ty = String(n.type || '');
      n._cat = k === 'activity' ? 'activity' : /_submitted$|\.dk_sign/.test(ty) ? 'approval' : 'assigned';
    }
    return n;
  };
  NT.fetchRows = function (days) {
    var since = new Date(Date.now() - (days || 90) * 864e5).toISOString();
    return sb.from('notifications').select('*').eq('user_id', NT.uid()).eq('tenant_id', NT.tid()).is('deleted_at', null).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(days > 30 ? 500 : 200).then(function (r) { return (r.data || []).map(NT.classify); }, function () { return []; });
  };
  NT.markRead = function (ids) {
    ids = (ids || []).filter(Boolean); if (!ids.length) return Promise.resolve();
    return sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).eq('user_id', NT.uid()).is('read_at', null).then(function () {}, function () {});
  };
  NT.acted = function (ids) {
    ids = (ids || []).filter(Boolean); if (!ids.length) return Promise.resolve(); var now = new Date().toISOString();
    return sb.from('notifications').update({ acted_at: now, read_at: now }).in('id', ids).eq('user_id', NT.uid()).then(function () {}, function () {});
  };
  /* ---- notify(): central template. o = {type, kind, title, body, link, ref_table, ref_id, priority, group_key, users:[ids], roles:[..], tenant_id} ---- */
  var thr = {};
  NT.notify = function (o) {
    if (!NT.on || !o || !o.title) return Promise.resolve(0);
    var tid = o.tenant_id || NT.tid(), me = NT.uid(), cat = String(o.type || 'assigned').split('.')[0];
    var k = (o.type || '') + '|' + (o.ref_id || o.title) + '|' + String(o.body || '').slice(0, 60) + '|' + (o.users || o.roles || []).join(','); if (thr[k] && Date.now() - thr[k] < 60000) return Promise.resolve(0); thr[k] = Date.now();
    var q = o.users ? Promise.resolve({ data: o.users.map(function (u) { return { id: u }; }) })
      : sb.from('user_profiles').select('id,role').eq('tenant_id', tid);
    return Promise.resolve(q).then(function (r) {
      var us = (r.data || []).filter(function (u) { return !NT.same(u.id, me) && (!o.roles || o.roles.indexOf(String(u.role || '').toLowerCase()) >= 0); });
      if (!us.length) return 0;
      var rows = us.map(function (u) { return { tenant_id: tid, user_id: u.id, actor_id: me, title: String(o.title).slice(0, 200), body: String(o.body || '').slice(0, 500), category: o.category || cat, kind: o.kind || 'for_you', type: o.type || null, priority: o.priority || 0, link: o.link || null, ref_table: o.ref_table || null, ref_id: o.ref_id != null ? String(o.ref_id) : null, group_key: o.group_key || null }; });
      return sb.from('notifications').insert(rows).then(function (x) {
        if (x.error) return 0;
        if (o.kind !== 'activity') NT.tgFan(tid, us.map(function (u) { return u.id; }), cat, o);
        return rows.length;
      });
    }).catch(function () { return 0; });
  };
  NT.tgFan = function (tid, ids, cat, o) {
    if (typeof _tgNotifySubject !== 'function') return;
    sb.from('notification_settings').select('user_id,settings').eq('tenant_id', tid).in('user_id', ids).then(function (r) {
      var map = {}; (r.data || []).forEach(function (x) { map[x.user_id] = NT.merge(x.settings); });
      ids.forEach(function (id) { var s = map[id] || NT.merge(); if (NT.ch(cat, 't', s) && !NT.quiet(s, o.priority)) { try { _tgNotifySubject('user', id, 'M-Core · ' + o.title + (o.body ? '\n' + o.body : '')); } catch (e) {} } });
    }, function () {});
  };
  NT.activity = function (cat, title, body) {
    var t = String(title || '').replace(/^M-Core · /, '').trim(); if (!t || /menunggu|pending/i.test(t)) return Promise.resolve(0);
    return NT.notify({ kind: 'activity', type: 'activity.' + (cat || 'x'), category: cat, title: t, body: body, roles: ['owner', 'admin', 'platform_admin'], group_key: 'act:' + (cat || 'x') + ':' + t.slice(0, 40) + ':' + NT.day() });
  };
  /* ---- employee -> user (email first, then exact name) ---- */
  NT.userForEmp = function (empId) {
    return sb.from('employees').select('id,name,email').eq('id', empId).eq('tenant_id', NT.tid()).maybeSingle().then(function (e) {
      e = e && e.data; if (!e) return null;
      return sb.from('user_profiles').select('*').eq('tenant_id', NT.tid()).then(function (r) {
        var us = r.data || [], em = String(e.email || '').trim().toLowerCase(), nm = String(e.name || '').trim().toLowerCase();
        var hit = us.find(function (u) { return em && String(u.email || '').toLowerCase() === em; }) || us.find(function (u) { return nm && String(u.full_name || '').trim().toLowerCase() === nm; });
        return hit ? hit.id : null;
      });
    }).catch(function () { return null; });
  };
  /* ---- realtime + retention tidy ---- */
  NT.listen = function () {
    if (NT.chan || !NT.uid()) return;
    try {
      NT.chan = sb.channel('nt-' + NT.uid()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + NT.uid() }, function (p) {
        var n = NT.classify(Object.assign({}, p.new || {})); if (!NT.same(n.tenant_id, NT.tid())) return;
        if (n._k !== 'activity' && NT.ch(n._cat, 'p') && !NT.quiet(null, n.priority)) { try { _notifOsNotify(n.title, n.body || '', false, n.link, n); } catch (e) {} }
        if (NT.refresh) NT.refresh();
      }).subscribe();
    } catch (e) {}
  };
  NT.tidy = function () {
    var k = 'mcore_nt_tidy_' + NT.uid(); if (localStorage.getItem(k) === NT.day()) return; localStorage.setItem(k, NT.day());
    sb.from('notifications').update({ deleted_at: new Date().toISOString() }).eq('user_id', NT.uid()).is('deleted_at', null).lt('created_at', new Date(Date.now() - 90 * 864e5).toISOString()).then(function () {}, function () {});
  };
})();
