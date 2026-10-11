/* Sales Plan — File 10/12: templates (cards, save as template, use template, copy). */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc, d10 = SP.d10;
  var PLAN_COPY = ['currency', 'sales_source', 'product_filter', 'watch_pct', 'on_track_pct', 'at_risk_days', 'financing_enabled', 'financed_pct', 'fee_pct', 'tenure_days', 'variable_cost_pct', 'max_discount_pct', 'loan_account_id', 'fee_account_id', 'draw_debit_account_id', 'default_bank_account_id', 'pic_employee_id', 'pic_user_id', 'pic_name', 'notes'];
  var PERIOD_COPY = ['kind', 'label', 'start_date', 'end_date', 'gmv_target', 'units_target', 'orders_target', 'inbound_target', 'sort_order'];
  var WEEK_COPY = ['code', 'start_date', 'end_date', 'gmv_target', 'units_target', 'orders_target', 'sort_order'];
  var BATCH_COPY = ['code', 'label', 'product_mix', 'target_inbound', 'target_qty', 'target_cost', 'financed_pct', 'fee_pct', 'tenure_days', 'target_due_date', 'notes', 'sort_order'];
  var MILE_COPY = ['code', 'title', 'due_date', 'metric', 'metric_label', 'target', 'link_type', 'owner_employee_id', 'owner_name', 'sort_order'];
  var DATES = ['start_date', 'end_date', 'target_inbound', 'target_due_date', 'due_date'];

  function tplMeta(r) {
    if (r.p.template_note && String(r.p.template_note).trim()) return String(r.p.template_note).trim();
    return t(r.weeksN + ' weeks · ' + r.batchesN + ' batches · ' + r.milesN + ' milestones', r.weeksN + ' minggu · ' + r.batchesN + ' batch · ' + r.milesN + ' milestone');
  }
  function tplCard(icon, name, meta, btn) {
    return '<div class="card sp-tpl"><span class="stat-icon blue sp-tpl-ic"><i class="ti ' + icon + '" aria-hidden="true"></i></span><div class="sp-tpl-txt"><div class="sp-tpl-name">' + esc(name) + '</div><div class="sp-hint">' + esc(meta) + '</div></div>' + btn + '</div>';
  }
  function useBtn(id, name) {
    return '<button type="button" class="btn btn-outline btn-sm" ' + (id ? 'data-act="use-template" data-id="' + esc(id) + '"' : 'data-act="new"') + ' aria-label="' + esc(t('Use', 'Guna') + ' ' + name) + '">' + esc(t('Use', 'Guna')) + '</button>';
  }
  SP.templatesHtml = function (admin) {
    var tp = (st.list && st.list.templates) || [];
    if (!tp.length && !admin) return '';
    var cards = tp.map(function (r) { return tplCard('ti-copy', r.p.name, tplMeta(r), admin ? useBtn(r.p.id, r.p.name) : ''); });
    if (admin) cards.push(tplCard('ti-file-plus', t('Blank plan', 'Pelan kosong'), t('Start from scratch', 'Mula dari kosong'), useBtn(null, t('Blank plan', 'Pelan kosong'))));
    return '<div class="sp-tpls"><div class="card-title sp-sec-title"><i class="ti ti-template"></i>' + esc(t('Templates', 'Templat')) + '</div><div class="sp-tpl-grid">' + cards.join('') + '</div></div>';
  };

  function shift(row, delta) { DATES.forEach(function (k) { if (row[k]) row[k] = SP.addDays(d10(row[k]), delta); }); return row; }
  async function rows(table, cols, pid) { return (await SP.fetchAll(table, 'id,' + cols.join(','), function (q) { return q.eq('plan_id', pid); })).sort(SP.sortRows); }
  async function run(q) { var r = await q; if (r && r.error) throw r.error; return r; }
  SP.copyPlan = async function (srcId, o) {
    var tid = SP.tid();
    var pr = await run(sb.from('sales_plans').select('*').eq('id', srcId).eq('tenant_id', tid).is('deleted_at', null).maybeSingle());
    var src = pr.data; if (!src) throw new Error(t('Source plan not found', 'Pelan sumber tidak dijumpai'));
    var none = function () { return []; };
    var r = await Promise.all([rows('sales_plan_periods', PERIOD_COPY, srcId), rows('sales_plan_weeks', WEEK_COPY.concat('period_id'), srcId),
      rows('sales_plan_batches', BATCH_COPY, srcId).catch(none), rows('sales_plan_milestones', MILE_COPY.concat('link_period_id', 'link_batch_id'), srcId).catch(none)]);
    var delta = o.start ? SP.diffDays(d10(src.start_date), o.start) : 0, id = SP.uuid(), pMap = {}, bMap = {};
    var plan = shift(Object.assign(SP.pick(src, PLAN_COPY), { start_date: d10(src.start_date), end_date: d10(src.end_date) }), delta);
    Object.assign(plan, { id: id, tenant_id: tid, name: o.name, status: 'draft', is_template: !!o.asTemplate, template_note: o.asTemplate ? (o.note || null) : null, source_template_id: src.is_template ? src.id : null });
    await run(sb.from('sales_plans').insert(plan));
    try {
      var P = r[0].map(function (x) {
        var n = shift(Object.assign(SP.pick(x, PERIOD_COPY), { id: SP.uuid(), tenant_id: tid, plan_id: id }), delta);
        if (n.kind === 'month' && delta) { var s = n.start_date; n.label = SP.mons()[+s.slice(5, 7) - 1] + '-' + s.slice(2, 4); }
        pMap[String(x.id)] = n.id; return n;
      });
      var B = r[2].map(function (x) { var n = shift(Object.assign(SP.pick(x, BATCH_COPY), { id: SP.uuid(), tenant_id: tid, plan_id: id }), delta); bMap[String(x.id)] = n.id; return n; });
      var W = r[1].map(function (x) { return shift(Object.assign(SP.pick(x, WEEK_COPY), { id: SP.uuid(), tenant_id: tid, plan_id: id, period_id: x.period_id ? pMap[String(x.period_id)] || null : null }), delta); });
      var M = r[3].map(function (x) { return shift(Object.assign(SP.pick(x, MILE_COPY), { id: SP.uuid(), tenant_id: tid, plan_id: id, link_period_id: x.link_period_id ? pMap[String(x.link_period_id)] || null : null, link_batch_id: x.link_batch_id ? bMap[String(x.link_batch_id)] || null : null }), delta); });
      if (P.length) await run(sb.from('sales_plan_periods').insert(P));
      if (B.length) await run(sb.from('sales_plan_batches').insert(B));
      if (W.length) await run(sb.from('sales_plan_weeks').insert(W));
      if (M.length) await run(sb.from('sales_plan_milestones').insert(M));
    } catch (err) {
      try { await sb.from('sales_plans').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', tid); } catch (e) {}
      throw err;
    }
    return id;
  };

  function field(id, label, html) { return '<div class="form-group"><label class="form-label" for="' + id + '">' + esc(label) + '</label>' + html + '</div>'; }
  function val(ov, id) { var el = ov.querySelector('#' + id); return el ? String(el.value || '').trim() : ''; }
  function nextMonday() { var d = SP.todayISO(); return SP.addDays(d, (8 - SP.dow(d)) % 7 || 7); }
  SP.useTemplate = function (tplId) {
    if (!SP.isAdmin()) return;
    var r = ((st.list && st.list.templates) || []).find(function (x) { return SP.same(x.p.id, tplId); }); if (!r) return;
    var len = SP.diffDays(d10(r.p.start_date), d10(r.p.end_date)), info = function (s) {
      return SP.isoOk(s) ? t('Dates shift to ' + SP.fmtRange(s, SP.addDays(s, len)) + '. Targets and structure are copied; no actual sales.', 'Tarikh dianjak ke ' + SP.fmtRange(s, SP.addDays(s, len)) + '. Sasaran dan struktur disalin; tiada jualan sebenar.') : t('Choose a start date.', 'Pilih tarikh mula.');
    };
    var s0 = nextMonday();
    var body = field('sp-m-name', t('Plan name', 'Nama pelan'), '<input id="sp-m-name" class="form-input" data-no-titlecase="1" maxlength="120" value="' + esc(r.p.name) + '">') +
      field('sp-m-start', t('New start date', 'Tarikh mula baharu'), '<input id="sp-m-start" type="date" class="form-input" value="' + s0 + '">') +
      '<div class="sp-hint" id="sp-m-info">' + esc(info(s0)) + '</div><div class="sp-hint">' + esc(t('Tip: start on a Monday to keep Monday–Sunday weeks.', 'Tip: mula pada hari Isnin supaya minggu kekal Isnin–Ahad.')) + '</div>';
    SP.openModal(t('Use template', 'Guna templat'), body, t('Create draft', 'Cipta draf'), async function (ov, b) {
      var name = val(ov, 'sp-m-name'), s = val(ov, 'sp-m-start');
      if (!name) { SP.toast(t('Plan name is required', 'Nama pelan diperlukan'), 'error'); return; }
      if (!SP.isoOk(s)) { SP.toast(t('Start date is required', 'Tarikh mula diperlukan'), 'error'); return; }
      b.disabled = true;
      try { var id = await SP.copyPlan(r.p.id, { name: name, start: s }); SP.closeModal(); SP.discard(); SP.toast(t('Draft created from template', 'Draf dicipta daripada templat'), 'success'); SP.go({ view: 'setup', id: id, step: 1 }); }
      catch (err) { b.disabled = false; SP.toast(SP.errMsg(err), 'error'); }
    }, function (ov) { var i = ov.querySelector('#sp-m-info'); if (i) i.textContent = info(val(ov, 'sp-m-start')); });
  };
  SP.saveAsTemplate = function (p) {
    if (!SP.isAdmin() || !p) return;
    var body = field('sp-m-name', t('Template name', 'Nama templat'), '<input id="sp-m-name" class="form-input" data-no-titlecase="1" maxlength="120" value="' + esc(p.name) + '">') +
      field('sp-m-note', t('Short note (optional)', 'Nota ringkas (pilihan)'), '<input id="sp-m-note" class="form-input" data-no-titlecase="1" maxlength="120" placeholder="' + esc(t('e.g. weekly targets only', 'cth. sasaran mingguan sahaja')) + '">') +
      '<div class="sp-hint">' + esc(t('Copies periods, weeks, targets, batches and milestones — not actual sales or payments.', 'Menyalin tempoh, minggu, sasaran, batch dan milestone — bukan jualan sebenar atau bayaran.')) + '</div>';
    SP.openModal(t('Save as template', 'Simpan sebagai templat'), body, t('Save template', 'Simpan templat'), async function (ov, b) {
      var name = val(ov, 'sp-m-name');
      if (!name) { SP.toast(t('Template name is required', 'Nama templat diperlukan'), 'error'); return; }
      b.disabled = true;
      try { await SP.copyPlan(p.id, { asTemplate: true, name: name, note: val(ov, 'sp-m-note') }); SP.closeModal(); SP.toast(t('Template saved', 'Templat disimpan'), 'success'); }
      catch (err) { b.disabled = false; SP.toast(SP.errMsg(err), 'error'); }
    });
  };
  SP.actions['use-template'] = function (b) { SP.useTemplate(b.getAttribute('data-id')); };
  SP.actions['from-template'] = function () {
    var tp = (st.list && st.list.templates) || [];
    if (!tp.length) { SP.toast(t('No templates yet — open a plan and use "Save as template".', 'Belum ada templat — buka pelan dan guna "Simpan sebagai templat".'), 'info'); return; }
    SP.openModal(t('Start from a template', 'Mula daripada templat'), '<div class="sp-tpl-list">' + tp.map(function (r) { return tplCard('ti-copy', r.p.name, tplMeta(r), useBtn(r.p.id, r.p.name)); }).join('') + '</div>', '', null);
  };
})();
