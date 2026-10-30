/* dk-cards.js — M-Core card kit (all widths). Generic list-table → cards transformer:
   accordion cards, search + status/date chips, lazy 20 + infinite scroll, swipe quick actions,
   bulk select + queued WhatsApp share, lazy timeline (created/sent/opened/signed), deep-link highlight.
   The source <table> stays in the DOM (hidden on screen, shown in print) so every onclick handler,
   list-table-fit wrap and existing filter keeps working; cards re-click the original row / buttons.
   Design tokens only (var(--…)); EN/BM; dark/light; no horizontal overflow. v1 */
(function () {
  if (window.DK) return;
  var DK = window.DK = { lists: [], st: {}, cur: { page: '', params: {} }, hl: null, v: 1 };
  var UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  var L = DK.L = function (en, b) { return bm() ? b : en; };
  var esc = DK.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  DK.toast = function (m, k) { try { showToast(m, k || 'info'); } catch (e) { console.log(m); } };
  DK.money = function (n) { try { return formatRM(n); } catch (e) { return 'RM ' + Number(n || 0).toFixed(2); } };
  DK.tid = function () { try { return APP.tenant.id; } catch (e) { return null; } };
  DK.date = function (d) { if (!d) return ''; var x = new Date(d); if (isNaN(x)) return String(d); var p2 = function (n) { return (n < 10 ? '0' : '') + n; }; var loc = /T/.test(String(d)) ? x.getFullYear() + '-' + p2(x.getMonth() + 1) + '-' + p2(x.getDate()) : String(d).slice(0, 10); try { return formatDate(loc); } catch (e) { return x.toLocaleDateString(); } };
  DK.dt = function (d) { var x = new Date(d); if (isNaN(x)) return ''; return DK.date(d) + ' ' + x.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };

  /* ---------- styles (tokens only) ---------- */
  var css = '' +
    '.dk-src{display:none!important}' +
    '.dk-wrap{display:block;max-width:100%;min-width:0;margin:0 0 16px}' +
    '.dk-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}' +
    '.dk-q{flex:1 1 220px;min-width:0;max-width:100%;box-sizing:border-box}' +
    '.dk-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}' +
    '.dk-chip{white-space:nowrap;border:1px solid var(--border);background:var(--bg-card);color:var(--text-2);border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:600;min-height:32px;cursor:pointer;font-family:var(--font);transition:var(--transition)}' +
    '.dk-chip:hover{border-color:var(--primary);color:var(--text)}.dk-chip.on{background:var(--primary);border-color:var(--primary);color:var(--on-primary,#fff)}' +
    '.dk-chip:disabled{opacity:.5;cursor:not-allowed}' +
    '.dk-sum{font-size:12.5px;color:var(--text-3);margin:0 0 8px;display:flex;flex-wrap:wrap;gap:4px 12px}' +
    '.dk-grid{display:grid;grid-template-columns:1fr;gap:10px;min-width:0}' +
    '@media(min-width:901px){.dk-grid{grid-template-columns:repeat(auto-fill,minmax(320px,1fr));align-items:start}}' +
    '.dk-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow-sm,none);min-width:0;overflow:hidden;position:relative;transition:var(--transition)}' +
    '.dk-card:hover{border-color:var(--border-2,var(--border))}' +
    '.dk-card.dk-hl{border-color:var(--primary);box-shadow:0 0 0 2px var(--primary)}' +
    '.dk-card.dk-sel{border-color:var(--primary)}' +
    '.dk-head{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;cursor:pointer;width:100%;text-align:left;background:none;border:0;color:var(--text);font-family:var(--font);min-width:0;transition:transform .18s ease}' +
    '.dk-head:focus-visible{outline:2px solid var(--primary);outline-offset:-2px}' +
    '.dk-ck{width:20px;height:20px;margin-top:2px;flex:0 0 auto;accent-color:var(--primary)}' +
    '.dk-main{flex:1 1 auto;min-width:0}' +
    '.dk-t{font-weight:700;font-size:14.5px;line-height:1.3;overflow-wrap:anywhere}' +
    '.dk-s{font-size:12.5px;color:var(--text-2);margin-top:2px;overflow-wrap:anywhere}' +
    '.dk-m{display:flex;flex-wrap:wrap;gap:4px 8px;margin-top:6px;font-size:12px;color:var(--text-3);align-items:center}' +
    '.dk-r{flex:0 0 auto;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px;max-width:45%}' +
    '.dk-amt{font-family:"Space Grotesk",var(--font);font-weight:700;font-size:15px;white-space:nowrap}' +
    '.dk-st{display:inline-block;white-space:nowrap;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid currentColor;line-height:1.5;max-width:100%;overflow:hidden;text-overflow:ellipsis}' +
    '.dk-chev{color:var(--text-3);transition:transform .18s ease;font-size:16px}.dk-card.open .dk-chev{transform:rotate(180deg)}' +
    '.dk-body{display:none;border-top:1px solid var(--border);padding:12px 14px}.dk-card.open .dk-body{display:block}' +
    '.dk-kv{display:grid;grid-template-columns:minmax(0,40%) minmax(0,1fr);gap:6px 10px;font-size:13px;margin:0 0 10px}' +
    '.dk-kv dt{color:var(--text-3);overflow-wrap:anywhere}.dk-kv dd{margin:0;color:var(--text);overflow-wrap:anywhere;min-width:0}' +
    '.dk-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
    '.dk-acts .btn,.dk-acts button{white-space:nowrap}' +
    '.dk-wa{color:var(--success)!important;border-color:var(--success)!important}' +
    '.dk-tl{margin-top:10px;border-top:1px dashed var(--border);padding-top:8px;font-size:12.5px;color:var(--text-2)}' +
    '.dk-tl-i{display:flex;gap:8px;align-items:flex-start;padding:3px 0;min-width:0}.dk-tl-i i{color:var(--primary);margin-top:2px}.dk-tl-i span{overflow-wrap:anywhere;min-width:0}' +
    '.dk-tl-i small{color:var(--text-3);margin-left:auto;white-space:nowrap;padding-left:8px}' +
    '.dk-swa{position:absolute;right:0;top:0;bottom:0;display:flex;gap:6px;align-items:center;padding:0 10px;background:var(--bg);border-left:1px solid var(--border);transform:translateX(100%);transition:transform .18s ease;z-index:1}' +
    '.dk-card.sw .dk-swa{transform:translateX(0)}.dk-swa button{white-space:nowrap}' +
    '.dk-empty{padding:32px 16px;text-align:center;color:var(--text-3);border:1px dashed var(--border);border-radius:var(--radius);background:var(--bg-card)}' +
    '.dk-empty i{font-size:28px;display:block;margin-bottom:6px}' +
    '.dk-sk{height:74px;border-radius:var(--radius);background:linear-gradient(90deg,var(--bg-card),var(--bg),var(--bg-card));background-size:200% 100%;animation:dkSk 1.2s linear infinite;border:1px solid var(--border)}' +
    '@keyframes dkSk{0%{background-position:200% 0}100%{background-position:-200% 0}}' +
    '.dk-more{height:1px}' +
    '.dk-bulk{position:sticky;bottom:8px;z-index:40;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin-top:10px;padding:10px 12px;background:var(--bg-card);border:1px solid var(--primary);border-radius:var(--radius);box-shadow:var(--shadow-lg)}' +
    '.dk-bulk span{font-weight:700;font-size:13px}.dk-bulk div{display:flex;flex-wrap:wrap;gap:8px}.dk-bulk .btn{white-space:nowrap}' +
    '.btn.dk-busy{opacity:.6;pointer-events:none}' +
    '@media print{.dk-wrap,.dk-bulk,.dk-q,.dk-chips{display:none!important}.dk-src{display:revert!important}}';
  function addCss() { if (document.getElementById('dk-cards-css')) return; var s = document.createElement('style'); s.id = 'dk-cards-css'; s.textContent = css; document.head.appendChild(s); }
  DK.css = function (id, text) { if (document.getElementById(id)) return; var s = document.createElement('style'); s.id = id; s.textContent = text; document.head.appendChild(s); };

  /* ---------- registry ----------
     DK.list({ key, sel: css selector of the table or its container, doc?: share/timeline doc type,
       fns?: [render function names to wrap], when?: fn()->bool, title?, sub?, amount?, status?, date?: column indexes,
       quick?: RegExp for swipe/approve buttons, open?: fn(id,row), hide?: [col idx], bulk?: bool, table?: timeline source table }) */
  DK.list = function (cfg) { DK.lists = DK.lists.filter(function (c) { return c.key !== cfg.key; }); DK.lists.push(cfg); (cfg.fns || []).forEach(wrapFn); schedule(); return cfg; };
  var wrapped = {};
  function wrapFn(name) {
    if (wrapped[name]) return; var f = window[name]; if (typeof f !== 'function') { setTimeout(function () { if (!wrapped[name] && typeof window[name] === 'function') wrapFn(name); }, 1500); return; }
    wrapped[name] = 1;
    window[name] = function () { var r = f.apply(this, arguments); Promise.resolve(r).then(schedule, schedule); return r; };
  }

  /* ---------- openPage capture (deep-link highlight + current view) ---------- */
  function hookOpen() {
    if (typeof window.openPage !== 'function' || window.openPage.__dk) return;
    var o = window.openPage;
    var w = function (page, params) {
      params = params || {};
      DK.cur = { page: page, params: params };
      if (params.hl) DK.hl = String(params.hl); else if (!params.id) DK.hl = null;
      return o.apply(this, arguments);
    };
    w.__dk = 1; window.openPage = w;
  }
  DK.focus = function (id) { DK.hl = id ? String(id) : null; schedule(); };

  /* ---------- parsing ---------- */
  function txt(el) { return el ? String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function rowId(tr) {
    var s = (tr.getAttribute('onclick') || '') + ' ' + (tr.dataset.id || '');
    var m = s.match(UUID); if (m) return m[1];
    var b = tr.querySelectorAll('[onclick]');
    for (var i = 0; i < b.length; i++) { m = (b[i].getAttribute('onclick') || '').match(UUID); if (m) return m[1]; }
    var a = tr.querySelector('a[href*="-"]'); if (a) { m = (a.getAttribute('href') || '').match(UUID); if (m) return m[1]; }
    return null;
  }
  var RX = { status: /^(status|keadaan)$/i, amount: /(total|jumlah|amount|amaun|baki|balance|net|bersih|nilai|value|claim|tuntutan|paid|dibayar|gaji|komisen|commission)/i, date: /(date|tarikh|bila|when|tempoh|period|issued|due|akhir)/i, party: /(customer|pelanggan|supplier|pembekal|employee|pekerja|staff|kakitangan|nama|name|payee|penerima|vendor)/i };
  function guess(heads, rows, cfg) {
    var g = { title: cfg.title, sub: cfg.sub, amount: cfg.amount, status: cfg.status, date: cfg.date, party: cfg.party };
    var n = heads.length;
    function find(rx, from) { for (var i = from || 0; i < n; i++) if (rx.test(heads[i])) return i; return -1; }
    if (g.title == null) g.title = 0;
    if (g.status == null) { g.status = find(RX.status); if (g.status < 0 && rows[0]) { for (var i = 1; i < n; i++) { var c = rows[0].cells[i]; if (c && c.querySelector('.badge,.status-badge,[class*=badge]')) { g.status = i; break; } } } }
    if (g.amount == null) { g.amount = -1; for (var j = n - 1; j > 0; j--) if (RX.amount.test(heads[j]) && j !== g.status) { var c2 = rows[0] && rows[0].cells[j]; if (!c2 || /\d/.test(txt(c2))) { g.amount = j; break; } } }
    if (g.date == null) g.date = find(RX.date, 1);
    if (g.party == null) { g.party = find(RX.party, 1); if (g.party === g.title) g.party = -1; }
    if (g.sub == null) g.sub = g.party >= 0 ? g.party : (n > 1 && 1 !== g.amount && 1 !== g.status && 1 !== g.date ? 1 : -1);
    return g;
  }
  function actCell(tr) {
    var cs = tr.cells, last = cs[cs.length - 1];
    if (!last) return null;
    var btns = last.querySelectorAll('button,a.btn,.btn');
    return btns.length && btns.length >= last.children.length * 0 ? last : null;
  }
  function statusOf(td) {
    if (!td) return { t: '', c: '' };
    var s = td.querySelector('[style*="color"],.badge,span') || td, t = txt(td), col = '';
    var st = (s.getAttribute && s.getAttribute('style')) || '';
    var m = st.match(/(?:^|;|\s)color\s*:\s*(var\(--[a-z0-9-]+\))/i); if (m) col = m[1];
    if (!col) { var cls = (s.className || '') + ''; if (/success|paid|approved|green/i.test(cls)) col = 'var(--success)'; else if (/danger|overdue|reject|red/i.test(cls)) col = 'var(--danger)'; else if (/warn|pending|amber/i.test(cls)) col = 'var(--warning)'; }
    if (!col) { if (/(paid|approved|lulus|selesai|complete|delivered|dihantar|accepted|diterima|active|aktif|received|posted|closed|ditutup|dibayar)/i.test(t)) col = 'var(--success)'; else if (/(overdue|lewat|reject|ditolak|cancel|batal|void|expired|tamat)/i.test(t)) col = 'var(--danger)'; else if (/(pending|menunggu|draft|sent|dihantar|partial|separa|open|transit)/i.test(t)) col = 'var(--warning)'; else col = 'var(--text-3)'; }
    return { t: t, c: col };
  }
  function parseDate(s) {
    s = String(s || '').trim(); var m = s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(s); return isNaN(d) ? null : d;
  }
  function num(s) { var m = String(s || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; }

  function modelOf(table, cfg) {
    var heads = [].map.call(table.querySelectorAll('thead th'), txt);
    var trs = [].filter.call(table.querySelectorAll('tbody tr'), function (tr) { return tr.cells.length > 1 || !tr.cells[0] || !tr.cells[0].colSpan || tr.cells[0].colSpan < 2; });
    trs = trs.filter(function (tr) { return !(tr.cells.length === 1 && tr.cells[0].colSpan > 1); });
    if (!heads.length && trs[0]) heads = [].map.call(trs[0].cells, function (c, i) { return '#' + (i + 1); });
    var g = guess(heads, trs, cfg), items = [];
    trs.forEach(function (tr, i) {
      var cs = tr.cells, ac = actCell(tr), acIdx = ac ? cs.length - 1 : -1;
      if (ac && txt(ac) && !ac.querySelector('button,.btn')) { ac = null; acIdx = -1; }
      var st = g.status >= 0 ? statusOf(cs[g.status]) : { t: '', c: '' };
      var it = { i: i, tr: tr, id: (cfg.id ? cfg.id(tr) : rowId(tr)), title: txt(cs[g.title]) || '—', sub: g.sub >= 0 ? txt(cs[g.sub]) : '', amt: g.amount >= 0 ? txt(cs[g.amount]) : '', amtN: g.amount >= 0 ? num(txt(cs[g.amount])) : 0, st: st.t, stc: st.c, dateS: g.date >= 0 ? txt(cs[g.date]) : '', kv: [], ac: ac, clickable: !!(tr.getAttribute('onclick') || tr.onclick || tr.style.cursor === 'pointer'), search: '' };
      it.date = parseDate(it.dateS);
      for (var j = 0; j < cs.length; j++) {
        if (j === acIdx || (cfg.hide && cfg.hide.indexOf(j) >= 0)) continue;
        if (j === g.title) continue;
        var v = cs[j].innerHTML.trim(); if (!txt(cs[j]) && !cs[j].querySelector('img,input')) continue;
        if (cs[j].querySelector('input[type=checkbox]') && !txt(cs[j])) continue;
        it.kv.push([heads[j] || '', cs[j]]);
      }
      it.search = txt(tr).toLowerCase();
      items.push(it);
    });
    return { heads: heads, g: g, items: items };
  }

  /* ---------- render ---------- */
  var seq = 0;
  function srcEl(table, host) {
    var el = table;
    while (el.parentElement && el.parentElement !== host && el.parentElement.children.length === 1 && el.parentElement.id !== 'main' && !el.parentElement.classList.contains('card')) el = el.parentElement;
    return el;
  }
  function sig(table) { return table.rows.length + '|' + (table.tBodies[0] ? table.tBodies[0].innerHTML.length : 0); }
  function apply(cfg) {
    if (cfg.when && !cfg.when()) return;
    var nodes = document.querySelectorAll(cfg.sel);
    [].forEach.call(nodes, function (n) {
      var tables = n.tagName === 'TABLE' ? [n] : [].slice.call(n.querySelectorAll('table'));
      tables.forEach(function (tb, ti) {
        if (tb.closest('.pdoc,.dk-wrap,.modal,.modal-overlay,[role=dialog],form') || tb.classList.contains('pdoc-table') || tb.classList.contains('pdoc-sig-print-table')) return;
        if (tb.closest('tbody') ) return;
        if (tb.__dk && tb.__dk.sig === sig(tb) && tb.__dk.wrap.isConnected) return;
        build(tb, cfg, n, cfg.key + ':' + (cfg.stateKey ? cfg.stateKey() : '') + ':' + ti);
      });
    });
  }
  function build(tb, cfg, host, key) {
    var src = srcEl(tb, host), m = modelOf(tb, cfg);
    var old = tb.__dk && tb.__dk.wrap; if (old && old.parentNode) old.parentNode.removeChild(old);
    var S = DK.st[key] || (DK.st[key] = { q: '', s: '', d: '', open: {}, sel: {}, bulk: false });
    var wrap = document.createElement('div'); wrap.className = 'dk-wrap no-print'; wrap.dataset.dk = cfg.key; wrap.id = 'dk-' + (++seq);
    src.classList.add('dk-src');
    src.parentNode.insertBefore(wrap, src.nextSibling);
    tb.__dk = { sig: sig(tb), wrap: wrap };
    var R = { cfg: cfg, m: m, S: S, wrap: wrap, shown: 0, list: [] };
    wrap.__dkR = R;
    draw(R);
  }
  function statuses(items) { var seen = {}, out = []; items.forEach(function (it) { var k = it.st; if (k && !seen[k]) { seen[k] = 1; out.push([k, it.stc]); } }); return out; }
  function filtered(R) {
    var S = R.S, q = S.q.toLowerCase().trim(), now = new Date(), d0 = null;
    if (S.d === '7') d0 = new Date(now - 7 * 864e5); else if (S.d === '30') d0 = new Date(now - 30 * 864e5); else if (S.d === 'm') d0 = new Date(now.getFullYear(), now.getMonth(), 1);
    return R.m.items.filter(function (it) {
      if (q && it.search.indexOf(q) < 0) return false;
      if (S.s && it.st !== S.s) return false;
      if (d0 && (!it.date || it.date < d0)) return false;
      return true;
    });
  }
  function canShare(cfg) { return !!(cfg.doc && window.DKS && DKS.has(cfg.doc)); }
  function draw(R) {
    var cfg = R.cfg, S = R.S, m = R.m, w = R.wrap, sts = statuses(m.items);
    if (!m.items.length) { w.innerHTML = '<div class="dk-empty"><i class="ti ti-inbox"></i>' + esc(cfg.emptyText || L('Nothing here yet', 'Tiada rekod lagi')) + '</div>'; return; }
    var h = '<div class="dk-tools"><input type="search" class="form-input dk-q" placeholder="' + esc(L('Search ref, name, status…', 'Cari no., nama, status…')) + '" value="' + esc(S.q) + '" aria-label="' + esc(L('Search', 'Cari')) + '">';
    if (canShare(cfg) && cfg.bulk !== false) h += '<button type="button" class="btn btn-outline btn-sm dk-bulkt">' + '<i class="ti ti-checkbox"></i> ' + esc(S.bulk ? L('Done', 'Selesai') : L('Select', 'Pilih')) + '</button>';
    h += '</div><div class="dk-chips">';
    if (sts.length > 1) { h += '<button type="button" class="dk-chip' + (S.s ? '' : ' on') + '" data-s="">' + esc(L('All', 'Semua')) + '</button>'; sts.forEach(function (s) { h += '<button type="button" class="dk-chip' + (S.s === s[0] ? ' on' : '') + '" data-s="' + esc(s[0]) + '">' + esc(s[0]) + '</button>'; }); }
    if (m.g.date >= 0 && m.items.some(function (i) { return i.date; })) [['', L('Any date', 'Semua tarikh')], ['7', L('7 days', '7 hari')], ['30', L('30 days', '30 hari')], ['m', L('This month', 'Bulan ini')]].forEach(function (d) { h += '<button type="button" class="dk-chip' + (S.d === d[0] ? ' on' : '') + '" data-d="' + d[0] + '">' + esc(d[1]) + '</button>'; });
    h += '</div><div class="dk-sum"></div><div class="dk-grid" role="list"></div><div class="dk-more"></div><div class="dk-bulkh"></div>';
    w.innerHTML = h;
    var q = w.querySelector('.dk-q'), tmr;
    q.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(function () { S.q = q.value; list(R, true); }, 160); });
    [].forEach.call(w.querySelectorAll('.dk-chip'), function (b) { b.onclick = function () { if (b.dataset.s != null) S.s = b.dataset.s; if (b.dataset.d != null) S.d = b.dataset.d; [].forEach.call(w.querySelectorAll(b.dataset.s != null ? '[data-s]' : '[data-d]'), function (x) { x.classList.toggle('on', x === b); }); list(R, true); }; });
    var bt = w.querySelector('.dk-bulkt'); if (bt) bt.onclick = function () { S.bulk = !S.bulk; if (!S.bulk) S.sel = {}; draw(R); };
    list(R, true);
  }
  function list(R, reset) {
    var w = R.wrap, g = w.querySelector('.dk-grid'); if (!g) return;
    if (reset) { R.list = filtered(R); R.shown = 0; g.innerHTML = ''; }
    var sum = w.querySelector('.dk-sum'), tot = 0, hasAmt = R.m.g.amount >= 0;
    R.list.forEach(function (it) { tot += it.amtN; });
    sum.innerHTML = '<span>' + esc(L(R.list.length + ' of ' + R.m.items.length, R.list.length + ' daripada ' + R.m.items.length)) + '</span>' + (hasAmt && R.list.length ? '<span>' + esc(L('Sum', 'Jumlah')) + ': <strong style="color:var(--text)">' + esc(DK.money(tot)) + '</strong></span>' : '');
    if (!R.list.length) { g.innerHTML = '<div class="dk-empty"><i class="ti ti-search"></i>' + esc(L('No match. Clear the search or filters.', 'Tiada padanan. Kosongkan carian atau penapis.')) + '</div>'; bulkBar(R); return; }
    var hl = DK.hl, hlIdx = -1;
    if (hl) R.list.forEach(function (it, i) { if (it.id === hl) hlIdx = i; });
    var upto = Math.min(R.list.length, Math.max(R.shown + 20, hlIdx + 1));
    for (var i = R.shown; i < upto; i++) g.appendChild(card(R, R.list[i]));
    R.shown = upto;
    more(R);
    bulkBar(R);
    if (hlIdx >= 0) { var c = g.querySelector('[data-id="' + hl + '"]'); if (c) { c.classList.add('dk-hl', 'open'); loadTl(R, c, R.list[hlIdx]); setTimeout(function () { try { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }, 60); setTimeout(function () { c.classList.remove('dk-hl'); }, 4000); DK.hl = null; } }
  }
  function more(R) {
    var s = R.wrap.querySelector('.dk-more'); if (!s) return;
    if (R.io) R.io.disconnect();
    if (R.shown >= R.list.length) { s.innerHTML = ''; return; }
    s.innerHTML = '<div class="dk-sk" aria-hidden="true"></div>'; s.style.height = 'auto'; s.style.marginTop = '10px';
    if (!('IntersectionObserver' in window)) { list(R, false); return; }
    R.io = new IntersectionObserver(function (en) { if (en.some(function (e) { return e.isIntersecting; })) { R.io.disconnect(); list(R, false); } }, { rootMargin: '400px' });
    R.io.observe(s);
  }
  function quickBtns(R, it) {
    var out = [], rx = R.cfg.quick || /(approve|lulus|markpaid|_billpay|recordpayment|setstatus\([^)]*'(approved|paid)')/i;
    if (it.ac) [].forEach.call(it.ac.querySelectorAll('button,.btn'), function (b) { if (rx.test((b.getAttribute('onclick') || '') + ' ' + (b.title || '') + ' ' + txt(b))) out.push(b); });
    return out;
  }
  function cloneBtn(b) {
    var c = b.cloneNode(true); c.removeAttribute('id'); c.classList.add('btn-sm'); if (!c.classList.contains('btn')) c.classList.add('btn', 'btn-outline');
    c.style.whiteSpace = 'nowrap';
    c.addEventListener('click', function (e) { e.stopPropagation(); }, true);
    if (!txt(c) && b.title) c.insertAdjacentText('beforeend', ' ' + b.title);
    return c;
  }
  function card(R, it) {
    var cfg = R.cfg, S = R.S, el = document.createElement('div');
    el.className = 'dk-card' + (S.open[it.id || it.i] ? ' open' : '') + (S.sel[it.id] ? ' dk-sel' : ''); el.setAttribute('role', 'listitem'); if (it.id) el.dataset.id = it.id;
    var stHtml = it.st ? '<span class="dk-st" style="color:' + esc(it.stc) + '">' + esc(it.st) + '</span>' : '';
    var h = '<button type="button" class="dk-head" aria-expanded="' + (el.classList.contains('open')) + '">';
    if (S.bulk && it.id) h += '<input type="checkbox" class="dk-ck" ' + (S.sel[it.id] ? 'checked' : '') + ' aria-label="' + esc(L('Select', 'Pilih')) + '">';
    h += '<div class="dk-main"><div class="dk-t">' + esc(it.title) + '</div>' + (it.sub ? '<div class="dk-s">' + esc(it.sub) + '</div>' : '') + (it.dateS ? '<div class="dk-m"><span><i class="ti ti-calendar"></i> ' + esc(it.dateS) + '</span></div>' : '') + '</div>';
    h += '<div class="dk-r">' + (it.amt ? '<div class="dk-amt">' + esc(it.amt) + '</div>' : '') + stHtml + '<i class="ti ti-chevron-down dk-chev" aria-hidden="true"></i></div></button>';
    h += '<div class="dk-body"><dl class="dk-kv"></dl><div class="dk-acts"></div><div class="dk-tl" hidden></div></div><div class="dk-swa"></div>';
    el.innerHTML = h;
    var kv = el.querySelector('.dk-kv');
    it.kv.forEach(function (p) { var dt = document.createElement('dt'); dt.textContent = p[0]; var dd = document.createElement('dd'); dd.innerHTML = p[1].innerHTML; [].forEach.call(dd.querySelectorAll('[onclick]'), function (x) { x.addEventListener('click', function (e) { e.stopPropagation(); }, true); }); [].forEach.call(dd.querySelectorAll('[id]'), function (x) { x.removeAttribute('id'); }); kv.appendChild(dt); kv.appendChild(dd); });
    var acts = el.querySelector('.dk-acts');
    if (it.clickable) { var ob = document.createElement('button'); ob.type = 'button'; ob.className = 'btn btn-primary btn-sm'; ob.innerHTML = '<i class="ti ti-arrow-right"></i> ' + esc(L('Open', 'Buka')); ob.onclick = function () { if (cfg.open) cfg.open(it.id, it.tr); else it.tr.click(); }; acts.appendChild(ob); }
    if (canShare(cfg) && it.id) { var wb = document.createElement('button'); wb.type = 'button'; wb.className = 'btn btn-outline btn-sm dk-wa'; wb.innerHTML = '<i class="ti ti-brand-whatsapp"></i> WhatsApp'; wb.onclick = function () { DKS.share(cfg.doc, it.id); }; acts.appendChild(wb); }
    if (it.ac) [].forEach.call(it.ac.querySelectorAll('button,a.btn'), function (b) { acts.appendChild(cloneBtn(b)); });
    if (window.DKSign && cfg.doc && DKSign.has(cfg.doc) && it.id) { var sb2 = document.createElement('button'); sb2.type = 'button'; sb2.className = 'btn btn-outline btn-sm'; sb2.innerHTML = '<i class="ti ti-signature"></i> ' + esc(L('Sign', 'Tandatangan')); sb2.onclick = function () { DKSign.open(cfg.doc, it.id, it.title, function () { loadTl(R, el, it, true); }); }; acts.appendChild(sb2); }
    if (!acts.children.length) acts.remove();
    var head = el.querySelector('.dk-head');
    head.addEventListener('click', function (e) {
      if (e.target.classList.contains('dk-ck')) { if (e.target.checked) S.sel[it.id] = it; else delete S.sel[it.id]; el.classList.toggle('dk-sel', !!S.sel[it.id]); bulkBar(R); e.stopPropagation(); return; }
      if (el.classList.contains('sw')) { el.classList.remove('sw'); return; }
      var o = !el.classList.contains('open'); el.classList.toggle('open', o); head.setAttribute('aria-expanded', o); S.open[it.id || it.i] = o; if (o) loadTl(R, el, it);
    });
    if (el.classList.contains('open')) loadTl(R, el, it);
    /* swipe quick actions */
    var sw = el.querySelector('.dk-swa'), q = quickBtns(R, it);
    if (canShare(cfg) && it.id) { var w2 = document.createElement('button'); w2.type = 'button'; w2.className = 'btn btn-outline btn-sm dk-wa'; w2.innerHTML = '<i class="ti ti-brand-whatsapp"></i> ' + esc(L('Share', 'Kongsi')); w2.onclick = function (e) { e.stopPropagation(); el.classList.remove('sw'); DKS.share(cfg.doc, it.id); }; sw.appendChild(w2); }
    q.forEach(function (b) { var c = cloneBtn(b); c.addEventListener('click', function () { el.classList.remove('sw'); }); sw.appendChild(c); });
    if (sw.children.length) {
      var x0 = 0, y0 = 0, t0 = 0;
      el.addEventListener('touchstart', function (e) { var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); }, { passive: true });
      el.addEventListener('touchend', function (e) { var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - t0 < 800) { el.classList.toggle('sw', dx < 0); } }, { passive: true });
    } else sw.remove();
    return el;
  }
  function bulkBar(R) {
    var h = R.wrap.querySelector('.dk-bulkh'); if (!h) return;
    var ids = Object.keys(R.S.sel);
    if (!R.S.bulk) { h.innerHTML = ''; return; }
    h.innerHTML = '<div class="dk-bulk"><span>' + esc(L(ids.length + ' selected', ids.length + ' dipilih')) + '</span><div>' +
      '<button type="button" class="btn btn-outline btn-sm" data-a="all">' + esc(L('Select all shown', 'Pilih semua')) + '</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-a="share"' + (ids.length ? '' : ' disabled') + '><i class="ti ti-brand-whatsapp"></i> ' + esc(L('Share one by one', 'Kongsi satu persatu')) + '</button></div></div>';
    h.querySelector('[data-a=all]').onclick = function () { R.list.forEach(function (it) { if (it.id) R.S.sel[it.id] = it; }); draw(R); };
    h.querySelector('[data-a=share]').onclick = function () { DKS.queue(R.cfg.doc, Object.keys(R.S.sel)); };
  }

  /* ---------- timeline (created / sent / opened / signed / audit) ---------- */
  DK.timeline = function (doc, id, table) {
    if (!window.sb || !id) return Promise.resolve([]);
    var tid = DK.tid(), safe = function (p) { return Promise.resolve(p).then(function (r) { return (r && r.data) || []; }, function () { return []; }); };
    return Promise.all([
      safe(sb.from('doc_shares').select('created_at,created_by_name,template').eq('tenant_id', tid).eq('doc_type', doc).eq('doc_id', id).is('deleted_at', null).order('created_at', { ascending: false }).limit(20)),
      safe(sb.from('doc_views').select('viewed_at').eq('tenant_id', tid).eq('doc_type', doc).eq('doc_id', id).order('viewed_at', { ascending: false }).limit(5)),
      safe(sb.from('dk_signatures').select('slot,signer_name,signed_at,via').eq('tenant_id', tid).eq('doc_type', doc).eq('doc_id', id).is('deleted_at', null).order('signed_at', { ascending: false }).limit(10)),
      safe(sb.from('dk_doc_events').select('event,actor_name,note,created_at').eq('tenant_id', tid).eq('doc_type', doc).eq('doc_id', id).order('created_at', { ascending: false }).limit(10)),
      safe(sb.from('audit_logs').select('action,created_at').eq('tenant_id', tid).eq('record_id', String(id)).order('created_at', { ascending: false }).limit(10))
    ]).then(function (a) {
      var ev = [];
      a[0].forEach(function (s) { ev.push({ at: s.created_at, i: 'ti-brand-whatsapp', t: L('Sent on WhatsApp', 'Dihantar di WhatsApp') + ' (' + s.template + ')' + (s.created_by_name ? ' · ' + s.created_by_name : '') }); });
      a[1].forEach(function (v) { ev.push({ at: v.viewed_at, i: 'ti-eye', t: L('Opened by recipient', 'Dibuka oleh penerima') }); });
      a[2].forEach(function (s) { ev.push({ at: s.signed_at, i: 'ti-signature', t: L('Signed', 'Ditandatangani') + ' · ' + (window.DKSign ? DKSign.slotLabel(doc, s.slot) : s.slot) + ' · ' + (s.signer_name || '-') + (s.via === 'link' ? ' (' + L('link', 'pautan') + ')' : '') }); });
      a[3].forEach(function (e) { ev.push({ at: e.created_at, i: e.event === 'paid' ? 'ti-cash' : e.event === 'accepted' || e.event === 'received' ? 'ti-circle-check' : e.event === 'declined' ? 'ti-circle-x' : 'ti-bell', t: DK.evLabel(e.event) + (e.actor_name ? ' · ' + e.actor_name : '') + (e.note ? ' — ' + e.note : '') }); });
      a[4].forEach(function (l) { var ac = String(l.action || '').toLowerCase(); ev.push({ at: l.created_at, i: ac.indexOf('create') >= 0 || ac.indexOf('insert') >= 0 ? 'ti-plus' : ac.indexOf('delete') >= 0 ? 'ti-trash' : 'ti-pencil', t: ac.indexOf('create') >= 0 || ac.indexOf('insert') >= 0 ? L('Created', 'Dicipta') : ac.indexOf('delete') >= 0 ? L('Deleted', 'Dipadam') : L('Updated', 'Dikemas kini') + ' (' + l.action + ')' }); });
      ev.sort(function (x, y) { return new Date(y.at) - new Date(x.at); });
      return ev;
    });
  };
  DK.evLabel = function (e) { return ({ accepted: L('Accepted by customer', 'Diterima pelanggan'), declined: L('Declined by customer', 'Ditolak pelanggan'), received: L('Receipt confirmed', 'Penerimaan disahkan'), paid: L('Payment reported', 'Bayaran dilaporkan'), reminder: L('Auto reminder queued', 'Peringatan automatik'), signed: L('Signed', 'Ditandatangani') })[e] || e; };
  DK.tlHtml = function (ev) {
    if (!ev.length) return '<div style="color:var(--text-3)">' + esc(L('No history yet', 'Tiada sejarah lagi')) + '</div>';
    return ev.slice(0, 12).map(function (e) { return '<div class="dk-tl-i"><i class="ti ' + e.i + '"></i><span>' + esc(e.t) + '</span><small>' + esc(DK.dt(e.at)) + '</small></div>'; }).join('');
  };
  function loadTl(R, el, it, force) {
    var cfg = R.cfg; if (!cfg.doc || !it.id || cfg.timeline === false) return;
    var b = el.querySelector('.dk-tl'); if (!b || (b.dataset.l && !force)) return;
    b.dataset.l = 1; b.hidden = false; b.innerHTML = '<div style="color:var(--text-3)"><i class="ti ti-loader"></i> ' + esc(L('Loading history…', 'Memuat sejarah…')) + '</div>';
    DK.timeline(cfg.doc, it.id, cfg.table).then(function (ev) { b.innerHTML = '<div style="font-weight:700;color:var(--text);margin-bottom:4px">' + esc(L('Timeline', 'Garis masa')) + '</div>' + DK.tlHtml(ev); });
  }

  /* ---------- engine ---------- */
  var tm = null;
  function schedule() { clearTimeout(tm); tm = setTimeout(run, 60); }
  DK.scan = schedule;
  function run() { hookOpen(); addCss(); DK.lists.forEach(function (c) { try { apply(c); } catch (e) { console.warn('[dk-cards]', c.key, e); } }); try { document.dispatchEvent(new CustomEvent('dk:scan')); } catch (e) {} }
  function boot() {
    addCss(); hookOpen();
    var main = document.getElementById('main');
    if (!main) { setTimeout(boot, 300); return; }
    new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) { var t = ms[i].target; if (t.closest && t.closest('.dk-wrap,.dk-doc,.wad-bg')) continue; schedule(); return; } }).observe(main, { childList: true, subtree: true });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
