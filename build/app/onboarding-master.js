/* M-Core Onboarding Checklist - checklist master editor (mockup ob5): versions, sections, items table. Edit drawer in onboarding-master-edit.js. */
(function () {
  var C = window.COB; if (!C || C._master) return; C._master = 1;
  var E = C.esc, L = C.L;
  var M = C.M = { sec: null, sel: null };
  function q(r) { if (r.error) throw r.error; return r.data; }
  C.loadMaster = function () {
    return sb.from('cob_master_versions').select('*').is('deleted_at', null).then(function (r) {
      var vs = (q(r) || []).sort(function (a, b) { return b.version - a.version; });
      var v = vs.find(function (x) { return x.status === 'draft'; }) || vs.find(function (x) { return x.status === 'published'; }) || vs[0];
      if (!v) return { vs: vs, v: null, secs: [], items: [], used: 0 };
      return Promise.all([
        sb.from('cob_master_sections').select('*').eq('version_id', v.id).is('deleted_at', null),
        sb.from('cob_master_items').select('*').eq('version_id', v.id).is('deleted_at', null),
        sb.from('cob_checklists').select('id', { count: 'exact', head: true }).is('deleted_at', null)
      ]).then(function (x) {
        return { vs: vs, v: v, secs: (q(x[0]) || []).sort(function (a, b) { return a.sort_order - b.sort_order; }),
          items: (q(x[1]) || []).sort(function (a, b) { return a.sort_order - b.sort_order; }), used: x[2].count || 0 };
      });
    });
  };
  C.view.cob_master = function () { return C.loadMaster().then(function (d) { M.d = d; C.drawMaster(); }); };
  C.targets = function (it) { var t = (it.fields || []).filter(function (f) { return f.target; }).map(function (f) { return 'tenants.' + f.target; }); return t.length ? t.join(', ') : L('answer only', 'jawapan sahaja'); };
  C.drawMaster = function () {
    var d = M.d, m = document.getElementById('main'); if (APP.currentPage !== 'cob_master') return;
    if (!d.v) { m.innerHTML = '<div class="cob-root"><div class="cob-card cob-sm" style="padding:24px;text-align:center">' + L('No checklist master found. Run onboarding SQL part 5.', 'Tiada master senarai semak. Jalankan SQL onboarding bahagian 5.') + '</div></div>'; return; }
    var draft = d.v.status === 'draft', pub = d.vs.find(function (x) { return x.status === 'published'; });
    if (!M.sec || !d.secs.some(function (s) { return s.key === M.sec; })) M.sec = d.secs.length ? d.secs[0].key : null;
    var sec = d.secs.find(function (s) { return s.key === M.sec; }) || {}, list = d.items.filter(function (i) { return i.section_key === M.sec; });
    var h = '<div class="cob-root"><div class="cob-head"><div><div class="cob-h1">' + L('Checklist Master', 'Master Senarai Semak') + '</div><div class="cob-sm">' + d.secs.length + L(' sections · ', ' seksyen · ') + d.items.length + L(' items · used by ', ' item · diguna oleh ') + d.used + ' tenant</div></div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" data-m="versions"><i class="ti ti-history"></i>' + L('Versions', 'Versi') + '</button><button class="btn btn-outline btn-sm" data-m="preview"><i class="ti ti-eye"></i>' + L('Tenant preview', 'Pratonton tenant') + '</button>' +
      (draft ? '<button class="btn btn-primary btn-sm" data-m="publish"><i class="ti ti-send"></i>' + L('Publish v', 'Terbitkan v') + d.v.version + '</button>' : '<button class="btn btn-primary btn-sm" data-m="draft"><i class="ti ti-pencil-plus"></i>' + L('New draft v', 'Draf baharu v') + (Math.max.apply(null, d.vs.map(function (x) { return x.version; })) + 1) + '</button>') + '</div></div>';
    var strip = '<div class="row cob-chips" style="gap:6px;padding:10px 14px;border-bottom:1px solid var(--border);flex-wrap:wrap">';
    d.secs.forEach(function (s) {
      var n = d.items.filter(function (i) { return i.section_key === s.key; }).length;
      strip += '<button class="cob-chip' + (s.key === M.sec ? ' on' : '') + '" data-sec="' + E(s.key) + '" title="' + E(C.lab(s, 'name')) + '" style="font-size:12.5px;padding:5px 10px"><b>' + E(s.key) + '</b> <span class="cob-xs" style="color:inherit;opacity:.8">' + n + '</span>' + (s.is_core ? ' <span class="cob-ut" style="margin-left:4px">U</span>' : '') + '</button>';
    });
    strip += (draft ? '<button class="cob-chip" data-m="addsec" style="font-size:12.5px;padding:5px 10px"><i class="ti ti-plus"></i>' + L('Section', 'Seksyen') + '</button>' : '') + '<span class="cob-xs" style="margin-left:auto"><span class="cob-ut">U</span> ' + L('MAIN · B/C/E → urgent bell + Telegram', 'UTAMA · B/C/E → loceng + Telegram segera') + '</span></div>';
    var T = { doc: [L('Document', 'Dokumen'), 'ti-file-text', 'var(--danger)'], form: [L('Form', 'Borang'), 'ti-forms', 'var(--cob-info)'], list: [L('List', 'Senarai'), 'ti-table-import', 'var(--cob-ok)'] };
    var tbl = '<div class="cob-card" style="padding:0;overflow:hidden"><div class="row" style="padding:12px 14px;justify-content:space-between;border-bottom:1px solid var(--border)"><div><b style="font-size:14px">' + E((sec.key || '') + ' · ' + C.lab(sec, 'name')) + '</b>' + (sec.is_core ? ' <span class="cob-ut" style="margin-left:6px">' + L('MAIN', 'UTAMA') + '</span>' : '') +
      '<div class="cob-xs" style="margin-top:2px">' + list.length + L(' items · ', ' item · ') + list.filter(function (i) { return i.requirement === 'required'; }).length + L(' required · master v', ' wajib · versi master v') + d.v.version + ' (' + (draft ? L('draft', 'draf') : L('published ', 'diterbitkan ') + C.date(d.v.published_at)) + ')</div></div>' +
      (draft ? '<button class="btn btn-sm btn-primary" data-m="additem"><i class="ti ti-plus"></i>' + L('Add item', 'Tambah item') + '</button>' : '') + '</div>' + strip +
      '<div class="cob-scroll"><table class="cob-tbl"><thead><tr><th>' + L('Code', 'Kod') + '</th><th style="width:200px">Item</th><th>' + L('Requirement', 'Keperluan') + '</th><th>' + L('Type', 'Jenis') + '</th><th>' + L('Target field', 'Medan sasaran') + '</th><th>' + L('Template', 'Templat') + '</th><th>AI</th></tr></thead><tbody>';
    list.forEach(function (i) {
      var t = T[i.item_type] || T.doc;
      tbl += '<tr class="cob-click' + (M.sel === i.id ? ' sel' : '') + '" data-i="' + E(i.id) + '" tabindex="0"><td class="cob-mono" style="color:var(--cob-t3)">' + E(i.code) + '</td><td><div style="font-weight:600">' + E(C.lab(i, 'label')) + '</div><div class="cob-xs">' + E(C.lab(i, 'note') || '') + '</div></td>' +
        '<td>' + (i.requirement === 'required' ? '<span class="badge badge-blue">' + L('Required', 'Wajib') + '</span>' : '<span class="badge badge-gray" style="white-space:normal;display:inline-block;line-height:1.25;text-align:center">' + L('If<br>applicable', 'Jika<br>berkenaan') + '</span>') + '</td>' +
        '<td><span class="row" style="gap:5px;white-space:nowrap"><i class="ti ' + t[1] + '" style="color:' + t[2] + '"></i>' + t[0] + '</span></td><td class="cob-mono" style="font-size:11px;color:var(--text-2);word-break:break-all">' + E(C.targets(i)) + '</td>' +
        '<td>' + (i.template_header ? '<span class="row" style="gap:5px;color:var(--primary);white-space:nowrap"><i class="ti ti-file-spreadsheet"></i>' + E(i.code) + '.csv</span>' : '<span class="cob-xs">—</span>') + '</td><td><span class="cob-sw' + (i.ai_action ? ' on' : '') + '" role="img" aria-label="AI ' + (i.ai_action ? 'on' : 'off') + '" style="display:inline-block;transform:scale(.8)"></span></td></tr>';
    });
    if (!list.length) tbl += '<tr><td colspan="7" class="cob-sm" style="text-align:center;padding:24px">' + L('No items in this section', 'Tiada item dalam seksyen ini') + '</td></tr>';
    tbl += '</tbody></table></div></div>';
    m.innerHTML = h + '<div class="cob-g2">' + tbl + '<div id="cob-drawer">' + (C.drawer ? C.drawer() : '') + '</div></div></div>';
    m.firstChild.onclick = function (ev) {
      var b = ev.target.closest('[data-sec],[data-i],[data-m]'); if (!b) return;
      if (b.dataset.sec) { M.sec = b.dataset.sec; M.sel = null; C.drawMaster(); }
      else if (b.dataset.i) { M.sel = b.dataset.i; C.drawMaster(); }
      else if (b.dataset.m === 'versions') versions();
      else if (b.dataset.m === 'preview') preview();
      else if (C.masterAct) C.masterAct(b.dataset.m);
    };
    m.firstChild.onkeydown = function (ev) { var t = ev.target.dataset && ev.target.dataset.i; if (ev.key === 'Enter' && t) { M.sel = t; C.drawMaster(); } };
    if (C.bindDrawer) C.bindDrawer();
  };
  function versions() {
    C.modal(L('Versions', 'Versi'), M.d.vs.map(function (v) {
      return '<div class="row" style="padding:10px 14px;border-top:1px solid var(--border)"><b class="cob-mono">v' + v.version + '</b><div class="grow cob-sm">' + E(v.note || '') + '</div><span class="badge ' + (v.status === 'published' ? 'badge-green' : (v.status === 'draft' ? 'badge-blue' : 'badge-gray')) + '">' + ({ published: L('Published', 'Diterbitkan'), draft: L('Draft', 'Draf'), archived: L('Archived', 'Diarkib') }[v.status]) + '</span><span class="cob-xs" style="width:90px;text-align:right">' + (v.published_at ? C.date(v.published_at) : '—') + '</span></div>';
    }).join('') + '<div class="cob-xs" style="padding:10px 14px">' + L('New tenants copy the latest published version. Existing tenants keep their copy.', 'Tenant baharu menyalin versi terbitan terkini. Tenant sedia ada kekal dengan salinan mereka.') + '</div>');
  }
  function preview() {
    var d = M.d, h = '';
    d.secs.forEach(function (s) {
      h += '<div style="padding:10px 14px;border-top:1px solid var(--border)"><div class="row"><span class="cob-k">' + E(s.key) + '</span><b class="grow">' + E(C.lab(s, 'name')) + '</b>' + (s.is_core ? '<span class="cob-ut">' + L('MAIN', 'UTAMA') + '</span>' : '') + '</div>';
      d.items.filter(function (i) { return i.section_key === s.key; }).forEach(function (i) { h += '<div class="row" style="padding:6px 0 0 36px;align-items:flex-start"><i class="ti ' + C.typeIcon(i) + '" style="color:var(--cob-t3)"></i><div class="grow" style="font-size:13px"><span class="cob-mono" style="color:var(--cob-t3)">' + E(i.code) + '</span> ' + E(C.lab(i, 'label')) + '<div class="cob-xs">' + E(C.lab(i, 'note') || '') + '</div></div>' + C.st('pending') + '</div>'; });
      h += '</div>';
    });
    C.modal(L('Tenant preview · v', 'Pratonton tenant · v') + d.v.version, h);
  }
})();
