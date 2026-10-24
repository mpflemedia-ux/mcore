/* M-Core Projects - task detail activity: share log + comments (paste a WhatsApp reply or screenshot).
   Screenshots go to the private bucket project-comments/{tenant}/{task}/ and are shown with short-lived signed URLs. */
(function () {
  function isImg(name) { return /\.(jpg|jpeg|png|gif|webp|heic|bmp)$/i.test(name || ''); }
  function fileIcon(name) { var n = (name || '').toLowerCase(); if (/\.pdf$/.test(n)) return 'ti-file-type-pdf'; if (/\.(xlsx?|csv)$/.test(n)) return 'ti-file-spreadsheet'; if (/\.(docx?|txt)$/.test(n)) return 'ti-file-text'; if (/\.zip$/.test(n)) return 'ti-file-zip'; return 'ti-file'; }

  var W = window.PJW; if (!W || W.activity) return;
  var MAXB = 26214400;
  function when(d) { var x = new Date(d); return x.toLocaleDateString(W.bm() ? 'ms-MY' : 'en-GB', { day: 'numeric', month: 'short' }) + ', ' + x.toLocaleTimeString(W.bm() ? 'ms-MY' : 'en-GB', { hour: 'numeric', minute: '2-digit' }); }
  var ev = function (ic, col, who, txt, d, extra) { return '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><span style="width:30px;height:30px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;background:var(--bg);border:1px solid var(--border)"><i class="ti ' + ic + '" style="color:' + col + '"></i></span><div style="flex:1;min-width:0"><div style="font-size:13px;overflow-wrap:anywhere"><b>' + W.esc(who || '-') + '</b> ' + txt + '</div><div class="cob-xs">' + when(d) + '</div>' + (extra || '') + '</div></div>'; };
  W.activity = function (det, k, can) {
    var box = det.querySelector('.pjw-act');
    if (!box) { box = document.createElement('div'); box.className = 'pjw-act pjw-inj'; box.style.cssText = 'margin-top:12px;border-top:1px solid var(--border);padding-top:10px'; det.appendChild(box); }
    if (box.dataset.busy) return; box.dataset.busy = '1';
    Promise.all([
      sb.from('project_task_shares').select('id,template,lang,recipient_label,recipient_kind,created_by_name,created_at').eq('tenant_id', W.tid()).eq('task_id', k.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(50),
      sb.from('project_task_comments').select('id,body,file_path,file_name,file_size,created_by,created_by_name,created_at').eq('tenant_id', W.tid()).eq('task_id', k.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(100)
    ]).then(function (r) {
      var sh = r[0].data || [], cm = r[1].data || [], paths = cm.filter(function (c) { return c.file_path; }).map(function (c) { return c.file_path; });
      return (paths.length ? sb.storage.from('project-comments').createSignedUrls(paths, 600) : Promise.resolve({ data: [] })).then(function (u) {
        var url = {}; (u.data || []).forEach(function (x) { if (x && x.signedUrl) url[x.path] = x.signedUrl; });
        var items = sh.map(function (s) { return { d: s.created_at, h: ev('ti-brand-whatsapp', 'var(--pjw)', s.created_by_name, W.L('shared to WhatsApp ', 'kongsi ke WhatsApp ') + (s.recipient_label ? '<b>' + W.esc(s.recipient_label) + '</b> ' : '') + '· template <i>' + W.esc(W.tplName(s.template) || W.L('Summary', 'Ringkasan')) + '</i> (' + String(s.lang || '').toUpperCase() + ')', s.created_at) }; })
          .concat(cm.map(function (c) {
            var mine = W.same(c.created_by, W.uid()) || W.isTA();
            var x = (c.body ? '<div style="font-size:13px;margin-top:6px;padding:8px 10px;border-left:3px solid var(--pjw);background:var(--bg);border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere">' + W.esc(c.body) + '</div>' : '') +
              (c.file_path ? '<a href="' + W.esc(url[c.file_path] || '#') + '" target="_blank" rel="noopener" style="display:block;margin-top:8px;max-width:240px;border:1px solid var(--border);border-radius:10px;overflow:hidden">' + (isImg(c.file_name) && url[c.file_path] ? '<img src="' + W.esc(url[c.file_path]) + '" alt="' + W.esc(c.file_name || '') + '" style="display:block;width:100%;max-height:260px;object-fit:cover">' : '<div style="padding:16px;text-align:center;background:var(--bg)"><i class="ti ' + fileIcon(c.file_name) + '" style="font-size:32px;color:var(--text-muted)"></i></div>') + '<span class="cob-xs" style="display:flex;gap:6px;align-items:center;padding:6px 8px;min-width:0"><i class="ti ' + (isImg(c.file_name) ? 'ti-photo' : fileIcon(c.file_name)) + '"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + W.esc(c.file_name || 'file') + '</span></span></a>' : '') +
              (mine ? '<button type="button" class="cob-xs" data-pjw-del="' + c.id + '" style="background:none;border:0;padding:4px 0;color:var(--text-3);cursor:pointer">' + W.L('Delete', 'Padam') + '</button>' : '');
            return { d: c.created_at, h: ev('ti-message-2', 'var(--primary)', c.created_by_name, c.file_path && !c.body ? (isImg(c.file_name) ? W.L('added a screenshot', 'tambah screenshot') : W.L('added a file', 'tambah fail')) : W.L('commented', 'komen'), c.created_at, x) };
          })).sort(function (a, b) { return a.d < b.d ? 1 : -1; });
        box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:14px">' + W.L('Activity', 'Aktiviti') + '</b>' + (sh.length ? '<span class="cob-xs"><i class="ti ti-brand-whatsapp" style="color:var(--pjw)"></i> ' + W.L('Shared ', 'Dikongsi ') + sh.length + 'x</span>' : '') + '</div>' +
          (can ? '<button type="button" class="pjw-btn" data-pjw-dsh style="margin-top:8px;min-height:40px;padding:0 12px"><i class="ti ti-brand-whatsapp"></i> ' + W.L('Share WhatsApp', 'Share WhatsApp') + '</button>' : '') +
          (items.length ? items.map(function (i) { return i.h; }).join('') : '<div class="cob-xs" style="padding:10px 0">' + W.L('No activity yet', 'Belum ada aktiviti') + '</div>') +
          '<div style="margin-top:10px"><textarea class="form-input" data-no-titlecase="1" rows="2" maxlength="4000" placeholder="' + W.esc(W.L('Write a comment / paste a WhatsApp reply or screenshot…', 'Tulis komen / tampal balasan WhatsApp atau screenshot…')) + '" style="display:block;width:100%;box-sizing:border-box;min-width:0;resize:vertical"></textarea>' +
          '<div style="display:flex;gap:8px;margin-top:8px;align-items:stretch;width:100%"><label class="btn btn-outline" style="flex:1;min-width:0;min-height:44px;justify-content:center" title="' + W.L('Add file', 'Tambah fail') + '"><i class="ti ti-paperclip"></i><input type="file" multiple hidden></label><button type="button" class="btn btn-primary" data-pjw-send style="flex:1;min-width:0;min-height:44px;justify-content:center" aria-label="' + W.L('Send', 'Hantar') + '"><i class="ti ti-send"></i></button></div><div class="cob-xs" data-pjw-file style="margin-top:4px"></div></div>';
        var ta = box.querySelector('textarea'), fi = box.querySelector('input[type=file]'), fl = box.querySelector('[data-pjw-file]'), files = [];
        var pick = function (fs) { files = [].slice.call(fs || []).filter(function (f) { if (f.size > MAXB) { W.toast(f.name + ': ' + W.L('Max 25 MB', 'Maks 25 MB'), 'error'); return false; } return true; }); fl.innerHTML = files.map(function (f) { return '<div style="overflow-wrap:anywhere;word-break:break-word;margin-top:2px"><i class="ti ti-paperclip"></i> ' + W.esc(f.name) + ' · ' + Math.round(f.size / 1024) + ' KB</div>'; }).join(''); };
        fi.onchange = function () { pick(fi.files); };
        ta.addEventListener('paste', function (e) { var its = [].slice.call((e.clipboardData && e.clipboardData.items) || []).filter(function (i) { return i.kind === 'file'; }); if (its.length) { e.preventDefault(); var fs = its.map(function (i) { var f = i.getAsFile(); return f ? new File([f], 'paste-' + Date.now() + '.' + (f.type.split('/')[1] || 'bin'), { type: f.type }) : null; }).filter(Boolean); pick(files.concat(fs)); } });
        var dsh = box.querySelector('[data-pjw-dsh]'); if (dsh) dsh.onclick = function () { W.share({ task: k }); };
        box.querySelectorAll('[data-pjw-del]').forEach(function (b) { b.onclick = function () { if (!confirm(W.L('Delete this comment?', 'Padam komen ini?'))) return; sb.from('project_task_comments').update({ deleted_at: new Date().toISOString() }).eq('id', b.dataset.pjwDel).eq('tenant_id', W.tid()).then(function (x) { if (x.error) W.toast(x.error.message, 'error'); W.activity(det, k, can); }); }; });
        box.querySelector('[data-pjw-send]').onclick = function () {
          var body = ta.value.trim(); if (!body && !files.length) return;
          var btn = this; btn.disabled = true;
          var ups = files.length ? Promise.all(files.map(function (f) { return sb.storage.from('project-comments').upload(W.tid() + '/' + k.id + '/' + Date.now() + '-' + String(f.name || 'file').replace(/[^\w.\-]+/g, '_').slice(-80), f, { upsert: false, contentType: f.type }).then(function (u) { if (u.error) throw u.error; return { path: u.data.path, name: f.name, size: f.size }; }); })) : Promise.resolve([]);
          ups.then(function (ps) {
            var rows = ps.length ? ps.map(function (p, i) { return { tenant_id: W.tid(), task_id: k.id, body: i === 0 ? body || null : null, file_path: p.path, file_name: String(p.name).slice(-200), file_size: p.size, created_by: W.uid(), created_by_name: W.me() }; }) : [{ tenant_id: W.tid(), task_id: k.id, body: body || null, created_by: W.uid(), created_by_name: W.me() }];
            return sb.from('project_task_comments').insert(rows);
          }).then(function (x) { if (x.error) throw x.error; if (window.NT && NT.taskComment) NT.taskComment(k, body); W.activity(det, k, can); }).catch(function (e) { btn.disabled = false; W.toast((e && e.message) || 'Error', 'error'); });
        };
      });
    }).catch(function (e) { box.innerHTML = '<div class="cob-xs" style="color:var(--danger)">' + W.esc((e && e.message) || 'Error') + '</div>'; }).then(function () { delete box.dataset.busy; });
  };
})();
