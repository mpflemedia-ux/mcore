/* report-share.js — "Share via WhatsApp" for Reports (Income Statement, Balance Sheet,
   Trial Balance, SST, Custom Report). Same concept as Salary Disbursement's own WhatsApp
   links (sd-signatures.js share()): a server-generated, SHA-256-hashed, expiring public
   token (report_share_link_create / get_public_report RPCs — supabase/migrations/
   20261101060000_report_share_links.sql), opened via WAD.open() the same way sd-signatures
   does. No login needed to view; the public page (public-report.html) only ever reads a
   frozen snapshot captured at share time, never a live tenant query. Owner/Admin/Manager
   only (enforced in the RPC); platform-admin view-only support sessions are blocked
   server-side too. EN/BM, tokens only. v1 */
(function () {
  if (window.RPTShare) return;
  var RS = window.RPTShare = { v: 1 };
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }
  function tid() { try { return APP.tenant.id; } catch (e) { return null; } }
  function fmtDate(v) { try { return formatDate(v); } catch (e) { return String(v || '').slice(0, 10); } }

  // Extend the shared WAD label pool (wa-doc-i18n.js) the same way sd-signatures.js's
  // sdShare/sdShareD keys were added — one small key added here, not a shared-file edit.
  function addI18n() {
    var S = window.__WAD_S; if (!S || !S.en || S.en.rptShare) return;
    S.en.rptShare = 'Share report'; S.en.rptShareD = 'Read-only link via WhatsApp, expires in 7 days';
    S.bm.rptShare = 'Kongsi laporan'; S.bm.rptShareD = 'Pautan read-only melalui WhatsApp, tamat 7 hari';
  }

  var snaps = {}; // reportType -> latest snapshot object, set by index.html after each load
  RS.setSnapshot = function (type, snap) { snaps[type] = snap; };

  function msgText(lang, title, url) {
    var co = (window.APP && APP.tenant && APP.tenant.name) || 'M-Core';
    return lang === 'bm'
      ? ('Salam, berikut laporan ' + title + '.\nSemak (tiada log masuk diperlukan): ' + url + '\nPautan tamat dalam 7 hari.\n– ' + co)
      : ('Hi, here is the ' + title + '.\nView (no login needed): ' + url + '\nLink expires in 7 days.\n– ' + co);
  }
  function base() { try { return (window.WAD && WAD.base) ? WAD.base() : (location.origin + location.pathname.replace(/index\.html$/, '')); } catch (e) { return '/'; } }

  RS.share = function (type, title) {
    var W = window.WAD;
    if (!W || typeof W.open !== 'function') { toast(L('WhatsApp share is not available.', 'Kongsi WhatsApp tidak tersedia.'), 'error'); return; }
    var snap = snaps[type];
    if (!snap) { toast(L('Nothing to share yet — load the report first.', 'Tiada apa nak kongsi lagi — muatkan laporan dahulu.'), 'warning'); return; }
    addI18n();
    var cached = null;
    W.open({
      docType: 'report', docId: null, docRef: title, to: null, phone: '', recipientKind: 'other',
      k: 'rpt_share',
      tpls: [{ k: 'rpt_share', label: 'rptShare', desc: 'rptShareD' }],
      build: function (k, lang) {
        var get = cached ? Promise.resolve(cached) : Promise.resolve(
          sb.rpc('report_share_link_create', { p_report_type: type, p_title: title, p_snapshot: snap, p_days: 7 })
        ).then(function (r) { if (r.error) throw r.error; cached = r.data; return cached; });
        return get.then(function (d) {
          var th = (window.WAD && WAD.theme) ? WAD.theme() : null;
          var url = base() + 'public-report.html?rpt=' + encodeURIComponent(d.token) + (lang === 'bm' ? '&lang=bm' : '') + (th ? '&theme=' + th : '');
          return { text: msgText(lang, title, url), link_id: d.link_id, expires_at: d.expires_at };
        });
      }
    });
  };

  /* ---------- manage / revoke panel ---------- */
  RS.openManage = function (type) {
    var t = tid(); if (!t) return;
    var old = document.getElementById('rpt-share-mgr'); if (old) old.remove();
    var o = document.createElement('div'); o.className = 'modal-overlay active no-print'; o.id = 'rpt-share-mgr';
    o.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" style="max-width:480px"><div class="modal-box-header">' +
      esc(L('Shared links', 'Pautan dikongsi')) + '</div><div class="modal-box-body" id="rpt-share-mgr-body">' +
      '<div class="empty-state" style="padding:20px"><div class="spinner"></div></div></div>' +
      '<div class="modal-box-footer"><button type="button" class="btn btn-outline btn-sm" data-x>' + esc(L('Close', 'Tutup')) + '</button></div></div>';
    o.addEventListener('click', function (e) { if (e.target === o || (e.target.closest && e.target.closest('[data-x]'))) o.remove(); });
    document.body.appendChild(o);
    loadMgr(type);
  };
  function loadMgr(type) {
    var body = document.getElementById('rpt-share-mgr-body'); if (!body) return;
    var t = tid();
    Promise.resolve(sb.from('report_share_links').select('id,title,created_at,expires_at,revoked_at')
      .eq('tenant_id', t).eq('report_type', type).is('deleted_at', null).order('created_at', { ascending: false }).limit(20))
      .then(function (r) {
        var rows = (r && r.data) || [];
        if (!rows.length) { body.innerHTML = '<p style="color:var(--text-3);font-size:13px;padding:8px 0">' + esc(L('No links shared yet.', 'Belum ada pautan dikongsi.')) + '</p>'; return; }
        body.innerHTML = rows.map(function (x) {
          var now = Date.now(), exp = new Date(x.expires_at).getTime();
          var status = x.revoked_at ? L('Revoked', 'Dibatalkan') : (exp < now ? L('Expired', 'Tamat tempoh') : L('Active', 'Aktif'));
          var color = x.revoked_at ? 'var(--text-3)' : (exp < now ? 'var(--text-3)' : 'var(--success)');
          var canRevoke = !x.revoked_at && exp >= now;
          return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--border)">' +
            '<div><div style="font-size:13px">' + esc(fmtDate(x.created_at)) + ' · <span style="color:' + color + ';font-weight:600">' + esc(status) + '</span></div>' +
            '<div style="font-size:11.5px;color:var(--text-3)">' + esc(L('Expires', 'Tamat')) + ' ' + esc(fmtDate(x.expires_at)) + '</div></div>' +
            (canRevoke ? '<button type="button" class="btn btn-outline btn-sm" data-revoke="' + x.id + '">' + esc(L('Revoke', 'Batalkan')) + '</button>' : '') +
            '</div>';
        }).join('');
        [].forEach.call(body.querySelectorAll('[data-revoke]'), function (b) {
          b.onclick = function () {
            b.disabled = true;
            Promise.resolve(sb.from('report_share_links').update({ revoked_at: new Date().toISOString() }).eq('id', b.dataset.revoke).eq('tenant_id', t))
              .then(function (r) { if (r && r.error) throw r.error; toast(L('Link revoked.', 'Pautan dibatalkan.')); loadMgr(type); })
              .catch(function (e) { toast(L('Failed: ', 'Gagal: ') + (e && e.message || e), 'error'); b.disabled = false; });
          };
        });
      }, function () { body.innerHTML = '<p style="color:var(--danger);font-size:13px">' + esc(L('Could not load links.', 'Gagal muatkan pautan.')) + '</p>'; });
  }
})();
