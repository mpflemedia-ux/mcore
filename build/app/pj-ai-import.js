/* M-Core Projects - "Import from doc": PDF / photos -> AI (ai-proxy action doc_to_project_tasks) -> preview (tick, edit, pick project + owner)
   -> create tasks. Nothing is written until Create. Owner defaults to the signed-in user's staff record (same email rule as PJM.myEmp).
   Tools button + mobile ⋮ menu entry are added after each board paint. Hook: window._pjAfterPaint (chained, not overwritten). */
(function () {
  if (window.PJI) return;
  var I = window.PJI = { st: null, hol: null };
  var MAX_FILE = 20 * 1024 * 1024, MAX_IMG = 5, MAX_PAGES = 40, CAP = 40;
  var COLORS = ['#0E7490', '#16A34A', '#D97706', '#7C3AED', '#DC2626', '#0891B2'];
  function bm() { return window.APP && APP.language === 'bm'; }
  function L(en, ms) { return bm() ? ms : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function same(a, b) { return String(a) === String(b); }
  function tid() { return window.APP && APP.tenant && APP.tenant.id; }
  function toast(m, k) { if (typeof showToast === 'function') showToast(esc(m), k || 'success'); } /* showToast renders HTML */
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function today() { return ymd(new Date()); }
  function dmy(s) { var p = String(s || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function nm(e) { return e ? (e.nickname || e.name || '') : ''; }
  function allowed() { try { return typeof canAccess !== 'function' || canAccess('core'); } catch (e) { return false; } }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, ' ').trim(); }
  function membersPayload(emps) {
    return (emps || []).map(function (e) { return { id: e.id, name: nm(e) }; }).filter(function (m) { return m.id && m.name; }).slice(0, 80);
  }
  /* fuzzy name → employee id; only when exactly one employee matches */
  function matchMemberId(name, emps) {
    var n = norm(name); if (!n) return null;
    var hits = (emps || []).filter(function (e) {
      var a = norm(nm(e));
      return a && (a === n || a.indexOf(n) >= 0 || n.indexOf(a) >= 0);
    });
    return hits.length === 1 ? hits[0].id : null;
  }
  function isPdf(f) { return /pdf/i.test(f.type || '') || /\.pdf$/i.test(f.name || ''); }
  function isImg(f) { return /^image\//i.test(f.type || '') || /\.(png|jpe?g|webp|gif|heic)$/i.test(f.name || ''); }

  /* ---------- styles (theme variables only; light + dark) ---------- */
  (function css() {
    if (document.getElementById('pji-css')) return;
    var c = document.createElement('style'); c.id = 'pji-css';
    c.textContent = ':root{--pji-warn-ink:#92400e;--pji-danger-ink:#b91c1c}body.dark,[data-theme=dark]{--pji-warn-ink:#fbbf24;--pji-danger-ink:#f87171}' +
      '.pji-panel{width:min(720px,100%)}.pji-head{display:flex;align-items:center;gap:8px;padding:14px 14px 0}.pji-head h3{flex:1;min-width:0;margin:0;font-size:16px}.pji-x{min-width:40px;min-height:40px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}' +
      '.pji-hint{color:var(--text-2);font-size:12.5px;line-height:1.45;margin:4px 0 10px}.pji-picks{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pji-picks label{display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;border:1px dashed var(--border-2,var(--border));border-radius:10px;background:var(--bg);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;text-align:center;padding:6px}.pji-picks input{display:none}' +
      '.pji-files{display:flex;flex-direction:column;gap:6px;margin-top:10px}.pji-file{display:flex;align-items:center;gap:8px;min-height:40px;border:1px solid var(--border);border-radius:8px;background:var(--bg);padding:4px 4px 4px 10px;font-size:13px;color:var(--text)}.pji-file span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pji-file small{color:var(--text-2);white-space:nowrap}.pji-file button{min-width:36px;min-height:36px;border:0;background:none;color:var(--text-2);cursor:pointer;border-radius:8px}' +
      '.pji-busy{display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px 8px;color:var(--text-2);text-align:center;font-size:13px}.pji-err{border:1px solid var(--pji-danger-ink);border-radius:10px;padding:10px 12px;color:var(--pji-danger-ink);font-size:13px;margin:8px 0;overflow-wrap:anywhere}' +
      '.pji-grid{display:grid;grid-template-columns:1fr;gap:8px}.pji-grid label{display:block;font-size:12px;color:var(--text-2)}.pji-panel .pji-grid select,.pji-panel .pji-grid input{margin-top:2px}.pji-seg{display:flex;gap:6px;flex-wrap:wrap}.pji-seg label{display:inline-flex;align-items:center;gap:6px;min-height:40px;border:1px solid var(--border);border-radius:99px;padding:4px 12px;background:var(--bg);color:var(--text);font-size:13px;cursor:pointer}.pji-seg input{accent-color:var(--primary)}' +
      '.pji-sum{font-size:12.5px;color:var(--text-2);margin:8px 0;line-height:1.45}.pji-load{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;color:var(--text);border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--bg);margin:8px 0}.pji-load b.over{color:var(--pji-danger-ink)}' +
      '.pji-bar{display:flex;align-items:center;gap:8px;justify-content:space-between;margin:10px 0 6px;font-size:12.5px;color:var(--text-2)}.pji-bar button{min-height:36px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);padding:4px 10px;font-size:12.5px;cursor:pointer}' +
      '.pji-item{border:1px solid var(--border);border-radius:12px;background:var(--bg);padding:8px 10px;margin-bottom:8px}.pji-item.off{opacity:.62}.pji-top{display:flex;align-items:flex-start;gap:8px}.pji-top input[type=checkbox]{width:20px;height:20px;margin:10px 0 0;flex:none;accent-color:var(--primary)}.pji-top textarea{flex:1;min-width:0;resize:none;min-height:40px;line-height:1.35;font-weight:600;font-size:13.5px}' +
      '.pji-f{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:6px}.pji-f label{display:block;font-size:11.5px;color:var(--text-2);min-width:0}.pji-panel .pji-f input,.pji-panel .pji-f select{margin-top:2px;min-width:0}' +
      '.pji-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.pji-w{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;border-radius:99px;padding:2px 8px;border:1px solid var(--border);color:var(--pji-warn-ink);background:var(--bg-card)}.pji-w.dup{color:var(--pji-danger-ink)}.pji-w.src{color:var(--text-2);font-weight:500}' +
      '.pji-item details{margin-top:6px}.pji-item summary{cursor:pointer;font-size:12.5px;color:var(--text);min-height:32px;display:flex;align-items:center}.pji-item details label{display:block;font-size:11.5px;color:var(--text-2);margin-top:6px}.pji-item details textarea{min-height:72px;resize:vertical;line-height:1.4}' +
      '.pji-panel textarea,.pji-panel .pji-f input,.pji-panel .pji-f select,.pji-panel .pji-grid input,.pji-panel .pji-grid select{width:100%;min-height:40px;border:1px solid var(--border);background:var(--bg-card);color:var(--text);border-radius:8px;padding:6px 8px;font-size:13px;box-sizing:border-box}.pji-panel textarea::placeholder,.pji-panel input::placeholder{color:var(--text-2)}' +
      '.pji-foot{display:flex;gap:8px}.pji-foot .btn{flex:1;min-height:44px;justify-content:center}.pji-foot .btn[disabled]{opacity:.55;cursor:not-allowed}' +
      '#pji-btn{min-height:40px}.pj-tabs .pji-d{margin-left:auto;flex:none;align-self:center;min-height:32px;padding:2px 10px;color:var(--text);white-space:nowrap}' +
      '@media(max-width:800px){.pj-tabs .pji-d{display:none}}@media(min-width:801px){.pj-tools .pji-m{display:none}}' +
      '@media(min-width:801px){.pji-grid{grid-template-columns:1fr 1fr}.pji-f{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,.7fr) minmax(0,1.2fr)}}';
    document.head.appendChild(c);
  })();

  /* ---------- data helpers ---------- */
  function tagOptions() {
    var g = document.getElementById('pj-g'), out = [];
    if (g) Array.prototype.forEach.call(g.options, function (o) { if (o.value) out.push(o.value); });
    return out;
  }
  function myEmp() {
    if (window.PJM && typeof PJM.myEmp === 'function') return PJM.myEmp().catch(function () { return null; });
    var em = String((APP.user && APP.user.email) || '').toLowerCase(); if (!em) return Promise.resolve(null);
    return sb.from('employees').select('id,email').eq('tenant_id', tid()).is('deleted_at', null).then(function (r) {
      var e = (r.data || []).filter(function (x) { return String(x.email || '').toLowerCase() === em; })[0]; return e ? e.id : null;
    });
  }
  /* Malaysia public holidays already seeded into this tenant's Planner (notes marker MY_PH:YYYY:YYYY-MM-DD) */
  function holidays() {
    if (I.hol) return Promise.resolve(I.hol);
    return sb.from('platform_activities').select('notes').eq('tenant_id', tid()).is('deleted_at', null).like('notes', 'MY_PH:%').limit(400).then(function (r) {
      var s = {}; (r.data || []).forEach(function (x) { var m = String(x.notes || '').match(/^MY_PH:\d{4}:(\d{4}-\d{2}-\d{2})/); if (m) s[m[1]] = 1; });
      I.hol = s; return s;
    }, function () { I.hol = {}; return I.hol; });
  }
  function workday(d, hol) { var x = new Date(d + 'T00:00:00'), w = x.getDay(); return w !== 0 && w !== 6 && !hol[d]; }
  function addDays(d, n) { var x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return ymd(x); }
  /* due on a weekend / public holiday -> previous working day (never before today), else the next working day */
  I.shiftDue = function (d, hol, t0) {
    if (!d) return { d: d, moved: false };
    t0 = t0 || today(); if (d < t0) d = t0;
    if (workday(d, hol)) return { d: d, moved: false };
    var back = d, n = 0;
    while (n++ < 10) { back = addDays(back, -1); if (back < t0) break; if (workday(back, hol)) return { d: back, moved: true, from: d }; }
    var fwd = d; n = 0;
    while (n++ < 14) { fwd = addDays(fwd, 1); if (workday(fwd, hol)) return { d: fwd, moved: true, from: d }; }
    return { d: d, moved: false };
  };
  I.dupOf = function (title, existing) {
    var a = norm(title); if (!a) return '';
    for (var i = 0; i < existing.length; i++) {
      var b = norm(existing[i]); if (!b) continue;
      if (a === b || (a.length >= 12 && b.length >= 12 && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0))) return existing[i];
    }
    return '';
  };
  function existingTitles(pid) {
    if (!pid) return Promise.resolve([]);
    return sb.from('project_tasks').select('title').eq('tenant_id', tid()).eq('project_id', pid).is('deleted_at', null).limit(2000).then(function (r) { return (r.data || []).map(function (x) { return x.title; }); }, function () { return []; });
  }
  /* owner's estimated hours this week (Mon-Sun), same rule as the Workload panel (PJM.workCalc) */
  function ownerHours(owner) {
    if (!owner || !(window.PJM && PJM.ok2 && PJM.workCalc)) return Promise.resolve(null);
    var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); var e = new Date(d); e.setDate(d.getDate() + 6);
    var w = [ymd(d), ymd(e)], cols = 'id,column_key,assignee_employee_id,due_date,start_date,est_hours';
    return Promise.all([
      sb.from('project_tasks').select(cols).eq('tenant_id', tid()).is('deleted_at', null).neq('column_key', 'done').gte('due_date', w[0]).lte('due_date', w[1]).limit(1000),
      sb.from('project_tasks').select(cols).eq('tenant_id', tid()).is('deleted_at', null).neq('column_key', 'done').is('due_date', null).gte('start_date', w[0]).lte('start_date', w[1]).limit(1000)
    ]).then(function (r) {
      var ks = ((r[0] && r[0].data) || []).concat((r[1] && r[1].data) || []).filter(function (k) { return Number(k.est_hours) > 0; });
      var ids = ks.map(function (k) { return k.id; });
      return (ids.length ? sb.from('project_task_assignees').select('task_id,employee_id').eq('tenant_id', tid()).in('task_id', ids).is('deleted_at', null) : Promise.resolve({ data: [] })).then(function (a) {
        var wl = PJM.workCalc(ks, a.data || []), me = wl[String(owner)]; return { h: me ? Math.round(me.h * 10) / 10 : 0, w: w };
      });
    }).catch(function () { return null; });
  }

  /* ---------- file reading ---------- */
  function canvasJpeg(canvas) { var u = canvas.toDataURL('image/jpeg', 0.7); return { base64: u.split(',')[1], mime: 'image/jpeg' }; }
  async function readFiles(files, status) {
    var text = [], images = [], pages = 0, scanned = 0;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (isPdf(f)) {
        status(L('Reading PDF: ', 'Membaca PDF: ') + f.name);
        if (typeof _loadPdfJs !== 'function') throw new Error(L('PDF reader is not available on this page.', 'Pembaca PDF tiada pada halaman ini.'));
        var lib = await _loadPdfJs();
        var pdf = await lib.getDocument({ data: await f.arrayBuffer() }).promise;
        var n = Math.min(pdf.numPages, MAX_PAGES); pages += pdf.numPages;
        for (var p = 1; p <= n; p++) {
          var page = await pdf.getPage(p);
          var tc = await page.getTextContent();
          var s = tc.items.map(function (it) { return it.str; }).join(' ').replace(/\s+/g, ' ').trim();
          if (s.length >= 30) { text.push('--- ' + f.name + ' · page ' + p + ' ---\n' + s); continue; }
          scanned++;
          if (images.length >= MAX_IMG) continue;
          var vp = page.getViewport({ scale: 1 }), sc = Math.min(2, 1280 / vp.width), v2 = page.getViewport({ scale: sc });
          var cv = document.createElement('canvas'); cv.width = Math.round(v2.width); cv.height = Math.round(v2.height);
          await page.render({ canvasContext: cv.getContext('2d'), viewport: v2 }).promise;
          images.push(canvasJpeg(cv));
        }
      } else if (isImg(f)) {
        if (images.length >= MAX_IMG) { scanned++; continue; }
        status(L('Preparing photo: ', 'Sedia gambar: ') + f.name);
        if (typeof _compressImageToBase64 !== 'function') throw new Error(L('Image reader is not available on this page.', 'Pembaca gambar tiada pada halaman ini.'));
        var im = await _compressImageToBase64(f); images.push({ base64: im.base64, mime: im.mimeType || 'image/jpeg' }); pages++;
      }
    }
    return { text: text.join('\n\n'), images: images, pages: pages, skipped: Math.max(0, scanned - images.length) };
  }

  /* ---------- sheet ---------- */
  var S = null; /* { el, files:[], step, res, owner, ... } */
  function close() { if (S && S.el && S.el.parentNode) S.el.remove(); S = null; document.body.classList.remove('pja-sheet-open'); }
  function frame(title, body, foot) {
    return '<div class="pja-panel pji-panel" role="dialog" aria-modal="true" aria-labelledby="pji-h"><div class="pji-head"><h3 id="pji-h"><i class="ti ti-file-import"></i> ' + esc(title) + '</h3><button type="button" class="pji-x" data-pji-x aria-label="' + esc(L('Close', 'Tutup')) + '"><i class="ti ti-x"></i></button></div>' +
      '<div class="pja-panel-body">' + body + '</div>' + (foot ? '<div class="pja-panel-foot"><div class="pji-foot">' + foot + '</div></div>' : '') + '</div>';
  }
  function paint(html) {
    S.el.innerHTML = html;
    S.el.querySelectorAll('[data-pji-x]').forEach(function (b) { b.onclick = close; });
  }
  I.open = function (st) {
    if (!allowed()) { toast(L('Access denied', 'Akses ditolak'), 'error'); return; }
    if (typeof _invokeAiProxy !== 'function') { toast(L('AI is not available on this page.', 'AI tiada pada halaman ini.'), 'error'); return; }
    close();
    var el = document.createElement('div'); el.id = 'pji-sheet'; el.className = 'pja-sheet';
    el.onclick = function (e) { if (e.target === el && S && S.step !== 'busy') close(); };
    document.body.appendChild(el); document.body.classList.add('pja-sheet-open');
    S = { el: el, st: st, files: [], step: 'pick' };
    stepPick();
  };
  function stepPick(err) {
    S.step = 'pick';
    var rows = S.files.map(function (f, i) { return '<div class="pji-file"><i class="ti ' + (isPdf(f) ? 'ti-file-type-pdf' : 'ti-photo') + '"></i><span>' + esc(f.name) + '</span><small>' + Math.max(1, Math.round(f.size / 1024)) + ' KB</small><button type="button" data-rm="' + i + '" aria-label="' + esc(L('Remove ', 'Buang ') + f.name) + '"><i class="ti ti-x"></i></button></div>'; }).join('');
    paint(frame(L('Import from doc', 'Import dari doc'),
      '<p class="pji-hint">' + esc(L('Upload a PDF or photos of a brief, proposal, quotation or meeting notes. AI reads it and suggests tasks. Nothing is saved until you press Create.', 'Muat naik PDF atau gambar brief, proposal, sebut harga atau nota mesyuarat. AI baca dan cadangkan task. Tiada apa disimpan sehingga kau tekan Cipta.')) + '</p>' +
      (err ? '<div class="pji-err" role="alert">' + esc(err) + '</div>' : '') +
      '<div class="pji-picks"><label><i class="ti ti-upload"></i> ' + esc(L('Choose files', 'Pilih fail')) + '<input type="file" id="pji-in" multiple accept="application/pdf,image/*"></label>' +
      '<label><i class="ti ti-camera"></i> ' + esc(L('Take photo', 'Ambil gambar')) + '<input type="file" id="pji-cam" accept="image/*" capture="environment"></label></div>' +
      '<div class="pji-files">' + rows + '</div>' +
      '<p class="pji-hint" style="margin-top:10px">' + esc(L('PDF text is read in full (up to 40 pages). Scanned pages and photos: up to 5 images per import. Max 20 MB per file.', 'Teks PDF dibaca penuh (sehingga 40 muka surat). Muka surat imbasan dan gambar: sehingga 5 imej setiap import. Maksimum 20 MB setiap fail.')) + '</p>',
      '<button type="button" class="btn btn-outline" data-pji-x>' + esc(L('Cancel', 'Batal')) + '</button><button type="button" class="btn btn-primary" id="pji-go"' + (S.files.length ? '' : ' disabled') + '><i class="ti ti-sparkles"></i> ' + esc(L('Read document', 'Baca dokumen')) + '</button>'));
    var add = function (list) {
      Array.prototype.forEach.call(list || [], function (f) {
        if (!(isPdf(f) || isImg(f))) { toast(L('Only PDF or image files: ', 'Hanya fail PDF atau gambar: ') + f.name, 'error'); return; }
        if (f.size > MAX_FILE) { toast(L('File is over 20 MB: ', 'Fail melebihi 20 MB: ') + f.name, 'error'); return; }
        if (S.files.length >= 10) return;
        S.files.push(f);
      });
      stepPick();
    };
    S.el.querySelector('#pji-in').onchange = function () { add(this.files); };
    S.el.querySelector('#pji-cam').onchange = function () { add(this.files); };
    S.el.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { S.files.splice(Number(b.getAttribute('data-rm')), 1); stepPick(); }; });
    S.el.querySelector('#pji-go').onclick = run;
  }
  function busy(msg) {
    S.step = 'busy';
    paint(frame(L('Import from doc', 'Import dari doc'), '<div class="pji-busy" role="status" aria-live="polite"><div class="spinner"></div><span id="pji-msg">' + esc(msg) + '</span></div>', ''));
  }
  async function run() {
    var st = S.st, files = S.files.slice();
    busy(L('Reading document…', 'Membaca dokumen…'));
    var setMsg = function (m) { var x = document.getElementById('pji-msg'); if (x) x.textContent = m; };
    try {
      var got = await readFiles(files, setMsg);
      if (!got.text.trim() && !got.images.length) throw new Error(L('No readable text or image found in these files.', 'Tiada teks atau gambar yang boleh dibaca dalam fail ini.'));
      setMsg(L('AI is drafting tasks… (10-40 seconds)', 'AI sedang draf task… (10-40 saat)'));
      var res = await _invokeAiProxy({
        action: 'doc_to_project_tasks', language: bm() ? 'bm' : 'en', text: got.text, images: got.images, today: today(),
        tags: tagOptions(), project_names: (st.projects || []).map(function (p) { return p.name; }), file_names: files.map(function (f) { return f.name; }),
        members: membersPayload(st.employees)
      });
      if (!S) return;
      var payload = res && res.data && res.data.success ? res.data.data : null;
      if (!payload) throw new Error((res && res.data && res.data.error) || (res && res.error && res.error.message) || L('AI did not return tasks.', 'AI tidak pulangkan task.'));
      if (!payload.tasks || !payload.tasks.length) throw new Error(L('AI found no actionable tasks in this document.', 'AI tidak jumpa task yang boleh dibuat dalam dokumen ini.'));
      S.res = payload; S.read = got;
      await prepare();
      stepPreview();
    } catch (e) {
      if (!S) return;
      stepPick((e && e.message) || String(e));
    }
  }
  /* defaults for the preview: project match, owner = me, working-day due dates, duplicates unticked */
  async function prepare() {
    var st = S.st, r = S.res;
    var cur = st.projectId && st.projectId !== '__all__' ? st.projectId : '';
    var hit = r.project_name ? (st.projects || []).filter(function (p) { return norm(p.name) === norm(r.project_name); })[0] : null;
    S.mode = hit || cur ? 'old' : 'new';
    S.pid = hit ? String(hit.id) : cur ? String(cur) : (st.projects && st.projects[0] ? String(st.projects[0].id) : '');
    if (S.mode === 'old' && !S.pid) S.mode = 'new';
    S.newName = r.project_name || (S.files[0] ? S.files[0].name.replace(/\.[^.]+$/, '') : '');
    var cu = r.client_name ? (st.customers || []).filter(function (c) { var a = norm(c.name), b = norm(r.client_name); return a && b && (a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0); })[0] : null;
    S.kind = cu ? 'client' : 'internal'; S.cust = cu ? String(cu.id) : '';
    var me = (await myEmp()) || '';
    S.owner = me;
    var hol = await holidays(), t0 = today();
    var vote = {}, hints = [];
    S.items = r.tasks.map(function (k) {
      var sd = I.shiftDue(k.due_date, hol, t0);
      var asgName = k.suggested_assignee ? String(k.suggested_assignee).trim() : '';
      var asgId = asgName ? matchMemberId(asgName, st.employees) : null;
      if (asgId) vote[asgId] = (vote[asgId] || 0) + 1;
      else if (asgName) hints.push(asgName);
      var notes = k.notes || '';
      if (asgName) {
        var tip = L('Doc named assignee: ', 'Dokumen namakan assignee: ') + asgName;
        notes = notes ? (notes + '\n' + tip) : tip;
      }
      return { on: true, title: k.title, tag: k.tag || '', due: sd.d || '', moved: sd.moved ? sd.from : '', start: k.start_date || '', h: k.est_hours, imp: !!k.important, urg: !!k.urgent, todo: (k.todo || []).join('\n'), notes: notes, src: k.source || '', dup: '', asg: asgId || '' };
    });
    /* If every matched task points at the same member, preselect Owner; else keep me */
    var ids = Object.keys(vote);
    if (ids.length === 1) S.owner = ids[0];
    await markDup();
  }
  async function markDup() {
    var ex = S.mode === 'old' ? await existingTitles(S.pid) : [];
    S.items.forEach(function (it) { var d = I.dupOf(it.title, ex); if (d && !it.dup) it.on = false; it.dup = d; });
  }
  function quad(it) { return it.imp && it.urg ? 'do' : it.imp ? 'schedule' : it.urg ? 'delegate' : 'later'; }
  function itemHtml(it, i, tags) {
    var tg = '<option value="">—</option>' + tags.map(function (t) { return '<option' + (t === it.tag ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
    var q = quad(it), qo = [['do', L('Important + urgent', 'Penting + segera')], ['schedule', L('Important only', 'Penting sahaja')], ['delegate', L('Urgent only', 'Segera sahaja')], ['later', L('Neither', 'Dua-dua tidak')]].map(function (o) { return '<option value="' + o[0] + '"' + (q === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
    var w = (it.dup ? '<span class="pji-w dup"><i class="ti ti-copy"></i> ' + esc(L('Possible duplicate: ', 'Mungkin berganda: ') + it.dup) + '</span>' : '') +
      (it.moved ? '<span class="pji-w"><i class="ti ti-calendar-event"></i> ' + esc(L('Moved from ', 'Dialih dari ') + dmy(it.moved) + L(' (weekend / public holiday)', ' (hujung minggu / cuti umum)')) + '</span>' : '') +
      (it.src ? '<span class="pji-w src"><i class="ti ti-file-text"></i> ' + esc(it.src) + '</span>' : '');
    return '<div class="pji-item' + (it.on ? '' : ' off') + '" data-i="' + i + '">' +
      '<div class="pji-top"><input type="checkbox" data-k="on"' + (it.on ? ' checked' : '') + ' aria-label="' + esc(L('Include task ', 'Masukkan task ') + (i + 1)) + '"><textarea rows="1" data-k="title" maxlength="200" data-no-titlecase="1" aria-label="' + esc(L('Task title', 'Tajuk task')) + '">' + esc(it.title) + '</textarea></div>' +
      '<div class="pji-f"><label>' + esc(L('Tag', 'Tag')) + '<select data-k="tag">' + tg + '</select></label><label>' + esc(L('Due', 'Due')) + '<input type="date" data-k="due" value="' + esc(it.due) + '"></label>' +
      '<label>' + esc(L('Hours', 'Jam')) + '<input type="number" min="0.25" max="999" step="0.25" inputmode="decimal" data-k="h" value="' + (it.h != null ? esc(it.h) : '') + '"></label><label>' + esc(L('Matrix', 'Matrix')) + '<select data-k="quad">' + qo + '</select></label></div>' +
      (w ? '<div class="pji-tags">' + w + '</div>' : '') +
      '<details><summary>' + esc(L('Checklist & notes', 'Senarai semak & nota')) + (it.todo ? ' · ' + it.todo.split('\n').filter(Boolean).length : '') + '</summary>' +
      '<label>' + esc(L('Checklist (one step per line)', 'Senarai semak (satu langkah satu baris)')) + '<textarea data-k="todo" rows="4" data-no-titlecase="1">' + esc(it.todo) + '</textarea></label>' +
      '<label>' + esc(L('Notes', 'Nota')) + '<textarea data-k="notes" rows="3" data-no-titlecase="1">' + esc(it.notes) + '</textarea></label></details></div>';
  }
  function stepPreview() {
    S.step = 'preview';
    var st = S.st, r = S.res, tags = tagOptions();
    S.items.forEach(function (it) { if (it.tag && tags.indexOf(it.tag) < 0) tags.push(it.tag); });
    var on = S.items.filter(function (x) { return x.on && String(x.title || '').trim(); }).length;
    var projOpts = (st.projects || []).map(function (p) { return '<option value="' + esc(p.id) + '"' + (same(p.id, S.pid) ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
    var custOpts = '<option value="">—</option>' + (st.customers || []).map(function (c) { return '<option value="' + esc(c.id) + '"' + (same(c.id, S.cust) ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');
    var empOpts = '<option value="">' + esc(L('— Unassigned —', '— Tiada assignee —')) + '</option>' + (st.employees || []).map(function (e) { return '<option value="' + esc(e.id) + '"' + (same(e.id, S.owner) ? ' selected' : '') + '>' + esc(nm(e)) + '</option>'; }).join('');
    var body =
      (r.summary ? '<p class="pji-sum"><i class="ti ti-sparkles"></i> ' + esc(r.summary) + '</p>' : '') +
      (S.read && S.read.skipped ? '<p class="pji-hint">' + esc(L('Note: ', 'Nota: ') + S.read.skipped + L(' scanned page(s) were not read (limit 5 images). Import them separately if needed.', ' muka surat imbasan tidak dibaca (had 5 imej). Import berasingan jika perlu.')) + '</p>' : '') +
      '<div class="pja-sec"><b>' + esc(L('Project', 'Projek')) + '</b><div class="pji-seg" role="radiogroup">' +
        '<label><input type="radio" name="pji-m" value="old"' + (S.mode === 'old' ? ' checked' : '') + (projOpts ? '' : ' disabled') + '> ' + esc(L('Existing project', 'Projek sedia ada')) + '</label>' +
        '<label><input type="radio" name="pji-m" value="new"' + (S.mode === 'new' ? ' checked' : '') + '> ' + esc(L('New project', 'Projek baru')) + '</label></div>' +
        (S.mode === 'old'
          ? '<div class="pji-grid" style="margin-top:8px"><label>' + esc(L('Project', 'Projek')) + '<select id="pji-pid">' + projOpts + '</select></label></div>'
          : '<div class="pji-grid" style="margin-top:8px"><label>' + esc(L('Project name', 'Nama projek')) + '<input id="pji-name" maxlength="120" value="' + esc(S.newName) + '"></label>' +
            '<label>' + esc(L('Type', 'Jenis')) + '<select id="pji-kind"><option value="internal"' + (S.kind === 'internal' ? ' selected' : '') + '>' + esc(L('Internal', 'Dalaman')) + '</option><option value="client"' + (S.kind === 'client' ? ' selected' : '') + '>' + esc(L('Client', 'Klien')) + '</option></select></label>' +
            (S.kind === 'client' ? '<label>' + esc(L('Customer', 'Pelanggan')) + '<select id="pji-cust">' + custOpts + '</select></label>' : '') +
            (r.client_name ? '<p class="pji-hint" style="margin:0">' + esc(L('Client in document: ', 'Klien dalam dokumen: ') + r.client_name) + '</p>' : '') + '</div>') +
      '</div>' +
      '<div class="pja-sec"><b>' + esc(L('Owner', 'Owner')) + '</b><div class="pji-grid"><label>' + esc(L('Assign all tasks to', 'Assign semua task kepada')) + '<select id="pji-owner">' + empOpts + '</select></label></div><div id="pji-load"></div></div>' +
      '<div class="pji-bar"><span>' + on + ' / ' + S.items.length + ' ' + esc(L('tasks selected', 'task dipilih')) + '</span><span><button type="button" data-all="1">' + esc(L('Select all', 'Pilih semua')) + '</button> <button type="button" data-all="0">' + esc(L('Clear', 'Kosongkan')) + '</button></span></div>' +
      S.items.map(function (it, i) { return itemHtml(it, i, tags); }).join('');
    paint(frame(L('Review tasks', 'Semak task'), body,
      '<button type="button" class="btn btn-outline" id="pji-back">' + esc(L('Back', 'Kembali')) + '</button><button type="button" class="btn btn-primary" id="pji-make"' + (on ? '' : ' disabled') + '><i class="ti ti-check"></i> ' + esc(L('Create', 'Cipta')) + ' (' + on + ')</button>'));
    var el = S.el;
    el.querySelectorAll('input[name="pji-m"]').forEach(function (x) { x.onchange = function () { S.mode = x.value; markDup().then(stepPreview); }; });
    var pid = el.querySelector('#pji-pid'); if (pid) pid.onchange = function () { S.pid = pid.value; markDup().then(stepPreview); };
    var name = el.querySelector('#pji-name'); if (name) name.oninput = function () { S.newName = name.value; };
    var kind = el.querySelector('#pji-kind'); if (kind) kind.onchange = function () { S.kind = kind.value; stepPreview(); };
    var cust = el.querySelector('#pji-cust'); if (cust) cust.onchange = function () { S.cust = cust.value; };
    var own = el.querySelector('#pji-owner'); own.onchange = function () { S.owner = own.value; loadLine(); };
    el.querySelectorAll('[data-all]').forEach(function (b) { b.onclick = function () { var v = b.getAttribute('data-all') === '1'; S.items.forEach(function (it) { it.on = v; }); stepPreview(); }; });
    el.querySelectorAll('.pji-item').forEach(function (box) {
      var it = S.items[Number(box.getAttribute('data-i'))];
      box.querySelectorAll('[data-k]').forEach(function (f) {
        var k = f.getAttribute('data-k');
        var fit = function () { if (f.tagName === 'TEXTAREA' && k === 'title') { f.style.height = 'auto'; f.style.height = Math.max(40, f.scrollHeight) + 'px'; } };
        fit();
        f.addEventListener(f.type === 'checkbox' || f.tagName === 'SELECT' || f.type === 'date' ? 'change' : 'input', function () {
          if (k === 'on') { it.on = f.checked; box.classList.toggle('off', !it.on); counts(); return; }
          if (k === 'quad') { it.imp = f.value === 'do' || f.value === 'schedule'; it.urg = f.value === 'do' || f.value === 'delegate'; return; }
          if (k === 'h') { var n = Number(f.value); it.h = f.value !== '' && n > 0 ? Math.min(999, n) : null; loadLine(); return; }
          if (k === 'due') { it.due = f.value; it.moved = ''; return; }
          it[k] = f.value; fit(); if (k === 'title') counts();
        });
      });
    });
    el.querySelector('#pji-back').onclick = function () { stepPick(); };
    el.querySelector('#pji-make').onclick = create;
    loadLine();
  }
  function counts() {
    var on = S.items.filter(function (x) { return x.on && String(x.title || '').trim(); }).length;
    var b = S.el.querySelector('#pji-make'); if (b) { b.disabled = !on; b.innerHTML = '<i class="ti ti-check"></i> ' + esc(L('Create', 'Cipta')) + ' (' + on + ')'; }
    var s = S.el.querySelector('.pji-bar span'); if (s) s.textContent = on + ' / ' + S.items.length + ' ' + L('tasks selected', 'task dipilih');
    loadLine();
  }
  var loadSeq = 0;
  function loadLine() {
    var box = S && S.el.querySelector('#pji-load'); if (!box) return;
    var mine = ++loadSeq, owner = S.owner;
    if (!owner) { box.innerHTML = ''; return; }
    var w0 = new Date(); w0.setHours(0, 0, 0, 0); w0.setDate(w0.getDate() - ((w0.getDay() + 6) % 7)); var w1 = new Date(w0); w1.setDate(w0.getDate() + 6);
    var a = ymd(w0), b = ymd(w1);
    var add = S.items.reduce(function (n, it) { return n + (it.on && it.h > 0 && it.due && it.due >= a && it.due <= b ? Number(it.h) : 0); }, 0);
    ownerHours(owner).then(function (r) {
      if (!S || mine !== loadSeq || !r) { if (S && mine === loadSeq) box.innerHTML = ''; return; }
      var tot = Math.round((r.h + add) * 10) / 10, over = tot > CAP;
      box.innerHTML = '<div class="pji-load" role="status"><i class="ti ti-chart-bar"></i><span>' + esc(L('Owner workload this week: ', 'Beban kerja owner minggu ini: ')) + '<b class="' + (over ? 'over' : '') + '">' + tot + ' / ' + CAP + 'h</b>' + (add ? ' (' + esc(L('+', '+') + (Math.round(add * 10) / 10) + 'h ' + L('from this import', 'dari import ini')) + ')' : '') + '</span>' + (over ? '<b class="over"><i class="ti ti-alert-triangle"></i> ' + esc(L('Over capacity', 'Lebih kapasiti')) + '</b>' : '') + '</div>';
    });
  }
  function safeName(name) { var c = String(name || 'file').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, ''); return (Date.now() + '-' + (c || 'file')).slice(0, 120); }
  function notesFor(it, withChecklist) {
    var src = it.src ? L('Source: ', 'Sumber: ') + it.src : '';
    var ctx = [it.notes, src].filter(Boolean).join('\n');
    if (withChecklist) return ctx || null;
    var todo = String(it.todo || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    return L('To do:\n', 'Perlu buat:\n') + todo.map(function (s) { return '- ' + s; }).join('\n') + L('\n\nIn progress:\n\nDone:\n', '\n\nSedang buat:\n\nSudah siap:\n') + (ctx ? '\n' + ctx : '');
  }
  async function create() {
    var st = S.st, t = tid(), picked = S.items.filter(function (x) { return x.on && String(x.title || '').trim(); });
    if (!picked.length || !t) return;
    if (S.mode === 'new' && !String(S.newName || '').trim()) { toast(L('Enter a project name', 'Isi nama projek'), 'error'); return; }
    if (S.mode === 'new' && S.kind === 'client' && !S.cust) { toast(L('Pick a customer', 'Pilih pelanggan'), 'error'); return; }
    if (S.mode === 'old' && !S.pid) { toast(L('Choose a project', 'Pilih projek'), 'error'); return; }
    var btn = S.el.querySelector('#pji-make'); btn.disabled = true; btn.innerHTML = '<div class="spinner" style="display:inline-block;width:14px;height:14px"></div> ' + esc(L('Creating…', 'Sedang cipta…'));
    try {
      var pid = S.pid;
      if (S.mode === 'new') {
        var row = { tenant_id: t, name: String(S.newName).trim().slice(0, 120), kind: S.kind, customer_id: S.kind === 'client' ? S.cust : null, color: COLORS[(st.allProjects || st.projects || []).length % COLORS.length] };
        var pr = await sb.from('projects').insert(row).select('id').single();
        if (pr.error) throw pr.error;
        pid = pr.data.id;
      }
      var last = await sb.from('project_tasks').select('sort_order').eq('tenant_id', t).eq('project_id', pid).is('deleted_at', null).order('sort_order', { ascending: false }).limit(1);
      var base = last.data && last.data[0] ? Number(last.data[0].sort_order) || 0 : 0;
      var multi = !!(window.PJM && PJM.ok), multi2 = !!(window.PJM && PJM.ok2), chk = !!(window.PJC && (await PJC.probe()));
      var t0 = today();
      var rows = picked.map(function (it, i) {
        var r = {
          tenant_id: t, project_id: pid, title: String(it.title).replace(/\s+/g, ' ').trim().slice(0, 200), column_key: 'backlog', tag: it.tag || null,
          assignee_employee_id: S.owner || null, start_date: it.start && (!it.due || it.start <= it.due) ? it.start : (it.due && it.due < t0 ? it.due : t0), due_date: it.due || null,
          progress: 0, notes: notesFor(it, chk), sort_order: base + i + 1, is_important: !!it.imp, is_urgent: !!it.urg
        };
        if (multi2 && it.h > 0) r.est_hours = Math.round(Number(it.h) * 100) / 100;
        if (multi && it.due) r.remind_before_min = 1440;
        return r;
      });
      var ins = await sb.from('project_tasks').insert(rows).select('id,title,sort_order');
      if (ins.error) throw ins.error;
      var made = (ins.data || []).slice().sort(function (a, b) { return a.sort_order - b.sort_order; });
      var warn = [];
      if (multi && S.owner && made.length) {
        var as = await sb.from('project_task_assignees').insert(made.map(function (k) { return { tenant_id: t, task_id: k.id, employee_id: S.owner, is_owner: true }; }));
        if (as.error) warn.push(as.error.message);
      }
      if (chk && made.length) {
        var cl = [];
        made.forEach(function (k, i) { String(picked[i].todo || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 30).forEach(function (s, j) { cl.push({ tenant_id: t, task_id: k.id, label: s.slice(0, 300), sort_order: j + 1 }); }); });
        if (cl.length) { var cr = await sb.from('project_task_checklist').insert(cl); if (cr.error) warn.push(cr.error.message); }
      }
      for (var f = 0; f < S.files.length; f++) {
        var file = S.files[f];
        try {
          var up = await sb.storage.from('company-assets').upload(t + '/projects/' + pid + '/' + safeName(file.name), new Blob([await file.arrayBuffer()], { type: file.type || 'application/octet-stream' }), { contentType: file.type || 'application/octet-stream', upsert: false });
          if (up.error) warn.push(file.name + ': ' + up.error.message);
        } catch (e) { warn.push(file.name + ': ' + ((e && e.message) || 'upload')); }
      }
      if (typeof auditLog === 'function') made.forEach(function (k) { auditLog('ai_import', 'project_tasks', k.id); });
      close();
      toast(made.length + L(' task(s) created', ' task dicipta') + (warn.length ? L(' · some extras failed: ', ' · sebahagian gagal: ') + warn[0] : ''), warn.length ? 'warning' : 'success');
      if (typeof openPage === 'function') openPage('projects', { id: pid }); else if (typeof renderProjects === 'function') renderProjects({ id: pid });
    } catch (e) {
      if (!S) return;
      btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i> ' + esc(L('Create', 'Cipta')) + ' (' + picked.length + ')';
      toast((e && e.message) || 'Error', 'error');
    }
  }

  /* ---------- board entry points ---------- */
  function decorate(st) {
    I.st = st;
    var main = document.getElementById('main'); if (!main || !main.querySelector('.pj-wrap') || !allowed()) return;
    /* mobile: wraps with the other tool buttons; laptop: right end of the tab row (the laptop tool row does not wrap and is already full) */
    var box = main.querySelector('.pj-top .pj-tools');
    if (box && !document.getElementById('pji-btn')) {
      box.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-sm btn-outline pji-m" id="pji-btn"><i class="ti ti-file-import"></i> ' + esc(L('Import from doc', 'Import dari doc')) + '</button>');
      document.getElementById('pji-btn').onclick = function () { I.open(I.st); };
    }
    var tabs = main.querySelector('.pj-tabs');
    if (tabs && !document.getElementById('pji-btn2')) {
      tabs.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-sm btn-outline pji-d" id="pji-btn2"><i class="ti ti-file-import"></i> ' + esc(L('Import from doc', 'Import dari doc')) + '</button>');
      document.getElementById('pji-btn2').onclick = function () { I.open(I.st); };
    }
    menuItem();
  }
  /* mobile ⋮ menu (pj-all-ui.js rebuilds .pja-bar on every PJA.ui call, so the entry is re-added right after each rebuild) */
  function menuItem() {
    var menu = document.getElementById('pja-menu');
    if (!menu || menu.querySelector('[data-pji-menu]') || !allowed()) return;
    var first = menu.querySelector('[data-pja="new"]');
    var html = '<button type="button" data-pji-menu role="menuitem">' + esc(L('Import from doc', 'Import dari doc')) + '</button>';
    if (first) first.insertAdjacentHTML('afterend', html); else menu.insertAdjacentHTML('afterbegin', html);
    menu.querySelector('[data-pji-menu]').onclick = function (e) { e.stopPropagation(); menu.classList.remove('on'); I.open(I.st); };
  }
  if (window.PJA && typeof PJA.ui === 'function' && !PJA.ui._pji) {
    var oui = PJA.ui;
    PJA.ui = function (st) { var r = oui.apply(this, arguments); try { I.st = st; menuItem(); } catch (e) { console.warn('[pj-ai-import]', e); } return r; };
    PJA.ui._pji = 1;
  }
  var prev = window._pjAfterPaint;
  window._pjAfterPaint = function (st) {
    var r; try { r = typeof prev === 'function' ? prev(st) : null; } catch (e) { console.error(e); }
    try { decorate(st); } catch (e) { console.warn('[pj-ai-import]', e); }
    return r;
  };
})();
