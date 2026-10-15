/* M-Core PA Enter: recent tenants (All Clients, PA only), Support Access wording (EN/BM new keys), PDPA support-access clause on Service Contract (screen + PDF). */
(function () {
  if (window._paMisc) return; window._paMisc = 1;
  function bm() { return typeof APP !== 'undefined' && APP.language === 'bm'; }
  function L(en, ms) { return bm() ? ms : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function isPa() { try { return typeof isPlatformAdmin === 'function' && isPlatformAdmin(); } catch (e) { return false; } }
  var T = {
    pa_sa_card_en: 'Choose how M-Core support staff may help with your service requests',
    pa_sa_card_bm: 'Pilih cara staf sokongan M-Core boleh membantu permohonan servis anda',
    pa_sa_allow_en: 'Support staff may open the modules you choose to do contracted work. M-Core platform administrators may also access your account for support and maintenance under the Service Contract (PDPA clause).',
    pa_sa_allow_bm: 'Staf sokongan boleh membuka modul yang anda pilih untuk kerja dalam kontrak. Pentadbir platform M-Core juga boleh mengakses akaun anda untuk sokongan dan penyelenggaraan di bawah Kontrak Servis (klausa PDPA).',
    pa_pdpa_t_en: 'Support access & personal data (PDPA)',
    pa_pdpa_t_bm: 'Akses sokongan & data peribadi (PDPA)',
    pa_pdpa_en: 'To provide support, maintenance and troubleshooting under this contract, authorised M-Core platform administrators may access the client\'s M-Core account and the data in it. Access is limited to that purpose, recorded in M-Core\'s internal audit log, and personal data is handled in line with the Personal Data Protection Act 2010 (PDPA). Personal data is not disclosed to third parties except as required by law.',
    pa_pdpa_bm: 'Bagi menyediakan sokongan, penyelenggaraan dan penyelesaian masalah di bawah kontrak ini, pentadbir platform M-Core yang diberi kuasa boleh mengakses akaun M-Core klien dan data di dalamnya. Akses terhad kepada tujuan tersebut, direkod dalam log audit dalaman M-Core, dan data peribadi dikendalikan selaras dengan Akta Perlindungan Data Peribadi 2010 (PDPA). Data peribadi tidak didedahkan kepada pihak ketiga kecuali seperti yang dikehendaki undang-undang.'
  };
  function t(k) { return T[k + (bm() ? '_bm' : '_en')]; }
  window.PA_I18N = T;
  var REPL = [
    ['Control when the M-Core team may enter your workspace', 'pa_sa_card'], ['Kawal bila pasukan M-Core boleh masuk ke ruang kerja anda', 'pa_sa_card'],
    ['M-Core staff can enter your workspace to do contracted work', 'pa_sa_allow'], ['Staf M-Core boleh masuk ruang kerja anda untuk kerja dalam kontrak', 'pa_sa_allow']
  ];
  function texts(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, hit = [];
    while ((n = w.nextNode())) { var v = n.nodeValue; if (v && v.length > 30 && v.indexOf('M-Core') >= 0) hit.push(n); }
    hit.forEach(function (n) { REPL.forEach(function (r) { if (n.nodeValue.indexOf(r[0]) >= 0) n.nodeValue = n.nodeValue.replace(r[0], t(r[1])); }); });
  }
  function clauseHtml() {
    return '<details class="pa-pdpa" style="margin-top:12px;border-top:1px solid var(--border,#ddd);padding-top:10px"><summary style="cursor:pointer;font-weight:700;font-size:13px"><i class="ti ti-shield-lock" aria-hidden="true"></i> ' + t('pa_pdpa_t') + '</summary>' +
      '<div style="font-size:12.5px;line-height:1.5;margin-top:6px;color:var(--text-2,inherit)">' + esc(t('pa_pdpa')) + '</div>' +
      '<button type="button" class="btn btn-sm btn-outline pa-pdpa-pdf" style="margin-top:8px"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> ' + L('Contract PDF', 'PDF kontrak') + '</button></details>';
  }
  function pdf(card) {
    var c = card.cloneNode(true); c.querySelectorAll('button,.pa-pdpa-pdf').forEach(function (b) { b.remove(); });
    var d = c.querySelector('details'); if (d) d.setAttribute('open', '');
    var w = window.open('', '_blank'); if (!w) return;
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(L('Service Contract', 'Kontrak Servis')) + '</title><style>@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#111;font-size:12px}summary{list-style:none;font-weight:700;margin-top:10px}.cob-xs{font-size:11px;color:#444}b{color:#111}div{max-width:100%}</style></head><body><h2 style="margin:0 0 10px">' +
      esc(L('Service Contract', 'Kontrak Servis')) + (APP && APP.tenant ? ' — ' + esc(APP.tenant.name) : '') + '</h2>' + c.innerHTML +
      '<h3 style="margin-top:16px">' + esc(t('pa_pdpa_t')) + '</h3><p style="line-height:1.5">' + esc(t('pa_pdpa')) + '</p></body></html>');
    w.document.close(); setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 300);
  }
  function contract() {
    var cards = document.querySelectorAll('.cob-card');
    Array.prototype.forEach.call(cards, function (c) {
      if (c.querySelector('.pa-pdpa')) return;
      var x = (c.textContent || '').slice(0, 200);
      if (!/SERVICE CONTRACT|KONTRAK SERVIS|Contract summary|Ringkasan kontrak/.test(x)) return;
      if (/No service contract yet|Tiada kontrak servis/.test(x)) return;
      c.insertAdjacentHTML('beforeend', clauseHtml());
      c.querySelector('.pa-pdpa-pdf').onclick = function () { pdf(c); };
    });
    var pk = document.querySelector('.sd-pack');
    if (pk && !pk.querySelector('.pa-pdpa-print')) pk.insertAdjacentHTML('beforeend', '<div class="cob-card pa-pdpa-print" style="padding:12px 16px;margin-top:12px;font-size:11.5px;line-height:1.5"><b>' + t('pa_pdpa_t') + '</b><div>' + esc(t('pa_pdpa')) + '</div></div>');
  }
  function recent() {
    var host = document.getElementById('admin-clients-table-host');
    if (!host || !isPa() || (window.PAE && window.PAE.inSupport())) return;
    var a = []; try { a = JSON.parse(localStorage.getItem('mcore_pa_recent') || '[]'); } catch (e) {}
    var el = document.getElementById('pa-recent'), sig = a.map(function (x) { return x.id; }).join(',') + (bm() ? 'b' : 'e');
    if (!a.length) { if (el) el.remove(); return; }
    if (el && el.getAttribute('data-sig') === sig) return;
    if (!el) { el = document.createElement('div'); el.id = 'pa-recent'; host.parentNode.insertBefore(el, host); }
    el.setAttribute('data-sig', sig);
    el.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 10px;font-size:12px';
    el.innerHTML = '<span style="font-weight:700;color:var(--text-2,inherit)"><i class="ti ti-history" aria-hidden="true"></i> ' + L('Recent tenants', 'Tenant terkini') + ':</span>' +
      a.map(function (x) { return '<button type="button" class="btn btn-sm btn-outline" data-tid="' + esc(x.id) + '" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><i class="ti ti-login-2" aria-hidden="true"></i> ' + esc(x.name) + '</button>'; }).join('');
    el.querySelectorAll('[data-tid]').forEach(function (b) { b.onclick = function () { window._enterSupportTenant(b.getAttribute('data-tid')); }; });
  }
  var q = 0;
  function run() { q = 0; try { texts(document.getElementById('main-content') || document.body); contract(); recent(); } catch (e) {} }
  new MutationObserver(function () { if (!q) q = setTimeout(run, 250); }).observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(run, 600);
})();
