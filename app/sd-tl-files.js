/* M-Core Service Desk - request detail Timeline: file events become viewable (client tenant + platform admin, same SD.detail view).
   Images -> lazy inline thumbnail (tap opens full size), other files -> open link with a clean name (no "<ms>-" prefix).
   Same access rule as the Deliverables card: a file is only opened when its own download button there is enabled
   (unpaid client = locked, plain text + lock). Signed URLs via service-files createSignedUrl (300 s), fetched when visible.
   Chained onto SD.waInject (called at the end of SD.detail). v1 */
(function () {
  var SD = window.SD; if (!SD || SD._tlFiles) return; SD._tlFiles = 1;
  var S = {
    en: { img: 'Open image', file: 'Open file', locked: 'Available after full payment' },
    bm: { img: 'Buka gambar', file: 'Buka fail', locked: 'Tersedia selepas bayaran penuh' }
  };
  try { if (window.LANG) ['en', 'bm'].forEach(function (l) { if (LANG[l] && !LANG[l].sdTlf) LANG[l].sdTlf = S[l]; }); } catch (e) {}
  function T(k) { var l = window.APP && APP.language === 'bm' ? 'bm' : 'en', d = (window.LANG && LANG[l] && LANG[l].sdTlf) || S[l]; return d[k] != null ? d[k] : S.en[k]; }
  var css = document.createElement('style'); css.id = 'sd-tl-files';
  css.textContent = '.sd-tlf-a{display:flex;width:fit-content;align-items:flex-start;gap:6px;margin-top:4px;max-width:100%;min-width:0;color:var(--primary);font-size:13px;line-height:1.35;overflow-wrap:anywhere;word-break:break-word;text-decoration:none}' +
    '.sd-tlf-a:hover{text-decoration:underline}.sd-tlf-a>.ti{flex:0 0 auto;margin-top:1px;font-size:15px}' +
    '.sd-tlf-th{display:block;margin-top:6px;padding:0;border:1px solid var(--border);border-radius:8px;background:var(--bg-2,rgba(127,127,127,.12));cursor:zoom-in;overflow:hidden;max-width:min(220px,100%);line-height:0}' +
    '.sd-tlf-th img{display:block;max-width:100%;max-height:220px;min-width:96px;min-height:72px;object-fit:contain}' +
    '.sd-tlf-a:focus-visible,.sd-tlf-th:focus-visible{outline:2px solid var(--primary);outline-offset:2px}' +
    '.sd-tlf-lk{display:flex;align-items:flex-start;gap:6px;margin-top:4px;font-size:12px;color:var(--text-2)}';
  (document.head || document.documentElement).appendChild(css);
  var PRE = /^\d{13}-(?=\S)/, IMG = /\.(jpe?g|png|gif|webp|bmp|avif)$/i, CACHE = {}, TTL = 240000;
  function clean(e) { var n = String((e.meta || {}).name || e.body || String(e.file_path).split('/').pop() || 'file').trim(); return n.replace(PRE, ''); }
  function isImg(e) { var mt = String((e.meta || {}).mime || (e.meta || {}).type || ''); return /^image\/(jpe?g|png|gif|webp|bmp|avif)$/i.test(mt) || IMG.test(String(e.file_path)) || IMG.test(clean(e)); }
  function sign(p) {
    var c = CACHE[p]; if (c && Date.now() - c.t < TTL) return Promise.resolve(c.u);
    return sb.storage.from('service-files').createSignedUrl(p, 300).then(function (r) { if (r.error || !r.data || !r.data.signedUrl) throw (r.error || new Error('no url')); CACHE[p] = { u: r.data.signedUrl, t: Date.now() }; return r.data.signedUrl; });
  }
  function fresh(p) { var c = CACHE[p]; return c && Date.now() - c.t < TTL ? c.u : null; }
  function open(p, ev) { var u = fresh(p); if (u) { if (ev && ev.currentTarget.tagName === 'A') { ev.currentTarget.href = u; return; } if (ev) ev.preventDefault(); window.open(u, '_blank', 'noopener'); return; } if (ev) ev.preventDefault(); SD.download(p); }
  var IO = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { IO.unobserve(x.target); load(x.target); } }); }, { rootMargin: '200px' }) : null;
  function load(el) {
    var p = el.dataset.p; sign(p).then(function (u) {
      if (el.tagName === 'A') { el.href = u; return; }
      var im = el.querySelector('img'); im.onerror = function () { var a = link(p, el.dataset.n); el.replaceWith(a); }; im.src = u;
    }, function () {});
  }
  function watch(el) { if (IO) IO.observe(el); else load(el); }
  function link(p, n) {
    var a = document.createElement('a'); a.className = 'sd-tlf-a'; a.href = '#'; a.target = '_blank'; a.rel = 'noopener'; a.dataset.p = p; a.title = T('file');
    a.innerHTML = '<i class="ti ti-external-link" aria-hidden="true"></i><span></span>'; a.lastChild.textContent = n;
    a.onclick = function (ev) { open(p, ev); }; watch(a); return a;
  }
  function inject(m, ev) {
    var tl = m && m.querySelector('.sd-tl'); if (!tl || !ev || !ev.length) return;
    var rows = [].filter.call(tl.children, function (n) { return n.classList.contains('sd-ev'); }); if (rows.length !== ev.length) return;
    var btn = {}; [].forEach.call(m.querySelectorAll('[data-dl]'), function (b) { btn[b.getAttribute('data-dl')] = b; });
    ev.forEach(function (e, i) {
      if (e.type !== 'attachment' || !e.file_path) return;
      var row = rows[i], g = row.querySelector('.grow'); if (!g || row.querySelector('.sd-tlf-a,.sd-tlf-th,.sd-tlf-lk')) return;
      var body = g.querySelector('div[style*="pre-wrap"]'), n = clean(e), b = btn[e.file_path];
      if (!b) return; /* no matching file row -> keep plain text */
      if (body) body.textContent = n;
      if (b.disabled) { var lk = document.createElement('div'); lk.className = 'sd-tlf-lk'; lk.innerHTML = '<i class="ti ti-lock" aria-hidden="true"></i><span></span>'; lk.lastChild.textContent = T('locked'); (body || g.firstChild).after(lk); return; }
      var el;
      if (isImg(e)) {
        el = document.createElement('button'); el.type = 'button'; el.className = 'sd-tlf-th'; el.dataset.p = e.file_path; el.dataset.n = n; el.setAttribute('aria-label', T('img') + ': ' + n); el.title = T('img');
        el.innerHTML = '<img alt="" loading="lazy" decoding="async">'; el.onclick = function (x) { open(e.file_path, x); }; watch(el);
      } else { el = link(e.file_path, n); if (body) body.remove(); body = null; }
      var at = body || g.firstChild; at.after(el);
    });
  }
  var prev = SD.waInject;
  SD.waInject = function (m, r, ev, admin) {
    if (typeof prev === 'function') { try { prev.apply(this, arguments); } catch (e) { console.warn('[sd-tl-files] prev', e); } }
    try { inject(m, ev); } catch (e) { console.warn('[sd-tl-files]', e); }
  };
})();
