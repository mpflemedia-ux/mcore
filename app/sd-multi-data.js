/* M-Core Service Desk - multi-request: data layer (groups SG-YYYYMM-NNNN, drafts, templates, group thread, rating, bell).
   Everything stays off until supabase/sd_multi_01.sql is run (probe on service_request_groups); single-request flow unchanged. */
(function () {
  var SD = window.SD; if (!SD || SD.MG) return;
  var MG = SD.MG = { on: false, MAX: 5 }, probed = null, pUid = null;
  MG.probe = function () {
    var u = SD.uid(); if (!u || typeof sb === 'undefined') return Promise.resolve(false);
    if (probed && pUid === u) return probed; pUid = u;
    probed = Promise.resolve().then(function () { return sb.from('service_request_groups').select('id', { count: 'exact', head: true }).limit(1); })
      .then(function (r) { MG.on = !!(r && !r.error); return MG.on; }, function () { MG.on = false; return false; });
    return probed;
  };
  /* group status from its SRs: rejected (out_of_scope) / cancelled do not count */
  MG.DONE = ['delivered', 'closed']; MG.DEAD = ['out_of_scope', 'cancelled'];
  MG.prog = function (srs) {
    var live = srs.filter(function (r) { return MG.DEAD.indexOf(r.status) < 0; }), done = live.filter(function (r) { return MG.DONE.indexOf(r.status) >= 0; }).length;
    var st = !live.length ? 'cancelled' : done === live.length ? 'completed' : done ? 'partial' : live.some(function (r) { return r.assigned_to || r.status !== 'submitted'; }) ? 'in_progress' : 'open';
    return { done: done, total: live.length, st: st, pct: live.length ? Math.round(done / live.length * 100) : 0, pic: srs.some(function (r) { return !!r.assigned_to; }) };
  };
  MG.GST = { open: ['gray', 'Open', 'Dibuka'], in_progress: ['blue', 'In progress', 'Dalam proses'], partial: ['blue', 'Partly done', 'Sebahagian siap'], completed: ['green', 'Completed', 'Selesai'], cancelled: ['gray', 'Cancelled', 'Dibatalkan'] };
  MG.chip = function (st) { var x = MG.GST[st] || MG.GST.open; return '<span class="badge badge-' + x[0] + ' cob-st">' + SD.L(x[1], x[2]) + '</span>'; };
  /* ref SG-YYYYMM-NNNN per tenant (MAX+1, unique index, retry on 23505) - same pattern as SD.createRequest */
  MG.createGroup = function (row) {
    var pre = 'SG-' + SD.today().slice(0, 7).replace('-', '') + '-', n = 0;
    function go() {
      return sb.from('service_request_groups').select('ref_no').eq('tenant_id', row.tenant_id).like('ref_no', pre + '%').order('ref_no', { ascending: false }).limit(1).then(function (r) {
        var last = r.data && r.data[0] ? parseInt(String(r.data[0].ref_no).slice(pre.length), 10) || 0 : 0;
        return sb.from('service_request_groups').insert(Object.assign({ created_by: SD.uid() }, row, { ref_no: pre + String(last + 1 + n).padStart(4, '0') })).select().single();
      }).then(function (r) { if (r.error && r.error.code === '23505' && ++n < 6) return go(); if (r.error) throw r.error; return r.data; });
    }
    return go();
  };
  MG.groups = function (ids) {
    ids = (ids || []).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (!ids.length) return Promise.resolve({});
    return Promise.resolve(sb.from('service_request_groups').select('*').in('id', ids).is('deleted_at', null)).then(function (r) { var m = {}; (r.data || []).forEach(function (g) { m[g.id] = g; }); return m; }, function () { return {}; });
  };
  MG.members = function (gid) { return sb.from('service_requests').select('*').eq('group_id', gid).is('deleted_at', null).order('ref_no').then(function (r) { if (r.error) throw r.error; return r.data || []; }); };
  /* one bell per group: all platform admins + tenant owner(s), submitter excluded (SD.bellNew / SD.bell) */
  MG.bell = function (g, srs) {
    var t = SD.L('New service request group ', 'Kumpulan permohonan servis baharu ') + g.ref_no + ' (' + srs.length + ')';
    var b = srs.map(function (r) { return r.ref_no + ' ' + SD.svcName(r.service_code); }).join(', ');
    return (SD.bellNew || SD.bellFor)({ tenant_id: g.tenant_id }, t, b);
  };
  /* drafts: one live row per user */
  MG.draftGet = function () { return Promise.resolve(sb.from('service_request_drafts').select('id,payload,updated_at').eq('user_id', SD.uid()).is('deleted_at', null).limit(1)).then(function (r) { return r.data && r.data[0] || null; }, function () { return null; }); };
  var dId = null, dT = null;
  MG.draftSave = function (payload) {
    clearTimeout(dT);
    return new Promise(function (res) {
      dT = setTimeout(function () {
        var now = new Date().toISOString(), q = dId ? sb.from('service_request_drafts').update({ payload: payload, updated_at: now }).eq('id', dId).select('id')
          : sb.from('service_request_drafts').insert({ tenant_id: SD.tid(), user_id: SD.uid(), payload: payload }).select('id');
        Promise.resolve(q).then(function (r) { if (r && r.data && r.data[0]) dId = r.data[0].id; res(now); }, function () { res(null); });
      }, 800);
    });
  };
  MG.draftUse = function (d) { dId = d ? d.id : null; };
  MG.draftDrop = function () {
    clearTimeout(dT); var id = dId; dId = null; if (!id) return Promise.resolve();
    return Promise.resolve(sb.from('service_request_drafts').update({ deleted_at: new Date().toISOString() }).eq('id', id)).then(function () {}, function () {});
  };
  MG.templates = function () { return Promise.resolve(sb.from('service_request_templates').select('id,name,services,payload').eq('tenant_id', SD.tid()).is('deleted_at', null).order('name')).then(function (r) { return r.data || []; }, function () { return []; }); };
  MG.tplSave = function (name, services, payload) { return sb.from('service_request_templates').insert({ tenant_id: SD.tid(), user_id: SD.uid(), name: String(name).slice(0, 80), services: services, payload: payload || {} }).select().single().then(function (r) { if (r.error) throw r.error; return r.data; }); };
  /* group thread */
  MG.thread = function (gid) { return sb.from('service_group_events').select('*').eq('group_id', gid).is('deleted_at', null).order('created_at').then(function (r) { return r.data || []; }); };
  MG.post = function (g, body) { return sb.from('service_group_events').insert({ tenant_id: g.tenant_id, group_id: g.id, body: String(body).slice(0, 4000), actor_id: SD.uid() }).then(function (r) { if (r.error) throw r.error; }); };
  MG.rate = function (g, n, note) {
    return sb.from('service_request_groups').update({ rating: n, rating_note: note || null, rated_by: SD.uid(), rated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', g.id).select().then(function (r) { if (r.error) throw r.error; return r.data && r.data[0]; });
  };
  /* thread modal shared by client + admin */
  MG.threadModal = function (g) {
    MG.thread(g.id).then(function (ev) {
      return SD.names(ev.map(function (e) { return e.actor_id; })).then(function (nm) {
        SD.modal(SD.L('Group thread ', 'Thread kumpulan ') + g.ref_no, '<div style="padding:14px"><div style="max-height:46vh;overflow:auto;margin-bottom:10px">' + (ev.length ? ev.map(function (e) {
          return '<div class="cob-card" style="padding:10px;margin-bottom:8px"><div class="cob-xs">' + SD.esc(nm[e.actor_id] || '—') + ' · ' + SD.dt(e.created_at) + '</div><div class="cob-sm" style="white-space:pre-wrap;overflow-wrap:anywhere">' + SD.esc(e.body) + '</div></div>';
        }).join('') : '<div class="cob-xs" style="padding:12px;text-align:center">' + SD.L('No messages yet.', 'Tiada mesej lagi.') + '</div>') + '</div><textarea class="form-input" data-no-titlecase="1" id="mg-msg" rows="3" placeholder="' + SD.L('Message for all requests in this group…', 'Mesej untuk semua permohonan dalam kumpulan ini…') + '"></textarea><div class="sd-acts" style="margin-top:10px"><button class="btn btn-primary" id="mg-send" style="flex:1"><i class="ti ti-send"></i> ' + SD.L('Send', 'Hantar') + '</button></div></div>');
        var b = document.getElementById('mg-send'); if (!b) return;
        b.onclick = function () {
          var v = (document.getElementById('mg-msg').value || '').trim(); if (!v) return;
          b.disabled = true;
          MG.post(g, v).then(function () {
            (SD.isPA() ? SD.bellFor : SD.bellNew || SD.bellFor)({ tenant_id: g.tenant_id }, g.ref_no + ': ' + SD.L('new message', 'mesej baharu'), v.slice(0, 140));
            SD.closeModal(); MG.threadModal(g);
          }, function (e) { b.disabled = false; SD.toast(SD.err(e), 'error'); });
        };
      });
    }).catch(function (e) { SD.toast(SD.err(e), 'error'); });
  };
})();
