/* Scan document onto Add/Edit Customer form (cf-* fields) */
(function () {
  var STATES = ['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis','Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','W.P. Kuala Lumpur','W.P. Labuan','W.P. Putrajaya'];
  function matchState(v) {
    if (!v) return '';
    var s = String(v).trim().toLowerCase();
    for (var i = 0; i < STATES.length; i++) {
      if (STATES[i].toLowerCase() === s) return STATES[i];
    }
    for (var j = 0; j < STATES.length; j++) {
      var n = STATES[j].toLowerCase();
      if (n.indexOf(s) >= 0 || s.indexOf(n) >= 0) return STATES[j];
    }
    if (s.indexOf('kuala') >= 0) return 'W.P. Kuala Lumpur';
    return '';
  }
  function setVal(id, v) {
    var el = document.getElementById(id);
    if (!el || v == null || v === '') return;
    el.value = v;
  }
  window._custScanDocument = async function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var isBm = APP.language === 'bm';
    var t = isBm
      ? { scanning: 'Mengimbas dokumen...', converting: 'Menukar PDF ke imej...', done: 'Dokumen diimbas — sila semak field.', err: 'Ralat imbas: ', badFile: 'Sila pilih fail imej atau PDF.' }
      : { scanning: 'Scanning document...', converting: 'Converting PDF to image...', done: 'Document scanned — please review the fields.', err: 'Scan error: ', badFile: 'Please select an image or PDF file.' };
    var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    var isImage = file.type.indexOf('image/') === 0;
    if (!isPdf && !isImage) { showToast(t.badFile, 'warning'); event.target.value = ''; return; }
    var statusEl = document.getElementById('cust-scan-status');
    if (statusEl) statusEl.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></div> ' + t.scanning;
    try {
      var pageBlobs = [file];
      if (isPdf) {
        if (statusEl) statusEl.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></div> ' + t.converting;
        pageBlobs = await _pdfPagesToImageBlobs(file);
        if (statusEl) statusEl.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></div> ' + t.scanning;
      }
      var images = await Promise.all(pageBlobs.map(function (blob) { return _compressImageToBase64(blob); }));
      var res = await _invokeAiProxy({
        action: 'scan_customer_document',
        images: images.map(function (img) { return { image_base64: img.base64, mime_type: img.mimeType }; })
      });
      if (res.error) throw res.error;
      if (!res.data || !res.data.success) throw new Error((res.data && res.data.error) || 'Unknown error');
      try { _usageCaptureAi(); } catch (e) {}
      var r = res.data.data || {};
      setVal('cf-name', r.name);
      setVal('cf-email', r.email);
      setVal('cf-phone', r.phone);
      setVal('cf-addr', r.address);
      setVal('cf-city', r.city);
      setVal('cf-postcode', r.postcode);
      var st = matchState(r.state);
      if (st) setVal('cf-state', st);
      if (statusEl) statusEl.textContent = t.done;
    } catch (err) {
      var msg = err && err.message ? err.message : String(err);
      if (statusEl) statusEl.textContent = t.err + msg;
      showToast(t.err + msg, 'error');
    }
    event.target.value = '';
  };
  function inject() {
    if (!document.getElementById('cf-name')) return;
    if (document.getElementById('cust-scan-input')) return;
    var nameWrap = document.getElementById('cf-name').closest('.form-group');
    if (!nameWrap) return;
    var isBm = APP.language === 'bm';
    var box = document.createElement('div');
    box.className = 'form-group';
    box.style.gridColumn = '1 / -1';
    box.innerHTML = '<label class="form-label">' + (isBm ? 'Imbas dokumen' : 'Scan document') + '</label>' +
      '<input type="file" accept="image/*,application/pdf" id="cust-scan-input" style="display:block;margin-top:4px">' +
      '<div id="cust-scan-status" style="margin-top:4px;font-size:12px;color:var(--text-3)"></div>';
    nameWrap.parentNode.insertBefore(box, nameWrap);
    document.getElementById('cust-scan-input').onchange = function (e) { window._custScanDocument(e); };
  }
  var orig = window.renderCustomerForm;
  if (typeof orig === 'function' && !orig._crmScan) {
    window.renderCustomerForm = async function () {
      var r = await orig.apply(this, arguments);
      setTimeout(inject, 0);
      setTimeout(inject, 300);
      return r;
    };
    window.renderCustomerForm._crmScan = true;
  }
  setInterval(inject, 1200);
})();
