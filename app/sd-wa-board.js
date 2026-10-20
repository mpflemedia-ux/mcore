/* M-Core Service Desk - admin board filter chip 'Belum dimaklumkan (N)': delivered requests with no WhatsApp share
   since delivery (computed from service_request_shares). Active chip swaps the columns for a list with a WA button. */
(function () {
  var SD = window.SD, W = window.SDW; if (!SD || !W || SD.waBoard) return;
  W.unnOn = false;
  SD.waBoard = function (m, S, repaint) {
    W.probe().then(function (on) {
      if (!on || !m.isConnected) return;
      var del = (S.rows || []).filter(function (r) { return r.status === 'delivered'; });
      W.loadShares(del.map(function (r) { return r.id; })).then(function () {
        var chips = m.querySelector('.sd-flt .cob-chips:not(.mg-seg)'); if (!chips || chips.querySelector('[data-unn]')) return;
        var list = del.filter(W.unnotified);
        var b = document.createElement('button'); b.type = 'button'; b.className = 'cob-chip' + (W.unnOn ? ' on' : ''); b.setAttribute('data-unn', '1');
        b.innerHTML = '<i class="ti ti-bell-off"></i> ' + W.L('Not notified', 'Belum dimaklumkan') + ' (' + list.length + ')';
        var sel = chips.querySelector('select'); chips.insertBefore(b, sel || null);
        chips.querySelectorAll('[data-f]').forEach(function (x) { if (W.unnOn) x.classList.remove('on'); x.addEventListener('click', function () { W.unnOn = false; }, true); });
        b.onclick = function () { W.unnOn = !W.unnOn; repaint(); };
        if (!W.unnOn) return;
        var bd = m.querySelector('.sd-board'); if (!bd) return;
        var tn = S.tn || {};
        bd.outerHTML = '<div class="sdw-list"><div class="cob-xs" style="margin-bottom:8px">' + W.L('<b>Done</b> requests not yet notified to the client', 'Permintaan <b>Siap</b> yang belum dimaklumkan kepada client') + '</div>' +
          (list.length ? list.map(function (r) {
            return '<div class="cob-card" style="padding:0;margin-bottom:8px"><div class="sd-li"><i class="ti ti-circle-check" style="font-size:18px;color:var(--success);margin-top:2px"></i><button type="button" class="grow" data-open="' + W.esc(r.id) + '" style="min-width:0;text-align:left;background:none;border:0;color:inherit;padding:0;cursor:pointer"><div class="sd-ref">' + W.esc(r.ref_no) + '</div><b style="display:block;font-size:14px;margin-top:2px">' + W.esc(r.title) + '</b><div class="cob-xs cob-ell">' + W.esc((tn[r.tenant_id] || '') + ' · ' + SD.svcName(r.service_code)) + '</div></button>' +
              '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><span class="badge badge-yellow" style="font-size:10.5px;white-space:nowrap">' + W.L('Done ', 'Siap ') + W.esc(SD.age(r.delivered_at) || '') + '</span><button type="button" class="btn btn-sm pjw-go" data-wa="' + W.esc(r.id) + '" aria-label="Share WhatsApp"><i class="ti ti-brand-whatsapp"></i></button></div></div></div>';
          }).join('') : '<div class="cob-card" style="padding:16px;text-align:center" ><i class="ti ti-circle-check" style="color:var(--success)"></i> ' + W.L('All done requests have been notified.', 'Semua permintaan siap sudah dimaklumkan.') + '</div>') +
          '<div class="cob-card" style="padding:12px;display:flex;gap:10px;align-items:center;border-style:dashed"><i class="ti ti-info-circle" style="color:var(--text-2)"></i><span class="cob-xs">' + W.L('A request leaves this list once it is notified via WhatsApp.', 'Senarai hilang sendiri bila permintaan dimaklumkan via WhatsApp.') + '</span></div></div>';
        m.querySelectorAll('[data-open]').forEach(function (x) { x.onclick = function () { SD.go('admin', { view: 'sd_desk', id: x.dataset.open }); }; });
        m.querySelectorAll('[data-wa]').forEach(function (x) { x.onclick = function () { var r = list.find(function (y) { return SD.same(y.id, x.dataset.wa); }); if (r) W.share(r, repaint); }; });
      });
    });
  };
})();
