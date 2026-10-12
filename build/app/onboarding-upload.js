/* M-Core Onboarding Checklist - item actions (mockup ob2): upload, logo, AI read, submit, Telegram, comments, file view. */
(function () {
  var C = window.COB; if (!C || C._upload) return; C._upload = 1;
  var E = C.esc, L = C.L, MAX = 10485760;
  C.bindItem = function (root) {
    var S = C.IS, it = S.it, $ = function (s) { return root.querySelector(s); };
    $('#cob-back').onclick = function () { C.go(S.page, S.back); };
    root.querySelectorAll('input[data-up]').forEach(function (inp) { inp.onchange = function () { upload(inp.files && inp.files[0]); inp.value = ''; }; });
    root.querySelectorAll('[data-k]').forEach(function (inp) { inp.oninput = function () { S.vals[inp.dataset.k] = inp.value; }; });
    root.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { C.openFile(it.id, S.files.find(function (f) { return f.id === b.dataset.view; }), false); }; });
    root.querySelectorAll('[data-st]').forEach(function (b) { b.onclick = function () { setSt(b.dataset.st); }; });
    var x;
    if ((x = $('[data-edit]'))) x.onclick = function () { S.edit = true; C.drawItem(); };
    if ((x = $('[data-gos]'))) x.onclick = function () { openPage('settings', {}); };
    if ((x = $('#cob-tpl'))) x.onclick = function () { C.csv(it.code, it.template_header); };
    if ((x = $('#cob-mod'))) x.onclick = function () { openPage(it.module_page, it.module_params || {}); };
    if ((x = $('#cob-exp'))) x.onchange = function () { S.expiry = this.value; C.drawItem(); };
    $('#cob-submit').onclick = submit;
    $('#cob-csend').onclick = comment;
  };
  C.csv = function (code, header) {
    var b = new Blob(['\ufeff' + String(header || '') + '\r\n'], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'mcore_onboarding_' + code + '.csv'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  /* Signed URL (2 min) only on explicit click; each open logged (view_doc / view_full). */
  C.openFile = function (itemId, f, full, target) {
    if (!f) return Promise.resolve(null);
    var w = target ? null : window.open('about:blank', '_blank');
    return sb.rpc('cob_log_view', { p_item: itemId, p_file: f.id, p_full: !!full }).then(function (r) {
      if (r.error) throw r.error;
      return sb.storage.from('onboarding-docs').createSignedUrl(f.storage_path, 120);
    }).then(function (r) {
      if (r.error || !r.data) throw r.error || new Error('no url');
      if (w) w.location = r.data.signedUrl; return r.data.signedUrl;
    }).catch(function (e) { if (w) w.close(); C.toast(C.err(e), 'error'); return null; });
  };
  function draw(msg) { C.IS.busy = msg || false; C.drawItem(); }
  function upload(file) {
    var S = C.IS, it = S.it; if (!file || S.busy) return;
    var isLogo = (it.fields || []).some(function (f) { return f.kind === 'logo'; }), ty = file.type || '', nm = file.name || 'file';
    if (file.size > MAX) return C.toast(L('File larger than 10 MB', 'Fail melebihi 10 MB'), 'warning');
    var ok = isLogo ? /^image\//.test(ty) : (/^image\/|application\/pdf/.test(ty) || /\.pdf$/i.test(nm) || (it.item_type === 'list' && /\.(csv|xlsx)$/i.test(nm)));
    if (!ok) return C.toast(L('File type not supported', 'Jenis fail tidak disokong'), 'warning');
    var v = S.files.reduce(function (m, f) { return Math.max(m, f.version_no || 0); }, 0) + 1;
    var path = it.tenant_id + '/' + it.id + '/v' + v + '-' + Date.now() + '-' + nm.replace(/[^\w.\-]+/g, '_').slice(-80);
    draw(L('Uploading…', 'Memuat naik…'));
    sb.storage.from('onboarding-docs').upload(path, file, { contentType: ty || 'application/octet-stream', upsert: false }).then(function (r) {
      if (r.error) throw r.error;
      return sb.from('cob_files').insert({ item_id: it.id, tenant_id: it.tenant_id, storage_path: path, file_name: nm, mime_type: ty, size_bytes: file.size }).select('*').single();
    }).then(function (r) {
      if (r.error) throw r.error;
      S.files.unshift(r.data); S.newFile = r.data;
      if (isLogo) return logo(file);
      if (it.ai_action && (/^image\//.test(ty) || /pdf/.test(ty) || /\.pdf$/i.test(nm))) { draw(L('AI is reading the document…', 'AI sedang membaca dokumen…')); return ai(file); }
    }).then(function () { draw(false); }).catch(function (e) { C.toast(C.err(e), 'error'); draw(false); });
  }
  function logo(file) {
    var S = C.IS, tid = S.it.tenant_id, ext = /svg/.test(file.type) ? '.svg' : '.png';
    var p = (ext === '.png' && !/png/.test(file.type) && typeof _compressImageToPngBlob === 'function') ? _compressImageToPngBlob(file, 1600) : Promise.resolve(file);
    var path = tid + '/logo-onb-' + Date.now() + ext;
    return p.then(function (blob) { return sb.storage.from('company-assets').upload(path, blob, { contentType: ext === '.svg' ? 'image/svg+xml' : 'image/png', upsert: false }); }).then(function (r) {
      if (r.error) throw r.error;
      S.vals.logo_url = sb.storage.from('company-assets').getPublicUrl(path).data.publicUrl;
    });
  }
  function ai(file) {
    var S = C.IS, it = S.it, isPdf = /pdf/.test(file.type) || /\.pdf$/i.test(file.name);
    if (typeof _invokeAiProxy !== 'function' || typeof _compressImageToBase64 !== 'function') { S.aiErr = L('AI not available', 'AI tidak tersedia'); S.edit = true; return Promise.resolve(); }
    return (isPdf && typeof _pdfPagesToImageBlobs === 'function' ? _pdfPagesToImageBlobs(file) : Promise.resolve([file])).then(function (bl) {
      return Promise.all(bl.map(function (b) { return _compressImageToBase64(b); }));
    }).then(function (imgs) {
      return _invokeAiProxy({ action: it.ai_action, images: imgs.map(function (i) { return { image_base64: i.base64, mime_type: i.mimeType }; }) });
    }).then(function (res) {
      if (!res || res.error) throw (res && res.error) || new Error('AI');
      var d = res.data; if (!d || !d.success) throw new Error((d && d.error) || 'AI');
      try { _usageCaptureAi(); } catch (e) {}
      var r = d.data || {}, map = it.ai_action === 'scan_ssm_certificate' ? { name: r.company_name, ssm_no: r.registration_no, incorporation_date: r.incorporation_date } : { bank_name: r.bank_name, account_number: r.account_number, account_name: r.account_name };
      Object.keys(map).forEach(function (k) { if (map[k] && S.vals.hasOwnProperty(k)) S.vals[k] = String(map[k]); });
      S.ai = true; S.edit = false; S.aiErr = null;
    }).catch(function (e) { S.aiErr = C.err(e); S.edit = true; });
  }
  function submit() {
    var S = C.IS, it = S.it; if (S.busy) return;
    var vals = {}; (it.fields || []).forEach(function (f) { if (S.vals[f.key] != null) vals[f.key] = String(S.vals[f.key]).trim(); });
    if (vals.incorporation_date && !/^\d{4}-\d{2}-\d{2}$/.test(vals.incorporation_date)) return C.toast(L('Incorporation date must be a valid date', 'Tarikh diperbadankan mesti tarikh sah'), 'warning');
    draw(L('Submitting…', 'Menghantar…'));
    sb.rpc('cob_submit', { p_item: it.id, p_values: vals, p_file: S.newFile ? S.newFile.id : null, p_ai: !!S.ai, p_expiry: S.expiry || null }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data || {};
      if (APP.tenant && String(APP.tenant.id) === String(it.tenant_id)) (d.applied || []).forEach(function (a) { APP.tenant[a.col] = a.value; });
      try { if ((d.applied || []).some(function (a) { return a.col === 'name'; })) document.getElementById('tenant-name-header').textContent = APP.tenant.name; } catch (e) {}
      if (d.urgent) (d.admins || []).forEach(function (a) {
        sb.functions.invoke('telegram-send', { body: { tenant_id: a.tenant_id, subject_type: 'user', subject_id: a.user_id, text: 'SEGERA · Onboarding ' + (d.tenant_name || '') + ': ' + it.code + ' ' + it.label_bm + ' dihantar. Semak di M-Core › Onboarding Klien.' } }).catch(function () {});
      });
      S.busy = false; C.toast(L('Submitted · active now, awaiting review', 'Dihantar · sudah aktif, menunggu semakan'), 'success');
      C.go(S.page, S.back);
    }).catch(function (e) { C.toast(C.err(e), 'error'); draw(false); });
  }
  function comment() {
    var S = C.IS, inp = document.getElementById('cob-cin'), body = (inp.value || '').trim(); if (!body) return;
    sb.from('cob_comments').insert({ tenant_id: S.it.tenant_id, item_id: S.it.id, body: body.slice(0, 2000), author_name: (APP.user && (APP.user.name || APP.user.email)) || null, is_platform: C.isPA() }).select('*').single().then(function (r) {
      if (r.error) throw r.error; S.com.push(r.data); C.drawItem();
    }).catch(function (e) { C.toast(C.err(e), 'error'); });
  }
  function setSt(st) {
    var S = C.IS, why = st === 'na' ? window.prompt(L('Reason (optional)', 'Sebab (pilihan)'), '') : '';
    if (why === null) return;
    sb.rpc('cob_set_status', { p_item: S.it.id, p_status: st, p_reason: why || null }).then(function (r) {
      if (r.error) throw r.error; C.itemView(S.it.id, S.page, S.back);
    }).catch(function (e) { C.toast(C.err(e), 'error'); });
  }
})();
