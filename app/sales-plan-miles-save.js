/* Sales Plan — phase 2b. Milestone save/delete (soft) + actions. PIC saves only actual_manual + pic_notes. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, num = SP.num;
  function v(ov, id) { var el = ov.querySelector('#' + id); return el ? String(el.value == null ? '' : el.value).trim() : ''; }
  function nOrNull(s) { if (s === '') return null; var n = Number(String(s).replace(/,/g, '')); return isFinite(n) ? SP.r2(n) : NaN; }
  function reload() { SP.go({ view: 'detail', id: st.plan.id, tab: 'milestones' }); }
  SP.mileSave = async function (ov, btn, m) {
    if (st.busy) return;
    var admin = SP.isAdmin(), row = {}, err = null;
    var act = nOrNull(v(ov, 'sp-ms-actual')), notes = v(ov, 'sp-ms-notes');
    if (Number.isNaN(act)) err = t('Actual must be a number', 'Sebenar mesti nombor');
    if (admin) {
      var code = v(ov, 'sp-ms-code').toUpperCase(), title = v(ov, 'sp-ms-title'), due = v(ov, 'sp-ms-due'), tg = nOrNull(v(ov, 'sp-ms-target')), lt = v(ov, 'sp-ms-link') || 'manual';
      var per = v(ov, 'sp-ms-period'), bat = v(ov, 'sp-ms-batch'), metric = v(ov, 'sp-ms-metric') || 'rm';
      if (!code) err = t('ID is required', 'ID diperlukan');
      else if (st.miles.some(function (x) { return String(x.code).toUpperCase() === code && (!m || !SP.same(x.id, m.id)); })) err = t('ID ' + code + ' is already used in this plan', 'ID ' + code + ' sudah digunakan dalam pelan ini');
      else if (!title) err = t('Milestone name is required', 'Nama milestone diperlukan');
      else if (!SP.isoOk(due)) err = t('Due date is required', 'Tarikh diperlukan');
      else if (tg == null || Number.isNaN(tg) || tg < 0) err = t('Target must be 0 or more', 'Sasaran mesti 0 atau lebih');
      else if (/^period_/.test(lt) && !per) err = t('Choose the period', 'Pilih tempoh');
      else if (/^batch_/.test(lt) && !bat) err = t('Choose the batch', 'Pilih batch');
      else if (act != null && act < 0) err = t('Actual must be 0 or more', 'Sebenar mesti 0 atau lebih');
      if (!err) row = { code: code, title: title, due_date: due, metric: metric, metric_label: metric === 'custom' ? (v(ov, 'sp-ms-mlabel') || null) : null, target: tg, link_type: lt,
        link_period_id: /^period_/.test(lt) ? per : null, link_batch_id: /^batch_/.test(lt) ? bat : null, owner_employee_id: v(ov, 'sp-ms-emp') || null, owner_name: v(ov, 'sp-ms-owner') || null };
    }
    if (err) { SP.toast(err, 'error'); return; }
    if (!admin && m && m.link_type !== 'manual') act = m.actual_manual == null ? null : num(m.actual_manual);
    if (admin ? row.link_type === 'manual' : true) row.actual_manual = act;
    row.pic_notes = notes || null;
    st.busy = true; btn.disabled = true;
    try {
      var res;
      if (m) res = await sb.from('sales_plan_milestones').update(row).eq('id', m.id).eq('tenant_id', SP.tid()).eq('plan_id', st.plan.id);
      else res = await sb.from('sales_plan_milestones').insert(Object.assign(row, { id: SP.uuid(), tenant_id: SP.tid(), plan_id: st.plan.id, sort_order: st.miles.length }));
      if (res.error) throw res.error;
      SP.closeModal(); st.busy = false;
      SP.toast(t('Milestone saved', 'Milestone disimpan'), 'success'); reload();
    } catch (e) { st.busy = false; btn.disabled = false; SP.toast(t('Save failed: ', 'Gagal simpan: ') + SP.errMsg(e), 'error'); }
  };
  var A = SP.actions;
  A['ms-add'] = function () { if (SP.isAdmin()) SP.mileModal(null); };
  A['ms-edit'] = function (b) { var m = st.miles.find(function (x) { return SP.same(x.id, b.getAttribute('data-id')); }); if (m && st.canEdit) SP.mileModal(m); };
  A['ms-del'] = async function (b) {
    var m = st.miles.find(function (x) { return SP.same(x.id, b.getAttribute('data-id')); });
    if (!m || !SP.isAdmin() || st.busy) return;
    if (!window.confirm(t('Delete milestone ' + m.code + ' "' + m.title + '"?', 'Padam milestone ' + m.code + ' "' + m.title + '"?'))) return;
    st.busy = true;
    try {
      var res = await sb.from('sales_plan_milestones').update({ deleted_at: new Date().toISOString() }).eq('id', m.id).eq('tenant_id', SP.tid()).eq('plan_id', st.plan.id);
      if (res.error) throw res.error;
      st.busy = false; SP.toast(t('Milestone deleted', 'Milestone dipadam'), 'success'); reload();
    } catch (e) { st.busy = false; SP.toast(SP.errMsg(e), 'error'); }
  };
})();
