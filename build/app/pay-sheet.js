/* M-Core payment attachments - proof sheet per payment: list, view (signed URL), download, add (also on past / ToyyibPay payments), soft remove (uploader / owner / admin / PA; locked period = owner / PA only). v2 */
(function () {
  var P = window.PAYX; if (!P || P.sheet) return;
  var E = P.esc, t = P.t;
  var css = document.createElement('style');
  css.textContent = '.payx-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;z-index:10050}' +
    '.payx-sh{background:var(--bg-card);color:var(--text);width:100%;max-width:560px;max-height:90vh;overflow:auto;border-radius:16px 16px 0 0;padding:10px 16px calc(16px + env(safe-area-inset-bottom));border:1px solid var(--border);box-sizing:border-box}' +
    '@media(min-width:900px){.payx-bg{align-items:center}.payx-sh{max-width:480px;border-radius:16px}.payx-grab{display:none}}' +
    '.payx-grab{width:40px;height:4px;border-radius:2px;background:var(--border-2,var(--border));margin:0 auto 10px}.payx-hd{display:flex;align-items:center;justify-content:space-between;gap:10px}' +
    '.payx-ti{font-weight:700;font-size:17px;min-width:0}.payx-sub{font-size:12.5px;color:var(--text-2);margin:4px 0 12px;overflow-wrap:anywhere}' +
    '.payx-row{display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--border);min-width:0}.payx-row>i{font-size:22px;color:var(--text-2);flex:none}' +
    '.payx-nm{flex:1;min-width:0}.payx-nm b{display:block;font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.payx-nm small{display:block;color:var(--text-2);font-size:12px}' +
    '@media(max-width:640px){' +
    '.payx-hist thead{display:none}.payx-hist,.payx-hist tbody{display:block;width:100%}.payx-hist tbody tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:12px;row-gap:4px;padding:12px 14px;border-bottom:1px solid var(--border)}' +
    '.payx-hist tbody td{padding:0!important;border:0!important;min-width:0;text-align:left}.payx-hist tbody td:nth-child(2){text-align:right!important;font-weight:700}' +
    '.payx-hist tbody td:nth-child(3){font-size:13px;color:var(--text-2)}.payx-hist tbody td:nth-child(4){text-align:right!important;font-size:13px}.payx-hist tbody td:nth-child(5){text-align:left!important}.payx-hist tbody td:nth-child(6){text-align:right!important}}' +
    '.payx-ib{display:flex;gap:4px;flex:none}.payx-ib .btn{min-width:36px;min-height:36px;padding:6px 8px!important}.payx-msg{font-size:13px;color:var(--text-2);padding:14px 0;text-align:center}';
  document.head.appendChild(css);
  P.canRm = function (a, row) { if (row.ro) return false; var mine = a.uploaded_by && String(a.uploaded_by) === String(P.uid()); return (mine || P.owner()) && P.lockOk(row.p && row.p.payment_date); };
  P.viewOnly = function () { try { var s = JSON.parse(sessionStorage.getItem('mcore_support_session') || 'null'); return !!(P.isPA() && s && (s.view_only || s.viewOnly)); } catch (e) { return false; } };
  /* row = { pay, doc, p:{ref_no, amount, payment_date} } ; done(count) */
  P.sheet = function (kind, row, done) {
    var old = document.getElementById('payx-sheet'); if (old) old.remove();
    var p = row.p || {}, bg = document.createElement('div'); bg.className = 'payx-bg'; bg.id = 'payx-sheet';
    bg.innerHTML = '<div class="payx-sh" role="dialog" aria-modal="true" aria-labelledby="payx-st"><div class="payx-grab"></div><div class="payx-hd"><div class="payx-ti" id="payx-st">' + E(t('files')) + '</div>' +
      '<button type="button" class="btn btn-outline btn-sm" data-x>' + E(t('close')) + '</button></div><div class="payx-sub">' + E([p.ref_no || p.bank_ref, p.amount != null ? P.money(p.amount) : '', p.payment_date ? P.date(p.payment_date) : ''].filter(Boolean).join(' · ')) + '</div>' +
      '<div data-l><div class="payx-msg">' + E(t('load')) + '</div></div><div data-a style="margin-top:12px"></div><div data-s class="payx-sub" style="margin:8px 0 0"></div></div>';
    document.body.appendChild(bg);
    var close = function () { bg.remove(); document.removeEventListener('keydown', esc); }, esc = function (e) { if (e.key === 'Escape') close(); };
    bg.onclick = function (e) { if (e.target === bg) close(); }; bg.querySelector('[data-x]').onclick = close; document.addEventListener('keydown', esc);
    var L = bg.querySelector('[data-l]'), A = bg.querySelector('[data-a]'), St = bg.querySelector('[data-s]'), list = [];
    function draw() {
      if (done) done(list.length);
      if (!list.length) { L.innerHTML = '<div class="payx-msg">' + E(t('none')) + '</div>'; return; }
      L.innerHTML = list.map(function (a, i) {
        var src = a.source === 'customer' ? ' · ' + t('byCust') : a.source === 'gateway' ? ' · ' + t('byGw') : '';
        return '<div class="payx-row"><i class="ti ' + P.icon(a.mime_type) + '"></i><div class="payx-nm"><b title="' + E(a.file_name) + '">' + E(a.file_name) + '</b><small>' + E(P.size(a.size_bytes) + ' · ' + P.date(a.created_at) + src) + '</small></div><div class="payx-ib">' +
          '<button type="button" class="btn btn-outline btn-sm" data-v="' + i + '" title="' + E(t('view')) + '" aria-label="' + E(t('view')) + '"><i class="ti ti-eye"></i></button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-d="' + i + '" title="' + E(t('dl')) + '" aria-label="' + E(t('dl')) + '"><i class="ti ti-download"></i></button>' +
          (P.canRm(a, row) && !P.viewOnly() ? '<button type="button" class="btn btn-outline btn-sm" data-r="' + i + '" title="' + E(t('rm')) + '" aria-label="' + E(t('rm')) + '" style="color:var(--danger);border-color:var(--danger)"><i class="ti ti-trash"></i></button>' : '') + '</div></div>';
      }).join('');
      L.querySelectorAll('[data-v],[data-d]').forEach(function (b) { b.onclick = function () {
        var dl = b.hasAttribute('data-d'), a = list[+(b.dataset.v || b.dataset.d)], w = dl ? null : window.open('', '_blank');
        P.url(a, dl).then(function (u) { if (w) { w.opener = null; w.location.href = u; } else { var x = document.createElement('a'); x.href = u; x.rel = 'noopener'; x.download = a.file_name; document.body.appendChild(x); x.click(); x.remove(); } },
          function (e) { if (w) w.close(); P.toast(t('err') + ((e && e.message) || e), 'error'); });
      }; });
      L.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = function () {
        var a = list[+b.dataset.r]; if (!P.lockOk(p.payment_date)) return P.toast(t('rmLock'), 'error');
        if (!confirm(t('rmQ', { n: a.file_name }))) return;
        b.disabled = true; P.remove(a).then(function () { list.splice(list.indexOf(a), 1); draw(); P.toast(t('saved')); }, function (e) { b.disabled = false; P.toast(t('err') + ((e && e.message) || e), 'error'); });
      }; });
    }
    function load() { return P.list(kind, [row.pay]).then(function (m) { list = m[row.pay] || []; draw(); }); }
    if (!P.viewOnly() && !row.ro) A.appendChild(P.pickers(function (files) {
      P.prep(files, list.length).then(function (r) { if (r.errs.length) P.toast(r.errs.join(' '), 'warning'); return P.dupCheck(r.ok, row.pay); }).then(function (ok) {
        if (!ok.length) return;
        return P.upload(kind, row.pay, ok, kind === 'bill' ? { bill_id: row.doc } : { invoice_id: row.doc }, function (i, n) { St.textContent = t('up', { i: i, n: n }); }).then(function (r) {
          St.textContent = ''; if (r.n) P.toast(t('upOk', { n: r.n })); if (r.errs.length) P.toast(t('upErr') + r.errs.join('; '), 'error'); return load();
        });
      });
    }));
    else if (!row.ro) St.textContent = t('viewOnly');
    load();
    setTimeout(function () { var x = bg.querySelector('[data-x]'); if (x) x.focus(); }, 30);
  };
})();
