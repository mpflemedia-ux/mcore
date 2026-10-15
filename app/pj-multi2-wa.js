/* M-Core Projects phase 2 - WhatsApp for multiple assignees: any assignee may share (UI; RLS in pj_multi_02.sql), message lists all assignees,
   recipient step offers "All assignees (N)" which opens wa.me one by one (one tap per person, each logged as a share - browsers block multi-popups). */
(function () {
  var W = window.PJW, M = window.PJM; if (!W || !M || W._pjm2wa) return; W._pjm2wa = 1;
  var on = function () { return M.ok && M.ok2; };
  var can0 = W.canShare;
  W.canShare = function (k) { if (can0(k)) return true; if (!on() || !k) return false; var me = W.myEmp(); return !!(me && M.has(k, me.id)); };
  var b0 = W.build;
  W.build = function (o) {
    var s = b0(o); if (!on() || !o || !o.task || o.tpl === 'client') return s;
    var ls = M.list(o.task); if (ls.length < 2) return s;
    var names = ls.map(function (a) { return W.empName(a.employee_id); }).filter(Boolean).join(', ');
    return s.replace('👤 Assignee: ' + W.empName(o.task.assignee_employee_id), '👤 Assignee: ' + names);
  };
  function people(k) { return M.list(k).map(function (a) { var e = W.emps.find(function (x) { return W.same(x.id, a.employee_id); }); return e ? { id: e.id, n: e.nickname || e.name, ph: W.phone(e.phone) } : null; }).filter(Boolean); }
  var r0 = W._recHtml;
  W._recHtml = function () {
    var h = r0(), S = W.SS, k = S && S.o.task; if (!on() || !k || S.kind !== 'staff') return h;
    var ps = people(k); if (ps.length < 2) return h;
    var sel = S.rid === '__all';
    var opt = '<button type="button" class="pjw-opt' + (sel ? ' on' : '') + '" data-rid="__all"><span class="pjw-av"><i class="ti ti-users"></i></span><div><b style="font-size:13.5px">' + W.L('All assignees', 'Semua assignee') + ' (' + ps.length + ')</b><small>' + W.esc(ps.map(function (p) { return p.n; }).join(', ')) + '</small></div>' + (sel ? '<i class="ti ti-circle-check-filled" style="color:var(--primary);font-size:20px"></i>' : '') + '</button>';
    var i = h.indexOf('<div class="pjw-sec">ASSIGNEE</div>');
    return i >= 0 ? h.slice(0, i) + opt + h.slice(i) : h.replace(/(<input class="form-input" id="pjw-q"[^>]*>)/, '$1' + opt);
  };
  function msg(S) { var ta = document.getElementById('pjw-ta'); if (ta) S.text = ta.value.slice(0, 6000); return S.text != null ? S.text : W.build({ task: S.o.task, tpl: S.tpl, lang: S.lang, kind: 'staff' }); }
  function list(sh, S) {
    var k = S.o.task, ps = people(k), text = msg(S), sent = {};
    var paint = function () {
      sh.querySelector('.pjm2-one') && sh.querySelector('.pjm2-one').remove();
      var d = document.createElement('div'); d.className = 'pjm2-one';
      d.innerHTML = '<div class="pjw-sec">' + W.L('SEND ONE BY ONE', 'HANTAR SATU-SATU') + '</div>' + ps.map(function (p) { var ok = sent[p.id]; return '<div class="pjw-opt' + (ok ? ' on' : '') + '" style="cursor:default"><span class="pjw-av">' + W.esc(M.ini({ name: p.n })) + '</span><div><b style="font-size:13.5px">' + W.esc(p.n) + '</b><small>' + (p.ph ? '+' + p.ph : W.L('No phone no. – choose in WhatsApp', 'Tiada no. telefon – pilih dalam WhatsApp')) + '</small></div><button type="button" class="btn btn-sm ' + (ok ? 'btn-outline' : 'pjw-go') + '" data-one="' + W.esc(p.id) + '"><i class="ti ti-' + (ok ? 'check' : 'brand-whatsapp') + '"></i> ' + (ok ? W.L('Sent', 'Dihantar') : W.L('Open', 'Buka')) + '</button></div>'; }).join('') +
        '<div class="pjw-row"><button type="button" class="btn btn-primary" data-one-done>' + W.L('Finish', 'Selesai') + '</button></div>';
      var row = sh.querySelector('#pjw-go'); row = row && row.closest('.pjw-row'); (row || sh.lastElementChild).insertAdjacentElement('afterend', d); if (row) row.style.display = 'none';
      d.querySelectorAll('[data-one]').forEach(function (b) { b.onclick = function () {
        var p = ps.filter(function (x) { return W.same(x.id, b.dataset.one); })[0]; if (!p) return;
        W.open(W.waUrl(p.ph, text)); sent[p.id] = 1;
        W.log([{ task_id: k.id, project_id: k.project_id, template: S.tpl, lang: S.lang, recipient_kind: 'staff', recipient_id: p.id, recipient_label: String(p.n || '').slice(0, 200), phone: p.ph || null, message: text }]).then(function () { if (W.after) W.after(); }, function (e) { W.toast((e && e.message) || 'Error', 'error'); });
        paint();
      }; });
      d.querySelector('[data-one-done]').onclick = function () { W.closeSheet(); };
    };
    paint();
  }
  document.addEventListener('click', function (e) {
    var g = e.target && e.target.closest && e.target.closest('#pjw-go'), S = W.SS;
    if (!g || !S || S.rid !== '__all' || !on()) return;
    e.stopPropagation(); e.preventDefault(); list(document.getElementById('pjw-sh'), S);
  }, true);
  /* preview "To:" label for the all-assignees choice */
  new MutationObserver(function () {
    var S = W.SS, sh = document.getElementById('pjw-sh'); if (!S || S.rid !== '__all' || !sh || sh._pjm2 === sh.innerHTML.length) return;
    var b = sh.querySelector('.pjw-hd .cob-xs b'); if (b && S.o.task) b.textContent = W.L('All assignees', 'Semua assignee') + ' (' + people(S.o.task).length + ')';
    var go = sh.querySelector('#pjw-go'); if (go && !go._pjm2) { go._pjm2 = 1; go.innerHTML = '<i class="ti ti-brand-whatsapp"></i> ' + W.L('Send one by one', 'Hantar satu-satu'); }
    sh._pjm2 = sh.innerHTML.length;
  }).observe(document.body, { childList: true, subtree: true });
})();
