(function () {
  var scanning = false;
  var SOP =
    'Phion folders:\n' +
    '01_Administration/01.1_Company Registration & SSM\n' +
    '01_Administration/01.2_Licenses & Permits\n' +
    '01_Administration/01.3_Policies & SOPs\n' +
    '01_Administration/01.4_Meeting Minutes\n' +
    '01_Administration/01.5_Office & Facilities\n' +
    '02_Finance/02.1_Invoices (Client)\n' +
    '02_Finance/02.2_Invoices (Vendor)\n' +
    '02_Finance/02.3_Bank Statements\n' +
    '02_Finance/02.5_Tax & Accounting\n' +
    '02_Finance/02.6_Payment Vouchers & Claims\n' +
    '03_Human Resource/03.1_Employee Records\n' +
    '03_Human Resource/03.2_Payroll & Claims\n' +
    '03_Human Resource/03.3_Recruitment\n' +
    '03_Human Resource/03.5_Leave & Attendance\n' +
    '04_Brand & Marketing/04.2_Logo & Visual Assets\n' +
    '04_Brand & Marketing/04.3_Marketing Materials\n' +
    '05_Clients/{Client}/01_Contracts & Agreements\n' +
    '05_Clients/{Client}/02_Proposals & Quotations\n' +
    '05_Clients/{Client}/06_Invoices & Payment\n' +
    '05_Clients/{Client}/07_Meeting Notes & Communication\n' +
    '06_Partners & Vendors/06.2_Vendors/{Vendor}\n' +
    '07_Projects\n' +
    '08_Legal/08.1_Master Contracts\n' +
    '08_Legal/08.2_NDAs\n' +
    'Clients: Fade Boys Worldwide, Atas Angin MY Sdn. Bhd, Brzky Empire, Clore Health And Beauty, Mayangs, Nuhea.\n' +
    'Rules: Phion letterhead alone is not the document type. Staff probation/LOA/warning = 03.1. Logo/png = 04.2. Client SSM = 05_Clients/{name}/01_Contracts.';

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

  async function understand(file, text) {
    if (typeof _invokeAiProxy !== 'function') return null;
    var msg =
      'Read this company document and classify it.\n' +
      'Return JSON only: {"what":"...","who":"...","folder":"...","why":"..."}\n' +
      'folder MUST be one path from the SOP list.\n\n' +
      SOP + '\n\nFilename: ' + file.name + '\n\nDocument text:\n' +
      String(text || '').slice(0, 8000);
    var res = await _invokeAiProxy({ action: 'chat', message: msg, context: { source: 'documents' } });
    if (res.error) throw new Error(res.error.message || res.error);
    if (!res.data || !res.data.success) throw new Error((res.data && res.data.error) || 'AI failed');
    try { if (typeof _usageCaptureAi === 'function') _usageCaptureAi(); } catch (e) {}
    var reply = res.data.data && (res.data.data.reply || res.data.data.text || res.data.data);
    return parseReply(reply);
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
      if (gen === window._docsScanGen) window._docsScanText = file.name;
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
