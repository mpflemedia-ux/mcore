/* Sales Plan — File 6/12: setup page (step 1/2), validation, save, form events. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc;

  SP.showSetup = async function (params, seq) {
    if (!SP.isAdmin()) { SP.paint(SP.viewOnlyHtml()); return; }
    var id = params.id || null, step = id && Number(params.step) === 2 ? 2 : 1;
    await SP.loadRefs();
    if (id) {
      await SP.loadPlan(id);
      if (!SP.alive(seq)) return;
      if (!st.plan) { SP.paint(SP.notFoundHtml()); return; }
    } else { st.plan = null; st.periods = []; st.weeks = []; }
    if (!SP.alive(seq)) return;
    if (step === 1) { SP.initForm(id ? 'edit:' + id : 'new'); SP.paint(setupPageHtml()); SP.afterFormPaint(); }
    else { SP.initEdit(); SP.paint(SP.targetsPageHtml()); }
  };
  function setupPageHtml() {
    var isNew = !st.plan;
    return '<div class="sp-setup sp-has-foot">' +
      '<div class="sp-step-head"><button type="button" class="sp-iconbtn" data-act="setup-back" aria-label="' + esc(t('Back', 'Kembali')) + '"><i class="ti ti-arrow-left"></i></button>' +
      '<div class="sp-step-txt"><div class="sp-step-title">' + esc(isNew ? t('New Plan', 'Pelan Baharu') : t('Edit Plan', 'Ubah Pelan')) + '</div><div class="sp-hint">' + esc(t('Step 1 / 2', 'Langkah 1 / 2')) + '</div></div></div>' +
      '<div class="card sp-form">' + SP.formFieldsHtml() + '</div>' +
      '<div class="sp-foot"><button type="button" class="btn btn-outline" data-act="setup-cancel">' + esc(t('Cancel', 'Batal')) + '</button>' +
      '<button type="button" class="btn btn-primary" data-act="setup-save" data-next="step2"><i class="ti ti-device-floppy"></i>' + esc(t('Save', 'Simpan')) + '</button></div></div>';
  }
  SP.afterFormPaint = function () {
    var q = document.getElementById('sp-prod-q');
    if (q && st.form && st.form._prodFocus) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (e) {} st.form._prodFocus = false; }
  };
  function blank(v) { return String(v == null ? '' : v).trim() === ''; }
  SP.validateForm = function (f) {
    if (blank(f.name)) return ['name', t('Plan name is required', 'Nama pelan diperlukan')];
    if (!SP.isoOk(f.start_date)) return ['start_date', t('Start date is required', 'Tarikh mula diperlukan')];
    if (!SP.isoOk(f.end_date)) return ['end_date', t('End date is required', 'Tarikh tamat diperlukan')];
    if (f.end_date < f.start_date) return ['end_date', t('End date must be on or after start date', 'Tarikh tamat mesti sama atau selepas tarikh mula')];
    if (Math.ceil((SP.diffDays(f.start_date, f.end_date) + 1) / 7) + 1 > SP.MAX_WEEKS) return ['end_date', t('Plan is too long (max 3 years)', 'Pelan terlalu panjang (maksimum 3 tahun)')];
    var w = Number(f.watch_pct), o = Number(f.on_track_pct);
    if (blank(f.watch_pct) || blank(f.on_track_pct) || !(w > 0) || !(o > 0) || w > 999 || o > 999) return ['watch_pct', t('Thresholds must be more than 0%', 'Had mesti lebih daripada 0%')];
    if (!(w < o)) return ['watch_pct', t('Watch must be lower than On Track', 'Had Watch mesti lebih rendah daripada On Track')];
    if (f.financing_enabled) {
      var fp = Number(f.financed_pct), fe = Number(f.fee_pct), te = Number(f.tenure_days);
      if (blank(f.financed_pct) || !isFinite(fp) || fp < 0 || fp > 100) return ['financed_pct', t('% financed must be 0–100', '% dibiayai mesti 0–100')];
      if (blank(f.fee_pct) || !isFinite(fe) || fe < 0 || fe > 100) return ['fee_pct', t('Fee must be 0–100%', 'Fee mesti 0–100%')];
      if (blank(f.tenure_days) || !isFinite(te) || te < 0 || te > 3650 || Math.floor(te) !== te) return ['tenure_days', t('Tenure must be 0–3650 days', 'Tempoh mesti 0–3650 hari')];
      if (!f.loan_account_id) return ['loan_account_id', t('Choose the financier loan account', 'Pilih akaun pinjaman pembiaya')];
      if (!f.fee_account_id) return ['fee_account_id', t('Choose the financing fee account', 'Pilih akaun fee pembiayaan')];
      if (!f.draw_debit_account_id) return ['draw_debit_account_id', t('Choose the Inventory or Bank account for funding drawn', 'Pilih akaun Inventori atau Bank untuk pembiayaan diterima')];
    }
    return null;
  };
  SP.formRow = function (f) {
    var nb = function (v, d, lo, hi) { var x = Number(v); x = blank(v) || !isFinite(x) ? d : x; return Math.min(hi, Math.max(lo, x)); };
    return {
      name: String(f.name).trim(), start_date: f.start_date, end_date: f.end_date, currency: f.currency || 'MYR',
      sales_source: f.sales_source === 'auto' ? 'auto' : 'manual', product_filter: f.product_filter.slice(),
      watch_pct: SP.r2(f.watch_pct), on_track_pct: SP.r2(f.on_track_pct), financing_enabled: !!f.financing_enabled,
      financed_pct: nb(f.financed_pct, 90, 0, 100), fee_pct: nb(f.fee_pct, 7, 0, 100), tenure_days: Math.round(nb(f.tenure_days, 30, 0, 3650)),
      loan_account_id: f.loan_account_id || null, fee_account_id: f.fee_account_id || null,
      draw_debit_account_id: f.draw_debit_account_id || null, default_bank_account_id: f.default_bank_account_id || null,
      pic_employee_id: f.pic_employee_id || null, pic_name: String(f.pic_name || '').trim() || null
    };
  };
  SP.saveSetup = async function (next) {
    if (st.busy) return;
    var f = st.form, bad = SP.validateForm(f);
    if (bad) { SP.toast(bad[1], 'error'); var el = document.getElementById('sp-f-' + bad[0]); if (el) { try { el.focus(); } catch (e) {} } return; }
    var row = SP.formRow(f), id = st.plan ? st.plan.id : null;
    SP.setBusy(true);
    try {
      var res;
      if (id) res = await sb.from('sales_plans').update(row).eq('id', id).eq('tenant_id', SP.tid());
      else { id = SP.uuid(); row.id = id; row.tenant_id = SP.tid(); row.status = 'draft'; row.is_template = false; res = await sb.from('sales_plans').insert(row); }
      if (res.error) throw res.error;
      st.form = null; st.formKey = ''; st.formDirty = false;
      SP.toast(t('Saved', 'Disimpan'), 'success');
      SP.go(next === 'step2' ? { view: 'setup', id: id, step: 2 } : { view: 'detail', id: id, tab: 'settings' });
    } catch (err) {
      SP.setBusy(false);
      SP.toast(t('Save failed: ', 'Gagal simpan: ') + SP.errMsg(err), 'error');
    }
  };

  var A = SP.actions;
  A['setup-back'] = A['setup-cancel'] = function () {
    if (!SP.leaveOk()) return;
    var pid = st.plan && st.plan.id; SP.discard();
    SP.go(pid ? { view: 'detail', id: pid, tab: 'overview' } : {});
  };
  A['setup-save'] = function (b) { SP.saveSetup(b.getAttribute('data-next')); };
  A.src = function (b) {
    st.form.sales_source = b.getAttribute('data-v'); st.formDirty = true;
    b.parentNode.querySelectorAll('button').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
    var h = document.getElementById('sp-src-hint'); if (h) h.textContent = SP.srcHint(st.form.sales_source);
  };
  A.fin = function (b) {
    var on = st.form.financing_enabled = !st.form.financing_enabled; st.formDirty = true;
    b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
    var fb = document.getElementById('sp-fin-body'); if (fb) fb.hidden = !on;
  };
  A.prod = function (b) {
    var sel = st.form.product_filter, k = String(b.getAttribute('data-id')), ix = sel.indexOf(k);
    if (ix >= 0) sel.splice(ix, 1); else sel.push(k);
    st.formDirty = true;
    var box = document.getElementById('sp-prod'); if (box) box.innerHTML = SP.prodChipsHtml();
  };
  SP.inputs.push(function (el) {
    if (el.id === 'sp-prod-q' && st.form) {
      st.form.prodQ = el.value; st.form._prodFocus = true;
      var pb = document.getElementById('sp-prod'); if (pb) { pb.innerHTML = SP.prodChipsHtml(); SP.afterFormPaint(); }
      return true;
    }
    var ff = el.getAttribute && el.getAttribute('data-ff');
    if (ff && st.form) { st.form[ff] = el.value; st.formDirty = true; return true; }
    return false;
  });
})();
