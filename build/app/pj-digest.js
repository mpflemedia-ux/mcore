/* M-Core Projects - daily summary switch (tenant owner/admin) at the bottom of the "Today & overdue" card: each person gets one bell / phone
   notification at 9:00 AM with their tasks due today + overdue (Edge Function pj-auto, scheduled in pj_auto_01.sql). Stored in
   push_settings.settings.pj_digest (tenant row, RLS owner/admin) - other keys in that row are kept. "Send mine now" calls pj-auto digest_me.
   Hook: wraps PJW.dailyCard (the card renders async, so the row is added once its buttons exist). */
(function () {
  var W = window.PJW; if (!W || W._pjDigest || typeof W.dailyCard !== 'function') return; W._pjDigest = 1;
  function bm() { return window.APP && APP.language === 'bm'; }
  function L(en, ms) { return bm() ? ms : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function tid() { return window.APP && APP.tenant && APP.tenant.id; }
  function toast(m, k) { if (typeof showToast === 'function') showToast(esc(m), k || 'success'); } /* showToast renders HTML */
  function isTA() { try { return typeof isTenantAdmin === 'function' && !!isTenantAdmin(); } catch (e) { return false; } }

  (function css() {
    if (document.getElementById('pjd-css')) return;
    var c = document.createElement('style'); c.id = 'pjd-css';
    c.textContent = '.pjd-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}.pjd-row label{display:flex;align-items:center;gap:10px;flex:1;min-width:200px;font-size:13px;color:var(--text);cursor:pointer;min-height:40px}' +
      '.pjd-row input[type=checkbox]{width:20px;height:20px;flex:none;accent-color:var(--primary);margin:0}.pjd-row small{display:block;color:var(--text-2);font-size:11.5px;line-height:1.35}.pjd-row .btn{min-height:40px}';
    document.head.appendChild(c);
  })();

  var cache = null;
  function load() {
    if (cache) return Promise.resolve(cache);
    return sb.from('push_settings').select('id,settings').eq('tenant_id', tid()).is('deleted_at', null).maybeSingle().then(function (r) {
      if (r.error) throw r.error; cache = r.data || null; return cache;
    });
  }
  function save(on) {
    return load().then(function (row) {
      var s = Object.assign({}, (row && row.settings) || {}), now = new Date().toISOString(), uid = APP.user && APP.user.id;
      s.pj_digest = Object.assign({ at: '09:00' }, s.pj_digest || {}, { on: on ? 1 : 0 });
      var q = row ? sb.from('push_settings').update({ settings: s, updated_by: uid, updated_at: now }).eq('id', row.id).eq('tenant_id', tid()).select('id,settings').single()
        : sb.from('push_settings').insert({ tenant_id: tid(), settings: s, updated_by: uid, updated_at: now }).select('id,settings').single();
      return q.then(function (r) { if (r.error) throw r.error; cache = r.data; return cache; });
    });
  }
  function row(el) {
    if (!el || el.querySelector('.pjd-row')) return;
    load().then(function (r) {
      if (!el.isConnected || el.querySelector('.pjd-row')) return;
      var d = (r && r.settings && r.settings.pj_digest) || {}, on = d.on === 1 || d.on === true, at = String(d.at || '09:00');
      var h = +at.slice(0, 2), m = at.slice(3, 5), time = (h % 12 || 12) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM');
      el.insertAdjacentHTML('beforeend', '<div class="pjd-row"><label><input type="checkbox" id="pjd-on"' + (on ? ' checked' : '') + '><span>' + esc(L('Daily summary at ', 'Ringkasan harian pada ') + time) +
        '<small>' + esc(L('Each person gets their own tasks due today + overdue (bell, phone or Telegram by their notification settings).', 'Setiap orang terima task sendiri yang due hari ini + lewat (loceng, telefon atau Telegram ikut tetapan notifikasi masing-masing).')) + '</small></span></label>' +
        '<button type="button" class="btn btn-sm btn-outline" id="pjd-now"><i class="ti ti-send"></i> ' + esc(L('Send mine now', 'Hantar saya sekarang')) + '</button></div>');
      var cb = el.querySelector('#pjd-on'), now = el.querySelector('#pjd-now');
      cb.onchange = function () {
        cb.disabled = true;
        save(cb.checked).then(function () { toast(cb.checked ? L('Daily summary on', 'Ringkasan harian dihidupkan') : L('Daily summary off', 'Ringkasan harian dimatikan')); })
          .catch(function (e) { cb.checked = !cb.checked; toast((e && e.message) || 'Error', 'error'); }).then(function () { cb.disabled = false; });
      };
      now.onclick = function () {
        now.disabled = true;
        sb.functions.invoke('pj-auto', { body: { action: 'digest_me' } }).then(function (res) {
          var b = res && res.data;
          if (res.error || !b || !b.ok) throw new Error((b && b.error) || (res.error && res.error.message) || 'Error');
          toast(b.sent ? L('Summary sent to your bell', 'Ringkasan dihantar ke loceng kau') : L('No tasks due today or overdue for you', 'Tiada task due hari ini atau lewat untuk kau'), b.sent ? 'success' : 'info');
        }).catch(function (e) { toast(L('Could not send: ', 'Tak dapat hantar: ') + ((e && e.message) || ''), 'error'); }).then(function () { now.disabled = false; });
      };
    }).catch(function (e) { console.warn('[pj-digest]', e); });
  }
  var orig = W.dailyCard;
  W.dailyCard = function (main, st) {
    var r = orig.apply(this, arguments);
    if (isTA() && main) {
      var n = 0, look = function () {
        var b = main.querySelector('.pjw-inj [data-dgo]'), el = b && b.closest('.pjw-inj');
        if (el) { row(el); return; }
        if (++n < 40) setTimeout(look, 150);
      };
      setTimeout(look, 50);
    }
    return r;
  };
})();
