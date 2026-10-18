/* M-Core Projects - Share public report (admin) core: toolbar button (whole project), modal to
   generate/regenerate/revoke a no-login report link (QR + copy), view count/last viewed, messages
   left by viewers. Optional task scope (task_id) and the per-task share icon live in
   pj-share-tasks.js; WhatsApp share lives in pj-share-wa.js (both extend via window.PJS).
   Hook: projects.js paint() -> window._pjAfterPaint(state) (same chain as pj-wa-board.js etc). */
(function () {
  if (window._pjShare) return; window._pjShare = 1;
  function bm() { return window.APP && APP.language === 'bm'; }
  function t(en, ms) { return bm() ? ms : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c]; }); }
  function can() { return (typeof isTenantAdmin === 'function' && isTenantAdmin()) || (typeof isPlatformAdmin === 'function' && isPlatformAdmin()); }
  function rndTok(n) { var a = new Uint8Array(n), c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return c[x % c.length]; }).join(''); }
  function sha256hex(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }); }
  function shareUrl(tok) { return location.origin + location.pathname + '?pj_report=' + encodeURIComponent(tok); }
  function dmy(d) { var p = String(d || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—'; }
  function dtFull(d) { if (!d) return ''; try { return new Date(d).toLocaleString(bm() ? 'ms-MY' : 'en-MY', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return String(d).slice(0, 16); } }
  function defExpiry() { return new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10); }

  var QRLIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
  function loadQr() { return window.qrcode ? Promise.resolve() : new Promise(function (ok, no) { var s = document.createElement('script'); s.src = QRLIB; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  function drawQr(url) {
    return loadQr().then(function () {
      var q = window.qrcode(0, 'M'); q.addData(url); q.make();
      var n = q.getModuleCount(), px = 5, pad = 4, c = document.createElement('canvas'); c.width = c.height = (n + pad * 2) * px;
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#0F172A';
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect((x + pad) * px, (y + pad) * px, px, px);
      c.style.cssText = 'width:150px;height:150px;border-radius:8px;image-rendering:pixelated'; return c;
    });
  }

  function closeModal() { var m = document.getElementById('pjs-modal'); if (m) m.remove(); }

  function loadLink(projectId, taskId) {
    var q = sb.from('project_share_links').select('*').eq('project_id', projectId).is('revoked_at', null).is('deleted_at', null);
    q = taskId ? q.eq('task_id', taskId) : q.is('task_id', null);
    return q.order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function loadMessages(linkId) {
    if (!linkId) return Promise.resolve([]);
    return sb.from('project_share_messages').select('body,created_at').eq('link_id', linkId).is('deleted_at', null).order('created_at', { ascending: false }).limit(20)
      .then(function (r) { return r.error ? [] : (r.data || []); });
  }
  function paintModal(proj, task, link, messages) {
    var m = document.getElementById('pjs-modal');
    var url = link ? shareUrl(link._tok || '') : '';
    var title = task ? (t('Share task report', 'Kongsi laporan task') + ' — ' + task.title) : (t('Share public report', 'Kongsi laporan awam') + ' — ' + proj.name);
    var body = '<div class="row" style="justify-content:space-between;margin-bottom:10px"><b style="font-size:15px;word-break:break-word;flex:1">' + esc(title) + '</b><button type="button" class="btn btn-sm btn-outline" id="pjs-x"><i class="ti ti-x"></i></button></div>' +
      '<div class="cob-xs" style="margin-bottom:12px">' + esc(t('View-only link, no login. Viewer can leave a message; nothing else can be changed from the link.', 'Link paparan sahaja, tiada log masuk. Pelawat boleh tinggal mesej; tiada apa lain boleh diubah dari link.')) + '</div>' +
      (link ? (
        '<div class="cob-card" style="padding:12px;margin-bottom:10px">' +
        '<div class="form-group" style="margin-bottom:10px"><label class="form-label">' + esc(t('Link', 'Link')) + '</label><div class="row" style="gap:8px"><input class="form-input" id="pjs-url" readonly value="' + (link._tok ? esc(url) : esc(t('(regenerate to get a fresh link)', '(jana semula untuk dapat link baharu)'))) + '"><button type="button" class="btn btn-outline" id="pjs-copy"' + (link._tok ? '' : ' disabled') + '><i class="ti ti-copy"></i></button></div></div>' +
        (link._tok ? '<div id="pjs-wa-slot"></div>' : '') +
        (link._tok ? '<div id="pjs-qr" style="width:150px;height:150px;border-radius:8px;background:#fff;margin-bottom:10px"></div>' : '') +
        '<div class="cob-sm" style="margin-bottom:4px">' + esc(t('Expires', 'Tamat tempoh')) + ': <b>' + esc(dmy(link.expires_on)) + '</b></div>' +
        '<div class="cob-xs" style="margin-bottom:10px">' + esc(t('Views', 'Paparan')) + ': ' + (link.view_count || 0) + (link.viewed_at ? ' · ' + esc(t('Last viewed', 'Terakhir dilihat')) + ': ' + esc(dtFull(link.viewed_at)) : ' · ' + esc(t('Not viewed yet', 'Belum dilihat'))) + '</div>' +
        '<div class="form-group" style="margin-bottom:10px"><label class="form-label">' + esc(t('New expiry (regenerate)', 'Tamat tempoh baharu (jana semula)')) + '</label><input type="date" class="form-input" id="pjs-exp" value="' + esc(defExpiry()) + '"></div>' +
        '<div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-outline" id="pjs-regen"><i class="ti ti-refresh"></i> ' + esc(t('Regenerate', 'Jana semula')) + '</button><button type="button" class="btn btn-outline" id="pjs-revoke" style="color:var(--danger);border-color:var(--danger)"><i class="ti ti-link-off"></i> ' + esc(t('Revoke', 'Tarik balik')) + '</button></div>' +
        '</div>'
      ) : (
        '<div class="cob-card" style="padding:12px;margin-bottom:10px"><div class="cob-xs" style="margin-bottom:10px">' + esc(t('No active link yet.', 'Belum ada link aktif.')) + '</div>' +
        '<div class="form-group" style="margin-bottom:10px"><label class="form-label">' + esc(t('Expires', 'Tamat tempoh')) + '</label><input type="date" class="form-input" id="pjs-exp" value="' + esc(defExpiry()) + '"></div>' +
        '<button type="button" class="btn btn-primary" id="pjs-gen" style="width:100%;justify-content:center"><i class="ti ti-link"></i> ' + esc(t('Generate link', 'Jana link')) + '</button></div>'
      )) +
      '<b style="font-size:13px">' + esc(t('Messages', 'Mesej')) + ' (' + messages.length + ')</b>' +
      (messages.length ? '<div style="margin-top:6px;max-height:220px;overflow-y:auto">' + messages.map(function (msg) {
        return '<div style="padding:8px 0;border-bottom:1px solid var(--border)"><div style="font-size:13px;white-space:pre-wrap;word-break:break-word">' + esc(msg.body) + '</div><div class="cob-xs" style="margin-top:2px">' + esc(dtFull(msg.created_at)) + '</div></div>';
      }).join('') + '</div>' : '<div class="cob-xs" style="padding:8px 0">' + esc(t('No messages yet.', 'Belum ada mesej.')) + '</div>');
    m.querySelector('.cob-mbody').innerHTML = body;
    m.querySelector('#pjs-x').onclick = closeModal;
    var copyBtn = m.querySelector('#pjs-copy'); if (copyBtn && link && link._tok) copyBtn.onclick = function () { try { navigator.clipboard.writeText(url); if (typeof showToast === 'function') showToast(t('Link copied', 'Link disalin'), 'success'); } catch (e) {} };
    if (window.PJS && PJS.fillWaSlot) { try { PJS.fillWaSlot(m, proj, task, url); } catch (e) {} }
    if (link && link._tok) { var qrBox = m.querySelector('#pjs-qr'); if (qrBox) drawQr(url).then(function (cv) { qrBox.innerHTML = ''; qrBox.appendChild(cv); }); }
    var gen = m.querySelector('#pjs-gen'); if (gen) gen.onclick = function () { gen.disabled = true; doGenerate(proj, task, null, m.querySelector('#pjs-exp').value).catch(function (e) { gen.disabled = false; if (typeof showToast === 'function') showToast(e.message || String(e), 'error'); }); };
    var regen = m.querySelector('#pjs-regen'); if (regen) regen.onclick = function () { regen.disabled = true; doGenerate(proj, task, link, m.querySelector('#pjs-exp').value).catch(function (e) { regen.disabled = false; if (typeof showToast === 'function') showToast(e.message || String(e), 'error'); }); };
    var revoke = m.querySelector('#pjs-revoke'); if (revoke) revoke.onclick = function () {
      if (!window.confirm(t('Revoke this link? It stops working immediately.', 'Tarik balik link ini? Ia berhenti berfungsi serta-merta.'))) return;
      revoke.disabled = true;
      sb.from('project_share_links').update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', link.id).then(function (x) {
        if (x.error) throw x.error;
        if (typeof showToast === 'function') showToast(t('Link revoked', 'Link ditarik balik'), 'success');
        return refresh(proj, task);
      }).catch(function (e) { revoke.disabled = false; if (typeof showToast === 'function') showToast(e.message || String(e), 'error'); });
    };
  }

  function doGenerate(proj, task, existingLink, expiresOn) {
    var tok = rndTok(28);
    return sha256hex(tok).then(function (h) {
      var now = new Date().toISOString();
      var p = existingLink
        ? sb.from('project_share_links').update({ token_hash: h, expires_on: expiresOn || defExpiry(), view_count: 0, viewed_at: null, updated_at: now }).eq('id', existingLink.id)
        : sb.from('project_share_links').insert({ tenant_id: window.APP && APP.tenant && APP.tenant.id, project_id: proj.id, task_id: task ? task.id : null, token_hash: h, expires_on: expiresOn || defExpiry() });
      return p.then(function (x) {
        if (x.error) throw x.error;
        if (typeof showToast === 'function') showToast(t('Link ready — copy it below', 'Link sedia — salin di bawah'), 'success');
        return refresh(proj, task, tok);
      });
    });
  }

  function refresh(proj, task, freshTok) {
    return loadLink(proj.id, task ? task.id : null).then(function (link) {
      if (link && freshTok) link._tok = freshTok;
      return loadMessages(link ? link.id : null).then(function (msgs) {
        paintModal(proj, task, link, msgs);
      });
    });
  }

  function openModal(proj, task) {
    closeModal();
    var m = document.createElement('div'); m.id = 'pjs-modal'; m.className = 'cob-modal';
    m.innerHTML = '<div class="cob-card cob-mbox"><div class="cob-mbody"><div class="page-loading"><div class="spinner"></div></div></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });
    refresh(proj, task).catch(function (e) { closeModal(); if (typeof showToast === 'function') showToast(e.message || String(e), 'error'); });
  }

  function decorate(st) {
    var main = document.getElementById('main'); if (!main) return;
    if (!can()) return;
    var box = main.querySelector('.pj-tools');
    if (box && st.projectId && st.projectId !== '__all__' && !box.querySelector('#pjs-open')) {
      var proj = (st.projects || []).find(function (p) { return String(p.id) === String(st.projectId); });
      if (proj) {
        box.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-sm btn-outline" id="pjs-open"><i class="ti ti-share"></i> ' + esc(t('Share report', 'Kongsi laporan')) + '</button>');
        box.querySelector('#pjs-open').onclick = function () { openModal(proj, null); };
      }
    }
  }

  window.PJS = window.PJS || {};
  PJS.openModal = openModal;
  PJS.can = can;
  PJS.t = t; PJS.esc = esc; PJS.dmy = dmy;

  function hook() {
    var prev = window._pjAfterPaint; if (prev && prev._pjs) return;
    var fn = function (st) {
      var r; try { r = typeof prev === 'function' ? prev(st) : null; } catch (e) { console.warn('pjs', e); }
      return Promise.resolve(r).then(function () { try { decorate(st); } catch (e) { console.warn('pjs', e); } });
    };
    fn._pjm = prev && prev._pjm; fn._pjm2 = prev && prev._pjm2; fn._pja = prev && prev._pja; fn._pjs = 1;
    window._pjAfterPaint = fn;
  }
  hook(); document.addEventListener('DOMContentLoaded', hook);
})();
