/* Settings > Public booking: booking notification toggles (pay_settings). v1 */
(function () {
  if (window.BKNOTIFSET) return;
  var P = window.PAYX, A = window.BKPAYA;
  var N = window.BKNOTIFSET = {};
  function bm() { return (P && P.bm && P.bm()) || APP.language === 'bm'; }
  function t(k) {
    var en = { title: 'Booking notifications', sub: 'Bell and phone push for public bookings', nNew: 'New booking', nRec: 'Receipt to review', nRem: 'Hold reminder', nDig: 'Morning digest', who: 'Recipients', whoO: 'Owner only', whoA: 'Owner and admin', ch: 'Sent via in-app bell and phone push.', need: 'Run booking_flow_01.sql for notification toggles.', saved: 'Saved' };
    var bmT = { title: 'Notifikasi tempahan', sub: 'Bell dan push telefon untuk tempahan awam', nNew: 'Tempahan baharu', nRec: 'Resit untuk disemak', nRem: 'Peringatan hold', nDig: 'Ringkasan pagi', who: 'Penerima', whoO: 'Pemilik sahaja', whoA: 'Pemilik dan admin', ch: 'Dihantar melalui bell aplikasi dan push telefon.', need: 'Jalankan booking_flow_01.sql untuk togol notifikasi.', saved: 'Disimpan' };
    return (bm() ? bmT : en)[k] || k;
  }
  function tid() { return P && P.tid ? P.tid() : (APP.tenant && APP.tenant.id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  N.mount = function (host) {
    if (!host || host.querySelector('#bk-n-box')) return;
    var box = el('div', '', ''); box.id = 'bk-n-box'; box.style.cssText = 'margin-top:16px;padding-top:12px;border-top:1px solid var(--border,var(--db-border,#e2e8f0))';
    box.innerHTML = '<div style="font-weight:700;margin-bottom:4px">' + t('title') + '</div><div style="font-size:12px;color:var(--text-2);margin-bottom:10px">' + t('sub') + '</div>' +
      '<label style="display:flex;align-items:center;gap:8px;min-height:40px"><input type="checkbox" id="bk-n-new"> ' + t('nNew') + '</label>' +
      '<label style="display:flex;align-items:center;gap:8px;min-height:40px"><input type="checkbox" id="bk-n-rec"> ' + t('nRec') + '</label>' +
      '<label style="display:flex;align-items:center;gap:8px;min-height:40px"><input type="checkbox" id="bk-n-rem"> ' + t('nRem') + '</label>' +
      '<label style="display:flex;align-items:center;gap:8px;min-height:40px"><input type="checkbox" id="bk-n-dig"> ' + t('nDig') + '</label>' +
      '<div style="font-size:12.5px;font-weight:600;margin:10px 0 6px">' + t('who') + '</div>' +
      '<label style="display:flex;align-items:center;gap:8px;min-height:36px"><input type="radio" name="bk-n-who" value="owner"> ' + t('whoO') + '</label>' +
      '<label style="display:flex;align-items:center;gap:8px;min-height:36px"><input type="radio" name="bk-n-who" value="owner_admin" checked> ' + t('whoA') + '</label>' +
      '<p style="font-size:12px;color:var(--text-2);margin:8px 0 0">' + t('ch') + '</p>' +
      '<button type="button" class="btn btn-primary btn-sm" id="bk-n-save" style="margin-top:10px;min-height:40px">' + t('saved').replace('Disimpan', bm() ? 'Simpan' : 'Save').replace('Saved', 'Save') + '</button>';
    /* fix save label */
    box.querySelector('#bk-n-save').textContent = bm() ? 'Simpan' : 'Save';
    host.appendChild(box);
    var g = document.getElementById('bk-n-new'), r = document.getElementById('bk-n-rec'), m = document.getElementById('bk-n-rem'), d = document.getElementById('bk-n-dig');
    sb.from('pay_settings').select('bk_n_new,bk_n_receipt,bk_n_remind,bk_n_digest,bk_n_who').eq('tenant_id', tid()).maybeSingle().then(function (q) {
      var x = q.data || {};
      if (q.error || (q.data && x.bk_n_new === undefined && x.bk_n_receipt === undefined)) {
        box.querySelector('#bk-n-save').disabled = true;
        var note = el('p', '', t('need')); note.style.cssText = 'font-size:12px;color:var(--text-2)'; box.appendChild(note);
        return;
      }
      g.checked = x.bk_n_new !== false; r.checked = x.bk_n_receipt !== false; m.checked = x.bk_n_remind !== false; d.checked = x.bk_n_digest !== false;
      var who = x.bk_n_who || 'owner_admin';
      box.querySelectorAll('[name="bk-n-who"]').forEach(function (i) { i.checked = i.value === who; });
    });
    box.querySelector('#bk-n-save').onclick = function () {
      var whoEl = box.querySelector('[name="bk-n-who"]:checked');
      var row = {
        tenant_id: tid(),
        bk_n_new: !!g.checked, bk_n_receipt: !!r.checked, bk_n_remind: !!m.checked, bk_n_digest: !!d.checked,
        bk_n_who: (whoEl && whoEl.value) || 'owner_admin',
        updated_by: (P && P.isPA && P.isPA()) ? null : (P && P.uid && P.uid()),
        updated_at: new Date().toISOString()
      };
      sb.from('pay_settings').upsert(row, { onConflict: 'tenant_id' }).then(function (u) {
        if (u.error) return (P && P.toast ? P.toast(u.error.message, 'error') : showToast(u.error.message, 'error'));
        if (P && P.toast) P.toast(t('saved')); else showToast(t('saved'), 'success');
      });
    };
  };
  function boot() {
    var host = document.getElementById('bk-pay-dep') || document.querySelector('#bk-settings-root') || document.getElementById('booking-settings');
    /* booking-pay-dep mounts into Public booking — hook after it */
    var tryHost = function () {
      var parent = document.getElementById('bk-pay-dep-root');
      if (!parent) {
        var box = document.getElementById('bkd-set');
        if (box) { var w = document.createElement('div'); w.id = 'bk-pay-dep-root'; box.parentNode.insertBefore(w, box.nextSibling); parent = w; }
      }
      if (parent) N.mount(parent);
    };
    setInterval(tryHost, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
