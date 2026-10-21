/* M-Core payment attachments - UI hooks on invoice + supplier bill detail: Record Payment mobile layout, bank ref / cheque / notes / DuitNow / e-wallet, attach (camera + file), Payment History ref + proof column. Needs pay_attach_01.sql for the new fields. v1 */
(function () {
  var P = window.PAYX; if (!P || P.ui) return; P.ui = 1;
  var E = P.esc, t = P.t;
  var css = document.createElement('style'); css.id = 'payx-css';
  css.textContent = '.payx-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:end;overflow:visible!important;white-space:normal!important;min-width:0}' +
    '.payx-grid>*{min-width:0}.payx-grid .form-group{margin:0!important}.payx-grid .form-input,.payx-grid .form-select{width:100%;box-sizing:border-box;min-width:0}' +
    '.payx-span2{grid-column:span 2}.payx-full{grid-column:1/-1}.payx-save{grid-column:-2/-1;justify-self:end;min-width:120px;min-height:40px}' +
    '.payx-att{border:1px dashed var(--border-2,var(--border));border-radius:12px;padding:12px}.payx-att .payx-hint{font-size:12.5px;color:var(--text-2);margin:2px 0 10px}' +
    '.payx-btns{display:flex;gap:8px;flex-wrap:wrap}.payx-btns .btn{min-height:40px}.payx-chips{display:flex;flex-direction:column;gap:6px;margin-top:10px}.payx-chips:empty{display:none}' +
    '.payx-chip{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:10px;font-size:13px;min-width:0}.payx-chip span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.payx-chip button{border:0;background:none;color:var(--text-2);cursor:pointer;min-width:32px;min-height:32px;font-size:16px}' +
    '.payx-clip{display:inline-flex;align-items:center;gap:4px;padding:4px 8px!important;min-height:32px;white-space:nowrap}.payx-clip.payx-has{color:var(--primary);border-color:var(--primary)}' +
    '.payx-hist{min-width:0!important}.payx-hist th{color:var(--text-2)!important}.payx-sm{display:block;font-size:12px;color:var(--text-2);margin-top:2px;overflow-wrap:anywhere}.payx-act{white-space:nowrap;text-align:center}.payx-act .btn{margin:0 2px}' +
    '@media(max-width:900px){.payx-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.payx-save{grid-column:1/-1;justify-self:stretch;width:100%}}' +
    '@media(max-width:640px){#inv-pay-section,.payx-card{padding:16px!important}.payx-span2{grid-column:1/-1}}';
  document.head.appendChild(css);
  var CH = { duitnow: ['duit', 'online_banking'], ewallet: ['ewal', 'online_banking'], cheque: ['cheque', 'bank_transfer'] };
  P.chLabel = function (ch) { return CH[ch] ? t(CH[ch][0]) : ''; };
  function kindOf(dateEl) { return dateEl.id === 'bill-pay-date' ? 'bill' : 'inv'; }
  function docId(kind) {
    var b = document.querySelector(kind === 'bill' ? '[onclick^="_billPaySave("],[onclick^="_billPayVoid("]' : '[onclick^="_paySave("],[onclick^="_payVoid("]');
    var m = b && String(b.getAttribute('onclick')).match(/\('([^']+)'/); return m ? m[1] : null;
  }
  P.docId = docId;
  function field(id, label, extra, cls) {
    var d = document.createElement('div'); d.className = 'form-group payx-f' + (cls ? ' ' + cls : '');
    d.innerHTML = '<label class="form-label" for="' + id + '">' + E(label) + '</label>' + extra; return d;
  }
  /* chips of files waiting for Save */
  function chips(kind, box) {
    var l = P.pend[kind] || [];
    box.innerHTML = l.map(function (x, i) { return '<div class="payx-chip"><i class="ti ' + P.icon(P.mime(x.f)) + '"></i><span>' + E(x.f.name) + '</span><small style="color:var(--text-2)">' + P.size(x.f.size) + '</small><button type="button" aria-label="' + E(t('rm')) + '" data-i="' + i + '">&times;</button></div>'; }).join('');
    box.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { l.splice(+b.dataset.i, 1); chips(kind, box); }; });
  }
  P.icon = function (m) { m = m || ''; return /pdf/.test(m) ? 'ti-file-type-pdf' : /^image/.test(m) ? 'ti-photo' : /sheet|excel|csv/.test(m) ? 'ti-file-spreadsheet' : /word/.test(m) ? 'ti-file-text' : 'ti-file'; };
  P.size = function (n) { n = Number(n || 0); return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; };
  /* camera + file pickers; onFiles(FileList) */
  P.pickers = function (onFiles) {
    var w = document.createElement('div'); w.className = 'payx-btns';
    w.innerHTML = '<label class="btn btn-outline btn-sm"><i class="ti ti-camera"></i> ' + E(t('cam')) + '<input type="file" accept="image/*" capture="environment" hidden></label>' +
      '<label class="btn btn-outline btn-sm"><i class="ti ti-paperclip"></i> ' + E(t('file')) + '<input type="file" multiple accept="' + P.ACCEPT + '" hidden></label>';
    w.querySelectorAll('input').forEach(function (i) { i.onchange = function () { var f = Array.prototype.slice.call(i.files || []); i.value = ''; if (f.length) onFiles(f); }; });
    return w;
  }
  P.attachHooks = [];
  function form(dateEl) {
    var kind = kindOf(dateEl), grid = dateEl.closest('div[style*="grid"]'); if (!grid || grid.dataset.payx) return;
    grid.dataset.payx = '1'; grid.classList.add('payx-grid'); ['grid-template-columns', 'overflow-x', 'white-space'].forEach(function (k) { grid.style.removeProperty(k); });
    var card = grid.parentNode; if (card && card.id !== 'inv-pay-section') card.classList.add('payx-card');
    var save = grid.querySelector('button.btn-primary'); if (save) save.classList.add('payx-save');
    P.ready().then(function (ok) {
      if (!ok || !P.can(kind) || !grid.isConnected || grid.querySelector('.payx-f')) return;
      P.pend[kind] = [];
      var sel = document.getElementById(kind === 'bill' ? 'bill-pay-method' : 'pay-method');
      if (sel && !sel.querySelector('[data-ch]')) Object.keys(CH).forEach(function (k) { var o = document.createElement('option'); o.value = CH[k][1]; o.dataset.ch = k; o.textContent = t(CH[k][0]); sel.appendChild(o); });
      var ref = field('payx-' + kind + '-ref', t('ref'), '<input id="payx-' + kind + '-ref" class="form-input" maxlength="80" autocomplete="off" data-no-titlecase="1" placeholder="' + E(t('refPh')) + '">');
      var chq = field('payx-' + kind + '-chq', t('chq'), '<input id="payx-' + kind + '-chq" class="form-input" maxlength="40" autocomplete="off" data-no-titlecase="1" inputmode="numeric">'); chq.style.display = 'none';
      var notes = field('payx-' + kind + '-notes', t('notes'), '<input id="payx-' + kind + '-notes" class="form-input" maxlength="500" autocomplete="off" data-no-titlecase="1" placeholder="' + E(t('notesPh')) + '">', 'payx-span2');
      var att = document.createElement('div'); att.className = 'payx-att payx-full payx-f';
      att.innerHTML = '<div style="font-weight:600;font-size:14px"><i class="ti ti-paperclip"></i> ' + E(t('attach')) + '</div><div class="payx-hint">' + E(t('attachD')) + '</div>';
      var box = document.createElement('div'); box.className = 'payx-chips';
      att.appendChild(P.pickers(function (files) {
        P.prep(files, P.pend[kind].length).then(function (r) { if (r.errs.length) P.toast(r.errs.join(' '), 'warning'); return P.dupCheck(r.ok, null); }).then(function (ok2) { P.pend[kind] = P.pend[kind].concat(ok2); chips(kind, box); });
      }));
      att.appendChild(box);
      [ref, chq, notes, att].forEach(function (n) { grid.insertBefore(n, save || null); });
      if (save) grid.appendChild(save);
      if (sel) sel.addEventListener('change', function () { var o = sel.selectedOptions[0]; chq.style.display = o && o.dataset.ch === 'cheque' ? '' : 'none'; });
      P.attachHooks.forEach(function (fn) { try { fn(kind, att, grid); } catch (e) { console.warn('[payx]', e); } });
    });
  }
  /* Payment History: ref column (RCP no. + bank ref + notes) and proof button */
  function hist(btn) {
    var kind = /^_billPayVoid/.test(btn.getAttribute('onclick')) ? 'bill' : 'inv', table = btn.closest('table'); if (!table || table.dataset.payx) return;
    table.dataset.payx = '1'; table.classList.add('payx-hist');
    var rows = [].slice.call(table.querySelectorAll('tbody tr')).map(function (tr) {
      var b = tr.querySelector('[onclick^="_payVoid("],[onclick^="_billPayVoid("]'), a = b ? String(b.getAttribute('onclick')).match(/'([^']*)'/g).map(function (s) { return s.slice(1, -1); }) : [];
      return { tr: tr, pay: kind === 'bill' ? a[1] : a[2], doc: a[0] };
    }).filter(function (r) { return r.pay; });
    var th = table.querySelectorAll('thead th'), last = th[th.length - 1];
    if (last) { var h1 = document.createElement('th'); h1.textContent = t('refCol'); var h2 = document.createElement('th'); h2.textContent = t('proof'); h2.style.textAlign = 'center'; last.parentNode.insertBefore(h1, last); last.parentNode.insertBefore(h2, last); }
    rows.forEach(function (r) { var tds = r.tr.children, v = tds[tds.length - 1]; r.ref = document.createElement('td'); r.act = document.createElement('td'); r.act.className = 'payx-act'; r.tr.insertBefore(r.ref, v); r.tr.insertBefore(r.act, v); r.ref.textContent = '-'; });
    var ids = rows.map(function (r) { return r.pay; });
    P.ready().then(function (ok) {
      var tb = kind === 'bill' ? 'supplier_payments' : 'payments', base = kind === 'bill' ? 'id,payment_date,amount' : 'id,ref_no,payment_date,amount';
      var q = function (cols) { return Promise.resolve(sb.from(tb).select(cols).in('id', ids).eq('tenant_id', P.tid())); };
      return q(ok ? base + ',bank_ref,pay_channel,cheque_no,memo' : base).then(function (r) { return r.error && ok ? q(base) : r; }).then(function (r) {
        var m = {}; ((r && r.data) || []).forEach(function (x) { m[x.id] = x; });
        rows.forEach(function (row) {
          var p = row.p = m[row.pay] || { id: row.pay };
          var main = p.ref_no || p.bank_ref || '-', sub = [p.ref_no && p.bank_ref ? p.bank_ref : '', p.cheque_no ? t('chq') + ' ' + p.cheque_no : '', p.memo || ''].filter(Boolean).join(' · ');
          row.ref.innerHTML = '<span style="white-space:nowrap">' + E(main) + '</span>' + (sub ? '<span class="payx-sm">' + E(sub) + '</span>' : '');
          if (p.pay_channel) { var mc = row.tr.children[2]; if (mc) mc.textContent = P.chLabel(p.pay_channel); }
        });
        if (!ok || !P.can(kind)) return;
        return P.list(kind, ids).then(function (att) {
          rows.forEach(function (row) {
            var n = (att[row.pay] || []).length, b = document.createElement('button');
            b.type = 'button'; b.className = 'btn btn-outline btn-sm payx-clip' + (n ? ' payx-has' : ''); b.title = t('files'); b.setAttribute('aria-label', t('files') + ' (' + n + ')');
            b.innerHTML = '<i class="ti ti-paperclip"></i><span>' + n + '</span>';
            b.onclick = function (e) { e.stopPropagation(); P.sheet(kind, row, function (c) { b.querySelector('span').textContent = c; b.classList.toggle('payx-has', !!c); }); };
            row.act.appendChild(b);
          });
          P.histHooks.forEach(function (fn) { try { fn(kind, rows); } catch (e) { console.warn('[payx]', e); } });
        });
      });
    }).catch(function (e) { console.warn('[payx] history', e); });
  }
  P.histHooks = [];
  function scan() {
    ['pay-date', 'bill-pay-date'].forEach(function (id) { var d = document.getElementById(id); if (d) form(d); });
    var b = document.querySelector('#main [onclick^="_payVoid("],#main [onclick^="_billPayVoid("]'); if (b) hist(b);
  }
  P.scan = scan;
  var tm = 0;
  new MutationObserver(function () { if (!tm) tm = setTimeout(function () { tm = 0; scan(); }, 120); }).observe(document.body, { childList: true, subtree: true });
})();
