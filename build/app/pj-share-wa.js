/* M-Core Projects - Share public report via WhatsApp: extends pj-share-core.js's modal with a
   "Share via WhatsApp" button in the #pjs-wa-slot placeholder (window.PJS.fillWaSlot). For a task
   link, auto-fills the assignee's phone (employees.phone) when set - wa.me/<phone>?text=...; falls
   back to wa.me/?text=... (admin picks the contact inside WhatsApp) for a project link or an
   unassigned/phoneless task. */
(function () {
  if (window._pjShareWa || !window.PJS) return; window._pjShareWa = 1;
  var t = PJS.t, esc = PJS.esc, dmy = PJS.dmy;
  /* same normalisation as PJW.phone in pj-wa-core.js, duplicated on purpose (small, self-contained) */
  function normPhone(p) { var d = String(p || '').replace(/\D/g, ''); if (!d) return ''; if (d.charAt(0) === '0') d = '6' + d; return d.length >= 8 && d.length <= 15 ? d : ''; }
  function waUrl(phone, text) { return 'https://wa.me/' + (phone || '') + '?text=' + encodeURIComponent(text); }
  function waText(proj, task, url) {
    if (task) {
      var due = task.due_date ? dmy(task.due_date) : t('no due date', 'tiada tarikh akhir');
      return t('Task report: ', 'Laporan task: ') + task.title + ' (' + t('due ', 'tarikh akhir ') + due + ')\n' + url;
    }
    return t('Project report: ', 'Laporan projek: ') + proj.name + '\n' + url;
  }
  function assigneePhone(task) {
    if (!task || !task.assignee_employee_id || typeof sb === 'undefined') return Promise.resolve('');
    return sb.from('employees').select('phone').eq('id', task.assignee_employee_id).maybeSingle()
      .then(function (r) { return r.error || !r.data ? '' : normPhone(r.data.phone); }, function () { return ''; });
  }

  PJS.fillWaSlot = function (m, proj, task, url) {
    var slot = m.querySelector('#pjs-wa-slot'); if (!slot) return;
    slot.innerHTML = '<div class="row" style="gap:8px;margin-bottom:10px"><button type="button" class="btn btn-outline" id="pjs-wa" style="color:#0F7A3F;border-color:#0F7A3F"><i class="ti ti-brand-whatsapp"></i> ' + esc(t('Share via WhatsApp', 'Kongsi melalui WhatsApp')) + '</button></div>';
    assigneePhone(task).then(function (phone) {
      var btn = slot.querySelector('#pjs-wa'); if (!btn) return;
      btn.onclick = function () { window.open(waUrl(phone, waText(proj, task, url)), '_blank', 'noopener'); };
    });
  };
})();
