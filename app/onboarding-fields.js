/* M-Core Onboarding Checklist - item detail cards (mockup ob2): fields / AI card and comments. */
(function () {
  var C = window.COB; if (!C || C._fields) return; C._fields = 1;
  var E = C.esc, L = C.L;
  C.fieldsCard = function (hasTarget) {
    var S = C.IS, it = S.it, cur = S.newFile || S.files.find(function (f) { return f.id === it.current_file_id; });
    var h = '<div class="cob-card" style="padding:14px;margin-bottom:12px"><div class="row" style="justify-content:space-between"><div style="font-size:14px;font-weight:600">' +
      (S.ai ? '<i class="ti ti-sparkles" style="color:var(--cob-ai)"></i> ' + L('Read by AI', 'Dibaca oleh AI') : '<i class="ti ti-forms" style="color:var(--primary)"></i> ' + L('Details', 'Maklumat')) + '</div>' +
      (S.ai && cur ? '<span class="cob-xs">' + L('from v', 'dari v') + cur.version_no + '</span>' : (it.ai_action && !S.ai ? '<span class="cob-xs"><i class="ti ti-sparkles" style="color:var(--cob-ai)"></i> ' + L('AI fills after upload', 'AI isi selepas muat naik') + '</span>' : '')) + '</div>';
    if (hasTarget) h += '<div class="cob-banner info" style="margin:10px 0 4px;padding:8px 10px;font-size:12.5px"><i class="ti ti-bolt" style="font-size:16px"></i><div><b>' + L('Applied immediately', 'Terus dikemas kini') + '</b> ' + L('to Company Info. M-Core admin will review; if rejected, old values are restored.', 'ke Maklumat Syarikat. Admin M-Core akan semak; jika ditolak, nilai lama dipulihkan.') + '</div></div>';
    if (S.aiErr) h += '<div class="cob-banner err" style="margin:8px 0;padding:8px 10px;font-size:12.5px"><i class="ti ti-alert-triangle" style="font-size:16px"></i><div>' + L('AI could not read the document: ', 'AI tidak dapat membaca dokumen: ') + E(S.aiErr) + '. ' + L('Please fill in manually.', 'Sila isi secara manual.') + '</div></div>';
    (it.fields || []).forEach(function (f) {
      if (f.kind === 'logo') return;
      var lab = C.bm() ? f.bm : f.en, v = S.vals[f.key] || '', old = f.target ? S.ten[f.target] : null;
      var oldTxt = f.target ? L('Old value: ', 'Nilai lama: ') + (old == null || old === '' ? '—' : E(f.sensitive ? C.mask(old) : old)) : L('Answer only (no system field yet)', 'Jawapan sahaja (tiada medan sistem lagi)');
      h += '<div style="padding:10px 0;border-top:1px solid var(--border)">';
      if (S.edit) {
        var ty = f.kind === 'date' ? 'date' : (f.kind === 'money' ? 'number' : 'text');
        h += '<label class="cob-sm" for="cob-f-' + E(f.key) + '">' + E(lab) + '</label><input class="cob-in" style="margin-top:4px" id="cob-f-' + E(f.key) + '" data-k="' + E(f.key) + '" type="' + ty + '"' + (ty === 'number' ? ' step="0.01" inputmode="decimal"' : '') + ' value="' + E(v) + '" autocomplete="off">';
      } else {
        h += '<div class="cob-sm">' + E(lab) + '</div><div style="font-size:14px;font-weight:600;margin-top:4px">' + (v ? E(f.sensitive ? C.mask(v) : v) : '—') + '</div>';
      }
      h += '<div class="cob-xs" style="margin-top:3px">' + oldTxt + '</div></div>';
    });
    if (!S.edit || hasTarget) h += '<div class="row" style="gap:8px;margin-top:6px">' + (!S.edit ? '<button class="btn btn-sm btn-outline grow" data-edit style="min-height:38px"><i class="ti ti-pencil"></i>' + L('Correct', 'Betulkan') + '</button>' : '') +
      (hasTarget ? '<button class="btn btn-sm btn-outline grow" data-gos style="min-height:38px"><i class="ti ti-external-link"></i>' + L('Company Settings', 'Tetapan Syarikat') + '</button>' : '') + '</div>';
    return h + '</div>';
  };
  C.commentsCard = function () {
    var S = C.IS, h = '<div class="cob-card" style="padding:14px"><div style="font-size:14px;font-weight:600;margin-bottom:8px"><i class="ti ti-messages" style="color:var(--primary)"></i> ' + L('Comments', 'Komen') + ' (' + S.com.length + ')</div>';
    S.com.forEach(function (c) {
      var nm = c.is_platform ? 'Admin M-Core' : (c.author_name || S.names[c.user_id] || '—'), ini = String(nm).split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
      h += '<div class="row" style="align-items:flex-start;padding:6px 0"><div class="user-avatar" style="width:30px;height:30px;font-size:11px;flex-shrink:0' + (c.is_platform ? ';background:var(--primary-light);color:var(--primary)' : '') + '">' + E(ini) + '</div><div class="grow"><div class="cob-sm"><b style="color:var(--text)">' + E(nm) + '</b> · ' + C.dt(c.created_at) + '</div><div style="font-size:13px;margin-top:2px;line-height:1.4;white-space:pre-wrap;word-break:break-word">' + E(c.body) + '</div></div></div>';
    });
    return h + '<div class="row" style="margin-top:8px"><textarea class="cob-in grow" id="cob-cin" data-no-titlecase="1" rows="1" maxlength="2000" placeholder="' + L('Write a comment…', 'Tulis komen…') + '" style="resize:vertical"></textarea><button class="btn btn-primary btn-icon" id="cob-csend" style="width:40px;height:40px" aria-label="' + L('Send', 'Hantar') + '"><i class="ti ti-send"></i></button></div></div>';
  };
})();
