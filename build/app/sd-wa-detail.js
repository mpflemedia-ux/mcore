/* M-Core Service Desk - Share WhatsApp on admin request detail: SLA x/y + Dimaklumkan badges, Share WhatsApp button,
   'Maklumkan client sekarang?' prompt when the request is Siap (delivered) and not yet notified. Admin (platform) only. */
(function () {
  var SD = window.SD, W = window.SDW; if (!SD || !W || SD.waInject) return;
  W.badges = function (r) {
    var s = W.sla(r), n = (W.shares[r.id] || []).length, h = '';
    if (s.x != null && s.y != null) h += '<span class="badge badge-' + (s.ok ? 'blue' : 'yellow') + '"><i class="ti ti-' + (s.ok ? 'check' : 'alert-triangle') + '"></i> SLA ' + s.x + SD.L('h', 'j') + ' / ' + s.y + SD.L('h', 'j') + '</span>';
    if (n) h += '<span class="badge sdw-n"><i class="ti ti-brand-whatsapp"></i> ' + W.L('Notified ', 'Dimaklumkan ') + n + 'x</span>';
    if (W.unnotified(r)) h += '<span class="badge badge-yellow"><i class="ti ti-bell-off"></i> ' + W.L('Not notified yet', 'Belum dimaklumkan') + '</span>';
    return h;
  };
  if (!document.getElementById('sdw-css')) { var c = document.createElement('style'); c.id = 'sdw-css'; c.textContent = '.sdw-n{border:1px solid var(--pjw,#25D366);color:#0F7A3F;background:transparent}body.dark .sdw-n,[data-theme=dark] .sdw-n{color:var(--pjw,#25D366)}.sdw-pr{border-color:var(--pjw,#25D366)!important}.sdw-pr .ti-brand-whatsapp.big{font-size:26px;color:var(--pjw,#25D366)}'; document.head.appendChild(c); }
  SD.waInject = function (m, r, ev, admin) {
    if (!admin) return;
    W.probe().then(function (on) {
      if (!on) return;
      return W.loadShares([r.id]).then(function () {
        if (!m.isConnected || !m.querySelector('.cob-root')) return;
        var head = m.querySelector('.cob-root > .cob-card'); if (!head || head.querySelector('.sdw-x')) return;
        var row = head.querySelector('.row'), ref = row && row.querySelector('.sd-ref');
        var b = document.createElement('span'); b.className = 'sdw-x'; b.style.cssText = 'display:contents'; b.innerHTML = W.badges(r);
        if (row) row.insertBefore(b, ref || null);
        var act = document.createElement('div'); act.className = 'row sdw-x'; act.style.cssText = 'gap:8px;margin-top:12px;flex-wrap:wrap';
        act.innerHTML = '<button type="button" class="pjw-btn" id="sdw-share"><i class="ti ti-brand-whatsapp"></i> ' + W.L('Share WhatsApp', 'Share WhatsApp') + '</button>';
        head.appendChild(act);
        var after = function () { SD.detail(r.id, true); };
        act.querySelector('#sdw-share').onclick = function () { W.share(r, after); };
        if (W.unnotified(r) && !W.dismiss[r.id]) {
          var p = document.createElement('div'); p.className = 'cob-card sdw-pr sdw-x'; p.style.cssText = 'padding:16px;margin-bottom:12px';
          p.innerHTML = '<div class="row" style="gap:10px;align-items:flex-start"><i class="ti ti-brand-whatsapp big"></i><div class="grow" style="min-width:0"><b style="font-size:15px">' + W.L('Notify the client now?', 'Maklumkan client sekarang?') + '</b><div class="cob-sm" style="margin-top:2px">' +
            W.L('Status is <b>Done</b>. Send the result link so the client can Confirm or Request changes.', 'Status ditukar ke <b>Siap</b>. Hantar link hasil kepada client supaya dia boleh Sahkan atau Minta pindaan.') + '</div>' +
            '<div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button type="button" class="btn pjw-go" id="sdw-pgo"><i class="ti ti-brand-whatsapp"></i> ' + W.L('Share WhatsApp', 'Share WhatsApp') + '</button><button type="button" class="btn btn-outline" id="sdw-later">' + W.L('Later', 'Nanti') + '</button></div></div></div>';
          head.parentNode.insertBefore(p, head.nextSibling);
          p.querySelector('#sdw-pgo').onclick = function () { W.share(r, after); };
          p.querySelector('#sdw-later').onclick = function () { W.dismiss[r.id] = 1; p.remove(); };
        }
      });
    });
  };
})();
