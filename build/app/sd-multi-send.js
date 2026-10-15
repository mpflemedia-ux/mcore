/* M-Core Service Desk - multi-request: wizard form pieces + review step + submit (group or single SR, notes, files, bell, template). */
(function () {
  var SD = window.SD, MG = SD && SD.MG; if (!MG || SD.mgUI) return;
  var PRI = [['low', 'Low', 'Rendah'], ['normal', 'Normal', 'Biasa'], ['high', 'High', 'Tinggi'], ['urgent', 'Urgent', 'Segera']];
  SD.mgUI = {};
  SD.mgUI.form = function (d, k) {
    var id = function (x) { return 'mg-' + x + (k ? '-' + k : ''); };
    return '<div class="form-group"><label class="form-label">' + SD.L('Title', 'Tajuk') + '</label><input class="form-input" data-no-titlecase="1" id="' + id('t') + '" maxlength="200" value="' + SD.esc(d.title) + '"></div>' +
      '<div class="form-group"><label class="form-label">' + SD.L('Details', 'Butiran') + '</label><textarea class="form-input" data-no-titlecase="1" id="' + id('d') + '" rows="4">' + SD.esc(d.desc) + '</textarea></div>' +
      '<div class="form-group"><label class="form-label">' + SD.L('Priority', 'Keutamaan') + '</label><select class="form-input" id="' + id('p') + '">' + PRI.map(function (x) { return '<option value="' + x[0] + '"' + (d.pri === x[0] ? ' selected' : '') + '>' + SD.L(x[1], x[2]) + '</option>'; }).join('') + '</select></div>';
  };
  SD.mgUI.chips = function (list) { return list.map(function (f) { return '<span class="cob-chip" style="margin:0 6px 6px 0"><i class="ti ti-file"></i> ' + SD.esc(f.name) + '</span>'; }).join(''); };
  SD.mgUI.review = function (N, P, det, S, l, openDup) {
    var c = S.c || {};
    return '<b style="font-size:15px;display:block;margin-bottom:4px">' + SD.L('Review & submit', 'Semak & hantar') + '</b><div class="cob-xs" style="margin-bottom:8px">' + (P.mk.length > 1 ? SD.L('Creates 1 group with ' + P.mk.length + ' requests', 'Mencipta 1 kumpulan dengan ' + P.mk.length + ' permohonan') : SD.L('Creates 1 request', 'Mencipta 1 permohonan')) + '</div>' +
        P.mk.map(function (k, i) { var d = det(k); return '<div class="row" style="gap:10px;padding:10px 0;border-top:1px solid var(--border)"><i class="ti ti-circle-check" style="color:var(--primary);font-size:18px"></i><div class="grow" style="min-width:0"><b style="display:block">' + SD.esc(SD.svcName(k)) + '</b><div class="cob-xs cob-ell">' + SD.esc(d.title) + '</div></div><div class="cob-xs" style="text-align:right;white-space:nowrap">SLA ' + c.sla_hours + SD.L('h', 'j') + (l != null ? '<br>' + SD.L('Quota after: ', 'Kuota selepas: ') + (l - i - 1) : '') + '</div></div>'; }).join('') +
        P.note.map(function (k) { return '<div class="cob-banner warn" style="margin-top:8px"><i class="ti ti-alert-triangle"></i><div><b>' + SD.esc(SD.svcName(k)) + '</b>' + SD.L(' will not be submitted: added as a note to ', ' tidak dihantar: ditambah sebagai nota ke ') + SD.esc(openDup(k).ref_no) + '.</div></div>'; }).join('') +
        P.skip.map(function (k) { return '<div class="cob-banner err" style="margin-top:8px"><i class="ti ti-alert-triangle"></i><div><b>' + SD.esc(SD.svcName(k)) + '</b>' + SD.L(' skipped: quota used up. The other services are still submitted.', ' diskip: kuota habis. Servis lain tetap dihantar.') + '</div></div>'; }).join('') +
        '<label class="row" style="gap:10px;margin-top:14px;cursor:pointer"><input type="checkbox" id="mg-tpl" style="width:20px;height:20px;accent-color:var(--primary)"' + (N.tpl ? ' checked' : '') + '><b>' + SD.L('Save as template', 'Simpan sebagai templat') + '</b></label>' +
        (N.tpl ? '<input class="form-input" data-no-titlecase="1" id="mg-tn" maxlength="80" style="margin-top:8px" placeholder="' + SD.L('Template name', 'Nama templat') + '" value="' + SD.esc(N.tname) + '">' : '') +
        '<div class="cob-xs" style="margin-top:10px">' + SD.L('Notified: M-Core team + account owner', 'Dimaklumkan: pasukan M-Core + pemilik akaun') + '</div>';
  };
  function openDup(S, code) { return (S.rows || []).find(function (r) { return r.service_code === code && ['submitted', 'triaged', 'in_progress', 'waiting_client', 'revision'].indexOf(r.status) >= 0; }); }
  function files(r, list) { return list.reduce(function (p, f) { return p.then(function () { return SD.upload(r, f, false).catch(function (e) { SD.toast(SD.err(e), 'error'); }); }); }, Promise.resolve()); }
  /* sequential so ref numbers stay in order; each SR keeps its own SLA due, status and (later) PIC */
  SD.mgSubmit = function (N, P, det, S) {
    var c = S.c, tid = SD.tid(), made = [], g = null;
    var notes = P.note.reduce(function (p, k) {
      var d = det(k), r = openDup(S, k); if (!r) return p;
      return p.then(function () { return SD.event(r, 'comment', { body: SD.L('Added from a new request: ', 'Ditambah dari permohonan baharu: ') + d.title + (d.desc ? '\n\n' + d.desc : '') }).catch(function () {}); });
    }, Promise.resolve());
    var head = P.mk.length > 1 ? MG.createGroup({ tenant_id: tid, title: (N.same ? N.c : det(P.mk[0])).title, source: 'app' }).then(function (x) { g = x; }) : Promise.resolve();
    return notes.then(function () { return head; }).then(function () {
      return P.mk.reduce(function (p, k) {
        return p.then(function () {
          var d = det(k), row = { tenant_id: tid, contract_id: c.id, service_code: k, title: d.title, description: d.desc || null, priority: d.pri || 'normal', status: 'submitted', created_by: SD.uid(), due_at: SD.addBH(new Date(), c.sla_hours).toISOString() };
          if (g) row.group_id = g.id;
          return SD.createRequest(row).then(function (r) {
            made.push(r);
            return SD.event(r, 'status', { to_status: 'submitted', body: g ? SD.L('Request submitted in group ', 'Permohonan dihantar dalam kumpulan ') + g.ref_no : SD.L('Request submitted', 'Permohonan dihantar') }).catch(function () {})
              .then(function () { return files(r, (N.files || []).concat(N.pf[k] || [])); });
          });
        });
      }, Promise.resolve());
    }).then(function () {
      if (g) MG.bell(g, made);
      else if (made[0]) (SD.bellNew || SD.bellFor)(made[0], SD.L('New service request ', 'Permohonan servis baharu ') + made[0].ref_no, made[0].title);
      var t = N.tpl && N.tname ? MG.tplSave(N.tname, N.svcs, { c: N.c, same: N.same, per: N.per }).catch(function () {}) : null;
      return Promise.resolve(t).then(function () {
        var ref = g ? g.ref_no : made[0] ? made[0].ref_no : '';
        return SD.L('Submitted ', 'Dihantar ') + ref + (g ? ' (' + made.length + SD.L(' requests', ' permohonan') + ')' : '') + (P.skip.length ? SD.L(', ' + P.skip.length + ' skipped', ', ' + P.skip.length + ' diskip') : '') + (P.note.length ? SD.L(', ' + P.note.length + ' note(s) added', ', ' + P.note.length + ' nota ditambah') : '');
      });
    });
  };
})();
