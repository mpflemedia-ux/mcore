/* M-Core Service Desk - Public Link owner review: tabs on 'Servis Saya', link quota card, pending public requests under
   'Perlu tindakan' with Approve / Reject. Approve = official service request on the contract quota (flows to admin desk). */
(function () {
  var SD = window.SD; if (!SD || SD._pubAppr || !SD.pubProbe) return; SD._pubAppr = 1;
  var st = document.createElement('style'); st.textContent = '.sd-pubg{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:14px;align-items:start}@media(max-width:1100px){.sd-pubg{grid-template-columns:1fr}}.sd-pubc .sd-acts .btn{flex:1;min-height:44px}';
  document.head.appendChild(st);
  var orig = SD.view.servis_saya;
  SD.view.servis_saya = function (p) {
    p = p || {};
    return SD.pubProbe().then(function (ok) {
      if (!ok || !SD.isTA()) { SD.pubOn = false; return orig(p); }
      SD.pubOn = true;
      if (p.tab === 'link') return SD.catalog().then(function (c) { SD.catalogList = c; return orig({ _noPaint: 1 }); }).then(function () { return SD.pubSettings(); });
      return SD.pubLoad().then(function () { return orig(p); });
    });
  };
  function card(r) {
    return '<div class="cob-card sd-pubc" style="padding:16px;margin-bottom:12px"><div class="row" style="gap:6px;flex-wrap:wrap"><span class="badge badge-blue"><i class="ti ti-world"></i> ' + SD.L('Via public link', 'Melalui link awam') + '</span><span class="badge badge-yellow">' + SD.L('Waiting for approval', 'Menunggu kelulusan') + '</span><span class="sd-ref" style="margin-left:auto">' + SD.esc(r.ref_no) + '</span></div>' +
      '<b style="display:block;font-size:15px;margin-top:8px;overflow-wrap:anywhere">' + SD.esc(r.title) + '</b><div class="cob-xs">' + SD.esc(SD.svcName(r.service_code)) + ' · ' + SD.dt(r.created_at) + '</div>' +
      '<div class="cob-card" style="padding:10px;margin-top:10px;font-size:13px;min-width:0"><div class="row"><i class="ti ti-user" style="color:var(--text-2)"></i>&nbsp;<span class="cob-ell">' + SD.esc(r.sender_name) + '</span></div><div class="row cob-xs" style="margin-top:4px"><i class="ti ti-mail"></i>&nbsp;<span class="cob-ell">' + SD.esc(r.sender_contact) + '</span></div>' +
      (r.file_path ? '<button type="button" class="row cob-xs" data-pf="' + SD.esc(r.file_path) + '" style="margin-top:4px;background:none;border:0;padding:0;color:var(--primary);cursor:pointer;max-width:100%"><i class="ti ti-paperclip"></i>&nbsp;<span class="cob-ell">' + SD.esc(r.file_name || r.file_path.split('/').pop()) + '</span></button>' : '') + '</div>' +
      (r.description ? '<div class="cob-sm" style="margin-top:10px;white-space:pre-wrap;overflow-wrap:anywhere">' + SD.esc(r.description) + '</div>' : '') +
      '<div class="sd-acts" style="margin-top:12px"><button class="btn btn-outline" data-rej="' + r.id + '" style="color:var(--danger)"><i class="ti ti-x"></i> ' + SD.L('Reject', 'Tolak') + '</button><button class="btn btn-success" data-ok="' + r.id + '"><i class="ti ti-check"></i> ' + SD.L('Approve', 'Lulus') + '</button></div>' +
      '<div class="cob-xs" style="margin-top:8px">' + SD.L('Approve = sent to the M-Core team and counts 1 contract quota.', 'Lulus = dihantar kepada pasukan M-Core dan mengira 1 kuota kontrak.') + '</div></div>';
  }
  /* called at the end of sd-client paint() */
  SD.pubInject = function (m, S) {
    if (!SD.pubOn) return;
    var root = m.querySelector('.cob-root'); if (!root) return;
    root.insertAdjacentHTML('afterbegin', SD.tabsBar('req')); SD.bindTabs(m);
    var l = SD.pub.link, pend = SD.pub.pending;
    if (l && l.enabled) {
      var pct = l.monthly_quota ? Math.min(100, Math.round(SD.pub.used / l.monthly_quota * 100)) : 0, q = S.c && S.c.monthly_quota;
      var bar = '<div class="cob-card" style="padding:12px 14px;margin-bottom:12px"><div class="row" style="justify-content:space-between"><b style="font-size:12.5px"><i class="ti ti-link"></i> ' + SD.L('Public link quota this month', 'Kuota link awam bulan ini') + '</b><b style="font-size:12.5px">' + SD.pub.used + ' / ' + l.monthly_quota + '</b></div><div class="cob-bar" style="margin-top:6px"><i style="width:' + pct + '%"></i></div>' +
        (q != null ? '<div class="row cob-xs" style="justify-content:space-between;margin-top:8px"><span>' + SD.L('Contract quota', 'Kuota kontrak') + '</span><span>' + S.used + ' / ' + q + '</span></div>' : '') + '</div>';
      var cnt = root.querySelector('.sd-cnt'); if (cnt) cnt.insertAdjacentHTML('beforebegin', bar);
    }
    if (!pend.length) return;
    var act = root.querySelector('[data-f="act"]'); if (act) act.textContent = act.textContent.replace(/\d+\s*$/, function (n) { return String(+n + pend.length); });
    if (S.f === 'all' || S.f === 'act') { var list = act && act.parentNode && act.parentNode.nextElementSibling; if (list) list.insertAdjacentHTML('beforebegin', pend.map(card).join('')); }
    root.querySelectorAll('[data-pf]').forEach(function (b) { b.onclick = function () { sb.storage.from('service-public').createSignedUrl(b.dataset.pf, 300).then(function (r) { if (r.data) window.open(r.data.signedUrl, '_blank', 'noopener'); else SD.toast(SD.err(r.error), 'error'); }); }; });
    root.querySelectorAll('[data-rej]').forEach(function (b) { b.onclick = function () { decide(b, pend.find(function (x) { return SD.same(x.id, b.dataset.rej); }), false); }; });
    root.querySelectorAll('[data-ok]').forEach(function (b) { b.onclick = function () { decide(b, pend.find(function (x) { return SD.same(x.id, b.dataset.ok); }), true); }; });
  };
  function decide(btn, r, ok) {
    if (!r) return;
    var c = SD.CL && SD.CL.c;
    if (ok && !SD.usable(c)) return SD.toast(SD.L('Your contract is not active or not paid yet.', 'Kontrak anda belum aktif atau belum dibayar.'), 'error');
    if (ok && c.monthly_quota != null && SD.CL.used >= c.monthly_quota) return SD.toast(SD.L('Monthly contract quota is full.', 'Kuota kontrak bulanan sudah penuh.'), 'error');
    var note = null;
    if (!ok) { note = prompt(SD.L('Reject this request? Reason (optional, internal):', 'Tolak permohonan ini? Sebab (pilihan, dalaman):'), ''); if (note === null) return; }
    btn.disabled = true;
    var now = new Date().toISOString(), done = function (rid) {
      return sb.from('service_public_requests').update({ status: ok ? 'approved' : 'rejected', decided_by: SD.uid(), decided_at: now, decision_note: note ? note.slice(0, 1000) : null, request_id: rid || null }).eq('id', r.id).eq('status', 'pending')
        .then(function (x) { if (x.error) throw x.error; });
    };
    var p = !ok ? done(null) : SD.createRequest({ tenant_id: SD.tid(), contract_id: c.id, service_code: r.service_code, title: r.title, priority: 'normal', status: 'submitted', created_by: SD.uid(), due_at: SD.addBH(new Date(), c.sla_hours).toISOString(),
      description: (r.description ? r.description + '\n\n' : '') + SD.L('Via public link ', 'Melalui link awam ') + r.ref_no + ' · ' + r.sender_name + ' · ' + r.sender_contact })
      .then(function (nr) {
        return SD.event(nr, 'status', { to_status: 'submitted', body: SD.L('Approved from public link ', 'Diluluskan dari link awam ') + r.ref_no }).catch(function () {})
          .then(function () {
            if (!r.file_path) return;
            return sb.storage.from('service-public').download(r.file_path).then(function (d) { if (d.error || !d.data) return; return SD.upload(nr, new File([d.data], r.file_name || 'lampiran', { type: d.data.type }), false); }).catch(function () {});
          }).then(function () { SD.bellFor(nr, SD.L('New service request ', 'Permohonan servis baharu ') + nr.ref_no, nr.title); return done(nr.id); });
      });
    p.then(function () { SD.toast(ok ? SD.L('Approved and sent to M-Core', 'Diluluskan dan dihantar kepada M-Core') : SD.L('Rejected', 'Ditolak'), 'success'); SD.go('servis_saya', {}); })
      .catch(function (e) { btn.disabled = false; SD.toast(SD.err(e), 'error'); });
  }
  /* in-app notice for owner: nav count + one toast per session + realtime on new public requests */
  var chan = null, tries = 0;
  (function boot() {
    var ready = SD.uid() && SD.tid() && typeof APP !== 'undefined' && APP.tenant && SD.has && SD.has.desk;
    if (!ready) { if (++tries < 120) setTimeout(boot, 1000); return; }
    if (!SD.isTA() || SD.isPA()) return;
    SD.pubProbe().then(function (ok) {
      if (!ok) return;
      SD.pubLoad().then(function () {
        var n = SD.pub.pending.length, k = 'sd_pub_seen_' + SD.uid();
        try { if (n && sessionStorage.getItem(k) !== String(n)) { sessionStorage.setItem(k, String(n)); SD.toast(SD.L(n + ' public link request(s) waiting for your approval', n + ' permohonan link awam menunggu kelulusan anda'), 'info'); } } catch (e) {}
      });
      if (chan || !sb.channel) return;
      try {
        chan = sb.channel('sd-pub-' + SD.uid()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'service_public_requests' }, function (pl) {
          var x = pl && pl.new; if (!x || !SD.same(x.tenant_id, SD.tid())) return;
          SD.toast(SD.L('New public link request ', 'Permohonan link awam baharu ') + (x.ref_no || ''), 'info');
          SD.pubLoad().then(function () { if (APP.currentPage === 'servis_saya' && document.querySelector('.sd-cnt')) SD.view.servis_saya({}); });
        }).subscribe();
      } catch (e) {}
    });
  })();
})();
