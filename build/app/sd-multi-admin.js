/* M-Core Service Desk - multi-request: admin desk Group/Flat toggle, group cards (progress, bulk PIC then per-SR PIC,
   per-SR Accept / Need info / Deliver / Reject without blocking others, split out / move SR, group thread), CSV group column.
   Runs after sd-board paint via the SD.waBoard hook; off until SQL is live. */
(function () {
  var SD = window.SD, MG = SD && SD.MG; if (!MG || SD._mgAd) return; SD._mgAd = 1;
  var V = { mode: 'group', open: {}, pas: null }, prev = SD.waBoard;
  SD.waBoard = function (m, S, repaint) {
    if (typeof prev === 'function') prev(m, S, repaint);
    MG.probe().then(function (on) { if (on && m.isConnected && SD.isPA()) inject(m, S, repaint); });
  };
  function pas() {
    if (V.pas) return Promise.resolve(V.pas);
    return Promise.resolve(SD.paList ? SD.paList() : sb.from('user_profiles').select('id,tenant_id,role').eq('role', 'platform_admin')).then(function (x) {
      var ids = (x && x.data || []).filter(function (u) { return String(u.role || '').toLowerCase() === 'platform_admin'; }).map(function (u) { return u.id; }); if (ids.indexOf(SD.uid()) < 0) ids.unshift(SD.uid());
      return SD.names(ids).then(function (n) { V.pas = ids.map(function (id) { return { id: id, name: n[id] || '—' }; }); return V.pas; });
    }, function () { return []; });
  }
  function sel(id, val, list) { return '<select class="form-input" ' + id + ' style="width:auto!important;min-height:30px;padding:4px 8px;font-size:12.5px"><option value="">' + SD.L('Unassigned', 'Belum ditugaskan') + '</option>' + list.map(function (u) { return '<option value="' + u.id + '"' + (SD.same(u.id, val) ? ' selected' : '') + '>' + SD.esc(u.name) + '</option>'; }).join('') + '</select>'; }
  /* inline steps follow SD.TR: accept = submitted->triaged->in_progress, reject = ->triaged->out_of_scope */
  var ACT = { acc: [['submitted', ['triaged', 'in_progress']], ['triaged', ['in_progress']]], info: [['in_progress', ['waiting_client']]], del: [['in_progress', ['delivered']]], rej: [['submitted', ['triaged', 'out_of_scope']], ['triaged', ['out_of_scope']]] };
  var AL = { acc: ['Accept', 'Terima'], info: ['Need info', 'Perlu info'], del: ['Deliver', 'Hantar'], rej: ['Reject', 'Tolak'] };
  function path(k, st) { var x = (ACT[k] || []).find(function (a) { return a[0] === st; }); return x && x[1]; }
  function card(g, srs, tn, list) {
    var p = MG.prog(srs), on = !!V.open[g.id];
    var h = '<div class="cob-card" data-g="' + g.id + '" style="padding:0;margin-bottom:10px;overflow:hidden' + (on ? ';border-color:var(--primary)' : '') + '"><button class="row mg-tg" style="gap:8px;width:100%;padding:12px 14px;background:none;border:0;color:var(--text);text-align:left;cursor:pointer;font:inherit;flex-wrap:wrap"><i class="ti ti-chevron-' + (on ? 'up' : 'down') + '"></i><i class="ti ti-stack-2" style="color:var(--primary)"></i><b class="sd-ref" style="color:var(--text);font-size:12.5px">' + SD.esc(g.ref_no) + '</b><span class="cob-xs cob-ell grow" style="min-width:120px">' + SD.esc(tn || '') + ' · ' + SD.esc(g.title) + '</span><span class="cob-xs">' + p.done + '/' + p.total + SD.L(' done', ' siap') + '</span><span class="cob-bar" style="width:80px;margin:0"><i style="width:' + p.pct + '%"></i></span>' + MG.chip(p.st) + '</button>';
    if (!on) return h + '</div>';
    h += '<div class="row" style="gap:8px;flex-wrap:wrap;padding:10px 14px;background:var(--primary-light);border-top:1px solid var(--border)"><i class="ti ti-user-check" style="color:var(--primary)"></i><b style="font-size:13px">' + SD.L('Assign PIC to all ', 'Tugaskan PIC kepada semua ') + srs.length + '</b>' + sel('data-bulk', '', list) + '<button class="btn btn-sm btn-primary" data-mga="bulk">' + SD.L('Assign all', 'Tugaskan semua') + '</button><span class="grow"></span><button class="btn btn-sm btn-outline" data-mga="th"><i class="ti ti-messages"></i> ' + SD.L('Group thread', 'Thread kumpulan') + '</button></div>';
    h += '<div style="overflow-x:auto"><table class="cob-tbl" style="min-width:860px"><tr><th>' + SD.L('Request', 'Permohonan') + '</th><th>' + SD.L('Service', 'Servis') + '</th><th>PIC</th><th>SLA</th><th>Status</th><th style="text-align:right">' + SD.L('Actions', 'Tindakan') + '</th></tr>' + srs.map(function (r) {
      return '<tr data-r="' + r.id + '"><td style="white-space:nowrap"><button class="sd-ref" data-open="' + r.id + '" style="background:none;border:0;color:var(--primary);cursor:pointer;font-weight:700">' + SD.esc(r.ref_no) + '</button><div class="cob-xs cob-ell" style="max-width:220px">' + SD.esc(r.title) + '</div></td><td>' + SD.esc(SD.svcName(r.service_code)) + '</td><td>' + sel('data-pic="' + r.id + '"', r.assigned_to, list) + '</td><td>' + SD.slaChip(r) + '</td><td>' + SD.st(r.status) + '</td><td style="text-align:right;white-space:nowrap">' +
        Object.keys(ACT).filter(function (k) { return path(k, r.status); }).map(function (k) { return '<button class="btn btn-sm btn-outline" data-act="' + k + '" data-id="' + r.id + '"' + (k === 'rej' ? ' style="color:var(--danger)"' : '') + '>' + SD.L(AL[k][0], AL[k][1]) + '</button> '; }).join('') +
        '<button class="btn btn-sm btn-outline btn-icon" data-mv="' + r.id + '" title="' + SD.L('Split / move', 'Pecah / pindah') + '" aria-label="' + SD.L('Split / move', 'Pecah / pindah') + '"><i class="ti ti-arrows-split"></i></button></td></tr>';
    }).join('') + '</table></div><div class="cob-xs" style="padding:8px 14px 12px">' + SD.L('Each request keeps its own SLA, quota, PIC and status. Rejecting one does not block the others.', 'Setiap permohonan ada SLA, kuota, PIC dan status sendiri. Tolak satu tidak menyekat yang lain.') + '</div></div>';
    return h;
  }
  function inject(m, S, repaint) {
    var flt = m.querySelector('.sd-flt'); if (!flt || m.querySelector('.mg-seg')) return;
    flt.insertAdjacentHTML('afterbegin', '<div class="cob-chips mg-seg" style="flex:0 0 auto"><button class="cob-chip' + (V.mode === 'group' ? ' on' : '') + '" data-mode="group"><i class="ti ti-stack-2"></i> ' + SD.L('Group', 'Kumpulan') + '</button><button class="cob-chip' + (V.mode === 'flat' ? ' on' : '') + '" data-mode="flat"><i class="ti ti-list"></i> ' + SD.L('Flat', 'Rata') + '</button></div>');
    m.querySelectorAll('[data-mode]').forEach(function (b) { b.onclick = function () { V.mode = b.dataset.mode; repaint(); }; });
    var gids = S.rows.map(function (r) { return r.group_id; }).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var G = {}, all = [], vis = [].slice.call(m.querySelectorAll('.sd-board .sd-tk')).map(function (t) { return t.dataset.id; });
    var ready = gids.length ? Promise.all([MG.groups(gids), sb.from('service_requests').select('*').in('group_id', gids).is('deleted_at', null).order('ref_no'), pas()]) : Promise.resolve([{}, { data: [] }, []]);
    ready.then(function (x) {
      G = x[0]; all = (x[1] && x[1].data) || []; var list = x[2] || [];
      if (SD.mgCsv) SD.mgCsv(m, S, G, vis);
      if (V.mode !== 'group' || !gids.length || !m.isConnected) return;
      var bd = m.querySelector('.sd-board'); if (!bd) return;
      bd.querySelectorAll('.sd-tk').forEach(function (t) { var r = S.rows.find(function (z) { return SD.same(z.id, t.dataset.id); }); if (r && r.group_id && G[r.group_id]) t.remove(); });
      bd.querySelectorAll('.sd-colm').forEach(function (c) { var n = c.querySelector('.n'); if (n) n.textContent = c.querySelectorAll('.sd-tk').length; });
      var ids = Object.keys(G).sort(function (a, b) { return G[a].created_at < G[b].created_at ? 1 : -1; });
      if (ids.length && !Object.keys(V.open).length) V.open[ids[0]] = true;
      var wrap = document.createElement('div'); wrap.className = 'mg-groups';
      wrap.innerHTML = ids.map(function (id) { return card(G[id], all.filter(function (r) { return SD.same(r.group_id, id); }), S.tn[G[id].tenant_id], list); }).join('');
      bd.parentNode.insertBefore(wrap, bd);
      wire(wrap, G, all, repaint, S);
    });
  }
  function done(repaint) { return function () { SD.toast(SD.L('Saved', 'Disimpan'), 'success'); SD.onChangeAdmin ? SD.onChangeAdmin() : repaint(); }; }
  function fail(e) { SD.toast(SD.err(e), 'error'); }
  function setPic(ids, uid) { var now = new Date().toISOString(); return sb.from('service_requests').update({ assigned_to: uid || null, updated_at: now }).in('id', ids).then(function (x) { if (x.error) throw x.error; }); }
  function wire(w, G, all, repaint, S) {
    var row = function (id) { return all.find(function (r) { return SD.same(r.id, id); }); };
    w.querySelectorAll('[data-g]').forEach(function (el) {
      var g = G[el.dataset.g], srs = all.filter(function (r) { return SD.same(r.group_id, g.id); });
      el.querySelector('.mg-tg').onclick = function () { V.open[g.id] = !V.open[g.id]; repaint(); };
      var q = function (s) { return el.querySelector(s); };
      if (q('[data-mga="th"]')) q('[data-mga="th"]').onclick = function () { MG.threadModal(g); };
      if (q('[data-mga="bulk"]')) q('[data-mga="bulk"]').onclick = function () { var u = q('[data-bulk]').value; if (!u) return; setPic(srs.filter(function (r) { return MG.DEAD.indexOf(r.status) < 0; }).map(function (r) { return r.id; }), u).then(done(repaint), fail); };
    });
    w.querySelectorAll('[data-pic]').forEach(function (s) { s.onchange = function () { setPic([s.dataset.pic], s.value).then(done(repaint), fail); }; });
    w.querySelectorAll('[data-open]').forEach(function (b) { b.onclick = function () { SD.go('admin', { view: 'sd_desk', id: b.dataset.open }); }; });
    w.querySelectorAll('[data-act]').forEach(function (b) { b.onclick = function () {
      var r = row(b.dataset.id), st = r && path(b.dataset.act, r.status); if (!st) return;
      var note = b.dataset.act === 'rej' || b.dataset.act === 'info' ? prompt(SD.L('Note for the client:', 'Nota untuk klien:'), '') : '';
      if (note === null) return; b.disabled = true;
      var pre = !r.assigned_to && b.dataset.act === 'acc' ? setPic([r.id], SD.uid()) : Promise.resolve();
      pre.then(function () { return st.reduce(function (p, to, i) { return p.then(function (cur) { return SD.setStatus(cur, to, i === st.length - 1 ? note || null : null); }); }, Promise.resolve(r)); }).then(done(repaint), function (e) { b.disabled = false; fail(e); });
    }; });
    w.querySelectorAll('[data-mv]').forEach(function (b) { b.onclick = function () { moveModal(row(b.dataset.mv), G, all, repaint, S); }; });
  }
  /* split out = SR leaves the group and becomes a normal SR; move = into another open group of the same tenant */
  function moveModal(r, G, all, repaint, S) {
    if (!r) return;
    var other = Object.keys(G).filter(function (id) { return !SD.same(id, r.group_id) && SD.same(G[id].tenant_id, r.tenant_id); });
    SD.modal(SD.L('Split / move ', 'Pecah / pindah ') + r.ref_no, '<div style="padding:14px"><button class="sd-li" data-to=""><i class="ti ti-arrows-split"></i><div class="grow"><b style="display:block;font-size:13px">' + SD.L('Split out as a normal request', 'Pecah keluar sebagai permohonan biasa') + '</b></div></button>' +
      other.map(function (id) { return '<button class="sd-li" data-to="' + id + '"><i class="ti ti-stack-2"></i><div class="grow"><b style="display:block;font-size:13px">' + SD.L('Move to ', 'Pindah ke ') + SD.esc(G[id].ref_no) + '</b><div class="cob-xs">' + SD.esc(G[id].title) + '</div></div></button>'; }).join('') + '</div>');
    document.querySelectorAll('#cob-modal [data-to]').forEach(function (b) { b.onclick = function () {
      var to = b.dataset.to || null;
      sb.from('service_requests').update({ group_id: to, updated_at: new Date().toISOString() }).eq('id', r.id).then(function (x) {
        if (x.error) return fail(x.error);
        SD.event(r, 'internal_note', { body: to ? SD.L('Moved to group ', 'Dipindah ke kumpulan ') + G[to].ref_no : SD.L('Split out of group ', 'Dipecah dari kumpulan ') + (G[r.group_id] || {}).ref_no }).catch(function () {});
        SD.closeModal(); done(repaint)();
      });
    }; });
  }
})();
