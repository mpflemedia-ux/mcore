/* M-Core Onboarding Checklist - master edit drawer + actions (mockup ob5). Edits only the DRAFT version; publish makes it live for new tenants. */
(function () {
  var C = window.COB; if (!C || C._medit) return; C._medit = 1;
  var E = C.esc, L = C.L, M = C.M;
  var MODS = [['', '—'], ['settings|{}', 'Tetapan / Settings'], ['hr|{}', 'SDM & Gaji / HR'], ['hr|{"view":"leave"}', 'SDM › Cuti / Leave'], ['crm|{}', 'Pelanggan / Customers'], ['sales|{}', 'Jualan / Sales'],
    ['inventory|{}', 'Inventori / Inventory'], ['purchasing|{"view":"suppliers"}', 'Perolehan › Pembekal / Suppliers'], ['purchasing|{"view":"bills"}', 'Perolehan › Bil / Bills'], ['accounting|{}', 'Perakaunan / Accounting'],
    ['accounting|{"view":"opening-balance"}', 'Perakaunan › Baki pembukaan'], ['accounting|{"view":"fixed-assets"}', 'Perakaunan › Aset tetap'], ['production|{}', 'Pengeluaran / Production'], ['applicants|{}', 'Permohonan Kerja / Applicants']];
  function modKey(i) { return i.module_page ? i.module_page + '|' + JSON.stringify(i.module_params || {}) : ''; }
  function fg(l, inner, id) { return '<div style="margin-bottom:12px"><label class="cob-sm" ' + (id ? 'for="' + id + '" ' : '') + 'style="display:block;margin-bottom:5px">' + l + '</label>' + inner + '</div>'; }
  function seg(name, val, opts, dis) { return '<div class="cob-seg" role="group">' + opts.map(function (o) { return '<button type="button" data-seg="' + name + '" data-v="' + o[0] + '" class="' + (val === o[0] ? 'on' : '') + '"' + (dis ? ' disabled' : '') + '>' + o[1] + '</button>'; }).join('') + '</div>'; }
  function sw(name, on, lab, dis) { return '<div class="row" style="justify-content:space-between;min-height:36px;font-size:13px"><span>' + lab + '</span><button type="button" class="cob-sw' + (on ? ' on' : '') + '" data-sw="' + name + '" role="switch" aria-checked="' + !!on + '" aria-label="' + E(lab.replace(/<[^>]+>/g, '')) + '"' + (dis ? ' disabled' : '') + '></button></div>'; }
  C.drawer = function () {
    var d = M.d, i = d.items.find(function (x) { return x.id === M.sel; }); if (!i) return '';
    var dr = d.v.status === 'draft', dis = dr ? '' : ' disabled', W = M.w = M.w && M.w.id === i.id ? M.w : JSON.parse(JSON.stringify(i));
    var h = '<div class="cob-card" style="padding:14px"><div class="row" style="justify-content:space-between;margin-bottom:12px"><b style="font-size:14px">' + L('Edit item ', 'Edit item ') + E(i.code) + '</b><button class="btn btn-sm btn-outline btn-icon" data-d="close" style="width:28px;height:28px" aria-label="' + L('Close', 'Tutup') + '"><i class="ti ti-x"></i></button></div>';
    if (!dr) h += '<div class="cob-banner info" style="margin-bottom:12px;padding:8px 10px;font-size:12.5px"><i class="ti ti-lock" style="font-size:16px"></i><div>' + L('Published version is read-only. Create a new draft to edit.', 'Versi terbitan hanya baca. Buat draf baharu untuk edit.') + '</div></div>';
    h += fg('Label (BM)', '<input class="cob-in" id="cob-lbm" maxlength="200" value="' + E(W.label_bm) + '"' + dis + '>', 'cob-lbm') + fg('Label (EN)', '<input class="cob-in" id="cob-len" maxlength="200" value="' + E(W.label_en) + '"' + dis + '>', 'cob-len');
    h += fg(L('Note (BM)', 'Nota (BM)'), '<input class="cob-in" id="cob-nbm" maxlength="200" value="' + E(W.note_bm || '') + '"' + dis + '>', 'cob-nbm') + fg(L('Note (EN)', 'Nota (EN)'), '<input class="cob-in" id="cob-nen" maxlength="200" value="' + E(W.note_en || '') + '"' + dis + '>', 'cob-nen');
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' + fg(L('Section', 'Seksyen'), '<select class="cob-in" id="cob-sec"' + dis + '>' + d.secs.map(function (s) { return '<option value="' + E(s.key) + '"' + (s.key === W.section_key ? ' selected' : '') + '>' + E(s.key + ' · ' + C.lab(s, 'name')) + '</option>'; }).join('') + '</select>', 'cob-sec') +
      fg(L('Requirement', 'Keperluan'), seg('requirement', W.requirement, [['required', L('Required', 'Wajib')], ['if_applicable', L('If applicable', 'Jika berkenaan')]], !dr)) + '</div>';
    h += fg(L('Type', 'Jenis'), seg('item_type', W.item_type, [['doc', L('Document', 'Dokumen')], ['form', L('Form', 'Borang')], ['list', L('List', 'Senarai')]], !dr));
    h += fg(L('Target field', 'Medan sasaran'), '<div class="cob-in cob-mono" style="font-size:12px;display:flex;align-items:center;color:var(--text-2)">' + E(C.targets(W)) + '</div><div class="cob-xs" style="margin-top:4px">' + L('Only real company columns can be targets (set in SQL allowlist).', 'Hanya lajur syarikat sebenar boleh jadi sasaran (senarai dibenarkan SQL).') + '</div>');
    if (W.item_type === 'list') h += fg(L('CSV template columns', 'Lajur templat CSV'), '<input class="cob-in cob-mono" id="cob-tpl" maxlength="500" value="' + E(W.template_header || '') + '"' + dis + ' placeholder="name,email,…">', 'cob-tpl');
    h += fg(L('AI reads document', 'AI baca dokumen'), '<select class="cob-in" id="cob-ai"' + dis + '><option value="">—</option><option value="scan_ssm_certificate"' + (W.ai_action === 'scan_ssm_certificate' ? ' selected' : '') + '>' + L('SSM certificate', 'Sijil SSM') + '</option><option value="scan_bank_statement"' + (W.ai_action === 'scan_bank_statement' ? ' selected' : '') + '>' + L('Bank statement', 'Penyata bank') + '</option></select>', 'cob-ai');
    h += sw('track_expiry', W.track_expiry, L('Track document expiry', 'Jejak tarikh tamat dokumen'), !dr) + sw('urgent', W.urgent, L('Urgent notification to admin (B/C/E)', 'Notifikasi segera ke admin (B/C/E)'), !dr);
    h += fg(L('Module link', 'Pautan modul'), '<select class="cob-in" id="cob-mod"' + dis + '>' + MODS.map(function (o) { return '<option value="' + E(o[0]) + '"' + (o[0] === modKey(W) ? ' selected' : '') + '>' + E(o[1]) + '</option>'; }).join('') + '</select>', 'cob-mod');
    if (dr) h += '<div class="row" style="gap:8px;margin-top:4px"><button class="btn btn-outline" data-d="close" style="flex:1;justify-content:center">' + L('Cancel', 'Batal') + '</button><button class="btn btn-primary" data-d="save" style="flex:1.3;justify-content:center"><i class="ti ti-device-floppy"></i>' + L('Save draft', 'Simpan draf') + '</button></div>' +
      '<button class="btn btn-sm btn-outline" data-d="del" style="width:100%;margin-top:8px;justify-content:center;color:var(--cob-bad)"><i class="ti ti-trash"></i>' + L('Remove from draft', 'Buang dari draf') + '</button><div class="cob-xs" style="margin-top:8px;text-align:center">' + L('Tenants see changes after "Publish v', 'Tenant nampak perubahan selepas "Terbitkan v') + d.v.version + '"</div>';
    return h + '</div>';
  };
  C.bindDrawer = function () {
    var box = document.getElementById('cob-drawer'); if (!box || !M.w) return;
    box.onclick = function (ev) {
      var b = ev.target.closest('[data-seg],[data-sw],[data-d]'); if (!b || b.disabled) return;
      read();
      if (b.dataset.seg) { M.w[b.dataset.seg] = b.dataset.v; C.drawMaster(); }
      else if (b.dataset.sw) { M.w[b.dataset.sw] = !M.w[b.dataset.sw]; C.drawMaster(); }
      else if (b.dataset.d === 'close') { M.sel = null; M.w = null; C.drawMaster(); }
      else if (b.dataset.d === 'save') save();
      else if (b.dataset.d === 'del') del();
    };
  };
  function read() {
    var W = M.w, g = function (id) { var e = document.getElementById(id); return e ? e.value : null; }, v;
    if ((v = g('cob-lbm')) !== null) W.label_bm = v; if ((v = g('cob-len')) !== null) W.label_en = v;
    if ((v = g('cob-nbm')) !== null) W.note_bm = v; if ((v = g('cob-nen')) !== null) W.note_en = v;
    if ((v = g('cob-sec')) !== null) W.section_key = v; if ((v = g('cob-tpl')) !== null) W.template_header = v;
    if ((v = g('cob-ai')) !== null) W.ai_action = v || null;
    if ((v = g('cob-mod')) !== null) { var p = v.split('|'); W.module_page = p[0] || null; W.module_params = p[1] ? JSON.parse(p[1]) : {}; }
  }
  function ok(r) { if (r.error) throw r.error; if (r.data && Array.isArray(r.data) && !r.data.length) throw new Error(L('Not saved (no permission)', 'Tidak disimpan (tiada kebenaran)')); return r; }
  function fail(e) { C.toast(C.err(e), 'error'); }
  function reload(msg) { if (msg) C.toast(msg, 'success'); return C.view.cob_master(); }
  function save() {
    var W = M.w; if (!W.label_bm.trim() || !W.label_en.trim()) return C.toast(L('Both labels are required', 'Kedua-dua label diperlukan'), 'warning');
    sb.from('cob_master_items').update({ label_bm: W.label_bm.trim(), label_en: W.label_en.trim(), note_bm: (W.note_bm || '').trim() || null, note_en: (W.note_en || '').trim() || null, section_key: W.section_key,
      requirement: W.requirement, item_type: W.item_type, template_header: W.item_type === 'list' ? ((W.template_header || '').trim() || null) : null, ai_action: W.ai_action || null,
      track_expiry: !!W.track_expiry, urgent: !!W.urgent, module_page: W.module_page || null, module_params: W.module_params || {} }).eq('id', W.id).select('id').then(ok).then(function () { M.w = null; return reload(L('Draft saved', 'Draf disimpan')); }).catch(fail);
  }
  function del() {
    if (!window.confirm(L('Remove this item from the draft?', 'Buang item ini dari draf?'))) return;
    sb.from('cob_master_items').update({ deleted_at: new Date().toISOString() }).eq('id', M.w.id).select('id').then(ok).then(function () { M.sel = null; M.w = null; return reload(L('Removed', 'Dibuang')); }).catch(fail);
  }
  C.masterAct = function (a) {
    var d = M.d;
    if (a === 'draft') return sb.rpc('cob_new_draft', {}).then(ok).then(function () { return reload(L('Draft created', 'Draf dicipta')); }).catch(fail);
    if (a === 'publish') {
      if (!window.confirm(L('Publish v', 'Terbitkan v') + d.v.version + '? ' + L('New tenants will use this version; existing tenants keep their copy.', 'Tenant baharu akan guna versi ini; tenant sedia ada kekal dengan salinan mereka.'))) return;
      return sb.rpc('cob_publish', { p_version: d.v.id }).then(ok).then(function () { return reload(L('Published', 'Diterbitkan')); }).catch(fail);
    }
    if (a === 'additem') {
      var bm = window.prompt(L('Item label (BM)', 'Label item (BM)'), ''); if (!bm || !bm.trim()) return;
      var en = window.prompt(L('Item label (EN)', 'Label item (EN)'), ''); if (!en || !en.trim()) return;
      var inSec = d.items.filter(function (i) { return i.section_key === M.sec; }), n = inSec.reduce(function (m, i) { return Math.max(m, parseInt(i.code.slice(1), 10) || 0); }, 0) + 1;
      if (n > 99) return C.toast(L('Section is full', 'Seksyen penuh'), 'warning');
      return sb.from('cob_master_items').insert({ version_id: d.v.id, section_key: M.sec, code: M.sec + n, sort_order: n, label_bm: bm.trim(), label_en: en.trim(), urgent: ['B', 'C', 'E'].indexOf(M.sec) >= 0 }).select('id').single()
        .then(function (r) { if (r.error) throw r.error; M.sel = r.data.id; M.w = null; return reload(L('Item added', 'Item ditambah')); }).catch(fail);
    }
    if (a === 'addsec') {
      var used = d.secs.map(function (s) { return s.key; }), k = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(function (c) { return used.indexOf(c) < 0; }); if (!k) return;
      var nb = window.prompt(L('Section name (BM)', 'Nama seksyen (BM)'), ''); if (!nb || !nb.trim()) return;
      var ne = window.prompt(L('Section name (EN)', 'Nama seksyen (EN)'), ''); if (!ne || !ne.trim()) return;
      return sb.from('cob_master_sections').insert({ version_id: d.v.id, key: k, name_bm: nb.trim(), name_en: ne.trim(), is_core: false, sort_order: k.charCodeAt(0) - 65 }).select('id').single()
        .then(function (r) { if (r.error) throw r.error; M.sec = k; return reload(L('Section added', 'Seksyen ditambah')); }).catch(fail);
    }
  };
})();
