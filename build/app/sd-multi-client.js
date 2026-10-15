/* M-Core Service Desk - multi-request: client 'Servis Saya' group cards (progress n/m, SR rows, group thread, cancel one SR,
   edit services before any PIC, group rating). Runs after sd-client paint via the SD.pubInject hook; off until SQL is live. */
(function () {
  var SD = window.SD, MG = SD && SD.MG; if (!MG || SD._mgCl) return; SD._mgCl = 1;
  var open = {}, prev = SD.pubInject;
  SD.pubInject = function (m, S) {
    if (typeof prev === 'function') prev(m, S);
    MG.probe().then(function (on) { if (on && m.isConnected) inject(m, S); });
  };
  function bar(p) { return '<div class="cob-bar" style="margin:8px 0 4px"><i style="width:' + p.pct + '%"></i></div>'; }
  function stars(n) { var h = ''; for (var i = 1; i <= 5; i++) h += '<i class="ti ti-star' + (i <= n ? '-filled' : '') + '" style="color:var(--warning)"></i>'; return h; }
  function card(g, srs) {
    var p = MG.prog(srs), on = !!open[g.id];
    return '<div class="mg-card" data-g="' + g.id + '" style="border-bottom:1px solid var(--border);padding:12px 14px' + (on ? ';background:var(--cob-sel,var(--primary-light))' : '') + '">' +
      '<button class="row mg-tg" style="gap:8px;width:100%;background:none;border:0;padding:0;color:var(--text);text-align:left;cursor:pointer;font:inherit" aria-expanded="' + on + '"><i class="ti ti-stack-2" style="font-size:18px;color:var(--primary)"></i><span class="sd-ref grow">' + SD.esc(g.ref_no) + '</span>' + MG.chip(p.st) + '<i class="ti ti-chevron-' + (on ? 'up' : 'down') + '"></i></button>' +
      '<b style="display:block;font-size:14px;margin-top:4px;overflow-wrap:anywhere">' + SD.esc(g.title) + '</b><div class="row cob-xs"><span class="grow">' + srs.length + SD.L(' requests', ' permohonan') + '</span><span>' + p.done + '/' + p.total + SD.L(' done', ' siap') + '</span></div>' + bar(p) +
      (on ? srs.map(function (r) { return '<button class="sd-li" data-id="' + r.id + '" style="padding:10px 0;background:none"><div class="grow" style="min-width:0"><b style="display:block;font-size:13px">' + SD.esc(SD.svcName(r.service_code)) + '</b><div class="cob-xs cob-ell">' + SD.esc(r.ref_no) + ' · ' + SD.esc(r.title) + '</div></div>' + SD.st(r.status) + '</button>'; }).join('') +
        '<div class="sd-acts" style="margin-top:10px"><button class="btn btn-sm btn-outline" data-mg="th"><i class="ti ti-messages"></i> ' + SD.L('Group thread', 'Thread kumpulan') + '</button>' +
        (srs.some(function (r) { return r.status === 'submitted'; }) ? '<button class="btn btn-sm btn-outline" data-mg="cx"><i class="ti ti-x"></i> ' + SD.L('Cancel an SR', 'Batal satu SR') + '</button>' : '') +
        '<button class="btn btn-sm btn-outline" data-mg="ed"' + (p.pic ? ' disabled' : '') + '><i class="ti ti-edit"></i> ' + SD.L('Edit services', 'Ubah servis') + '</button>' +
        (p.st === 'completed' && !g.rating ? '<button class="btn btn-sm btn-primary" data-mg="rt"><i class="ti ti-star"></i> ' + SD.L('Rate', 'Beri rating') + '</button>' : '') + '</div>' +
        (g.rating ? '<div class="cob-xs" style="margin-top:8px">' + stars(g.rating) + ' ' + SD.L('Group rating', 'Rating kumpulan') + '</div>' : '') +
        (p.pic ? '<div class="cob-xs" style="margin-top:6px">' + SD.L('Edit services is locked once a PIC is assigned.', 'Ubah servis dikunci selepas PIC ditugaskan.') + '</div>' : '') : '') + '</div>';
  }
  function inject(m, S) {
    var lis = [].slice.call(m.querySelectorAll('.cob-root > .cob-card .sd-li')); if (!lis.length) return;
    var byId = {}; S.rows.forEach(function (r) { byId[r.id] = r; });
    var gids = lis.map(function (b) { var r = byId[b.dataset.id]; return r && r.group_id; }).filter(Boolean);
    if (!gids.length) return;
    MG.groups(gids).then(function (G) {
      if (!m.isConnected) return;
      var done = {};
      lis.forEach(function (b) {
        var r = byId[b.dataset.id], g = r && G[r.group_id]; if (!g) return;
        if (!done[g.id]) {
          done[g.id] = 1; if (open[g.id] == null && Object.keys(open).length === 0) open[g.id] = true;
          var srs = S.rows.filter(function (x) { return SD.same(x.group_id, g.id); });
          b.insertAdjacentHTML('beforebegin', card(g, srs));
          wire(m.querySelector('.mg-card[data-g="' + g.id + '"]'), g, srs, S);
        }
        b.remove();
      });
    });
  }
  function reload() { SD.go('servis_saya', {}); }
  function wire(el, g, srs, S) {
    if (!el) return;
    el.querySelector('.mg-tg').onclick = function () { open[g.id] = !open[g.id]; reload(); };
    el.querySelectorAll('.sd-li').forEach(function (b) { b.onclick = function () { SD.go('servis_saya', { id: b.dataset.id }); }; });
    var a = function (k, fn) { var b = el.querySelector('[data-mg="' + k + '"]'); if (b) b.onclick = fn; };
    a('th', function () { MG.threadModal(g); });
    a('cx', function () { pickModal(SD.L('Cancel an SR', 'Batal satu SR'), srs.filter(function (r) { return r.status === 'submitted'; }), function (r) { return SD.setStatus(r, 'cancelled', SD.L('Cancelled by client (group ', 'Dibatalkan oleh klien (kumpulan ') + g.ref_no + ')', true); }); });
    a('ed', function () { editModal(g, srs, S); });
    a('rt', function () { rateModal(g); });
  }
  function pickModal(title, list, act) {
    SD.modal(title, '<div style="padding:14px">' + list.map(function (r) { return '<button class="sd-li" data-pk="' + r.id + '"><div class="grow"><b style="display:block;font-size:13px">' + SD.esc(SD.svcName(r.service_code)) + '</b><div class="cob-xs">' + SD.esc(r.ref_no) + '</div></div><i class="ti ti-x" style="color:var(--danger)"></i></button>'; }).join('') + '</div>');
    document.querySelectorAll('[data-pk]').forEach(function (b) { b.onclick = function () {
      var r = list.find(function (x) { return SD.same(x.id, b.dataset.pk); }); if (!r || !confirm(SD.L('Cancel ', 'Batal ') + r.ref_no + '?')) return;
      act(r).then(function () { SD.closeModal(); SD.toast(SD.L('Cancelled ', 'Dibatalkan ') + r.ref_no, 'success'); reload(); }, function (e) { SD.toast(SD.err(e), 'error'); });
    }; });
  }
  /* add / remove services while no PIC: removed = cancel (submitted only), added = new SR in the same group (uses quota) */
  function editModal(g, srs, S) {
    var c = S.c || {}, live = srs.filter(function (r) { return MG.DEAD.indexOf(r.status) < 0; }), have = live.map(function (r) { return r.service_code; });
    var cat = (SD.catalogList || []).filter(function (x) { return (c.services || []).indexOf(x.code) >= 0; });
    SD.modal(SD.L('Edit services ', 'Ubah servis ') + g.ref_no, '<div style="padding:14px"><div class="cob-xs" style="margin-bottom:10px">' + SD.L('Max ', 'Maks ') + MG.MAX + SD.L(' services. Unticked requests are cancelled; new ticks use 1 quota each.', ' servis. Yang dibuang dibatalkan; tambahan guna 1 kuota setiap satu.') + '</div><div class="sd-pick">' +
      cat.map(function (x) { return '<label><input type="checkbox" value="' + x.code + '"' + (have.indexOf(x.code) >= 0 ? ' checked' : '') + '><span>' + SD.esc(SD.L(x.name_en, x.name_bm)) + '</span></label>'; }).join('') +
      '</div><div class="sd-acts"><button class="btn btn-primary" id="mg-eds" style="flex:1">' + SD.L('Save', 'Simpan') + '</button></div></div>');
    var b = document.getElementById('mg-eds'); if (!b) return;
    b.onclick = function () {
      var want = [].slice.call(document.querySelectorAll('#cob-modal .sd-pick input:checked')).map(function (i) { return i.value; });
      if (!want.length || want.length > MG.MAX) return SD.toast(SD.L('Choose 1 to ' + MG.MAX + ' services', 'Pilih 1 hingga ' + MG.MAX + ' servis'), 'error');
      var add = want.filter(function (k) { return have.indexOf(k) < 0; }), rm = live.filter(function (r) { return want.indexOf(r.service_code) < 0; });
      var left = c.monthly_quota != null ? c.monthly_quota - S.used : null;
      if (left != null && add.length > left) return SD.toast(SD.L('Not enough quota this month', 'Kuota bulan ini tidak mencukupi'), 'error');
      b.disabled = true;
      var base = live[0] || {};
      var p = rm.reduce(function (q, r) { return q.then(function () { return SD.setStatus(r, 'cancelled', SD.L('Removed from group ', 'Dibuang dari kumpulan ') + g.ref_no, true); }); }, Promise.resolve());
      p = add.reduce(function (q, k) {
        return q.then(function () {
          return SD.createRequest({ tenant_id: g.tenant_id, contract_id: c.id, group_id: g.id, service_code: k, title: base.title || g.title, description: base.description || null, priority: base.priority || 'normal', status: 'submitted', created_by: SD.uid(), due_at: SD.addBH(new Date(), c.sla_hours).toISOString() })
            .then(function (r) { return SD.event(r, 'status', { to_status: 'submitted', body: SD.L('Added to group ', 'Ditambah ke kumpulan ') + g.ref_no }).catch(function () {}); });
        });
      }, p);
      p.then(function () { if (add.length) (SD.bellNew || SD.bellFor)({ tenant_id: g.tenant_id }, g.ref_no + ': ' + SD.L('services added', 'servis ditambah'), add.map(SD.svcName).join(', ')); SD.closeModal(); reload(); }, function (e) { b.disabled = false; SD.toast(SD.err(e), 'error'); });
    };
  }
  function rateModal(g) {
    var n = 0;
    SD.modal(SD.L('Rate ', 'Rating ') + g.ref_no, '<div style="padding:14px"><div class="row" id="mg-st" style="gap:6px;font-size:28px;justify-content:center;margin-bottom:10px">' + [1, 2, 3, 4, 5].map(function (i) { return '<button data-s="' + i + '" aria-label="' + i + '" style="background:none;border:0;cursor:pointer;color:var(--warning);font-size:30px"><i class="ti ti-star"></i></button>'; }).join('') + '</div>' +
      '<textarea class="form-input" data-no-titlecase="1" id="mg-rn" rows="3" placeholder="' + SD.L('Comment (optional)', 'Komen (pilihan)') + '"></textarea><div class="cob-xs" style="margin:6px 0 10px">' + SD.L('Applies to every request in this group.', 'Terpakai untuk setiap permohonan dalam kumpulan ini.') + '</div><div class="sd-acts"><button class="btn btn-primary" id="mg-rs" style="flex:1" disabled>' + SD.L('Submit rating', 'Hantar rating') + '</button></div></div>');
    document.querySelectorAll('#mg-st [data-s]').forEach(function (b) { b.onclick = function () { n = +b.dataset.s; document.querySelectorAll('#mg-st [data-s] i').forEach(function (i, k) { i.className = 'ti ti-star' + (k < n ? '-filled' : ''); }); document.getElementById('mg-rs').disabled = false; }; });
    document.getElementById('mg-rs').onclick = function () { var b = this; b.disabled = true; MG.rate(g, n, (document.getElementById('mg-rn').value || '').trim()).then(function () { SD.closeModal(); SD.toast(SD.L('Thank you for your rating', 'Terima kasih atas rating anda'), 'success'); reload(); }, function (e) { b.disabled = false; SD.toast(SD.err(e), 'error'); }); };
  }
})();
