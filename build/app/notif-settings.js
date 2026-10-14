/* M-Core bell v2 — per-user settings: type x channel (Bell/Phone/Telegram), quiet hours, morning digest. */
(function () {
  var NT = window.NT; if (!NT) return;
  var L = NT.L, esc = NT.esc;
  var ROWS = [['approval', L('Approvals', 'Kelulusan'), L('Leave, outstation, claims, advances', 'Leave, outstation, tuntutan, pendahuluan')], ['sd', 'Service Desk', L('Revisions, new requests, messages', 'Pindaan, permintaan baharu, mesej')], ['assigned', L('Assigned & @mention', 'Ditugaskan & @mention'), L('Projects, tasks, comments', 'Projek, task, komen')], ['overdue', L('Overdue invoices', 'Invois overdue'), L('Grouped ×N', 'Dikumpul ×N')], ['contract', L('Contracts & plan', 'Kontrak & langganan'), L('Ends in 30/14/7 days', 'Tamat dalam 30/14/7 hari')], ['activity', L('Activity', 'Aktiviti'), L('Saved, attendance (no badge)', 'Disimpan, kehadiran (tiada badge)')]];
  var CH = [['b', 'ti-bell', 'Bell'], ['p', 'ti-device-mobile', L('Phone', 'Phone')], ['t', 'ti-brand-telegram', 'Telegram']];
  var DAYS = [[1, L('Mon', 'Isn')], [2, L('Tue', 'Sel')], [3, L('Wed', 'Rab')], [4, L('Thu', 'Kha')], [5, L('Fri', 'Jum')], [6, L('Sat', 'Sab')], [7, L('Sun', 'Ahd')]];
  function sw(id, on, lbl) { return '<label class="nt-sw"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(lbl) + '"><span></span></label>'; }
  NT.settingsPage = function (m) {
    var S = JSON.parse(JSON.stringify(NT.S)), me = (window.APP && APP.user && (APP.user.name || APP.user.email)) || '';
    m.innerHTML = '<div class="nt-page"><button type="button" class="nt-back" data-back="1"><i class="ti ti-arrow-left"></i> ' + esc(L('Notifications', 'Pemberitahuan')) + '</button>' +
      '<h2>' + esc(L('Notification settings', 'Settings pemberitahuan')) + '</h2><div class="nt-m" style="margin-bottom:12px">' + esc(L('For your account only · ', 'Untuk akaun kau sahaja · ') + me + ' · ' + ((APP.tenant && APP.tenant.name) || '')) + '</div>' +
      '<div class="nt-card nt-pad"><div class="nt-grid nt-gh"><span>' + esc(L('TYPE', 'JENIS')) + '</span>' + CH.map(function (c) { return '<span><i class="ti ' + c[1] + '"></i><br>' + esc(c[2]) + '</span>'; }).join('') + '</div>' +
      ROWS.map(function (r) { return '<div class="nt-grid nt-gr"><div class="nt-bd"><b>' + esc(r[1]) + '</b><div class="nt-m">' + esc(r[2]) + '</div></div>' + CH.map(function (c) { return '<div class="nt-cc">' + sw('nt-' + r[0] + '-' + c[0], S.m[r[0]][c[0]], r[1] + ' · ' + c[2]) + '</div>'; }).join('') + '</div>'; }).join('') + '</div>' +
      '<div class="nt-card nt-pad"><div class="nt-row"><i class="ti ti-moon nt-big"></i><div class="nt-bd"><b>' + esc(L('Quiet hours', 'Waktu senyap')) + '</b><div class="nt-m">' + esc(L('Phone & Telegram held · Bell still collects', 'Phone & Telegram ditahan · Bell tetap kumpul')) + '</div></div>' + sw('nt-q-on', S.q.on, L('Quiet hours', 'Waktu senyap')) + '</div>' +
      '<div class="nt-2"><label><span class="form-label">' + esc(L('From', 'Dari')) + '</span><input type="time" class="form-input" id="nt-q-from" value="' + esc(S.q.from) + '"></label><label><span class="form-label">' + esc(L('Until', 'Hingga')) + '</span><input type="time" class="form-input" id="nt-q-to" value="' + esc(S.q.to) + '"></label></div>' +
      '<div class="nt-days">' + DAYS.map(function (d) { return '<button type="button" class="nt-day' + (S.q.days.indexOf(d[0]) >= 0 ? ' on' : '') + '" data-d="' + d[0] + '" aria-pressed="' + (S.q.days.indexOf(d[0]) >= 0) + '">' + esc(d[1]) + '</button>'; }).join('') + '</div>' +
      '<div class="nt-row" style="margin-top:10px"><i class="ti ti-alert-triangle" style="color:var(--danger)"></i><span class="nt-bd nt-m">' + esc(L('High priority still delivered', 'Keutamaan tinggi tetap dihantar')) + '</span>' + sw('nt-q-hi', S.q.hi, L('High priority still delivered', 'Keutamaan tinggi tetap dihantar')) + '</div></div>' +
      '<div class="nt-card nt-pad"><div class="nt-row"><i class="ti ti-sun nt-big" style="color:var(--warning)"></i><div class="nt-bd"><b>' + esc(L('Morning summary', 'Ringkasan pagi')) + '</b><div class="nt-m">' + esc(L('First open each morning · Bell', 'Buka pertama setiap pagi · Bell')) + '</div></div>' + sw('nt-dg', S.digest.on, L('Morning summary', 'Ringkasan pagi')) + '</div></div>' +
      '<div class="nt-card nt-pad"><div class="nt-row"><i class="ti ti-brand-telegram nt-big"></i><div class="nt-bd"><b>Telegram</b><div class="nt-m" id="tg-link-status">' + esc(L('Optional', 'Pilihan')) + '</div></div><button type="button" class="btn btn-sm btn-outline" data-tg="1">' + esc(L('Link Telegram', 'Pautkan Telegram')) + '</button></div>' +
      '<div class="nt-row" style="margin-top:8px"><i class="ti ti-device-mobile nt-big"></i><div class="nt-bd nt-m">' + esc(L('Phone alerts need permission on this device', 'Amaran phone perlukan kebenaran pada peranti ini')) + '</div><button type="button" class="btn btn-sm btn-outline" data-os="1">' + esc(L('Allow', 'Benarkan')) + '</button></div></div>' +
      '<button type="button" class="btn btn-primary nt-save" data-save="1">' + esc(L('Save settings', 'Simpan settings')) + '</button></div>';
    var q = function (s) { return m.querySelector(s); };
    m.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); }; });
    q('[data-back]').onclick = function () { window.openPage('notifikasi', {}); };
    q('[data-tg]').onclick = function () { try { _tgOpenLinkForMe(); } catch (e) {} };
    q('[data-os]').onclick = function () { try { _notifRequestOsPermission(); } catch (e) {} };
    try { setTimeout(_tgRefreshMyLinkStatus, 50); } catch (e) {}
    q('[data-save]').onclick = function () {
      var b = this; b.disabled = true;
      ROWS.forEach(function (r) { CH.forEach(function (c) { S.m[r[0]][c[0]] = q('#nt-' + r[0] + '-' + c[0]).checked ? 1 : 0; }); });
      S.q = { on: q('#nt-q-on').checked ? 1 : 0, from: q('#nt-q-from').value || '22:00', to: q('#nt-q-to').value || '07:00', hi: q('#nt-q-hi').checked ? 1 : 0, days: [].map.call(m.querySelectorAll('.nt-day.on'), function (x) { return +x.dataset.d; }) };
      S.digest.on = q('#nt-dg').checked ? 1 : 0;
      NT.saveSettings({ m: S.m, q: S.q, digest: S.digest }).then(function (ok) {
        b.disabled = false; try { showToast(ok ? L('Notification settings saved', 'Tetapan pemberitahuan disimpan') : L('Saved on this device only', 'Disimpan pada peranti ini sahaja'), ok ? 'success' : 'warning'); } catch (e) {}
        if (NT.refresh) NT.refresh();
      });
    };
  };
})();
