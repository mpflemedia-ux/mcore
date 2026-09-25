(function () {
  function isBm() { return typeof APP !== 'undefined' && APP.language === 'bm'; }
  function setMode(id) {
    window._annEditId = id || null;
    var btn = document.querySelector('button[onclick="doCreateAnnouncement()"]');
    if (!btn) return;
    if (id) {
      btn.innerHTML = '<i class="ti ti-device-floppy"></i> ' + (isBm() ? 'Simpan pindaan' : 'Save changes');
      if (!document.getElementById('ann-cancel-edit')) {
        var c = document.createElement('button');
        c.type = 'button';
        c.id = 'ann-cancel-edit';
        c.className = 'btn btn-outline';
        c.style.marginLeft = '8px';
        c.textContent = isBm() ? 'Batal' : 'Cancel';
        c.onclick = function () { window._annCancelEdit(); };
        btn.parentNode.insertBefore(c, btn.nextSibling);
      }
    } else {
      btn.innerHTML = '<i class="ti ti-speakerphone"></i> ' + (isBm() ? 'Siarkan Pengumuman' : 'Broadcast Announcement');
      var x = document.getElementById('ann-cancel-edit');
      if (x) x.remove();
    }
  }
  window._annCancelEdit = function () {
    window._annEditId = null;
    var en = document.getElementById('ann-msg-en');
    var bm = document.getElementById('ann-msg-bm');
    if (en) en.value = '';
    if (bm) bm.value = '';
    setMode(null);
  };
  window._annEdit = function (id) {
    var row = (window._adminAnnRows || []).find(function (a) { return a.id === id; });
    if (!row) return;
    var en = document.getElementById('ann-msg-en');
    var bmEl = document.getElementById('ann-msg-bm');
    var sev = document.getElementById('ann-severity');
    if (en) en.value = row.message_en || '';
    if (bmEl) bmEl.value = row.message_bm || '';
    if (sev) sev.value = row.severity || 'info';
    setMode(id);
    try { en && en.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  };
  window._annDelete = async function (id) {
    if (typeof isPlatformAdmin === 'function' && !isPlatformAdmin()) return;
    var row = (window._adminAnnRows || []).find(function (a) { return a.id === id; }) || {};
    var label = (isBm() ? row.message_bm : row.message_en) || id;
    if (!confirm(isBm() ? ('Padam pengumuman ini?\n' + label) : ('Delete this announcement?\n' + label))) return;
    var del = await sb.from('platform_announcements').delete().eq('id', id);
    if (del.error) {
      var off = await sb.from('platform_announcements').update({ is_active: false }).eq('id', id);
      if (off.error) { showToast(del.error.message || off.error.message, 'error'); return; }
      showToast(isBm() ? 'Dinyahaktif (RLS block delete)' : 'Deactivated (delete blocked by RLS)', 'warning');
    } else {
      showToast(isBm() ? 'Pengumuman dipadam' : 'Announcement deleted', 'success');
    }
    if (window._annEditId === id) window._annCancelEdit();
    if (typeof _loadAdminAnnouncementsHistory === 'function') _loadAdminAnnouncementsHistory();
    if (typeof _loadBroadcastAnnouncements === 'function') _loadBroadcastAnnouncements();
  };
  function wrapCreate() {
    var orig = window.doCreateAnnouncement;
    if (typeof orig !== 'function' || orig._annEdit) return;
    var w = async function () {
      var editId = window._annEditId;
      if (!editId) return orig.apply(this, arguments);
      var msgEn = (document.getElementById('ann-msg-en') && document.getElementById('ann-msg-en').value || '').trim();
      var msgBm = (document.getElementById('ann-msg-bm') && document.getElementById('ann-msg-bm').value || '').trim();
      var severity = (document.getElementById('ann-severity') && document.getElementById('ann-severity').value) || 'info';
      if (!msgEn || !msgBm) {
        showToast(isBm() ? 'Kedua-dua mesej EN dan BM diperlukan.' : 'Both EN and BM message are required.', 'error');
        return;
      }
      var r = await sb.from('platform_announcements').update({
        message_en: msgEn, message_bm: msgBm, severity: severity
      }).eq('id', editId);
      if (r.error) { showToast(r.error.message, 'error'); return; }
      showToast(isBm() ? 'Pengumuman dikemaskini' : 'Announcement updated', 'success');
      window._annCancelEdit();
      if (typeof _loadAdminAnnouncementsHistory === 'function') _loadAdminAnnouncementsHistory();
      if (typeof _loadBroadcastAnnouncements === 'function') _loadBroadcastAnnouncements();
    };
    w._annEdit = true;
    window.doCreateAnnouncement = w;
  }
  function decorate() {
    var wrap = document.getElementById('admin-ann-wrap');
    if (!wrap) return;
    var table = wrap.querySelector('table');
    if (!table) return;
    if (table.dataset.annActions) return;
    var head = table.querySelector('thead tr');
    if (head && !head.querySelector('.ann-act-th')) {
      var th = document.createElement('th');
      th.className = 'ann-act-th';
      th.textContent = isBm() ? 'Tindakan' : 'Actions';
      head.appendChild(th);
    }
    var rows = wrap.querySelectorAll('tbody tr');
    var data = window._adminAnnRows || [];
    rows.forEach(function (tr, i) {
      if (tr.querySelector('.ann-act')) return;
      var a = data[i];
      if (!a) return;
      var td = document.createElement('td');
      td.className = 'ann-act';
      td.style.whiteSpace = 'nowrap';
      td.onclick = function (e) { e.stopPropagation(); };
      td.innerHTML =
        '<button type="button" class="btn btn-sm btn-outline" onclick="window._annEdit(\'' + a.id + '\')"><i class="ti ti-pencil"></i> ' + (isBm() ? 'Pinda' : 'Edit') + '</button> ' +
        '<button type="button" class="btn btn-sm btn-outline" style="color:var(--danger);border-color:var(--danger)" onclick="window._annDelete(\'' + a.id + '\')"><i class="ti ti-trash"></i> ' + (isBm() ? 'Padam' : 'Delete') + '</button>';
      tr.appendChild(td);
    });
    table.dataset.annActions = '1';
  }
  function wrapHistory() {
    var orig = window._loadAdminAnnouncementsHistory;
    if (typeof orig !== 'function' || orig._annEdit) return;
    var w = async function () {
      var ret = orig.apply(this, arguments);
      var after = async function () {
        try {
          var r = await sb.from('platform_announcements')
            .select('id,message_en,message_bm,severity,created_at,is_active')
            .order('created_at', { ascending: false })
            .limit(100);
          window._adminAnnRows = r.data || [];
        } catch (e) { window._adminAnnRows = window._adminAnnRows || []; }
        decorate();
      };
      if (ret && typeof ret.then === 'function') return ret.then(function (v) { return after().then(function () { return v; }); });
      await after();
      return ret;
    };
    w._annEdit = true;
    window._loadAdminAnnouncementsHistory = w;
  }
  function boot() {
    wrapCreate();
    wrapHistory();
    decorate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 400);
  setInterval(function () {
    if (document.getElementById('admin-ann-wrap')) decorate();
  }, 1200);
})();
