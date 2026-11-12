/* M-Core Projects: Close project review. Archive (= close) first shows "N open tasks" with
   Cancel all and close (tasks stay in the archived project; the DB trigger cancels their Planner rows, Restore brings them back) /
   Move to another project (open tasks move, then the project closes) / Back. No open tasks = closes straight away as before.
   Hook: window._pjAfterPaint (chained) re-binds the existing [data-proj-arch] buttons and keeps the original click as the final step. */
(function () {
  if (window._pjCloseReview) return; window._pjCloseReview = 1;
  function L(en, ms) { return window.APP && APP.language === 'bm' ? ms : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function tid() { return window.APP && APP.tenant && APP.tenant.id; }
  function same(a, b) { return String(a) === String(b); }
  function toast(m, k) { if (typeof showToast === 'function') showToast(esc(m), k || 'success'); }

  async function review(st, pid, orig, btn) {
    var proj = (st.allProjects || st.projects || []).filter(function (p) { return same(p.id, pid); })[0] || { id: pid, name: '' };
    var r = await sb.from('project_tasks').select('id,title').eq('tenant_id', tid()).eq('project_id', pid).is('deleted_at', null).neq('column_key', 'done').order('created_at').limit(500);
    if (r.error) { toast(r.error.message, 'error'); return; }
    var open = r.data || [];
    if (!open.length) { orig.call(btn); return; }
    var others = (st.allProjects || []).filter(function (p) { return !p.archived_at && !same(p.id, pid); });
    var old = document.getElementById('pjcr-modal'); if (old) old.remove();
    var n = open.length;
    var html = '<div class="modal-overlay active" id="pjcr-modal"><div class="modal-box" style="max-width:440px;width:calc(100% - 24px)">' +
      '<div class="modal-box-header"><i class="ti ti-archive"></i> ' + esc(L('Close project', 'Tutup projek')) + '</div>' +
      '<div class="modal-box-body" style="display:flex;flex-direction:column;gap:10px">' +
      '<div style="font-weight:600;word-break:break-word">' + esc(proj.name) + '</div>' +
      '<div><b>' + esc(L(n + (n === 1 ? ' open task' : ' open tasks'), n + ' task belum siap')) + '</b><div style="font-size:13px;color:var(--text-2);margin-top:2px">' + esc(L('What should happen to them?', 'Apa nak buat dengan task ini?')) + '</div></div>' +
      '<ul style="margin:0;padding-left:18px;font-size:13px;color:var(--text-2);max-height:120px;overflow:auto">' + open.slice(0, 8).map(function (k) { return '<li style="word-break:break-word">' + esc(k.title) + '</li>'; }).join('') + (n > 8 ? '<li>' + esc(L('and ' + (n - 8) + ' more', 'dan ' + (n - 8) + ' lagi')) + '</li>' : '') + '</ul>' +
      '<div style="font-size:12px;color:var(--text-3)">' + esc(L('Cancel all: tasks stay in this project and leave everyone\'s Planner. Restore the project to bring them back.', 'Batal semua: task kekal dalam projek ini dan hilang dari Perancang semua orang. Pulihkan projek untuk bawa balik.')) + '</div>' +
      '<div id="pjcr-move" style="display:none;flex-direction:column;gap:6px"><label class="form-label" for="pjcr-target">' + esc(L('Move open tasks to', 'Pindah task belum siap ke')) + '</label>' +
      '<select id="pjcr-target" class="form-input">' + others.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('') + '</select>' +
      '<button type="button" class="btn btn-primary" id="pjcr-move-go" style="white-space:nowrap"><i class="ti ti-arrow-right"></i> ' + esc(L('Move and close', 'Pindah dan tutup')) + '</button></div>' +
      '</div><div class="modal-box-footer" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">' +
      '<button type="button" class="btn btn-outline" id="pjcr-back" style="white-space:nowrap">' + esc(L('Back', 'Kembali')) + '</button>' +
      (others.length ? '<button type="button" class="btn btn-outline" id="pjcr-move-show" style="white-space:nowrap"><i class="ti ti-arrows-exchange"></i> ' + esc(L('Move to another project', 'Pindah ke projek lain')) + '</button>' : '') +
      '<button type="button" class="btn btn-primary" id="pjcr-cancel" style="white-space:nowrap"><i class="ti ti-x"></i> ' + esc(L('Cancel all and close', 'Batal semua dan tutup')) + '</button>' +
      '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    var m = document.getElementById('pjcr-modal');
    function close() { m.remove(); }
    m.onclick = function (e) { if (e.target === m) close(); };
    m.querySelector('#pjcr-back').onclick = close;
    m.querySelector('#pjcr-cancel').onclick = function () { close(); orig.call(btn); };
    var ms = m.querySelector('#pjcr-move-show');
    if (ms) ms.onclick = function () { m.querySelector('#pjcr-move').style.display = 'flex'; ms.style.display = 'none'; };
    m.querySelector('#pjcr-move-go').onclick = async function () {
      var b = this, to = m.querySelector('#pjcr-target').value; if (!to || b.disabled) return; b.disabled = true;
      var up = await sb.from('project_tasks').update({ project_id: to, updated_at: new Date().toISOString() }).eq('tenant_id', tid()).eq('project_id', pid).is('deleted_at', null).neq('column_key', 'done');
      if (up.error) { b.disabled = false; toast(up.error.message, 'error'); return; }
      toast(L('Moved ' + n + (n === 1 ? ' task' : ' tasks'), n + ' task dipindah'));
      close(); orig.call(btn);
    };
  }

  var prev = window._pjAfterPaint;
  var fn = function (st) {
    if (typeof prev === 'function') prev.apply(this, arguments);
    var main = document.getElementById('main'); if (!main || !st || st.showArchived) return;
    main.querySelectorAll('[data-proj-arch]').forEach(function (btn) {
      var orig = btn.onclick; if (typeof orig !== 'function' || orig._pjcr) return;
      var h = function (ev) { if (ev) ev.stopPropagation(); review(st, btn.getAttribute('data-proj-arch'), function () { orig.call(btn, { stopPropagation: function () {} }); }, btn).catch(function (e) { toast(String(e.message || e), 'error'); }); };
      h._pjcr = 1; btn.onclick = h;
    });
  };
  /* keep the other modules' "already wrapped" flags so they do not wrap the chain twice */
  if (prev) Object.keys(prev).forEach(function (k) { if (/^_pj/.test(k)) fn[k] = prev[k]; });
  window._pjAfterPaint = fn;
})();
