/* M-Core Learning Center v2: lesson view with per-step image (lazy, max-width 100%, tap-to-zoom), prev/next,
   and "Not clear? Ask" which opens a Service Desk new request and prefills title/details once. Needs lc-core.js. */
(function () {
  var LC = window.LC; if (!LC || LC.lesson) return;
  var L = LC.L, esc = LC.esc, tx = LC.tx;
  var IMG = /^lc-img\/[a-z0-9_\-\/]+\.(webp|png|jpg)$/;
  LC.zoom = function (el) {
    var d = document.createElement('div'); d.className = 'lc-zoom'; d.setAttribute('role', 'dialog'); d.tabIndex = -1;
    d.innerHTML = '<img src="' + esc(el.getAttribute('src')) + '" alt="' + esc(el.getAttribute('alt')) + '">';
    var close = function () { d.remove(); document.removeEventListener('keydown', key); };
    var key = function (e) { if (e.key === 'Escape') close(); };
    d.onclick = close; document.addEventListener('keydown', key); document.body.appendChild(d); d.focus();
  };
  LC.canAsk = function () { try { return LC.can('sd_client') && !!(window.SD && SD.newReq) && !(typeof isPlatformAdmin === 'function' && isPlatformAdmin()); } catch (e) { return false; } };
  LC.ask = function (title) {
    try { sessionStorage.setItem('lc_ask', JSON.stringify({ t: L('Learning Center question: ', 'Soalan Pusat Pembelajaran: ') + title, d: L('Lesson: ', 'Pelajaran: ') + title + '\n' + L('What I do not understand: ', 'Apa yang saya tak faham: '), at: Date.now() })); } catch (e) {}
    openPage('servis_saya', { new: 1 });
    if (window.showToast) showToast(L('Pick a service; the title will be filled for you.', 'Pilih servis; tajuk akan diisi untuk anda.'), 'info');
    var n = 0, iv = setInterval(function () {
      var a; try { a = JSON.parse(sessionStorage.getItem('lc_ask') || 'null'); } catch (e) {}
      if (!a || ++n > 600 || Date.now() - a.at > 600000) { clearInterval(iv); return; }
      var m = document.getElementById('main'); if (!m) return;
      var ti = null, ta = m.querySelector('textarea');
      m.querySelectorAll('.form-group').forEach(function (g) { var lb = g.querySelector('label'), i = g.querySelector('input[type=text],input:not([type])'); if (!ti && lb && i && /title|tajuk|subject|subjek/i.test(lb.textContent)) ti = i; });
      if (!ti || !ta) return;
      var set = function (el, v) { if (el.value) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      set(ti, a.t.slice(0, 120)); set(ta, a.d); sessionStorage.removeItem('lc_ask'); clearInterval(iv);
    }, 1000);
  };
  LC.lesson = async function (id) {
    var main = document.getElementById('main'); main.innerHTML = LC.spin;
    var c = await LC.load(); if (c.error) return LC.origLesson && LC.origLesson(id);
    var l = c.ls.find(function (x) { return String(x.id) === String(id); });
    if (!l) { main.innerHTML = '<div class="empty-state"><p>' + L('Lesson not found.', 'Pelajaran tidak dijumpai.') + '</p><button class="btn btn-outline btn-sm" onclick="openPage(\'learning\')">← ' + L('Back', 'Kembali') + '</button></div>'; return; }
    var pr = await sb.from('user_learning_progress').select('completed_at').eq('user_id', APP.user.id).eq('lesson_id', id).maybeSingle();
    var done = !!(pr && pr.data && pr.data.completed_at); if (done) c.done.add(String(id));
    var sib = LC.lessonsOf(c, l.chapter_id), ix = sib.findIndex(function (x) { return String(x.id) === String(id); });
    var prev = sib[ix - 1], next = sib[ix + 1], steps = LC.stepsOf(c, id);
    var nb = function (x, ic, lab) { return x ? '<button type="button" class="btn btn-outline btn-sm" style="flex:1;min-width:0" onclick="openPage(\'learning\',{view:\'lesson\',id:\'' + esc(x.id) + '\'})">' + (ic === 'l' ? '<i class="ti ti-arrow-left"></i> ' : '') + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + lab + '</span>' + (ic === 'r' ? ' <i class="ti ti-arrow-right"></i>' : '') + '</button>' : '<span style="flex:1"></span>'; };
    main.innerHTML = '<div class="page-header"><div style="min-width:0"><div class="page-title">' + esc(tx(l, 'title')) + '</div>' + LC.back("openPage('learning',{view:'chapter',id:'" + esc(l.chapter_id) + "'})", L('Back to Chapter', 'Kembali ke Chapter')) + '</div></div>' +
      (tx(l, 'intro') ? '<div class="card" style="padding:20px;margin-bottom:16px"><p style="font-size:13px;color:var(--text-2);line-height:1.6;margin:0">' + esc(tx(l, 'intro')) + '</p></div>' : '') +
      '<div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">' + steps.map(function (s, i) {
        var note = tx(s, 'field_note'), img = s.image_path && IMG.test(String(s.image_path)) ? String(s.image_path) : '';
        var alt = tx(s, 'image_alt') || L('Example screen (sample data)', 'Contoh skrin (data contoh)');
        return '<div class="card" style="padding:16px"><div style="display:flex;gap:12px"><div style="width:26px;height:26px;min-width:26px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px">' + (i + 1) + '</div><div style="flex:1;min-width:0">' +
          '<p style="font-size:13px;line-height:1.6;margin:0 0 10px">' + esc(tx(s, 'text')) + '</p>' +
          (img ? '<img class="lc-img" loading="lazy" decoding="async" src="' + esc(img) + '" alt="' + esc(alt) + '" onclick="LC.zoom(this)" onerror="this.remove()">' : '') +
          (note ? '<div style="background:var(--bg);border-left:3px solid var(--primary);border-radius:6px;padding:10px 12px;font-size:12px;color:var(--text-2);line-height:1.5;margin-bottom:10px"><i class="ti ti-info-circle" style="color:var(--primary)"></i> ' + esc(note) + '</div>' : '') +
          (s.try_it_page && /^[a-z_]+$/.test(s.try_it_page) && s.try_it_page !== 'learning' ? '<button type="button" class="btn btn-outline btn-sm" onclick="openPage(\'' + s.try_it_page + '\')"><i class="ti ti-arrow-right"></i> ' + L('Try It Now', 'Cuba Sekarang') + '</button>' : '') +
          '</div></div></div>';
      }).join('') + '</div>' +
      '<div class="card" style="padding:16px;text-align:center;margin-bottom:12px">' + (done ? '<span style="color:var(--success);font-weight:600"><i class="ti ti-circle-check-filled"></i> ' + L("You've marked this understood", 'Anda dah faham pelajaran ni') + '</span>'
        : '<button type="button" class="btn btn-primary" onclick="doMarkLessonUnderstood(\'' + esc(id) + '\')"><i class="ti ti-check"></i> ' + L('I Understand This', 'Saya Faham') + '</button>') +
      (LC.canAsk() ? '<div style="margin-top:10px"><button type="button" class="btn btn-outline btn-sm" id="lc-ask"><i class="ti ti-message-question"></i> ' + L('Not clear? Ask M-Core', 'Tak faham? Tanya M-Core') + '</button></div>' : '') + '</div>' +
      '<div style="display:flex;gap:8px">' + nb(prev, 'l', L('Previous', 'Sebelum')) + nb(next, 'r', L('Next lesson', 'Pelajaran seterusnya')) + '</div>';
    var b = document.getElementById('lc-ask'); if (b) b.onclick = function () { LC.ask(tx(l, 'title')); };
  };
  var css = document.createElement('style');
  css.textContent = '.lc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.lc-row{padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:10px}.lc-row:last-child{border-bottom:0}.lc-row:hover{background:var(--bg)}.lc-sub{font-size:11px;color:var(--text-3)}' +
    '.lc-img{display:block;max-width:100%;height:auto;border-radius:10px;border:1px solid var(--border);margin:0 0 10px;cursor:zoom-in;background:var(--bg)}.lc-zoom{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:12px;cursor:zoom-out}.lc-zoom img{max-width:100%;max-height:100%;border-radius:8px}.lc-help{width:30px;height:30px;min-width:30px;border-radius:50%;border:1px solid var(--border);background:var(--surface,var(--bg));color:var(--text-2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-weight:700;margin-left:8px}.lc-help:focus-visible{outline:2px solid var(--primary)}';
  document.head.appendChild(css);
})();
