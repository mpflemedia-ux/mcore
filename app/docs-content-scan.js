/* Bank-recon style: PDF/image → page images → AI. */
(function () {
  var scanning = false;

  function t(en, bm) { return APP.language === 'bm' ? bm : en; }

  async function pagesOf(file) {
    if (file.type.indexOf('image/') === 0) return [file];
    if (typeof _pdfPagesToImageBlobs !== 'function') throw new Error('PDF helper missing');
    return _pdfPagesToImageBlobs(file, 3);
  }

  async function scanFile(file) {
    if (scanning) return;
    scanning = true;
    window._docsOrigName = file.name;
    window._docsLastFile = file;
    window._docsScanText = file.name;
    try {
      showToast(t('Reading document pages…', 'Membaca muka surat dokumen…'), 'info');
      var blobs = await pagesOf(file);
      var images = await Promise.all(blobs.map(function (b) { return _compressImageToBase64(b); }));
      var bits = [file.name];
      var rec = await _invokeAiProxy({
        action: 'receipt',
        image_base64: images[0].base64,
        mime_type: images[0].mimeType || 'image/jpeg'
      });
      if (rec && rec.data && rec.data.success && rec.data.data) {
        var r = rec.data.data;
        bits.push(r.vendor || '', r.merchant || '', r.description || '', r.notes || '');
      }
      var cust = await _invokeAiProxy({
        action: 'scan_customer_document',
        images: images.map(function (img) {
          return { image_base64: img.base64, mime_type: img.mimeType };
        })
      });
      if (cust && cust.data && cust.data.success && cust.data.data) {
        var c = cust.data.data;
        bits.push(c.name || '', c.address || '', c.email || '', c.notes || '', c.document_type || '');
      }
      try { if (typeof _usageCaptureAi === 'function') _usageCaptureAi(); } catch (e) {}
      window._docsScanText = bits.filter(Boolean).join(' ');
      showToast(t('Document pages read', 'Muka surat dokumen dibaca'), 'success');
    } catch (e) {
      window._docsScanText = file.name;
      showToast((e && e.message) || t('Scan failed', 'Imbasan gagal'), 'error');
    }
    scanning = false;
  }

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || el.id !== 'docs-file' || !el.files || !el.files[0]) return;
    scanFile(el.files[0]);
  }, true);
})();
