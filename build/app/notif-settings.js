/* M-Core bell v2 (i18n v2: LANG.*.notifSet) — per-user settings: type x channel (Bell/Phone/Telegram), quiet hours, morning digest. */
(function () {
  var NT = window.NT; if (!NT) return;
  var L = NT.L, esc = NT.esc;
  /* i18n: new keys only, under LANG.<lang>.notifSet (existing keys untouched). Read at render time, never at load. */
  var K = {
    en: { back: 'Notifications', title: 'Notification settings', scope: 'For your account only', type: 'Type', chB: 'Bell', chP: 'Phone', chT: 'Telegram',
      rApproval: 'Approvals', dApproval: 'Leave, outstation, claims, advances', rSd: 'Service Desk', dSd: 'Revisions, new requests, messages',
      rAssigned: 'Assigned & @mentions', dAssigned: 'Projects, tasks, comments', rOverdue: 'Overdue invoices', dOverdue: 'Grouped ×N',
      rContract: 'Contracts & plan', dContract: 'Ends in 30/14/7 days', rActivity: 'Activity', dActivity: 'Saved, attendance (no badge)',
      quiet: 'Quiet hours', quietD: 'Phone & Telegram held · Bell still collects', from: 'From', until: 'Until',
      d1: 'Mon', d2: 'Tue', d3: 'Wed', d4: 'Thu', d5: 'Fri', d6: 'Sat', d7: 'Sun', hi: 'High priority still delivered',
      digest: 'Morning summary', digestD: 'First open each morning · Bell', tg: 'Telegram', optional: 'Optional', tgLink: 'Link Telegram',
      os: 'Phone alerts need permission on this device', allow: 'Allow', save: 'Save settings', saved: 'Notification settings saved', local: 'Saved on this device only' },
    bm: { back: 'Pemberitahuan', title: 'Tetapan pemberitahuan', scope: 'Untuk akaun anda sahaja', type: 'Jenis', chB: 'Loceng', chP: 'Telefon', chT: 'Telegram',
      rApproval: 'Kelulusan', dApproval: 'Cuti, kerja luar, tuntutan, pendahuluan', rSd: 'Service Desk', dSd: 'Pindaan, permintaan baharu, mesej',
      rAssigned: 'Ditugaskan & sebutan (@)', dAssigned: 'Projek, tugasan, komen', rOverdue: 'Invois tertunggak', dOverdue: 'Dikumpul ×N',
      rContract: 'Kontrak & pelan', dContract: 'Tamat dalam 30/14/7 hari', rActivity: 'Aktiviti', dActivity: 'Disimpan, kehadiran (tiada lencana)',
      quiet: 'Waktu senyap', quietD: 'Telefon & Telegram ditahan · Loceng tetap mengumpul', from: 'Dari', until: 'Hingga',
      d1: 'Isn', d2: 'Sel', d3: 'Rab', d4: 'Kha', d5: 'Jum', d6: 'Sab', d7: 'Ahd', hi: 'Keutamaan tinggi tetap dihantar',
      digest: 'Ringkasan pagi', digestD: 'Buka pertama setiap pagi · Loceng', tg: 'Telegram', optional: 'Pilihan', tgLink: 'Pautkan Telegram',
      os: 'Amaran telefon memerlukan kebenaran pada peranti ini', allow: 'Benarkan', save: 'Simpan tetapan', saved: 'Tetapan pemberitahuan disimpan', local: 'Disimpan pada peranti ini sahaja' }
  };
  try { ['en', 'bm'].forEach(function (lg) { if (!LANG[lg]) return; var o = LANG[lg].notifSet = LANG[lg].notifSet || {}; Object.keys(K[lg]).forEach(function (k) { if (!(k in o)) o[k] = K[lg][k]; }); }); } catch (e) {}
  function T(k) { var lg = (window.APP && APP.language === 'bm') ? 'bm' : 'en', d = null; try { d = LANG[lg].notifSet; } catch (e) {} return (d && d[k]) || K[lg][k] || K.en[k] || k; }
  var IDS = ['approval', 'sd', 'assigned', 'overdue', 'contract', 'activity'], RK = ['Approval', 'Sd', 'Assigned', 'Overdue', 'Contract', 'Activity'];
  function rows() { return IDS.map(function (id, i) { return [id, T('r' + RK[i]), T('d' + RK[i])]; }); }
  function chans() { return [['b', 'ti-bell', T('chB')], ['p', 'ti-device-mobile', T('chP')], ['t', 'ti-brand-telegram', T('chT')]]; }
  function days() { return [1, 2, 3, 4, 5, 6, 7].map(function (n) { return [n, T('d' + n)]; }); }
  try { if (!document.getElementById('nt-setp-css')) { var st0 = document.createElement('style'); st0.id = 'nt-setp-css'; st0.textContent = '.nt-setp{padding-bottom:96px}@media(max-width:768px){body.nv-bb .nt-setp{padding-bottom:200px}}'; document.head.appendChild(st0); } } catch (e) {}
  function sw(id, on, lbl) { return '<label class="nt-sw"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(lbl) + '"><span></span></label>'; }
  NT.settingsPage = function (m) {
    var ROWS = rows(), CH = chans(), DAYS = days(), S = JSON.parse(JSON.stringify(NT.S)), me = (window.APP && APP.user && (APP.user.name || APP.user.email)) || '';
    m.innerHTML = '<div class="nt-page nt-setp"><button type="button" class="nt-back" data-back="1"><i class="ti ti-arrow-left"></i> ' + esc(T('back')) + '</button>' +
      '<h2>' + esc(T('title')) + '</h2><div class="nt-m" style="margin-bottom:12px">' + esc(T('scope') + ' · ' + me + ' · ' + ((APP.tenant && APP.tenant.name) || '')) + '</div>' +
      '<div class="nt-card nt-pad"><div class="nt-grid nt-gh"><span>' + esc(T('type')) + '</span>' + CH.map(function (c) { return '<span><i class="ti ' + c[1] + '"></i><br>' + esc(c[2]) + '</span>'; }).join('') + '</div>' +
      ROWS.map(function (r) { return '<div class="nt-grid nt-gr"><div class="nt-bd"><b>' + esc(r[1]) + '</b><div class="nt-m">' + esc(r[2]) + '</div></div>' + CH.map(function (c) { return '<div class="nt-cc">' + sw('nt-' + r[0] + '-' + c[0], S.m[r[0]][c[0]], r[1] + ' · ' + c[2]) + '</div>'; }).join('') + '</div>'; }).join('') + '</div>' +
      '<div class="nt-card nt-pad"><div class="nt-row"><i class="ti ti-moon nt-big"></i><div class="nt-bd"><b>' + esc(T('quiet')) + '</b><div class="nt-m">' + esc(T('quietD')) + '</div></div>' + sw('nt-q-on', S.q.on, T('quiet')) + '</div>' +
      '<div class="nt-2"><label><span class="form-label">' + esc(T('from')) + '</span><input type="time" class="form-input" id="nt-q-from" value="' + esc(S.q.from) + '"></label><label><span class="form-label">' + esc(T('until')) + '</span><input type="time" class="form-input" id="nt-q-to" value="' + esc(S.q.to) + '"></label></div>' +
      '<div class="nt-days">' + DAYS.map(function (d) { return '<button type="button" class="nt-day' + (S.q.days.indexOf(d[0]) >= 0 ? ' on' : '') + '" data-d="' + d[0] + '" aria-pressed="' + (S.q.days.indexOf(d[0]) >= 0) + '">' + esc(d[1]) + '</button>'; }).join('') + '</div>' +
      '<div class="nt-row" style="margin-top:10px"><i class="ti ti-alert-triangle" style="color:var(--danger)"></i><span class="nt-bd nt-m">' + esc(T('hi')) + '</span>' + sw('nt-q-hi', S.q.hi, T('hi')) + '</div></div>' +
      '<div class="nt-card nt-pad"><div class="nt-row"><i class="ti ti-sun nt-big" style="color:var(--warning)"></i><div class="nt-bd"><b>' + esc(T('digest')) + '</b><div class="nt-m">' + esc(T('digestD')) + '</div></div>' + sw('nt-dg', S.digest.on, T('digest')) + '</div></div>' +
      '<div class="nt-card nt-pad"><div class="nt-row"><i class="ti ti-brand-telegram nt-big"></i><div class="nt-bd"><b>' + esc(T('tg')) + '</b><div class="nt-m" id="tg-link-status">' + esc(T('optional')) + '</div></div><button type="button" class="btn btn-sm btn-outline" data-tg="1">' + esc(T('tgLink')) + '</button></div>' +
      '<div class="nt-row" style="margin-top:8px"><i class="ti ti-device-mobile nt-big"></i><div class="nt-bd nt-m">' + esc(T('os')) + '</div><button type="button" class="btn btn-sm btn-outline" data-os="1">' + esc(T('allow')) + '</button></div></div>' +
      '<button type="button" class="btn btn-primary nt-save" data-save="1">' + esc(T('save')) + '</button></div>';
    var q = function (s) { return m.querySelector(s); };
    m.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); }; });
    q('[data-back]').onclick = function () { window.openPage('notifikasi', {}); };
    q('[data-tg]').onclick = function () { try { _tgOpenLinkForMe(); } catch (e) {} };
    q('[data-os]').onclick = function () { try { _notifRequestOsPermission(); } catch (e) {} };
    try { setTimeout(_tgRefreshMyLinkStatus, 50); } catch (e) {}
    /* shared status text says 'klik Link Telegram' in BM; match this page's button label */
    try { var st = q('#tg-link-status'); if (st && window.MutationObserver) { var fx = function () { if (APP.language === 'bm' && /Link Telegram/.test(st.textContent)) st.textContent = st.textContent.replace(/Link Telegram/g, T('tgLink')); }; new MutationObserver(fx).observe(st, { childList: true, characterData: true, subtree: true }); } } catch (e) {}
    q('[data-save]').onclick = function () {
      var b = this; b.disabled = true;
      ROWS.forEach(function (r) { CH.forEach(function (c) { S.m[r[0]][c[0]] = q('#nt-' + r[0] + '-' + c[0]).checked ? 1 : 0; }); });
      S.q = { on: q('#nt-q-on').checked ? 1 : 0, from: q('#nt-q-from').value || '22:00', to: q('#nt-q-to').value || '07:00', hi: q('#nt-q-hi').checked ? 1 : 0, days: [].map.call(m.querySelectorAll('.nt-day.on'), function (x) { return +x.dataset.d; }) };
      S.digest.on = q('#nt-dg').checked ? 1 : 0;
      NT.saveSettings({ m: S.m, q: S.q, digest: S.digest }).then(function (ok) {
        b.disabled = false; try { showToast(ok ? T('saved') : T('local'), ok ? 'success' : 'warning'); } catch (e) {}
        if (NT.refresh) NT.refresh();
      });
    };
  };
})();
