(function () {
  var scanning = false;
  var SOP =
    'AGREED ROUTING RULE (locked):\n' +
    'Client = company on the LETTERHEAD (not Bill To, not names only in description).\n' +
    'who MUST be the letterhead company.\n' +
    'If document text does NOT mention Phion -> file under 05_Clients/{letterhead}/category.\n' +
    'If Phion IS mentioned -> use Phion company paths (01-09), e.g. 02_Finance/02.1_Invoices (Client).\n' +
    'Never prefer Bill To / description names (e.g. Holographix, Nuhea in description) over letterhead.\n' +
    'CATEGORY MAP under 05_Clients/{Name}/:\n' +
    'invoice|receipt|PV|claim|SOA -> 06_Invoices & Payment\n' +
    'contract|SSM|NDA|agreement -> 01_Contracts & Agreements\n' +
    'quotation|proposal|brief -> 02_Proposals & Quotations\n' +
    'feedback|revision -> 08_Feedback & Revisions\n' +
    'letter|meeting|minutes -> 07_Meeting Notes & Communication\n' +
    'default -> 07_Meeting Notes & Communication\n' +
    'Also: 03_Brief & Requirements, 04_Working Files, 05_Final Deliverables when clear.\n' +
    'Return JSON only: {"what":"...","who":"...","folder":"...","why":"..."} who = letterhead company.';

  var KNOWN = [
    ['fade boys', 'Fade Boys Worldwide'],
    ['fadeboys', 'Fade Boys Worldwide'],
    ['atas angin', 'Atas Angin MY Sdn. Bhd'],
    ['brozky', 'Brzky Empire'],
    ['brzky', 'Brzky Empire'],
    ['clore', 'Clore Health And Beauty'],
    ['mayang', 'Mayangs'],
    ['nuhea', 'Nuhea'],
    ['tns consulting', 'TNS Consulting'],
    ['tns consult', 'TNS Consulting']
  ];

  function t(en, bm) { return APP.language === 'bm' ? bm : en; }
  function titleClient(name) {
    return String(name || '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map(function (w) {
        if (/^(sdn|bhd|my|tns|ssm|nda|soa|pv)$/i.test(w)) return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');
  }
  function normalizeWho(who) {
    var raw = String(who || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw === '-' || raw === '-') return '';
    var low = raw.toLowerCase();
    for (var i = 0; i < KNOWN.length; i++) {
      if (low.indexOf(KNOWN[i][0]) >= 0 || KNOWN[i][0].indexOf(low) >= 0 || low === KNOWN[i][1].toLowerCase()) {
        return KNOWN[i][1];
      }
    }
    return titleClient(raw);
  }
  function clientSlot(what, text) {
    var w = String(what || '').toLowerCase() + ' ' + String(text || '').toLowerCase();
    if (/invoice|invois|\binv\b|receipt|resit|\bpv\b|voucher|claim|soa|payment/.test(w)) return '06_Invoices & Payment';
    if (/contract|agreement|ssm|nda|mou|borang|perjanjian|kontrak/.test(w)) return '01_Contracts & Agreements';
    if (/quotat|proposal|brief|sales order|sebut harga/.test(w)) return '02_Proposals & Quotations';
    if (/feedback|revision|revisi/.test(w)) return '08_Feedback & Revisions';
    if (/deliverable|final\b|artwork final/.test(w)) return '05_Final Deliverables';
    if (/working file|draft|wip/.test(w)) return '04_Working Files';
    if (/requirement|scope|brief/.test(w)) return '03_Brief & Requirements';
    if (/letter|meeting|minutes|surat|minit/.test(w)) return '07_Meeting Notes & Communication';
    return '07_Meeting Notes & Communication';
  }
  function phionFolder(what, text) {
    var w = String(what || '').toLowerCase() + ' ' + String(text || '').toLowerCase();
    if (/invoice|invois|receipt|resit|soa/.test(w)) return '02_Finance/02.1_Invoices (Client)';
    if (/\bpv\b|voucher|claim/.test(w)) return '02_Finance/02.6_Payment Vouchers & Claims';
    if (/ssm|borang|form 9|form 24|form 49/.test(w)) return '01_Administration/01.1_Company Registration & SSM';
    if (/contract|nda|agreement|mou/.test(w)) return '08_Legal/08.1_Master Contracts';
    if (/offer letter|probation|staff letter|\bloa\b|payslip|leave|cuti/.test(w)) return '03_Human Resource/03.1_Employee Records';
    if (/logo|banner|poster|brand/.test(w)) return '04_Brand & Marketing/04.2_Logo & Visual Assets';
    if (/quotat|proposal|project/.test(w)) return '07_Projects';
    return '01_Administration';
  }
  function mentionsPhion(text, who) {
    return /phion/i.test(String(text || '') + ' ' + String(who || ''));
  }
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
    var who = normalizeWho(cls.who);
    if (who) cls.who = who;
    if (mentionsPhion(text, who)) {
      cls.folder = phionFolder(cls.what, text);
      return cls;
    }
    if (!who) return cls;
    var slot = clientSlot(cls.what, text);
    cls.folder = '05_Clients/' + who + '/' + slot;
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
      showToast(t('Reading full document...', 'Membaca keseluruhan dokumen...'), 'info');
      var text = await pdfFullText(file);
      if (gen !== window._docsScanGen) { scanning = false; return; }
      window._docsScanText = [file.name, text].filter(Boolean).join('\n');
      showToast(t('Understanding document...', 'Memahami dokumen...'), 'info');
      var cls = await understand(file, window._docsScanText);
      if (gen !== window._docsScanGen) { scanning = false; return; }
      if (cls && cls.folder) {
        window._docsAiClass = cls;
        showToast(t('Document understood', 'Dokumen difahami'), 'success');
      } else {
        showToast(t('AI unclear - using rules', 'AI x pasti - guna rule'), 'info');
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
