/* M-Core Onboarding Checklist - platform admin review (mockup ob3): queue, actions, keys. Panels in onboarding-review-panel.js. */
(function () {
  var C = window.COB; if (!C || C._review) return; C._review = 1;
  var E = C.esc, L = C.L;
  var V = { f: 'all', sec: '', full: false, url: null };
  function chunk(a, n) { var o = []; for (var i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
  function byIds(t, cols, ids) {
    return Promise.all(chunk(ids, 100).map(function (c) { return sb.from(t).select(cols).in('id', c); })).then(function (rs) { var o = []; rs.forEach(function (r) { if (r.error) throw r.error; o = o.concat(r.data || []); }); return o; });
  }
  C.reviewView = function (p) {
    return C.all(function () { var q = sb.from('cob_submissions').select('*').is('decision', null).is('deleted_at', null); return p.tenant ? q.eq('tenant_id', p.tenant) : q; }).then(function (subs) {
      var iid = [], tid = [];
      subs.forEach(function (s) { if (iid.indexOf(s.item_id) < 0) iid.push(s.item_id); if (tid.indexOf(s.tenant_id) < 0) tid.push(s.tenant_id); });
      return Promise.all([iid.length ? byIds('cob_items', '*', iid) : [], tid.length ? byIds('tenants', 'id,name', tid) : []]).then(function (r) {
        var im = {}, tm = {}; r[0].forEach(function (i) { im[i.id] = i; }); r[1].forEach(function (t) { tm[t.id] = t.name; });
        /* latest pending per item only; skip items already N/A (safe before/after patch 06) */
        var last = {}; subs.forEach(function (s) { if (!last[s.item_id] || s.seq > last[s.item_id].seq) last[s.item_id] = s; });
        var Q = subs.filter(function (s) { return im[s.item_id] && last[s.item_id] === s && im[s.item_id].status !== 'na'; }).map(function (s) { return { s: s, i: im[s.item_id], t: tm[s.tenant_id] || '—' }; })
          .sort(function (a, b) { return (b.i.urgent - a.i.urgent) || (a.s.submitted_at < b.s.submitted_at ? 1 : -1); });
        C.pending = p.tenant ? C.pending : Q.length; C.paintCount();
        var sel = Q.find(function (x) { return x.s.id === p.sub; }) || Q[0];
        if (!sel || (V.sel && V.sel !== sel.s.id)) { V.full = false; V.url = null; }
        V.sel = sel && sel.s.id; V.Q = Q; V.p = p;
        if (!sel) return draw(Q, null, {});
        var ids = [sel.s.submitted_by];
        return Promise.all([
          sel.s.file_id ? sb.from('cob_files').select('*').eq('id', sel.s.file_id).maybeSingle() : Promise.resolve({ data: null }),
          sb.from('cob_events').select('*').eq('item_id', sel.i.id)
        ]).then(function (x) {
          var f = x[0].data, ev = (x[1].data || []).sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
          ev.forEach(function (e) { if (e.user_id && ids.indexOf(e.user_id) < 0) ids.push(e.user_id); }); if (f && ids.indexOf(f.uploaded_by) < 0) ids.push(f.uploaded_by);
          return sb.from('user_profiles').select('id,full_name').in('id', ids.filter(Boolean)).then(function (u) { var nm = {}; (u.data || []).forEach(function (q) { nm[q.id] = q.full_name; }); return draw(Q, sel, { f: f, ev: ev, nm: nm }); }, function () { return draw(Q, sel, { f: f, ev: ev, nm: {} }); });
        });
      });
    });
  };
  function draw(Q, sel, X) {
    var m = document.getElementById('main'); if (APP.currentPage !== 'cob_admin') return;
    var vis = Q.filter(function (x) { return (V.f === 'all' || x.i.urgent) && (!V.sec || x.i.section_key === V.sec); }), urg = Q.filter(function (x) { return x.i.urgent; }).length;
    var secs = []; Q.forEach(function (x) { if (secs.indexOf(x.i.section_key) < 0) secs.push(x.i.section_key); }); secs.sort();
    var h = '<div class="cob-root"><div class="cob-head"><div class="row" style="gap:6px"><button class="header-btn" data-go="back" style="width:40px;height:40px" aria-label="' + L('Back', 'Kembali') + '"><i class="ti ti-arrow-left"></i></button><div><div class="cob-h1">' + L('Onboarding Review', 'Semakan Onboarding') + '</div><div class="cob-sm">' + L('Data is already active in the tenant · you review and decide', 'Data sudah aktif dalam tenant · anda semak dan putuskan') + '</div></div></div>' +
      '<div class="row" style="gap:8px"><button class="btn btn-outline btn-sm" data-go="all"><i class="ti ti-filter"></i>' + (V.p.tenant ? E((Q[0] && Q[0].t) || '') + ' ×' : L('All tenants', 'Semua tenant')) + '</button><button class="btn btn-outline btn-sm" data-go="keys"><i class="ti ti-keyboard"></i>L / T / N</button></div></div>';
    var q = '<div class="cob-card" style="padding:0;overflow:hidden"><div style="padding:12px 14px;border-bottom:1px solid var(--border)"><div class="row" style="justify-content:space-between"><b style="font-size:14px">' + L('Review queue', 'Barisan semakan') + '</b>' + (urg ? '<span class="badge badge-red">' + urg + L(' urgent', ' segera') + '</span>' : '') + '</div>' +
      '<div class="cob-chips" style="margin-top:10px"><button class="cob-chip' + (V.f === 'all' ? ' on' : '') + '" data-f="all" style="font-size:12px;padding:5px 10px">' + L('All ', 'Semua ') + Q.length + '</button><button class="cob-chip' + (V.f === 'urg' ? ' on' : '') + '" data-f="urg" style="font-size:12px;padding:5px 10px">' + L('Urgent ', 'Segera ') + urg + '</button>' +
      '<button class="cob-chip' + (V.sec ? ' on' : '') + '" data-sec="1" style="font-size:12px;padding:5px 10px" title="' + L('Section', 'Seksyen') + '">' + (V.sec || (secs.length ? secs[0] + '–' + secs[secs.length - 1] : 'A–I')) + '</button></div></div>';
    vis.forEach(function (x) {
      var on = sel && x.s.id === sel.s.id;
      q += '<div class="row cob-q' + (on ? ' on' : '') + '" data-s="' + E(x.s.id) + '" tabindex="0" role="button"><i class="ti ' + (x.i.urgent ? 'ti-urgent' : 'ti-file-description') + '" style="font-size:18px;margin-top:1px;color:' + (x.i.urgent ? 'var(--danger)' : 'var(--cob-t3)') + '"></i><div class="grow"><div class="row" style="gap:6px"><span class="cob-ell" style="font-size:13px;font-weight:600">' + E(x.t) + '</span>' + (x.i.urgent ? '<span class="badge badge-red" style="font-size:10px;padding:1px 6px">' + L('URGENT', 'SEGERA') + '</span>' : '') + '</div>' +
        '<div class="cob-sm cob-ell" style="margin-top:2px"><span class="cob-mono" style="color:var(--cob-t3)">' + E(x.i.code) + '</span> ' + E(C.lab(x.i, 'label')) + '</div></div><span class="cob-xs" style="white-space:nowrap">' + C.age(x.s.submitted_at) + '</span></div>';
    });
    if (!vis.length) q += '<div class="cob-sm" style="padding:24px;text-align:center"><i class="ti ti-circle-check" style="font-size:24px;color:var(--cob-full)"></i><div>' + L('Nothing to review', 'Tiada untuk disemak') + '</div></div>';
    q += '</div>';
    if (!sel) { m.innerHTML = h + '<div class="cob-g3"><div>' + q + '</div></div></div>'; return bind(m.firstChild, null); }
    var P = C.rvPanel(sel, X, V), f = X.f;
    m.innerHTML = h + '<div class="cob-g3">' + q + P.doc + P.right + '</div>' + P.aud + '</div>';
    bind(m.firstChild, sel, f, secs);
  }
  function reload(sub) { return C.reviewView(Object.assign({}, V.p, { sub: sub })); }
  function bind(root, sel, f, secs) {
    root.onclick = function (ev) {
      var b = ev.target.closest('[data-f],[data-s],[data-go],[data-sec]'); if (!b) return;
      if (b.dataset.f) { V.f = b.dataset.f; reload(V.sel); }
      else if (b.dataset.sec) { var k = secs.indexOf(V.sec); V.sec = k + 1 < secs.length ? secs[k + 1] : ''; reload(V.sel); }
      else if (b.dataset.s) { V.full = false; V.url = null; reload(b.dataset.s); }
      else act(b.dataset.go, sel, f);
    };
    var rs = root.querySelector('#cob-rs'); if (rs) rs.onchange = function () { root.querySelector('#cob-ro').style.display = rs.value === '_o' ? '' : 'none'; };
  }
  function act(g, sel, f) {
    if (g === 'back') return C.go('cob_admin', {});
    if (g === 'all') return C.go('cob_admin', { view: 'review' });
    if (g === 'keys') return C.toast(L('L = Approve · T = Reject (choose reason first) · N = Not applicable', 'L = Lulus · T = Tolak (pilih sebab dahulu) · N = Tak berkenaan'), 'info');
    if (!sel) return;
    if (g === 'open' || g === 'dl') return C.openFile(sel.i.id, f, false, g === 'open').then(function (u) { if (u && g === 'open') { V.url = u; reload(sel.s.id); } if (u && g === 'dl') window.open(u, '_blank'); });
    if (g === 'full') return sb.rpc('cob_log_view', { p_item: sel.i.id, p_file: f ? f.id : null, p_full: true }).then(function (r) { if (r.error) throw r.error; V.full = true; reload(sel.s.id); }).catch(function (e) { C.toast(C.err(e), 'error'); });
    var call;
    if (g === 'ok') call = sb.rpc('cob_review', { p_submission: sel.s.id, p_decision: 'approved' });
    else if (g === 'no') {
      var v = document.getElementById('cob-rs').value, why = v === '_o' ? document.getElementById('cob-ro').value.trim() : v;
      if (!why) { C.toast(L('Choose a reject reason', 'Pilih sebab tolak'), 'warning'); document.getElementById('cob-rs').focus(); return; }
      call = sb.rpc('cob_review', { p_submission: sel.s.id, p_decision: 'rejected', p_reason: why });
    } else if (g === 'na') {
      if (!window.confirm(L('Mark this item not applicable?', 'Tanda item ini tak berkenaan?'))) return;
      call = sb.rpc('cob_set_status', { p_item: sel.i.id, p_status: 'na', p_reason: null });
    } else return;
    call.then(function (r) {
      if (r.error) throw r.error; var d = r.data || {};
      if (d.conflicts && d.conflicts.length) C.toast(L('Rejected. Changed since submit, check manually: ', 'Ditolak. Telah diubah selepas hantar, semak manual: ') + d.conflicts.join(', '), 'warning');
      else C.toast(L('Saved', 'Disimpan'), 'success');
      var Q = V.Q, k = Q.findIndex(function (x) { return x.s.id === sel.s.id; }), nx = Q[k + 1] || Q[k - 1];
      V.full = false; V.url = null; reload(nx ? nx.s.id : null);
    }).catch(function (e) { C.toast(C.err(e), 'error'); });
  }
  document.addEventListener('keydown', function (e) {
    if (APP.currentPage !== 'cob_admin' || !V.p || V.p.view !== 'review' || e.ctrlKey || e.metaKey || e.altKey || /input|select|textarea/i.test((e.target.tagName || ''))) return;
    if (!document.querySelector('.cob-dec')) return;
    var k = e.key.toLowerCase(), m = { l: 'ok', t: 'no', n: 'na' }[k]; if (!m) return;
    e.preventDefault(); var b = document.querySelector('[data-go="' + m + '"]'); if (b) b.click();
  });
})();
