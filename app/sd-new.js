/* M-Core Service Desk - client 3-step new request (only contracted services, monthly quota). */
(function () {
  var SD = window.SD; if (!SD || SD._new) return; SD._new = 1;
  var S = SD.CL;
  /* ---- new request: 1 service, 2 details, 3 review ---- */
  var N = { step: 1, svc: null, title: '', desc: '', pri: 'normal', file: null, formData: {} };
  function steps() { return '<div class="sd-step">' + [1, 2, 3].map(function (i) { return '<i class="' + (i <= N.step ? 'on' : '') + '"></i>'; }).join('') + '</div>'; }
  function svcDef() { return (SD.catalogList || []).find(function (x) { return x.code === N.svc; }); }
  /* dynamic required-field schema per service (service_catalog.form_fields) -- key/label_en/
     label_bm/type(text|date|month|select|file)/required/options[] */
  function dynField(f) {
    var id = 'sd-df-' + f.key, val = (N.formData || {})[f.key] || '', label = SD.L(f.label_en, f.label_bm) + (f.required ? ' *' : '');
    var input;
    if (f.type === 'select') input = '<select class="form-input" id="' + id + '" data-key="' + SD.esc(f.key) + '"><option value="">' + SD.L('Choose…', 'Pilih…') + '</option>' + (f.options || []).map(function (o) { return '<option value="' + SD.esc(o) + '"' + (val === o ? ' selected' : '') + '>' + SD.esc(o) + '</option>'; }).join('') + '</select>';
    else if (f.type === 'date' || f.type === 'month') input = '<input type="' + f.type + '" class="form-input" id="' + id + '" data-key="' + SD.esc(f.key) + '" value="' + SD.esc(val) + '">';
    else input = '<input class="form-input" data-no-titlecase="1" id="' + id + '" data-key="' + SD.esc(f.key) + '" maxlength="300" value="' + SD.esc(val) + '">';
    return '<div class="form-group"><label class="form-label">' + SD.esc(label) + '</label>' + input + '</div>';
  }
  function dynFieldsHtml() { return ((svcDef() || {}).form_fields || []).map(dynField).join(''); }
  function grabDynFields() {
    var g = function (id) { return document.getElementById(id); };
    N.formData = N.formData || {};
    ((svcDef() || {}).form_fields || []).forEach(function (f) { var el = g('sd-df-' + f.key); if (el) N.formData[f.key] = (el.value || '').trim(); });
  }
  function paintNew() {
    var m = SD.main(), c = S.c; if (!m) return;
    var left = c && c.monthly_quota != null ? c.monthly_quota - S.used : null, body = '';
    if (N.step === 1) body = '<b style="font-size:15px">' + SD.L('Which service?', 'Servis apa?') + '</b><div class="cob-xs" style="margin:2px 0 12px">' + (left != null ? SD.L(left + ' requests left this month', 'Baki ' + left + ' permohonan bulan ini') : SD.L('No monthly limit', 'Tiada had bulanan')) + '</div><div class="sd-pick">' +
      (SD.catalogList || []).filter(function (x) { return (c.services || []).indexOf(x.code) >= 0; }).map(function (x) { return '<label><input type="radio" name="sd-svc" value="' + x.code + '"' + (N.svc === x.code ? ' checked' : '') + '><span>' + SD.esc(SD.L(x.name_en, x.name_bm)) + '</span></label>'; }).join('') + '</div>';
    else if (N.step === 2) body = '<b style="font-size:15px;display:block;margin-bottom:12px">' + SD.esc(SD.svcName(N.svc)) + '</b>' +
      '<div class="form-group"><label class="form-label">' + SD.L('Title', 'Tajuk') + '</label><input class="form-input" data-no-titlecase="1" id="sd-nt" maxlength="200" value="' + SD.esc(N.title) + '"></div>' +
      '<div class="form-group"><label class="form-label">' + SD.L('Details', 'Butiran') + '</label><textarea class="form-input" data-no-titlecase="1" id="sd-nd" rows="5">' + SD.esc(N.desc) + '</textarea></div>' +
      dynFieldsHtml() +
      '<div class="form-group"><label class="form-label">' + SD.L('Priority', 'Keutamaan') + '</label><select class="form-input" id="sd-np">' + [['low', 'Low', 'Rendah'], ['normal', 'Normal', 'Biasa'], ['high', 'High', 'Tinggi'], ['urgent', 'Urgent', 'Segera']].map(function (x) { return '<option value="' + x[0] + '"' + (N.pri === x[0] ? ' selected' : '') + '>' + SD.L(x[1], x[2]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label class="form-label">' + SD.L('Attachment (optional)', 'Lampiran (pilihan)') + '</label><input type="file" class="form-input" id="sd-nf"></div>';
    else body = '<b style="font-size:15px;display:block;margin-bottom:12px">' + SD.L('Review & submit', 'Semak & hantar') + '</b><div class="sd-sum">' + [[SD.L('Service', 'Servis'), SD.svcName(N.svc)], [SD.L('Title', 'Tajuk'), N.title], ['SLA', c.sla_hours + SD.L(' business hours (Mon–Fri, excl. public holidays)', ' jam bekerja (Isnin–Jumaat, tidak termasuk cuti umum)')], [SD.L('Attachment', 'Lampiran'), N.file ? N.file.name : '—']]
      .concat(((svcDef() || {}).form_fields || []).filter(function (f) { return (N.formData || {})[f.key]; }).map(function (f) { return [SD.L(f.label_en, f.label_bm), N.formData[f.key]]; }))
      .map(function (x) { return '<div><div class="cob-xs">' + x[0] + '</div><b>' + SD.esc(x[1]) + '</b></div>'; }).join('') + '</div>' + (N.desc ? '<p class="cob-sm" style="white-space:pre-wrap;margin-top:12px;overflow-wrap:anywhere;word-break:break-word">' + SD.esc(N.desc) + '</p>' : '');
    m.innerHTML = '<div class="cob-root">' + SD.head(SD.L('New request', 'Permohonan baharu'), SD.L('Step ', 'Langkah ') + N.step + ' / 3') + steps() + '<div class="cob-card" style="padding:16px;margin-bottom:12px">' + body + '</div>' +
      '<div class="sd-acts"><button class="btn btn-outline" id="sd-back" style="flex:1"><i class="ti ti-arrow-left"></i> ' + (N.step === 1 ? SD.L('Cancel', 'Batal') : SD.L('Back', 'Kembali')) + '</button><button class="btn btn-primary" id="sd-next" style="flex:1"' + (N.step === 1 && left != null && left <= 0 ? ' disabled' : '') + '>' + (N.step === 3 ? '<i class="ti ti-send"></i> ' + SD.L('Submit', 'Hantar') : SD.L('Next', 'Seterusnya') + ' <i class="ti ti-arrow-right"></i>') + '</button></div></div>';
    m.querySelector('#sd-back').onclick = function () { if (N.step === 1) SD.go('servis_saya'); else { grab(); N.step--; paintNew(); } };
    m.querySelector('#sd-next').onclick = function () { grab(); next(this); };
  }
  function grab() {
    var g = function (id) { return document.getElementById(id); };
    if (N.step === 1) { var r = document.querySelector('input[name="sd-svc"]:checked'); N.svc = r ? r.value : N.svc; }
    if (N.step === 2) { N.title = g('sd-nt').value.trim(); N.desc = g('sd-nd').value.trim(); N.pri = g('sd-np').value; if (g('sd-nf').files[0]) N.file = g('sd-nf').files[0]; grabDynFields(); }
  }
  function missingRequired() { return ((svcDef() || {}).form_fields || []).filter(function (f) { return f.required && !(N.formData || {})[f.key]; }); }
  function next(btn) {
    if (N.step === 1 && !N.svc) return SD.toast(SD.L('Choose a service', 'Pilih satu servis'), 'error');
    if (N.step === 2 && !N.title) return SD.toast(SD.L('Enter a title', 'Masukkan tajuk'), 'error');
    if (N.step === 2) { var missing = missingRequired(); if (missing.length) return SD.toast(SD.L('Please fill in: ', 'Sila isi: ') + missing.map(function (f) { return SD.L(f.label_en, f.label_bm); }).join(', '), 'error'); }
    if (N.step < 3) { N.step++; return paintNew(); }
    btn.disabled = true;
    var c = S.c, now = new Date();
    SD.createRequest({ tenant_id: SD.tid(), contract_id: c.id, service_code: N.svc, title: N.title, description: N.desc || null, priority: N.pri, status: 'submitted', created_by: SD.uid(), due_at: SD.addBH(now, c.sla_hours).toISOString(), form_data: N.formData || {} })
      .then(function (r) {
        if (SD.taskSrLinkCallback) { var hook = SD.taskSrLinkCallback; SD.taskSrLinkCallback = null; hook(r); }
        return SD.event(r, 'status', { to_status: 'submitted', body: SD.L('Request submitted', 'Permohonan dihantar') }).catch(function () {})
          .then(function () { return N.file ? SD.upload(r, N.file, false).catch(function (e) { SD.toast(SD.err(e), 'error'); }) : null; })
          .then(function () { (SD.bellNew || SD.bellFor)(r, SD.L('New service request ', 'Permohonan servis baharu ') + r.ref_no, r.title, 'sd.new'); SD.toast(SD.L('Submitted ', 'Dihantar ') + r.ref_no, 'success'); SD.go('servis_saya', { id: r.id }); });
      }).catch(function (e) { btn.disabled = false; SD.toast(SD.err(e), 'error'); });
  }
  SD.newReq = function (prefill) { S = SD.CL; N = Object.assign({ step: 1, svc: null, title: '', desc: '', pri: 'normal', file: null, formData: {} }, prefill || {}); paintNew(); };
})();
