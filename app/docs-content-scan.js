(function () {
  var scanning = false;
  var SOP =
    'WHO = company on the LETTERHEAD, not the signatory and not the payee.\n' +
    'If letterhead is Brozky / Brzky / Fade Boys / Atas Angin / Clore / Mayangs / Nuhea → that company is a CLIENT. Put file under 05_Clients/{Client}/\u2026\n' +
    'Do NOT use 02_Finance Phion folders for a client letterhead document.\n' +
    'Phubieyas / Puteri signing a Brozky voucher does NOT make it a Phion document.\n' +
    'PV / invoice / receipt / claim for a client → 05_Clients/{Client}/06_Invoices & Payment\n' +
    'Contract for a client → 05_Clients/{Client}/01_Contracts & Agreements\n' +
    'Phion letterhead only → Phion 01-09 paths.\n' +
    'Clients: Fade Boys Worldwide, Atas Angin MY Sdn. Bhd, Brzky Empire, Clore Health And Beauty, Mayangs, Nuhea.\n' +
    'Return JSON only: {"what":"...","who":"...","folder":"...","why":"..."} who = letterhead company.';

  function t(en, bm) { return APP.language === 'bm' ? bm : en; }
  async function pdfFullText(file) {
    if (file.type.indexOf('image/') === 0) return '';
    if (typeof _loadPdfJs !== 'function') return '';
    var pdfjsLib = await _loadPdfJs();
    var pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    var out = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var content = await page.getTextContent();
      out.push(content.items.map(function (it) { return it.str; }).join(' '));
    }
    return out.join('\n');
  }
  function parseReply(reply) {
    var s = String(reply || '');
    var m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch (e) { return null; }
  }
  function forceClientFolder(cls, text) {
    if (!cls) return cls;
    var blob = String(text || '').toLowerCase();
    var map = [
      ['brozky', 'Brzky Empire'],
      ['brzky', 'Brzky Empire'],
      ['fade boys', 'Fade Boys Worldwide'],
      ['fadeboys', 'Fade Boys Worldwide'],
      ['atas angin', 'Atas Angin MY Sdn. Bhd'],
      ['clore', 'Clore Health And Beauty'],
      ['mayang', 'Mayangs'],
      ['nuhea', 'Nuhea']
    ];
    var client = null;
    for (var i = 0; i < map.length; i++) if (blob.indexOf(map[i][0]) >= 0) { client = map[i][1]; break; }
    if (!client) return cls;
    cls.who = client;
    var w = String(cls.what || '').toLowerCase();
    var slot = '07_Meeting Notes & Communication';
    if (/voucher|pv|invoice|receipt|claim|soa|payment/.test(w)) slot = '06_Invoices & Payment';
    else if (/contract|agreement|ssm|nda/.test(w)) slot = '01_Contracts & Agreements';
    else if (/quotat|proposal|brief|sales order/.test(w)) slot = '02_Proposals & Quotations';
    cls.folder = '05_Clients/' + client + '/' + slot;
    return cls;
  }
  async function understand(file, text) {
    if (typeof _invokeAiProxy !== 'function') return null;
    var msg = SOP + '\n\nFilename: ' + file.name + '\n\nDocument text:\n' + String(text || '').slice(0, 8000);
    var res = await _invokeAiProxy({ action: 'chat', message: msg, context: { source: 'documents' } });
    if (res.error) throw new Error(res.error.message || res.error);
    if (!res.data || !res.data.success) throw new Error((res.data && res.data.error) || 'AI failed');
    try { if (typeof _usageCaptureAi === 'function') _usageCaptureAi(); } catch (e) {}
    var reply = res.data.data && (res.data.data.reply || res.data.data.text || res.data.data);
    return forceClientFolder(parseReply(reply), text);
  }
  async function scanFile(file) {
    if (scanning) return;
    scanning = true;
    window._docsOrigName = file.name;
    window._docsLastFile = file;
    window._docsScanText = file.name;
    window._docsAiClass = null;
    window._docsScanGen = (window._docsScanGen || 0) + 1;
    var gen = window._docsScanGen;
    try {
      showToast(t('Reading full document…', 'Membaca keseluruhan dokumen…'), 'info');
      var text = await pdfFullText(file);
      if (gen !== window._docsScanGen) { scanning = false; return; }
      window._docsScanText = [file.name, text].filter(Boolean).join('\n');
      showToast(t('Understanding document…', 'Memahami dokumen…'), 'info');
      var cls = await understand(file, window._docsScanText);
      if (gen !== window._docsScanGen) { scanning = false; return; }
      if (cls && cls.folder) {
        window._docsAiClass = cls;
        showToast(t('Document understood', 'Dokumen difahami'), 'success');
      } else {
        showToast(t('AI unclear — using rules', 'AI x pasti — guna rule'), 'info');
      }
    } catch (e) {
      showToast((e && e.message) || t('Scan failed', 'Imbasan gagal'), 'error');
    }
    scanning = false;
  }
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || el.id !== 'docs-file' || !el.files || !el.files[0]) return;
    window._docsAiClass = null;
    window._docsScanText = el.files[0].name;
    window._docsOrigName = el.files[0].name;
    scanFile(el.files[0]);
  }, true);
})();
