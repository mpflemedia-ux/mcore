/* M-Core Onboarding Checklist - item detail screen (mockup ob2): load + render. Actions in onboarding-upload.js. */
(function () {
  var C = window.COB; if (!C || C._item) return; C._item = 1;
  var E = C.esc, L = C.L;
  function q(r) { if (r.error) throw r.error; return r.data; }
  C.itemView = function (id, page, back) {
    return sb.from('cob_items').select('*').eq('id', id).is('deleted_at', null).maybeSingle().then(function (r) {
      var it = q(r); if (!it) throw new Error(L('Item not found', 'Item tidak dijumpai'));
      var cols = (it.fields || []).map(function (f) { return f.target; }).filter(Boolean);
      return Promise.all([
        sb.from('cob_files').select('*').eq('item_id', id).is('deleted_at', null),
        sb.from('cob_comments').select('*').eq('item_id', id).is('deleted_at', null),
        cols.length ? sb.from('tenants').select(['id', 'name'].concat(cols).join(',')).eq('id', it.tenant_id).maybeSingle() : sb.from('tenants').select('id,name').eq('id', it.tenant_id).maybeSingle(),
        sb.from('cob_submissions').select('id,seq,decision,decision_reason,submitted_at,file_id').eq('item_id', id).is('deleted_at', null)
      ]).then(function (x) {
        var files = (q(x[0]) || []).sort(function (a, b) { return b.version_no - a.version_no; });
        var com = (q(x[1]) || []).sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
        var ten = q(x[2]) || {}, subs = (q(x[3]) || []).sort(function (a, b) { return b.seq - a.seq; });
        var vals = {};
        (it.fields || []).forEach(function (f) { var a = (it.answers || {})[f.key]; vals[f.key] = a != null && a !== '' ? String(a) : (f.target && ten[f.target] != null ? String(ten[f.target]) : ''); });
        var ids = []; files.concat(com).forEach(function (o) { var u = o.uploaded_by || o.user_id; if (u && ids.indexOf(u) < 0) ids.push(u); });
        var S = C.IS = { it: it, files: files, com: com, ten: ten, subs: subs, vals: vals, page: page, back: back || {}, names: {}, edit: !it.ai_action, ai: false, aiErr: null, newFile: null, expiry: it.expiry_date || '', busy: false };
        if (!ids.length) return S;
        return sb.from('user_profiles').select('id,full_name').in('id', ids).then(function (u) { (u.data || []).forEach(function (p) { S.names[p.id] = p.full_name; }); return S; }, function () { return S; });
      });
    }).then(function () { C.drawItem(); });
  };
  function fileIcon(f) { return /pdf/i.test(f.mime_type || f.file_name) ? ['ti-file-type-pdf', 'var(--danger)'] : (/image/i.test(f.mime_type || '') ? ['ti-photo', 'var(--cob-t3)'] : ['ti-file', 'var(--cob-t3)']); }
  function card(inner, extra) { return '<div class="cob-card" style="padding:14px;margin-bottom:12px' + (extra || '') + '">' + inner + '</div>'; }
  C.drawItem = function () {
    var S = C.IS, it = S.it, m = document.getElementById('main'); if (!m || APP.currentPage !== S.page) return;
    var hasTarget = (it.fields || []).some(function (f) { return f.target; }), isLogo = (it.fields || []).some(function (f) { return f.kind === 'logo'; });
    var needFile = it.item_type !== 'form', cur = S.newFile || S.files.find(function (f) { return f.id === it.current_file_id; }) || null;
    var h = '<div class="cob-root" style="max-width:760px;margin:0 auto"><div class="row" style="gap:6px;margin:-4px 0 8px -8px"><button class="header-btn" id="cob-back" style="width:40px;height:40px" aria-label="' + L('Back', 'Kembali') + '"><i class="ti ti-arrow-left"></i></button>' +
      '<div class="grow"><div class="cob-xs">' + E(it.section_key + ' · ' + C.lab(it, 'section_name')) + '</div><div style="font-size:16px;font-weight:700;line-height:1.25"><span class="cob-mono" style="color:var(--cob-t3);font-size:13px">' + E(it.code) + '</span> ' + E(C.lab(it, 'label')) + '</div></div></div>';
    h += '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:12px">' + (it.section_core ? '<span class="cob-ut">' + L('MAIN', 'UTAMA') + '</span>' : '') + (it.urgent ? '<span class="badge badge-red">' + L('URGENT', 'SEGERA') + '</span>' : '') +
      '<span class="badge badge-gray">' + (it.requirement === 'required' ? L('Required', 'Wajib') : L('If applicable', 'Jika berkenaan')) + '</span><span class="badge badge-gray"><i class="ti ' + C.typeIcon(it) + '"></i> ' + ({ doc: L('Document', 'Dokumen'), form: L('Form', 'Borang'), list: L('List', 'Senarai') }[it.item_type]) + '</span>' + C.st(it.status) + '</div>';
    if (it.status === 'rejected' && it.status_reason) h += '<div class="cob-banner err" style="margin-bottom:12px"><i class="ti ti-message-report"></i><div><b>' + L('Reason:', 'Sebab:') + '</b> ' + E(it.status_reason) + '<div class="cob-xs" style="color:var(--cob-bad)">Admin M-Core · ' + C.dt(it.status_at) + '</div></div></div>';
    if (it.status === 'na') h += '<div class="cob-banner info" style="margin-bottom:12px"><i class="ti ti-minus"></i><div>' + L('Marked not applicable by M-Core admin.', 'Ditanda tak berkenaan oleh admin M-Core.') + (it.status_reason ? ' ' + E(it.status_reason) : '') + '</div></div>';
    if (C.lab(it, 'note')) h += '<div class="cob-sm" style="margin:-4px 0 12px">' + E(C.lab(it, 'note')) + '</div>';
    if (it.item_type === 'list') {
      var cols = String(it.template_header || '').split(',').filter(Boolean);
      h += card('<div class="row"><i class="ti ti-file-spreadsheet" style="font-size:22px;color:var(--cob-ok)"></i><div class="grow"><div style="font-size:14px;font-weight:600">' + L('CSV template', 'Templat CSV') + '</div><div class="cob-xs">' + cols.length + L(' columns', ' lajur') + ' · ' + E(cols.join(', ')) + '</div></div></div>' +
        '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">' + (cols.length ? '<button class="btn btn-sm btn-outline" id="cob-tpl" style="min-height:38px"><i class="ti ti-download"></i>' + L('Download template', 'Muat turun templat') + '</button>' : '') +
        (it.module_page ? '<button class="btn btn-sm btn-outline" id="cob-mod" style="min-height:38px"><i class="ti ti-external-link"></i>' + L('Open module', 'Buka modul') + '</button>' : '') + '</div><div class="cob-xs" style="margin-top:8px">' + L('Fill the template and upload it below. M-Core will review before data is imported.', 'Isi templat dan muat naik di bawah. M-Core akan semak sebelum data diimport.') + '</div>');
    }
    if (needFile) {
      var acc = isLogo ? 'image/png,image/svg+xml,image/jpeg,image/webp' : 'image/*,application/pdf' + (it.item_type === 'list' ? ',.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : '');
      var v = '<div class="cob-drop"><i class="ti ti-cloud-upload" style="font-size:28px;color:var(--primary)"></i><div style="font-size:14px;font-weight:600;margin-top:4px">' + (S.files.length ? L('Upload new version', 'Muat naik versi baharu') : L('Upload file', 'Muat naik fail')) + '</div>' +
        '<div class="cob-xs" style="margin-top:2px">' + (isLogo ? 'PNG/SVG' : (it.item_type === 'list' ? 'CSV / XLSX / PDF' : 'PDF / JPG / PNG')) + L(' · max 10 MB', ' · maks 10 MB') + (C.lab(it, 'note') ? ' · ' + E(C.lab(it, 'note')) : '') + '</div>' +
        '<div class="row" style="justify-content:center;gap:8px;margin-top:10px;flex-wrap:wrap"><label class="btn btn-sm btn-outline" style="min-height:38px;cursor:pointer"><i class="ti ti-camera"></i>' + L('Take photo', 'Ambil gambar') + '<input type="file" accept="image/*" capture="environment" data-up hidden></label>' +
        '<label class="btn btn-sm btn-primary" style="min-height:38px;cursor:pointer"><i class="ti ti-paperclip"></i>' + L('Choose file', 'Pilih fail') + '<input type="file" accept="' + acc + '" data-up hidden></label></div>' + (S.busy ? '<div class="cob-sm" style="margin-top:10px"><span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle"></span> ' + E(S.busy) + '</div>' : '') + '</div>';
      if (S.files.length || S.newFile) {
        v += '<div style="font-size:13px;font-weight:600;margin:14px 0 6px">' + L('File versions', 'Versi fail') + '</div>';
        S.files.forEach(function (f, i) {
          var ic = fileIcon(f), isCur = cur && f.id === cur.id, sub = S.subs.find(function (s) { return s.file_id === f.id && s.decision === 'rejected'; });
          v += '<div class="row" style="padding:8px 0;' + (i ? 'border-top:1px solid var(--border)' : '') + '"><i class="ti ' + ic[0] + '" style="font-size:22px;color:' + ic[1] + '"></i><div class="grow"><div class="cob-ell" style="font-size:13px;font-weight:500' + (isCur ? '' : ';color:var(--text-2)') + '">' + E(f.file_name) + '</div>' +
            '<div class="cob-xs">v' + f.version_no + ' · ' + C.size(f.size_bytes) + ' · ' + C.date(f.created_at) + ', ' + C.time(f.created_at) + (S.names[f.uploaded_by] ? ' · ' + E(S.names[f.uploaded_by]) : '') + (sub ? ' · ' + L('Rejected: ', 'Ditolak: ') + E(sub.decision_reason || '') : '') + '</div></div>' +
            '<span class="badge ' + (isCur ? 'badge-blue">' + L('Current', 'Semasa') : 'badge-gray">' + L('Old', 'Lama')) + '</span><button class="btn btn-sm btn-outline btn-icon" data-view="' + E(f.id) + '" aria-label="' + L('Open', 'Buka') + '" style="width:34px;height:34px"><i class="ti ti-eye"></i></button></div>';
        });
      }
      h += card(v);
    }
    if ((it.fields || []).length && !isLogo) h += C.fieldsCard(hasTarget);
    if (it.track_expiry) {
      var dl = C.daysTo(S.expiry);
      h += card('<div class="row"><i class="ti ti-calendar-due" style="font-size:20px;color:var(--cob-stuck)"></i><div class="grow"><label class="cob-sm" for="cob-exp">' + L('Document expiry date', 'Tarikh tamat dokumen') + '</label><input type="date" class="cob-in" id="cob-exp" value="' + E(S.expiry) + '" style="margin-top:4px;max-width:220px"></div>' +
        (S.expiry ? '<span class="badge ' + (dl <= 7 ? 'badge-red' : (dl <= 30 ? 'badge-yellow' : 'badge-gray')) + '">' + dl + L(' days', ' hari') + '</span>' : '') + '</div><div class="cob-xs" style="margin-top:8px">' + L('Reminders 30 and 7 days before expiry when you open M-Core.', 'Peringatan 30 dan 7 hari sebelum tamat apabila anda buka M-Core.') + '</div>');
    }
    var canSubmit = it.status !== 'na' && !S.busy && (!needFile || cur);
    h += '<div class="row" style="gap:8px;margin-bottom:12px"><button class="btn btn-primary grow" id="cob-submit" style="min-height:44px;justify-content:center"' + (canSubmit ? '' : ' disabled') + '><i class="ti ti-send"></i>' + (it.status === 'pending' ? L('Submit', 'Hantar') : L('Resubmit', 'Hantar semula')) + '</button></div>';
    if (needFile && !cur && it.status !== 'na') h += '<div class="cob-xs" style="margin:-6px 0 12px;text-align:center">' + L('Upload a file first.', 'Muat naik fail dahulu.') + '</div>';
    if (C.isPA()) h += card('<div class="row" style="gap:8px;flex-wrap:wrap"><b style="font-size:13px" class="grow">' + L('Platform admin', 'Admin platform') + '</b>' + (it.status === 'na' ? '<button class="btn btn-sm btn-outline" data-st="pending"><i class="ti ti-rotate"></i>' + L('Reopen', 'Buka semula') + '</button>' : '<button class="btn btn-sm btn-outline" data-st="na"><i class="ti ti-minus"></i>' + L('Not applicable', 'Tak berkenaan') + '</button>') + '</div>');
    h += C.commentsCard();
    h += '<div class="cob-xs" style="text-align:center;margin:12px 0 4px"><i class="ti ti-lock"></i> ' + L('Private file of ', 'Fail peribadi ') + E(S.ten.name || '') + L(' · versions kept · every view is logged', ' · versi disimpan · setiap paparan dilog') + '</div></div>';
    m.innerHTML = h;
    C.bindItem(m.firstChild);
  };
})();
