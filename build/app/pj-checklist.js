/* M-Core Projects - task checklist: steps with tick boxes in task Detail; when a task has steps, its progress follows the checklist
   (done / total). Each tick is saved at once (project_task_checklist). Progress is written to the task and to every assignee row, so the
   multi-assignee average (pj-multi2-detail.js) equals the checklist %; when the column must change (0% / 100% / first tick) the card's own
   Save runs, so projects.js saveTask() keeps the existing Backlog / In Progress / Done rule. Hidden until pj_auto_01.sql runs.
   Hook: window._pjAfterPaint (chained) + PJM.detail2 wrap (per-person inputs become read-only while a checklist exists). */
(function () {
  if (window.PJC) return;
  var C = window.PJC = { ok: null, items: {}, busy: {} };
  function bm() { return window.APP && APP.language === 'bm'; }
  function L(en, ms) { return bm() ? ms : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function same(a, b) { return String(a) === String(b); }
  function tid() { return window.APP && APP.tenant && APP.tenant.id; }
  function toast(m, k) { if (typeof showToast === 'function') showToast(esc(m), k || 'success'); } /* showToast renders HTML */

  (function css() {
    if (document.getElementById('pjc-css')) return;
    var c = document.createElement('style'); c.id = 'pjc-css';
    c.textContent = '.pjc-badge{display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:11.5px;font-weight:600;color:var(--text-2)}.pjc-badge.all{color:var(--primary-dark,var(--primary))}body.dark .pjc-badge.all,[data-theme=dark] .pjc-badge.all{color:var(--primary)}.pjc-badge .ti{font-size:14px}' +
      '.pjc-box{margin-top:8px;font-size:12px}.pjc-box .pjm-lbl,.pjc-lbl{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;color:var(--text)}.pjc-lbl small{color:var(--text-2);font-size:11px}' +
      '.pjc-list{border:1px solid var(--border);border-radius:8px;background:var(--bg-card);margin-top:4px}.pjc-list:empty{display:none}' +
      '.pjc-row{display:flex;align-items:center;gap:4px;min-height:40px;border-bottom:1px solid var(--border);padding:0 2px 0 10px}.pjc-row:last-child{border-bottom:0}' +
      '.pj-detail .pjc-row label{display:flex;align-items:center;gap:10px;flex:1;min-width:0;margin:0;padding:6px 0;font-size:13px;color:var(--text);cursor:pointer}.pj-detail .pjc-row input[type=checkbox]{width:18px;height:18px;margin:0;flex:none;accent-color:var(--primary)}' +
      '.pjc-row span{min-width:0;overflow-wrap:anywhere;line-height:1.35}.pjc-row.done span{text-decoration:line-through;color:var(--text-2)}' +
      '.pjc-row button{min-width:36px;min-height:36px;border:0;background:none;color:var(--text-2);cursor:pointer;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex:none}' +
      '.pjc-add{display:flex;gap:6px;margin-top:6px}.pj-detail .pjc-add input{flex:1;min-width:0;margin:0;min-height:40px}.pjc-add .btn{flex:none;min-height:40px}' +
      '.pjc-use{margin-top:6px;min-height:36px;border:1px dashed var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:12px;padding:4px 10px;cursor:pointer;width:100%}' +
      '.pjc-bar{display:block;height:6px;border-radius:99px;background:var(--border);overflow:hidden;margin-top:6px}.pjc-bar i{display:block;height:100%;background:var(--primary)}' +
      '.pjc-row button:disabled,.pjc-add .btn:disabled{opacity:.5;cursor:wait}';
    document.head.appendChild(c);
  })();

  C.probe = function () {
    if (C.ok != null) return Promise.resolve(C.ok);
    if (!window.sb || !tid()) return Promise.resolve(false);
    return sb.from('project_task_checklist').select('id', { head: true, count: 'exact' }).limit(1).then(function (r) {
      C.ok = !r.error; if (!C.ok) console.info('[M-Core] Projects checklist hidden until SQL pj_auto_01.sql is run'); return C.ok;
    }, function () { C.ok = false; return false; });
  };
  C.load = function (st) {
    var ids = (st.tasks || []).map(function (k) { return k.id; }); C.items = {};
    if (!ids.length) return Promise.resolve();
    var parts = []; for (var i = 0; i < ids.length; i += 150) parts.push(ids.slice(i, i + 150));
    return Promise.all(parts.map(function (p) {
      return sb.from('project_task_checklist').select('id,task_id,label,done,sort_order,created_at').eq('tenant_id', tid()).in('task_id', p).is('deleted_at', null).order('sort_order').order('created_at').limit(3000);
    })).then(function (rs) {
      rs.forEach(function (r) { (r.data || []).forEach(function (x) { (C.items[x.task_id] = C.items[x.task_id] || []).push(x); }); });
    });
  };
  C.pct = function (list) { if (!list || !list.length) return null; var d = list.filter(function (x) { return x.done; }).length; return Math.round(d / list.length * 100); };
  /* same Backlog / In Progress / Done rule as projects.js saveTask() */
  C.nextCol = function (col, pct) { if (pct >= 100) return 'done'; if (pct === 0 && col !== 'backlog') return 'backlog'; if (pct > 0 && col === 'backlog') return 'progress'; return col; };

  function badge(card, k) {
    var old = card.querySelector('.pjc-badge'); if (old) old.remove();
    var list = C.items[k.id]; if (!list || !list.length) return;
    var d = list.filter(function (x) { return x.done; }).length, all = d === list.length;
    var html = '<span class="pjc-badge' + (all ? ' all' : '') + '" title="' + esc(L('Checklist', 'Senarai semak')) + '"><i class="ti ti-checklist"></i> ' + d + '/' + list.length + '</span>';
    var bar = card.querySelector('.pj-bar'); if (bar) bar.insertAdjacentHTML('beforebegin', html);
  }
  /* per-person progress inputs (pj-multi2-detail.js) follow the checklist while it has steps */
  function lockPP(det, k) {
    var list = C.items[k.id], on = !!(list && list.length);
    det.querySelectorAll('[data-pp]').forEach(function (i) {
      if (on) { i.readOnly = true; i.setAttribute('aria-readonly', 'true'); i.setAttribute('data-pjc-lock', '1'); }
      else if (i.getAttribute('data-pjc-lock')) { i.readOnly = false; i.removeAttribute('aria-readonly'); i.removeAttribute('data-pjc-lock'); }
    });
    det.querySelectorAll('[data-ppd]').forEach(function (b) { if (on) { b.disabled = true; b.setAttribute('data-pjc-lock', '1'); } else if (b.getAttribute('data-pjc-lock')) { b.disabled = false; b.removeAttribute('data-pjc-lock'); } });
    var prog = det.querySelector('input[data-f="progress"]');
    if (prog && on && !prog.readOnly) { prog.readOnly = true; prog.setAttribute('data-pjc-ro', '1'); }
    else if (prog && !on && prog.getAttribute('data-pjc-ro')) { prog.readOnly = false; prog.removeAttribute('data-pjc-ro'); }
    var pp = det.querySelector('.pjm2-pp'), h = pp && pp.querySelector('.pjc-pphint');
    if (pp && on && !h) pp.insertAdjacentHTML('beforeend', '<small class="pjm-hint pjc-pphint">' + esc(L('Progress follows the checklist below.', 'Kemajuan ikut senarai semak di bawah.')) + '</small>');
    if (h && !on) h.remove();
  }
  function setDom(card, pct) {
    var det = card.querySelector('details.pj-detail');
    if (det) {
      var p = det.querySelector('input[data-f="progress"]'); if (p) p.value = pct;
      det.querySelectorAll('[data-pp]').forEach(function (i) { i.value = pct; var b = i.parentNode && i.parentNode.querySelector('.pjm2-bar'); if (b) { b.setAttribute('aria-valuenow', pct); if (b.firstChild) b.firstChild.style.width = pct + '%'; } });
      det.querySelectorAll('.pjm2-row .pjm2-v').forEach(function (v) { v.textContent = pct + '%'; });
      det.querySelectorAll('.pjm2-row .pjm2-bar').forEach(function (b) { b.setAttribute('aria-valuenow', pct); if (b.firstChild) b.firstChild.style.width = pct + '%'; });
    }
    var bar = card.querySelector('.pj-bar i'); if (bar) bar.style.width = pct + '%';
    var tx = card.querySelector('.pj-pct'); if (tx) tx.textContent = pct + '%';
  }
  /* write checklist % to the task + all assignee rows; Save the card when the column has to change */
  function sync(card, k) {
    var pct = C.pct(C.items[k.id]); if (pct == null) return Promise.resolve();
    setDom(card, pct); badge(card, k);
    var t = tid(), now = new Date().toISOString(), M = window.PJM;
    var pp = M && M.ok2 ? sb.from('project_task_assignees').update({ progress: pct, done_at: pct >= 100 ? now : null }).eq('tenant_id', t).eq('task_id', k.id).is('deleted_at', null).then(function (r) {
      if (r.error) throw r.error;
      Object.keys(M.pp || {}).forEach(function (key) { if (key.indexOf(k.id + '|') === 0) { M.pp[key].progress = pct; M.pp[key].done_at = pct >= 100 ? now : null; } });
    }) : Promise.resolve();
    return pp.then(function () {
      var next = C.nextCol(k.column_key, pct), save = card.querySelector('[data-act="save"]');
      if (next !== k.column_key && save && !save.disabled) { save.click(); return; }
      return sb.from('project_tasks').update({ progress: pct }).eq('id', k.id).eq('tenant_id', t).then(function (r) { if (r.error) throw r.error; k.progress = pct; });
    });
  }
  /* "To do" lines in the Update text -> checklist steps (Update text is left as it is) */
  C.todoLines = function (notes) {
    var out = [], on = false;
    String(notes || '').split(/\r?\n/).forEach(function (raw) {
      var s = raw.trim();
      if (/^(to\s*do|perlu\s*buat)\s*:?\s*$/i.test(s)) { on = true; return; }
      if (/^(in\s*progress|sedang\s*buat|done|sudah\s*siap)\s*:?\s*$/i.test(s)) { on = false; return; }
      if (!on || !s) return;
      s = s.replace(/^([-*•]|\d+[.)])\s*/, '').trim();
      if (s && !/^none$|^tiada$/i.test(s)) out.push(s.slice(0, 300));
    });
    return out.slice(0, 30);
  };
  function boxHtml(k, det) {
    var list = C.items[k.id] || [], pct = C.pct(list), d = list.filter(function (x) { return x.done; }).length;
    var notes = (det.querySelector('textarea[data-f="notes"]') || {}).value || k.notes || '';
    var lines = list.length ? [] : C.todoLines(notes);
    return '<div class="pjc-lbl"><b>' + esc(L('Checklist', 'Senarai semak')) + '</b>' + (list.length ? '<small>' + d + '/' + list.length + ' · ' + esc(L('task progress follows the checklist', 'kemajuan task ikut senarai semak')) + '</small>' : '<small>' + esc(L('optional · ticks set the task progress', 'pilihan · tick menentukan kemajuan task')) + '</small>') + '</div>' +
      (list.length ? '<span class="pjc-bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(L('Checklist progress', 'Kemajuan senarai semak')) + '"><i style="width:' + pct + '%"></i></span>' : '') +
      '<div class="pjc-list">' + list.map(function (x) {
        return '<div class="pjc-row' + (x.done ? ' done' : '') + '"><label><input type="checkbox" data-pjc-t="' + esc(x.id) + '"' + (x.done ? ' checked' : '') + '><span>' + esc(x.label) + '</span></label><button type="button" data-pjc-del="' + esc(x.id) + '" aria-label="' + esc(L('Remove step: ', 'Buang langkah: ') + x.label) + '"><i class="ti ti-x"></i></button></div>';
      }).join('') + '</div>' +
      '<div class="pjc-add"><input type="text" maxlength="300" data-pjc-new data-no-titlecase="1" placeholder="' + esc(L('Add a step', 'Langkah baru')) + '" aria-label="' + esc(L('New checklist step', 'Langkah senarai semak baharu')) + '"><button type="button" class="btn btn-sm btn-outline" data-pjc-add>' + esc(L('Add', 'Tambah')) + '</button></div>' +
      (lines.length ? '<button type="button" class="pjc-use" data-pjc-use>' + esc(L('Use the ' + lines.length + ' "To do" line(s) from Update as steps', 'Guna ' + lines.length + ' baris "Perlu buat" dari Kemaskini sebagai langkah')) + '</button>' : '');
  }
  function detail(st, card, k) {
    var det = card.querySelector('details.pj-detail'); if (!det) return;
    var notesLab = det.querySelector('textarea[data-f="notes"]'); notesLab = notesLab && notesLab.closest('label'); if (!notesLab) return;
    var box = det.querySelector('.pjc-box');
    if (!box) { box = document.createElement('div'); box.className = 'pjc-box'; notesLab.insertAdjacentElement('beforebegin', box); }
    var draw = function () { box.innerHTML = boxHtml(k, det); wire(); lockPP(det, k); };
    var run = function (fn) {
      if (C.busy[k.id]) return; C.busy[k.id] = 1;
      box.querySelectorAll('button,input').forEach(function (x) { x.disabled = true; });
      Promise.resolve().then(fn).then(function () { return sync(card, k); }).catch(function (e) { toast((e && e.message) || 'Error', 'error'); }).then(function () { C.busy[k.id] = 0; if (box.isConnected) draw(); });
    };
    var wire = function () {
      box.querySelectorAll('[data-pjc-t]').forEach(function (c) {
        c.onchange = function () {
          var id = c.getAttribute('data-pjc-t'), on = c.checked;
          run(function () {
            return sb.from('project_task_checklist').update({ done: on, done_at: on ? new Date().toISOString() : null, done_by: on && APP.user ? APP.user.id : null }).eq('tenant_id', tid()).eq('id', id).then(function (r) {
              if (r.error) throw r.error; (C.items[k.id] || []).forEach(function (x) { if (same(x.id, id)) x.done = on; });
            });
          });
        };
      });
      box.querySelectorAll('[data-pjc-del]').forEach(function (b) {
        b.onclick = function (e) {
          e.preventDefault(); var id = b.getAttribute('data-pjc-del');
          run(function () {
            return sb.from('project_task_checklist').update({ deleted_at: new Date().toISOString() }).eq('tenant_id', tid()).eq('id', id).then(function (r) {
              if (r.error) throw r.error; C.items[k.id] = (C.items[k.id] || []).filter(function (x) { return !same(x.id, id); });
            });
          });
        };
      });
      var inp = box.querySelector('[data-pjc-new]'), add = box.querySelector('[data-pjc-add]');
      var addFn = function (labels) {
        labels = labels.map(function (s) { return String(s || '').trim().slice(0, 300); }).filter(Boolean); if (!labels.length) return;
        run(function () {
          var list = C.items[k.id] || [], base = list.reduce(function (m, x) { return Math.max(m, Number(x.sort_order) || 0); }, 0);
          return sb.from('project_task_checklist').insert(labels.map(function (s, i) { return { tenant_id: tid(), task_id: k.id, label: s, sort_order: base + i + 1 }; })).select('id,task_id,label,done,sort_order,created_at').then(function (r) {
            if (r.error) throw r.error; C.items[k.id] = list.concat(r.data || []);
          });
        });
      };
      add.onclick = function (e) { e.preventDefault(); addFn([inp.value]); };
      inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); addFn([inp.value]); } };
      var use = box.querySelector('[data-pjc-use]');
      if (use) use.onclick = function (e) { e.preventDefault(); var notes = (det.querySelector('textarea[data-f="notes"]') || {}).value || k.notes || ''; addFn(C.todoLines(notes)); };
    };
    draw();
  }
  function decorate(st) {
    var main = document.getElementById('main'); if (!main || !main.querySelector('.pj-wrap')) return;
    var by = {}; (st.tasks || []).forEach(function (k) { by[k.id] = k; });
    main.querySelectorAll('.pj-card[data-id]').forEach(function (card) { var k = by[card.getAttribute('data-id')]; if (!k) return; badge(card, k); detail(st, card, k); });
  }
  var seq = 0;
  function run(st) {
    var mine = ++seq;
    return C.probe().then(function (ok) { if (!ok) return; return C.load(st).then(function () { if (mine === seq) decorate(st); }); }).catch(function (e) { console.warn('[pj-checklist]', e); });
  }
  var M = window.PJM;
  if (M && typeof M.detail2 === 'function' && !M.detail2._pjc) {
    var od = M.detail2;
    M.detail2 = function (st, el, k) { var r = od.apply(this, arguments); try { var det = el.querySelector('details.pj-detail'); if (det && C.ok) lockPP(det, k); } catch (e) {} return r; };
    M.detail2._pjc = 1;
  }
  var prev = window._pjAfterPaint;
  window._pjAfterPaint = function (st) {
    var r; try { r = typeof prev === 'function' ? prev(st) : null; } catch (e) { console.error(e); }
    run(st);
    return r;
  };
})();
