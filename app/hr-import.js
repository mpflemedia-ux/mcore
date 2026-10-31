/* hr-import.js — P2 Import HR data from onboarding E1–E6 (CSV / XLSX) with a preview.
   Sources: files picked here, or the latest uploads on this tenant's onboarding items E1–E6.
   Normalises IC (pad to 12 digits + dashes), splits "BANK 1234…" into bank + account, parses dates
   (Excel serial, d/m/yyyy, yyyy-mm-dd, d MMM yyyy). Flags suspicious dates + duplicate IC.
   IC and bank account are masked in the preview. Upsert by tenant_id + IC (digits).
   Access: tenant HR admin (canManageHR) or platform admin. Notifies owner/admin/HR (bell + push) with the count only.
   SheetJS loaded lazily from the same CDN as sales-plan-import.js. EN/BM, existing tokens only. */
(function () {
  if (window.HRImport) return;
  var I = window.HRImport = { v: 1 };
  var CDN = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js', loading = null;
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }
  function tid() { try { return APP.tenant.id; } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function toast(m, k) { try { showToast(m, k || 'success'); } catch (e) {} }
  function rm(n) { try { return formatRM(n); } catch (e) { return 'RM ' + Number(n || 0).toFixed(2); } }
  function can() { try { return (typeof canManageHR === 'function' && canManageHR()) || (typeof isPlatformAdmin === 'function' && isPlatformAdmin()); } catch (e) { return false; } }
  function colMissing(err) { return /column|schema cache|does not exist|PGRST204/i.test(String((err && (err.message || err.details)) || '')); }

  function loadXlsx() {
    if (window.SP && typeof SP.loadXlsx === 'function') return SP.loadXlsx();
    if (window.XLSX && window.XLSX.read) return Promise.resolve(window.XLSX);
    if (loading) return loading;
    loading = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = CDN; s.async = true;
      var to = setTimeout(function () { no(new Error('timeout')); }, 20000);
      s.onload = function () { clearTimeout(to); window.XLSX ? ok(window.XLSX) : no(new Error('no XLSX')); };
      s.onerror = function () { clearTimeout(to); no(new Error('load')); };
      document.head.appendChild(s);
    }).catch(function (e) { loading = null; throw e; });
    return loading;
  }
  async function readBuf(buf, name) {
    var X = await loadXlsx(), csv = /\.csv$/i.test(name || '') || /\.txt$/i.test(name || '');
    var wb = csv ? X.read(new TextDecoder('utf-8').decode(buf).replace(/^\uFEFF/, ''), { type: 'string', raw: true }) : X.read(buf, { type: 'array' });
    var out = [];
    wb.SheetNames.forEach(function (n) { out.push(X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null })); });
    return out;
  }

  /* ---------- normalisers ---------- */
  var SYN = {
    name: ['name', 'nama', 'fullname', 'employeename', 'namapekerja', 'namapenuh', 'staffname'],
    ic_no: ['icno', 'ic', 'nric', 'mykad', 'noic', 'icnumber', 'nokp', 'kadpengenalan', 'nokadpengenalan', 'icpassport'],
    position: ['position', 'jawatan', 'designation', 'jobtitle', 'title'],
    department: ['department', 'jabatan', 'dept', 'bahagian'],
    join_date: ['joindate', 'datejoined', 'joineddate', 'startdate', 'tarikhmula', 'tarikhmasuk', 'tarikhmulakerja', 'dateofjoining'],
    employment_type: ['employmenttype', 'jenispekerjaan', 'type', 'jenis', 'emptype', 'status'],
    contract_end_date: ['contractenddate', 'contractend', 'enddate', 'tarikhtamatkontrak', 'tamatkontrak'],
    basic_salary: ['basicsalary', 'gajipokok', 'basic', 'salary', 'gaji', 'gajiasas'],
    allowance_name: ['allowancename', 'allowancetype', 'jeniselaun', 'namaelaun'],
    allowance_amount: ['allowanceamount', 'allowance', 'elaun', 'jumlahelaun', 'amaunelaun'],
    epf_no: ['epfno', 'kwspno', 'nokwsp', 'epf', 'kwsp', 'noahlikwsp', 'epfnumber'],
    socso_no: ['socsono', 'perkesono', 'socso', 'perkeso', 'noperkeso', 'socsonumber'],
    bank_name: ['bankname', 'bank', 'namabank'],
    account_number: ['accountnumber', 'accountno', 'noakaun', 'bankaccount', 'bankaccountno', 'akaun', 'noakaunbank', 'acc', 'accno'],
    leave_type: ['leavetype', 'jeniscuti'],
    entitlement_days: ['entitlementdays', 'entitlement', 'kelayakan', 'leave', 'cuti', 'annualleave', 'cutitahunan', 'kelayakancuti'],
    balance_days: ['balancedays', 'balance', 'leavebalance', 'baki', 'bakicuti', 'openingbalance']
  };
  function hkey(h) { return String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function mapHeader(row) {
    var m = {};
    (row || []).forEach(function (h, i) {
      var k = hkey(h); if (!k) return;
      Object.keys(SYN).some(function (f) { if (m[f] == null && SYN[f].indexOf(k) >= 0) { m[f] = i; return true; } return false; });
    });
    return m;
  }
  function icDigits(v) {
    if (v == null) return '';
    var s = typeof v === 'number' ? String(Math.round(v)) : String(v);
    var d = s.replace(/\D/g, '');
    if (d.length >= 10 && d.length < 12) d = ('000' + d).slice(-12); // Excel drops leading zeros
    return d;
  }
  function icFmt(d) { return d && d.length === 12 ? d.slice(0, 6) + '-' + d.slice(6, 8) + '-' + d.slice(8) : (d || ''); }
  function icMask(d) { return d && d.length === 12 ? '******-**-' + d.slice(8) : (d ? '****' + d.slice(-4) : '—'); }
  function accMask(a) { a = String(a || '').replace(/\s/g, ''); return a ? '••••' + a.slice(-4) : '—'; }
  var MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, ogo: 8, ogos: 8, sep: 9, sept: 9, oct: 10, okt: 10, nov: 11, dec: 12, dis: 12 };
  function pad(n) { return ('0' + n).slice(-2); }
  function ymd(y, m, d) {
    y = Number(y); m = Number(m); d = Number(d);
    if (y < 100) y += y > 50 ? 1900 : 2000;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (!y || !m || !d || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return y + '-' + pad(m) + '-' + pad(d);
  }
  function parseDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    if (typeof v === 'number' || /^\d{4,5}(\.\d+)?$/.test(String(v).trim())) {
      var n = Number(v); if (n > 20000 && n < 80000) { var dt = new Date(Math.round((n - 25569) * 86400000)); return dt.toISOString().slice(0, 10); }
      return null;
    }
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return ymd(m[1], m[2], m[3]);
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/))) return ymd(m[3], m[2], m[1]); // Malaysia: d/m/y
    if ((m = s.match(/^(\d{1,2})[\s\-\/.]+([A-Za-z]{3,9})[\s\-\/.,]+(\d{2,4})$/))) { var mo = MON[m[2].toLowerCase().slice(0, 4)] || MON[m[2].toLowerCase().slice(0, 3)]; return mo ? ymd(m[3], mo, m[1]) : null; }
    return null;
  }
  function num(v) { if (v == null || v === '') return null; var n = Number(String(v).replace(/rm/i, '').replace(/,/g, '').trim()); return isFinite(n) ? Math.round(n * 100) / 100 : null; }
  function etype(v) { var s = String(v || '').toLowerCase(); if (/contract|kontrak/.test(s)) return 'contract'; if (/perm|tetap/.test(s)) return 'permanent'; return null; }
  function allowType(n) { var s = String(n || '').toLowerCase(); return /transport|pengangkutan|travel|perjalanan|petrol|minyak|fuel/.test(s) ? 'transport' : /meal|makan/.test(s) ? 'meal' : /hous|rumah|perumahan|sewa/.test(s) ? 'housing' : /phone|telefon|handphone|mobile/.test(s) ? 'phone' : 'other'; }
  function splitBank(name, acc) {
    var n = String(name || '').trim(), a = String(acc == null ? '' : acc).trim();
    if (!a && /\d{6,}/.test(n.replace(/[\s-]/g, ''))) { var m = n.match(/^(.*?)[\s:\-–]*([\d][\d\s-]{5,})$/); if (m) { n = m[1].trim(); a = m[2]; } }
    return { bank: n || null, acc: a ? a.replace(/[\s-]/g, '') : null };
  }

  /* ---------- merge rows by IC ---------- */
  function cell(row, m, f) { return m[f] == null ? null : row[m[f]]; }
  function ingest(state, rows, src) {
    var hi = -1, m = null;
    for (var i = 0; i < Math.min(rows.length, 15); i++) { var mm = mapHeader(rows[i]); if (mm.ic_no != null && Object.keys(mm).length >= 2) { hi = i; m = mm; break; } }
    if (hi < 0) { state.skipped.push(src + ': ' + L('no header row with IC', 'tiada baris tajuk dengan IC')); return; }
    var seen = {};
    for (var r = hi + 1; r < rows.length; r++) {
      var row = rows[r] || []; if (!row.some(function (c) { return c != null && String(c).trim() !== ''; })) continue;
      var d = icDigits(cell(row, m, 'ic_no')), nm = String(cell(row, m, 'name') || '').trim();
      if (!d) { state.skipped.push(src + ' #' + (r + 1) + ': ' + L('no IC', 'tiada IC') + (nm ? ' (' + nm + ')' : '')); continue; }
      var e = state.by[d] = state.by[d] || { ic: d, name: '', allow: [], flags: [], src: {} };
      var isAllowFile = m.allowance_name != null || m.allowance_amount != null;
      if (seen[d] && !isAllowFile && m.leave_type == null) { if (e.flags.indexOf('dup') < 0) e.flags.push('dup'); }
      seen[d] = 1; e.src[src] = 1;
      if (nm && !e.name) e.name = nm;
      else if (nm && e.name && hkey(nm) !== hkey(e.name) && e.flags.indexOf('name') < 0) e.flags.push('name');
      if (d.length !== 12 && e.flags.indexOf('ic') < 0) e.flags.push('ic');
      var v;
      if ((v = cell(row, m, 'position')) != null && String(v).trim()) e.position = String(v).trim();
      if ((v = cell(row, m, 'department')) != null && String(v).trim()) e.department = String(v).trim().toUpperCase();
      if ((v = cell(row, m, 'employment_type')) != null && etype(v)) e.employment_type = etype(v);
      if ((v = cell(row, m, 'join_date')) != null && String(v).trim()) { var jd = parseDate(v); if (jd) e.join_date = jd; else if (e.flags.indexOf('date') < 0) e.flags.push('date'); }
      if ((v = cell(row, m, 'contract_end_date')) != null && String(v).trim()) { var cd = parseDate(v); if (cd) e.contract_end_date = cd; }
      if ((v = num(cell(row, m, 'basic_salary'))) != null) e.basic_salary = v;
      var an = cell(row, m, 'allowance_name'), aa = num(cell(row, m, 'allowance_amount'));
      if (aa && aa > 0) e.allow.push({ type: allowType(an), label: String(an || ''), amount: aa });
      if ((v = cell(row, m, 'epf_no')) != null && String(v).trim()) e.epf_no = String(typeof v === 'number' ? Math.round(v) : v).trim();
      if ((v = cell(row, m, 'socso_no')) != null && String(v).trim()) e.socso_no = String(typeof v === 'number' ? Math.round(v) : v).trim();
      var bn = cell(row, m, 'bank_name'), ba = cell(row, m, 'account_number');
      if ((bn != null && String(bn).trim()) || (ba != null && String(ba).trim())) { var sp = splitBank(bn, typeof ba === 'number' ? String(Math.round(ba)) : ba); if (sp.bank) e.bank_name = sp.bank; if (sp.acc) e.bank_account_no = sp.acc; }
      if (m.entitlement_days != null || m.balance_days != null) {
        var lt = String(cell(row, m, 'leave_type') || 'annual').toLowerCase();
        if (/annual|tahunan|^al$|^$/.test(lt) || m.leave_type == null) {
          var ent = num(cell(row, m, 'entitlement_days')), bal = num(cell(row, m, 'balance_days'));
          if (ent != null) e.annual_leave_days = ent;
          if (bal != null) e.leave_opening_balance = bal;
        }
      }
    }
  }
  function suspicious(e) {
    var y = new Date().getFullYear(), now = Date.now();
    var bad = function (s) { if (!s) return false; var yy = Number(s.slice(0, 4)); return yy < 1960 || yy > y + 1; };
    if (bad(e.join_date) || (e.join_date && new Date(e.join_date).getTime() > now + 60 * 86400000)) return true;
    if (e.join_date && e.ic && e.ic.length === 12) { // born yymmdd from IC → joined before age 15?
      var yy = Number(e.ic.slice(0, 2)), by = yy + (yy > (y % 100) ? 1900 : 2000);
      if (Number(e.join_date.slice(0, 4)) < by + 15) return true;
    }
    if (bad(e.contract_end_date)) return true;
    return false;
  }

  /* ---------- UI ---------- */
  var S = null;
  function close() { var m = $('hri-modal'); if (m) m.remove(); S = null; }
  I.close = close;
  I.open = function () {
    if (!can()) { toast(L('HR admin only.', 'Untuk admin HR sahaja.'), 'error'); return; }
    close();
    S = { by: {}, skipped: [], files: [], existing: null };
    var h = '<div class="modal-overlay active" id="hri-modal"><div class="modal-box" style="max-width:960px">' +
      '<div class="modal-box-header"><i class="ti ti-file-import"></i> ' + L('Import HR data (onboarding E1–E6)', 'Import data HR (onboarding E1–E6)') + '</div>' +
      '<div class="modal-box-body" id="hri-body">' +
        '<div style="font-size:12px;color:var(--text-3)">' + L('Pick the CSV / Excel files (E1 employees, E2 contracts, E3 salary & allowances, E4 EPF/SOCSO, E5 bank, E6 leave) or load what the client uploaded in onboarding. Nothing is saved until you press Import.', 'Pilih fail CSV / Excel (E1 pekerja, E2 kontrak, E3 gaji & elaun, E4 KWSP/PERKESO, E5 bank, E6 cuti) atau muat naik dari onboarding. Tiada apa disimpan sehingga tekan Import.') + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
          '<label class="btn btn-outline btn-sm" style="white-space:nowrap;cursor:pointer"><i class="ti ti-upload"></i> ' + L('Choose files', 'Pilih fail') + '<input id="hri-file" type="file" accept=".csv,.xlsx,.xls" multiple style="display:none"></label>' +
          '<button type="button" class="btn btn-outline btn-sm" style="white-space:nowrap" id="hri-cob" onclick="HRImport.fromOnboarding(this)"><i class="ti ti-cloud-download"></i> ' + L('From onboarding uploads', 'Dari muat naik onboarding') + '</button>' +
        '</div>' +
        '<div id="hri-preview"><div class="empty-state" style="padding:24px"><p>' + L('No file loaded yet.', 'Belum ada fail dimuat.') + '</p></div></div>' +
      '</div>' +
      '<div class="modal-box-footer" style="flex-wrap:wrap;justify-content:flex-end">' +
        '<button type="button" class="btn btn-outline" style="white-space:nowrap" onclick="HRImport.close()">' + L('Cancel', 'Batal') + '</button>' +
        '<button type="button" class="btn btn-primary" style="white-space:nowrap" id="hri-go" disabled onclick="HRImport.run(this)"><i class="ti ti-check"></i> ' + L('Import', 'Import') + '</button>' +
      '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', h);
    $('hri-file').addEventListener('change', async function () {
      var fs = [].slice.call(this.files || []); if (!fs.length) return;
      setBusy(L('Reading files…', 'Membaca fail…'));
      try { for (var i = 0; i < fs.length; i++) await addBuf(await fs[i].arrayBuffer(), fs[i].name); await preview(); }
      catch (e) { setErr(e); }
      this.value = '';
    });
  };
  function setBusy(msg) { var p = $('hri-preview'); if (p) p.innerHTML = '<div class="empty-state" style="padding:24px"><div class="spinner"></div><p>' + esc(msg) + '</p></div>'; }
  function setErr(e) { var p = $('hri-preview'); if (p) p.innerHTML = '<div class="empty-state" style="padding:24px"><p style="color:var(--danger)">' + L('Error: ', 'Ralat: ') + esc(e && e.message || e) + '</p></div>'; }
  async function addBuf(buf, name) {
    var sheets = await readBuf(buf, name);
    sheets.forEach(function (rows, i) { ingest(S, rows, name + (sheets.length > 1 ? ' [' + (i + 1) + ']' : '')); });
    S.files.push(name);
  }
  I.fromOnboarding = async function (b) {
    if (!S || !window.sb || !tid()) return;
    if (b) b.disabled = true;
    setBusy(L('Loading onboarding uploads…', 'Memuat muat naik onboarding…'));
    try {
      var it = await sb.from('cob_items').select('id,code').eq('tenant_id', tid()).in('code', ['E1', 'E2', 'E3', 'E4', 'E5', 'E6']).is('deleted_at', null);
      if (it.error) throw it.error;
      var items = it.data || []; if (!items.length) throw new Error(L('No onboarding items E1–E6 for this tenant.', 'Tiada item onboarding E1–E6 untuk tenant ini.'));
      var fr = await sb.from('cob_files').select('id,item_id,storage_path,file_name,mime_type,version_no,created_at').eq('tenant_id', tid()).in('item_id', items.map(function (x) { return x.id; })).is('deleted_at', null);
      if (fr.error) throw fr.error;
      var latest = {};
      (fr.data || []).filter(function (f) { return /\.(csv|xlsx|xls)$/i.test(f.file_name || f.storage_path || ''); }).forEach(function (f) {
        var k = f.item_id, cur = latest[k];
        if (!cur || Number(f.version_no || 0) > Number(cur.version_no || 0) || (Number(f.version_no || 0) === Number(cur.version_no || 0) && String(f.created_at) > String(cur.created_at))) latest[k] = f;
      });
      var code = {}; items.forEach(function (x) { code[x.id] = x.code; });
      var list = Object.keys(latest).map(function (k) { return latest[k]; }).sort(function (a, c) { return String(code[a.item_id]).localeCompare(String(code[c.item_id])); });
      if (!list.length) throw new Error(L('No CSV / Excel uploaded on E1–E6 yet.', 'Belum ada CSV / Excel dimuat naik pada E1–E6.'));
      for (var i = 0; i < list.length; i++) {
        var f = list[i], su = await sb.storage.from('onboarding-docs').createSignedUrl(f.storage_path, 120);
        if (su.error || !su.data) throw (su.error || new Error('signed url'));
        var res = await fetch(su.data.signedUrl); if (!res.ok) throw new Error((f.file_name || '') + ': HTTP ' + res.status);
        await addBuf(await res.arrayBuffer(), code[f.item_id] + ' · ' + (f.file_name || f.storage_path.split('/').pop()));
      }
      await preview();
    } catch (e) { setErr(e); }
    finally { if (b) b.disabled = false; }
  };
  var FLAG = function (k) { return { dup: L('duplicate IC in file', 'IC berulang dalam fail'), name: L('name differs between files', 'nama berbeza antara fail'), ic: L('IC not 12 digits', 'IC bukan 12 digit'), date: L('date unreadable', 'tarikh tidak dapat dibaca'), sus: L('suspicious date', 'tarikh meragukan'), dbdup: L('IC matches 2+ employees', 'IC padan 2+ pekerja') }[k] || k; };
  async function preview() {
    if (!S.existing) {
      var q = await sb.from('employees').select('id,name,ic_no').eq('tenant_id', tid()).is('deleted_at', null);
      if (q.error) throw q.error;
      S.existing = {}; (q.data || []).forEach(function (e) { var d = icDigits(e.ic_no); if (!d) return; (S.existing[d] = S.existing[d] || []).push(e); });
    }
    var list = Object.keys(S.by).map(function (k) { return S.by[k]; });
    list.forEach(function (e) {
      if (suspicious(e) && e.flags.indexOf('sus') < 0) e.flags.push('sus');
      var ex = S.existing[e.ic] || [];
      e.match = ex.length === 1 ? ex[0] : null;
      if (ex.length > 1 && e.flags.indexOf('dbdup') < 0) e.flags.push('dbdup');
      e.blocked = e.flags.indexOf('ic') >= 0 || e.flags.indexOf('dbdup') >= 0 || (!e.match && !e.name);
    });
    list.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    S.list = list;
    var nNew = list.filter(function (e) { return !e.match && !e.blocked; }).length, nUp = list.filter(function (e) { return e.match && !e.blocked; }).length;
    var p = $('hri-preview');
    if (!list.length) { p.innerHTML = '<div class="empty-state" style="padding:24px"><p>' + L('No employee rows found.', 'Tiada baris pekerja dijumpai.') + '</p></div>' + skippedHtml(); $('hri-go').disabled = true; return; }
    p.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--text-2);margin-bottom:8px">' +
      '<span>' + L('Files', 'Fail') + ': <b>' + S.files.length + '</b></span><span>' + L('Update', 'Kemas kini') + ': <b>' + nUp + '</b></span><span>' + L('New', 'Baru') + ': <b>' + nNew + '</b></span>' +
      '<span>' + L('Flagged', 'Ditanda') + ': <b>' + list.filter(function (e) { return e.flags.length; }).length + '</b></span></div>' +
      '<div style="overflow-x:auto;max-height:52vh;overflow-y:auto"><table><thead><tr><th><input type="checkbox" id="hri-all" checked onchange="HRImport.all(this.checked)" aria-label="' + L('Select all', 'Pilih semua') + '"></th>' +
      '<th>' + L('Name', 'Nama') + '</th><th>IC</th><th>' + L('Department', 'Jabatan') + '</th><th>' + L('Position', 'Jawatan') + '</th><th>' + L('Type', 'Jenis') + '</th><th>' + L('Join date', 'Tarikh mula') + '</th>' +
      '<th style="text-align:right">' + L('Basic', 'Gaji pokok') + '</th><th>' + L('Allowances', 'Elaun') + '</th><th>EPF / SOCSO</th><th>Bank</th><th>' + L('Leave', 'Cuti') + '</th><th>' + L('Action', 'Tindakan') + '</th></tr></thead><tbody>' +
      list.map(function (e, i) {
        var act = e.blocked ? '<span style="color:var(--danger)">' + L('Skip', 'Langkau') + '</span>' : e.match ? L('Update', 'Kemas kini') : '<span style="color:var(--success)">' + L('New', 'Baru') + '</span>';
        var fl = e.flags.length ? '<div style="color:var(--warning);font-size:11px;white-space:normal">' + e.flags.map(FLAG).map(esc).join('; ') + '</div>' : '';
        return '<tr><td><input type="checkbox" class="hri-row" data-i="' + i + '"' + (e.blocked ? ' disabled' : ' checked') + '></td>' +
          '<td>' + esc(e.name || (e.match && e.match.name) || '-') + fl + '</td><td style="white-space:nowrap">' + esc(icMask(e.ic)) + '</td>' +
          '<td>' + esc(e.department || '') + '</td><td>' + esc(e.position || '') + '</td><td>' + esc(e.employment_type ? (e.employment_type === 'contract' ? L('Contract', 'Kontrak') : L('Permanent', 'Tetap')) : '') + '</td>' +
          '<td style="white-space:nowrap">' + esc(e.join_date || '') + '</td><td style="text-align:right;white-space:nowrap">' + (e.basic_salary != null ? rm(e.basic_salary) : '') + '</td>' +
          '<td style="white-space:nowrap">' + e.allow.slice(0, 3).map(function (a) { return esc(a.label || a.type) + ' ' + rm(a.amount); }).join('<br>') + (e.allow.length > 3 ? '<div style="color:var(--warning);font-size:11px">+' + (e.allow.length - 3) + L(' more (max 3)', ' lagi (maks 3)') + '</div>' : '') + '</td>' +
          '<td style="white-space:nowrap">' + esc([e.epf_no ? 'EPF ✓' : '', e.socso_no ? 'SOCSO ✓' : ''].filter(Boolean).join(' · ')) + '</td>' +
          '<td style="white-space:nowrap">' + esc(e.bank_name || '') + (e.bank_account_no ? ' ' + esc(accMask(e.bank_account_no)) : '') + '</td>' +
          '<td style="white-space:nowrap">' + (e.annual_leave_days != null || e.leave_opening_balance != null ? esc((e.annual_leave_days != null ? e.annual_leave_days : '-') + ' / ' + (e.leave_opening_balance != null ? e.leave_opening_balance : '-')) : '') + '</td>' +
          '<td style="white-space:nowrap">' + act + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div style="font-size:11px;color:var(--text-3);margin-top:6px">' + L('IC and bank account are masked. Leave = entitlement / opening balance (annual). Deductions in E3 are not imported (enter per month in Salary Disbursement). Empty cells never overwrite existing data.', 'IC dan akaun bank disorok. Cuti = kelayakan / baki pembukaan (tahunan). Potongan dalam E3 tidak diimport (masukkan setiap bulan di Penyaluran Gaji). Sel kosong tidak menindih data sedia ada.') + '</div>' + skippedHtml();
    $('hri-go').disabled = !(nNew + nUp);
  }
  function skippedHtml() { return S.skipped.length ? '<details style="font-size:12px;color:var(--text-3);margin-top:6px"><summary>' + L('Skipped rows', 'Baris dilangkau') + ' (' + S.skipped.length + ')</summary>' + S.skipped.slice(0, 50).map(esc).join('<br>') + '</details>' : ''; }
  I.all = function (on) { [].forEach.call(document.querySelectorAll('.hri-row:not([disabled])'), function (c) { c.checked = on; }); };

  var NEWC = ['department', 'employment_type', 'contract_end_date', 'annual_leave_days', 'leave_opening_balance', 'leave_opening_year', 'fixed_allowance_type_1', 'fixed_allowance_1', 'fixed_allowance_type_2', 'fixed_allowance_2', 'fixed_allowance_type_3', 'fixed_allowance_3'];
  function patchOf(e) {
    var p = {};
    ['name', 'position', 'department', 'employment_type', 'join_date', 'contract_end_date', 'basic_salary', 'epf_no', 'socso_no', 'bank_name', 'bank_account_no', 'annual_leave_days', 'leave_opening_balance'].forEach(function (k) {
      if (k === 'name' && e.match) return; // keep the existing name on update
      if (e[k] != null && e[k] !== '') p[k] = e[k];
    });
    if (p.leave_opening_balance != null) p.leave_opening_year = new Date().getFullYear();
    if (!e.match && e.ic && e.ic.length === 12) p.ic_no = icFmt(e.ic); // keep the stored IC format on update
    if (e.allow.length) e.allow.slice(0, 3).concat([null, null, null]).slice(0, 3).forEach(function (a, i) { p['fixed_allowance_type_' + (i + 1)] = a ? a.type : null; p['fixed_allowance_' + (i + 1)] = a ? a.amount : 0; });
    return p;
  }
  function strip(p) { var q = {}; Object.keys(p).forEach(function (k) { if (NEWC.indexOf(k) < 0) q[k] = p[k]; }); return q; }
  I.run = async function (b) {
    if (!S || !S.list || !can()) return;
    var picks = [].filter.call(document.querySelectorAll('.hri-row:checked'), function () { return true; }).map(function (c) { return S.list[Number(c.getAttribute('data-i'))]; }).filter(function (e) { return e && !e.blocked; });
    if (!picks.length) return;
    if (!window.confirm(L('Import ' + picks.length + ' employee record(s) into this company?', 'Import ' + picks.length + ' rekod pekerja ke syarikat ini?'))) return;
    b.disabled = true; b.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div>';
    var up = 0, add = 0, fail = [], noNew = false;
    for (var i = 0; i < picks.length; i++) {
      var e = picks[i], p = patchOf(e), r;
      try {
        if (e.match) {
          r = await sb.from('employees').update(p).eq('id', e.match.id).eq('tenant_id', tid());
          if (r.error && colMissing(r.error)) { noNew = true; r = await sb.from('employees').update(strip(p)).eq('id', e.match.id).eq('tenant_id', tid()); }
          if (r.error) throw r.error; up++;
        } else {
          var ins = Object.assign({ tenant_id: tid(), name: e.name, basic_salary: e.basic_salary || 0 }, p);
          r = await sb.from('employees').insert(ins).select('id').single();
          if (r.error && colMissing(r.error)) { noNew = true; r = await sb.from('employees').insert(strip(ins)).select('id').single(); }
          if (r.error) throw r.error; add++;
        }
      } catch (err) { fail.push((e.name || icMask(e.ic)) + ': ' + (err.message || err)); }
    }
    var p2 = $('hri-preview');
    if (p2) p2.innerHTML = '<div class="empty-state" style="padding:24px"><i class="ti ti-circle-check" style="font-size:32px;color:var(--success)"></i><p>' +
      L(up + ' updated, ' + add + ' added', up + ' dikemas kini, ' + add + ' ditambah') + (fail.length ? L(', ' + fail.length + ' failed', ', ' + fail.length + ' gagal') : '') + '.</p>' +
      (noNew ? '<p style="color:var(--warning);font-size:12px">' + L('Department / type / allowances / leave were skipped — run the 2026-10-31 HR SQL, then import again.', 'Jabatan / jenis / elaun / cuti dilangkau — jalankan SQL HR 2026-10-31, kemudian import semula.') + '</p>' : '') +
      (fail.length ? '<div style="font-size:12px;color:var(--danger);text-align:left">' + fail.slice(0, 20).map(esc).join('<br>') + '</div>' : '') + '</div>';
    b.innerHTML = '<i class="ti ti-check"></i> ' + L('Import', 'Import');
    var go = $('hri-go'); if (go) go.disabled = true;
    try { if (typeof auditLog === 'function') auditLog('hr_import', 'employees', tid(), undefined, { updated: up, added: add, failed: fail.length, files: S.files.length }); } catch (x) {}
    if ((up + add) && window.NT && NT.notify) {
      NT.notify({ kind: 'for_you', type: 'assigned.hr_import', title: L('HR data imported', 'Data HR diimport'),
        body: L(up + ' employees updated, ' + add + ' added', up + ' pekerja dikemas kini, ' + add + ' ditambah'),
        link: { page: 'hr', params: {} }, ref_table: 'employees', roles: ['owner', 'admin', 'hr'], group_key: 'hrimp:' + tid() + ':' + Date.now() });
    }
    toast(L('Import done.', 'Import selesai.'), fail.length ? 'warning' : 'success');
    try { if (typeof renderEmployeeList === 'function' && document.getElementById('emp-list-wrap')) renderEmployeeList(); } catch (x) {}
  };

  /* ---------- entry button on HR employee list ---------- */
  function mountBtn() {
    if (!$('emp-list-wrap') || $('hri-btn') || !can()) return;
    var add = document.querySelector('#main .page-header [onclick*="employee-form"]'); if (!add) return;
    var b = document.createElement('button'); b.id = 'hri-btn'; b.type = 'button'; b.className = 'btn btn-outline btn-sm'; b.style.whiteSpace = 'nowrap';
    b.innerHTML = '<i class="ti ti-file-import"></i> ' + L('Import HR', 'Import HR');
    b.onclick = function () { I.open(); };
    add.parentNode.insertBefore(b, add);
  }
  I._t = { icDigits: icDigits, icFmt: icFmt, parseDate: parseDate, splitBank: splitBank, ingest: ingest, suspicious: suspicious, allowType: allowType, mapHeader: mapHeader };
  var tmr = null;
  function boot() {
    var m = document.getElementById('main'); if (!m) return setTimeout(boot, 300);
    new MutationObserver(function () { clearTimeout(tmr); tmr = setTimeout(mountBtn, 100); }).observe(m, { childList: true, subtree: true });
    mountBtn();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
