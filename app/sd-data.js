/* M-Core Service Desk - data: contracts, catalog, ref_no, SLA (Mon-Fri, no public holidays v1), status machine, events, files, bells. */
(function () {
  var SD = window.SD; if (!SD || SD._data) return; SD._data = 1;
  SD.ST = {
    submitted: ['blue', 'ti-send', 'Submitted', 'Dihantar oleh klien'], triaged: ['blue', 'ti-inbox', 'Triaged', 'Disaring'],
    in_progress: ['blue', 'ti-loader-2', 'In progress', 'Dalam proses'], waiting_client: ['yellow', 'ti-player-pause', 'Waiting on you', 'Tunggu klien'],
    delivered: ['green', 'ti-package', 'Delivered', 'Dihantar'], revision: ['yellow', 'ti-arrow-back-up', 'Revision', 'Revisi'],
    closed: ['gray', 'ti-circle-check', 'Closed', 'Ditutup'], out_of_scope: ['red', 'ti-ban', 'Out of scope', 'Luar skop'], cancelled: ['gray', 'ti-x', 'Cancelled', 'Dibatalkan']
  };
  SD.stLabel = function (s) { var x = SD.ST[s] || SD.ST.submitted; return SD.L(x[2], x[3]); };
  SD.st = function (s) { var x = SD.ST[s] || SD.ST.submitted; return '<span class="badge badge-' + x[0] + ' cob-st">' + SD.esc(SD.L(x[2], x[3])) + '</span>'; };
  SD.OPEN = ['submitted', 'triaged', 'in_progress', 'waiting_client', 'delivered', 'revision'];
  /* allowed transitions; client may only cancel pre-triage, request revision or accept (RLS also limits client statuses) */
  SD.TR = { submitted: ['triaged', 'cancelled'], triaged: ['in_progress', 'out_of_scope'], in_progress: ['waiting_client', 'delivered'],
    waiting_client: ['in_progress'], delivered: ['closed', 'revision'], revision: ['in_progress'] };
  SD.CLIENT_TR = { submitted: ['cancelled'], delivered: ['revision', 'closed'] };
  SD.canMove = function (from, to, asClient) { return ((asClient ? SD.CLIENT_TR : SD.TR)[from] || []).indexOf(to) >= 0; };

  var cat = null;
  SD.catalog = function () {
    if (cat) return Promise.resolve(cat);
    return sb.from('service_catalog').select('code,name_en,name_bm,default_sla_hours,sort,active').is('deleted_at', null).order('sort')
      .then(function (r) { if (r.error) throw r.error; cat = (r.data || []).filter(function (x) { return x.active !== false; }).sort(function (a, b) { return (+a.sort || 0) - (+b.sort || 0); }); return cat; });
  };
  SD.svcName = function (code) { var x = (cat || []).find(function (c) { return c.code === code; }); return x ? SD.L(x.name_en, x.name_bm) : code; };

  /* contract status derived on load: date window decides active/expired; draft/cancelled kept */
  SD.cStatus = function (c) {
    if (!c) return 'none';
    if (c.status === 'cancelled' || c.status === 'draft') return c.status;
    var t = SD.today();
    if (c.end_date && t > c.end_date) return 'expired';
    if (c.start_date && t < c.start_date) return 'draft';
    return 'active';
  };
  SD.CST = { active: ['green', 'Active', 'Aktif'], draft: ['yellow', 'Draft', 'Draf'], expired: ['gray', 'Expired', 'Tamat'], cancelled: ['red', 'Cancelled', 'Batal'], none: ['gray', 'No contract', 'Tiada kontrak'] };
  SD.cChip = function (c) { var x = SD.CST[SD.cStatus(c)]; return '<span class="badge badge-' + x[0] + '">' + SD.L(x[1], x[2]) + '</span>'; };
  SD.payChip = function (c) { return c && c.payment_status === 'paid' ? '<span class="badge badge-green">' + SD.L('Paid', 'Dibayar') + '</span>' : '<span class="badge badge-red">' + SD.L('Unpaid', 'Belum dibayar') + '</span>'; };
  SD.persistExpired = function (rows) {
    if (!SD.isPA()) return;
    (rows || []).forEach(function (c) {
      if (c.status === 'active' && SD.cStatus(c) === 'expired')
        sb.from('service_contracts').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', c.id).eq('status', 'active').then(function () {}, function () {});
    });
  };
  /* best contract for a tenant: current active > latest by end date */
  SD.myContract = function (tid) {
    return sb.from('service_contracts').select('*').eq('tenant_id', tid).is('deleted_at', null).order('end_date', { ascending: false })
      .then(function (r) {
        if (r.error) throw r.error;
        var rows = r.data || [];
        return rows.find(function (c) { return SD.cStatus(c) === 'active'; }) || rows.find(function (c) { return c.status !== 'cancelled'; }) || null;
      });
  };
  SD.usable = function (c) { return !!c && c.payment_status === 'paid' && SD.cStatus(c) === 'active'; };
  SD.exportDays = function (c) { if (!c || SD.cStatus(c) !== 'expired') return null; var d = 14 + SD.daysTo(c.end_date); return d >= 0 ? d : null; };
  SD.monthStart = function () { return SD.today().slice(0, 8) + '01'; };
  SD.monthIso = function () { return new Date(Date.parse(SD.monthStart() + 'T00:00:00+08:00')).toISOString(); };

  /* ---- SLA in business hours: only Mon-Fri hours count (Asia/Kuala_Lumpur). Public holidays ignored in v1. ---- */
  function wk(ms) { var d = new Date(ms + 8 * 3600000).getUTCDay(); return d !== 0 && d !== 6; }
  SD.addBH = function (from, hours) {
    var ms = new Date(from).getTime(), left = Math.max(0, hours || 0) * 3600000, step = 900000, guard = 0;
    while (left > 0 && guard++ < 20000) { if (wk(ms)) left -= step; ms += step; }
    return new Date(ms);
  };
  SD.bhBetween = function (a, b) {
    var x = new Date(a).getTime(), y = new Date(b).getTime(), sign = 1;
    if (y < x) { var t = x; x = y; y = t; sign = -1; }
    var h = 0, step = 900000, guard = 0;
    for (var m = x; m < y && guard++ < 40000; m += step) if (wk(m)) h += Math.min(step, y - m);
    return sign * h / 3600000;
  };
  SD.pausedSec = function (r) { return (r.sla_paused_seconds || 0) + (r.paused_at ? Math.max(0, (Date.now() - new Date(r.paused_at).getTime()) / 1000) : 0); };
  SD.due = function (r) { return r.due_at ? SD.addBH(r.due_at, SD.pausedSec(r) / 3600) : null; };
  SD.left = function (r) { var d = SD.due(r); return d ? SD.bhBetween(Date.now(), d) : null; };
  SD.hrs = function (h) { var a = Math.abs(h); return a >= 1 ? Math.round(a) + SD.L('h', 'j') : Math.max(1, Math.round(a * 60)) + 'm'; };
  SD.slaChip = function (r) {
    if (['closed', 'cancelled', 'out_of_scope'].indexOf(r.status) >= 0) return '';
    if (r.status === 'waiting_client') return '<span class="badge badge-yellow"><i class="ti ti-player-pause"></i> ' + SD.L('SLA paused ', 'SLA dijeda ') + SD.hrs(SD.pausedSec(r) / 3600) + '</span>';
    if (r.status === 'delivered') { var c = 168 - (Date.now() - new Date(r.delivered_at || Date.now()).getTime()) / 3600000; return '<span class="badge badge-gray">' + SD.L('Closes in ', 'Tutup dlm ') + SD.hrs(Math.max(0, c)) + '</span>'; }
    var l = SD.left(r); if (l == null) return '';
    return '<span class="badge badge-' + (l < 0 ? 'red' : l < 8 ? 'yellow' : 'green') + '">' + (l < 0 ? SD.L('Overdue ', 'Lewat ') : SD.L('Left ', 'Baki ')) + SD.hrs(l) + '</span>';
  };

  /* ref_no SR-YYYYMM-NNNN per tenant: MAX+1, unique (tenant_id, ref_no) index, retry on 23505 */
  SD.createRequest = function (row) {
    var pre = 'SR-' + SD.today().slice(0, 7).replace('-', '') + '-', n = 0;
    function attempt() {
      return sb.from('service_requests').select('ref_no').eq('tenant_id', row.tenant_id).like('ref_no', pre + '%').order('ref_no', { ascending: false }).limit(1)
        .then(function (r) {
          var last = r.data && r.data[0] ? parseInt(String(r.data[0].ref_no).slice(pre.length), 10) || 0 : 0;
          var rec = Object.assign({}, row, { ref_no: pre + String(last + 1 + n).padStart(4, '0') });
          return sb.from('service_requests').insert(rec).select().single();
        }).then(function (r) {
          if (r.error && r.error.code === '23505' && ++n < 6) return attempt();
          if (r.error) throw r.error;
          return r.data;
        });
    }
    return attempt();
  };
  SD.event = function (r, type, extra) {
    var ev = Object.assign({ tenant_id: r.tenant_id, request_id: r.id, type: type, actor_id: SD.uid(), meta: {} }, extra || {});
    return sb.from('service_request_events').insert(ev).then(function (x) { if (x.error) throw x.error; return x; });
  };
  SD.setStatus = function (r, to, body, asClient) {
    if (!SD.canMove(r.status, to, asClient) && !(SD.isPA() && to === 'closed')) return Promise.reject(new Error(SD.L('Status change not allowed', 'Perubahan status tidak dibenarkan')));
    var now = new Date().toISOString(), p = { status: to, updated_at: now };
    if (r.status === 'waiting_client' && r.paused_at) { p.sla_paused_seconds = Math.round(SD.pausedSec(r)); p.paused_at = null; }
    if (to === 'waiting_client') p.paused_at = now;
    if (to === 'delivered') p.delivered_at = now;
    if (to === 'closed') p.closed_at = now;
    return sb.from('service_requests').update(p).eq('id', r.id).eq('status', r.status).select().then(function (x) {
      if (x.error) throw x.error;
      if (!x.data || !x.data.length) throw new Error(SD.L('This request was changed by someone else. Reload.', 'Permohonan ini telah dikemas kini. Muat semula.'));
      var nr = x.data[0];
      return SD.event(nr, 'status', { from_status: r.status, to_status: to, body: body || null }).catch(function () {}).then(function () {
        SD.bellFor(nr, nr.ref_no + ': ' + SD.stLabel(to), nr.title); return nr;
      });
    });
  };
  /* auto-close delivered after 7 days (runs when either side opens a list; idempotent via status guard) */
  SD.autoClose = function (rows) {
    var cut = Date.now() - 7 * 86400000;
    return Promise.all((rows || []).filter(function (r) { return r.status === 'delivered' && r.delivered_at && new Date(r.delivered_at).getTime() < cut; }).map(function (r) {
      return SD.setStatus(r, 'closed', SD.L('Closed automatically 7 days after delivery', 'Ditutup automatik 7 hari selepas dihantar'), !SD.isPA())
        .then(function (nr) { Object.assign(r, nr); }, function () {});
    }));
  };
  SD.safeName = function (n) { return String(n || 'file').replace(/[^\w.\-]+/g, '_').slice(-80); };
  SD.upload = function (r, file, deliverable) {
    var path = r.tenant_id + '/service-requests/' + r.id + '/' + Date.now() + '-' + SD.safeName(file.name);
    return sb.storage.from('service-files').upload(path, file, { upsert: false }).then(function (u) {
      if (u.error) throw u.error;
      return SD.event(r, 'attachment', { file_path: path, body: file.name, meta: { name: file.name, size: file.size, deliverable: !!deliverable } });
    });
  };
  SD.download = function (path) {
    return sb.storage.from('service-files').createSignedUrl(path, 300).then(function (r) {
      if (r.error || !r.data) throw (r.error || new Error('no url'));
      window.open(r.data.signedUrl, '_blank', 'noopener');
    }).catch(function (e) { SD.toast(SD.err(e), 'error'); });
  };
  /* bells: tenant_id is ALWAYS set (recipient's own tenant). Failures never block the action. */
  SD.bell = function (rows) {
    rows = (rows || []).filter(function (x) { return x.tenant_id && x.user_id && !SD.same(x.user_id, SD.uid()); });
    if (!rows.length) return Promise.resolve();
    return Promise.resolve().then(function () { return sb.from('notifications').insert(rows); }).then(function () {}, function () {});
  };
  SD.bellFor = function (r, title, body) {
    var mk = function (u) { return { tenant_id: u.tenant_id, user_id: u.id, title: title, body: body || '', category: 'service_desk' }; };
    var q = SD.isPA()
      ? sb.from('user_profiles').select('id,tenant_id,role').eq('tenant_id', r.tenant_id)
      : SD.paList ? SD.paList() : sb.from('user_profiles').select('id,tenant_id,role').eq('role', 'platform_admin');
    return Promise.resolve(q).then(function (x) {
      var us = (x && x.data || []).filter(function (u) { var ro = String(u.role || '').toLowerCase(); return SD.isPA() ? (ro === 'owner' || ro === 'admin') : ro === 'platform_admin'; });
      return SD.bell(us.map(mk));
    }, function () {});
  };
  SD.names = function (ids) {
    ids = ids.filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (!ids.length) return Promise.resolve({});
    return Promise.resolve(sb.from('user_profiles').select('id,full_name').in('id', ids)).then(function (r) {
      var m = {}; (r.data || []).forEach(function (u) { m[u.id] = u.full_name; }); return m;
    }, function () { return {}; });
  };
})();
