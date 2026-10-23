/* M-Core Projects - task extras in Detail:
   (1) Repeat: none / every day / every weekday / every week / every month + optional "until" date. The next copy is created on the server
       (Edge Function pj-auto, every 15 min) after this one is Done or its due date has passed. Needs a due date. Hidden until pj_auto_01.sql runs.
   (2) Defaults: picking a due date while Reminder is "None" pre-selects "1 day before"; an empty Start becomes today. Shown in the form
       before Save, so the user can still change them.
   Saved through the existing Detail Save (PJM.patchX / PJM.pre in pj-multi-ui.js). Hook: PJM.detail wrap + window._pjAfterPaint (chained). */
(function () {
  if (window.PJX) return;
  var M = window.PJM; if (!M) return;
  var X = window.PJX = { ok: null, data: {}, key: '' };
  function bm() { return window.APP && APP.language === 'bm'; }
  function L(en, ms) { return bm() ? ms : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function tid() { return window.APP && APP.tenant && APP.tenant.id; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var RULES = [['', 'Does not repeat', 'Tidak berulang'], ['daily', 'Every day', 'Setiap hari'], ['weekdays', 'Every weekday (Mon–Fri)', 'Setiap hari bekerja (Isn–Jum)'], ['weekly', 'Every week', 'Setiap minggu'], ['monthly', 'Every month', 'Setiap bulan']];
  function ruleName(v) { var r = RULES.filter(function (x) { return x[0] === v; })[0]; return r ? L(r[1], r[2]) : ''; }

  (function css() {
    if (document.getElementById('pjx-css')) return;
    var c = document.createElement('style'); c.id = 'pjx-css';
    c.textContent = '.pjx-rep{display:inline-flex;align-items:center;gap:3px;margin:4px 0 0 4px;font-size:11px;font-weight:600;color:var(--text-2);vertical-align:middle}.pjx-rep .ti{font-size:13px}' +
      '.pjx-auto{display:block;color:var(--primary-dark,var(--primary));font-size:11px;margin-top:2px}body.dark .pjx-auto,[data-theme=dark] .pjx-auto{color:var(--primary)}';
    document.head.appendChild(c);
  })();

  X.probe = function () {
    if (X.ok != null) return Promise.resolve(X.ok);
    if (!window.sb || !tid()) return Promise.resolve(false);
    return sb.from('project_tasks').select('id,recur_rule,recur_until').limit(1).then(function (r) {
      X.ok = !r.error; if (!X.ok) console.info('[M-Core] Projects repeat hidden until SQL pj_auto_01.sql is run'); return X.ok;
    }, function () { X.ok = false; return false; });
  };
  var loading = null;
  X.ensure = function (st) {
    var ids = (st.tasks || []).map(function (k) { return k.id; }), key = tid() + '|' + ids.join(',');
    if (key === X.key && loading) return loading;
    X.key = key;
    loading = X.probe().then(function (ok) {
      if (!ok || !ids.length) { X.data = {}; return; }
      var parts = []; for (var i = 0; i < ids.length; i += 150) parts.push(ids.slice(i, i + 150));
      return Promise.all(parts.map(function (p) { return sb.from('project_tasks').select('id,recur_rule,recur_until').eq('tenant_id', tid()).in('id', p); })).then(function (rs) {
        var d = {}; rs.forEach(function (r) { (r.data || []).forEach(function (x) { d[x.id] = x; }); }); X.data = d;
      });
    }).catch(function (e) { console.warn('[pj-task-extras]', e); X.data = {}; });
    return loading;
  };

  function badge(card, k) {
    var old = card.querySelector('.pjx-rep'); if (old) old.remove();
    var x = X.data[k.id]; if (!x || !x.recur_rule) return;
    var html = '<span class="pjx-rep" title="' + esc(L('Repeats: ', 'Berulang: ') + ruleName(x.recur_rule)) + '"><i class="ti ti-repeat"></i> ' + esc(ruleName(x.recur_rule)) + '</span>';
    var a = card.querySelector('.pj-tag') || card.querySelector('.pj-card-title'); if (a) a.insertAdjacentHTML('afterend', html);
  }
  function defaults(det) {
    var due = det.querySelector('input[data-f="due_date"]'), start = det.querySelector('input[data-f="start_date"]'), rem = det.querySelector('select[data-pjm="remind"]');
    if (!due || due._pjx) return; due._pjx = 1;
    if (rem) rem.addEventListener('change', function () { rem._pjxTouched = 1; var n = det.querySelector('.pjx-auto[data-for="remind"]'); if (n) n.remove(); });
    due.addEventListener('change', function () {
      if (!due.value) return;
      if (rem && !rem._pjxTouched && String(rem.value) === '0' && rem.querySelector('option[value="1440"]')) {
        rem.value = '1440';
        if (!det.querySelector('.pjx-auto[data-for="remind"]')) rem.insertAdjacentHTML('afterend', '<small class="pjx-auto" data-for="remind">' + esc(L('Set to 1 day before (change if needed)', 'Ditetapkan 1 hari sebelum (tukar jika perlu)')) + '</small>');
      }
      if (start && !start.value) {
        var t = today(); start.value = due.value < t ? due.value : t;
        if (!det.querySelector('.pjx-auto[data-for="start"]')) start.insertAdjacentHTML('afterend', '<small class="pjx-auto" data-for="start">' + esc(L('Start set to today', 'Mula ditetapkan hari ini')) + '</small>');
      }
    });
  }
  function repeatUi(st, el, k) {
    var det = el.querySelector('details.pj-detail'); if (!det || det.querySelector('[data-pjx="recur"]')) return;
    var anchor = det.querySelector('select[data-pjm="remind"]'); anchor = anchor ? anchor.closest('label') : null;
    if (!anchor) { var d = det.querySelector('input[data-f="due_date"]'); anchor = d && d.closest('label'); }
    if (!anchor) return;
    anchor.insertAdjacentHTML('afterend', '<label class="pjx-recur" hidden>' + esc(L('Repeat', 'Ulang')) + '<select data-pjx="recur">' + RULES.map(function (r) { return '<option value="' + r[0] + '">' + esc(L(r[1], r[2])) + '</option>'; }).join('') + '</select>' +
      '<small class="pjm-hint">' + esc(L('The next copy is created automatically after this task is Done or its due date passes. Needs a due date.', 'Salinan seterusnya dicipta automatik selepas task ini Siap atau tarikh due berlalu. Perlu tarikh due.')) + '</small></label>' +
      '<label class="pjx-until" hidden>' + esc(L('Repeat until (optional)', 'Ulang sehingga (pilihan)')) + '<input type="date" data-pjx="until"></label>');
    var lab = det.querySelector('.pjx-recur'), ul = det.querySelector('.pjx-until'), sel = det.querySelector('[data-pjx="recur"]'), until = det.querySelector('[data-pjx="until"]');
    var showUntil = function () { ul.hidden = !sel.value; };
    sel.onchange = showUntil;
    X.ensure(st).then(function () {
      if (!X.ok || !sel.isConnected) return;
      var x = X.data[k.id] || {};
      sel.value = x.recur_rule || ''; until.value = x.recur_until ? String(x.recur_until).slice(0, 10) : '';
      sel.setAttribute('data-ready', '1'); lab.hidden = false; showUntil();
    });
  }
  /* PJM.detail runs for each card after the multi-assignee data is loaded (Reminder select exists by then) */
  if (typeof M.detail === 'function' && !M.detail._pjx) {
    var od = M.detail;
    M.detail = function (st, el, k) {
      var r = od.apply(this, arguments);
      try { var det = el.querySelector('details.pj-detail'); if (det) { repeatUi(st, el, k); defaults(det); } } catch (e) { console.warn('[pj-task-extras]', e); }
      return r;
    };
    M.detail._pjx = 1;
  }
  M.patchX = M.patchX || []; M.pre = M.pre || [];
  M.patchX.push(function (det, k) {
    var sel = det.querySelector('[data-pjx="recur"]'); if (!X.ok || !sel || sel.getAttribute('data-ready') !== '1') return null;
    var rule = sel.value || null, until = (det.querySelector('[data-pjx="until"]') || {}).value || null, was = (X.data[k.id] || {}).recur_rule || null;
    var p = { recur_rule: rule, recur_until: rule ? until : null };
    if (rule !== was) p.recur_spawned_at = null;
    return p;
  });
  M.pre.push(function (st, det) {
    var sel = det.querySelector('[data-pjx="recur"]'); if (!X.ok || !sel || sel.getAttribute('data-ready') !== '1' || !sel.value) return true;
    var due = (det.querySelector('input[data-f="due_date"]') || {}).value || '', until = (det.querySelector('[data-pjx="until"]') || {}).value || '';
    if (!due) { if (typeof showToast === 'function') showToast(L('Set a due date for a repeating task.', 'Isi tarikh due untuk task berulang.'), 'error'); return false; }
    if (until && until < due) { if (typeof showToast === 'function') showToast(L('"Repeat until" must be on or after the due date.', '"Ulang sehingga" mesti pada atau selepas tarikh due.'), 'error'); return false; }
    return true;
  });
  var prev = window._pjAfterPaint;
  window._pjAfterPaint = function (st) {
    var r; try { r = typeof prev === 'function' ? prev(st) : null; } catch (e) { console.error(e); }
    X.key = ''; /* every paint re-reads (a Save just changed the values); the Detail rows of this paint share this one read */
    X.ensure(st).then(function () {
      if (!X.ok) return;
      var main = document.getElementById('main'); if (!main || !main.querySelector('.pj-wrap')) return;
      var by = {}; (st.tasks || []).forEach(function (k) { by[k.id] = k; });
      main.querySelectorAll('.pj-card[data-id]').forEach(function (card) { var k = by[card.getAttribute('data-id')]; if (k) badge(card, k); });
    });
    return r;
  };
})();
