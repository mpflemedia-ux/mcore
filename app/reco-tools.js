/* reco-tools.js — Bank Reconciliation helpers (Nov 2026):
   C  "Apply to all similar" after a category is picked on one line
   D  "Remember for next time" → tenant rule (bank_recon_rules), used by the next import
   G  duplicate-import warning (same account + overlapping period, or lines already imported)
   Patch-module pattern: wraps existing globals (_brSuggestCategory, _recoSetCategory,
   _recoImportCategorize); table missing (42P01/PGRST205) → localStorage fallback, no UI error.
   Rule safety: rules exist ONLY when a user clicks "Remember" on a line, so a rule may carry a
   manual-only category (e.g. Owner Drawings) — that is the explicit choice. Learned localStorage
   patterns still never carry manual-only categories, and Post Unmatched still never posts
   manual-only or link-only lines, so a rule can never auto-post a balance-sheet move. */
(function () {
  if (window.RECOT) return;
  var R = window.RECOT = { rules: null, rulesTenant: null, v: 1 };
  function bm() { try { return APP.language === 'bm'; } catch (e) { return false; } }
  function L(en, b) { return bm() ? b : en; }
  function tid() { try { return APP.tenant && APP.tenant.id; } catch (e) { return null; } }
  function allowed() { try { return typeof canAccess !== 'function' || canAccess('accounting'); } catch (e) { return false; } }
  function missing(err) { var c = err && (err.code || ''); return c === '42P01' || c === 'PGRST205' || /does not exist|schema cache/i.test(String(err && err.message || '')); }
  function lsKey() { return 'nexerp_br_rules_' + (tid() || 'none'); }
  function lsRules() { try { return JSON.parse(localStorage.getItem(lsKey()) || '[]'); } catch (e) { return []; } }
  function norm(s) { return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim(); }

  /* Counterparty key: description minus bank noise words, first 2 meaningful words.
     "To NUR EHSAN BINTI AZIZ Transfer…" → "NUR EHSAN"; "TRANSFER FR A/C AHMAD ALI *" → "AHMAD ALI" */
  var NOISE = /^(TO|FROM|FR|TRANSFER|TRANSFERS|TRF|TFR|A\/C|AC|INSTANT|IBG|GIRO|DUITNOW|CIB|IBK|FUND|FUNDS|PAYMENT|PYMT|QR|MAE|CR|DR|INTERBANK|PAY|SALE|DEBIT|CREDIT|CARD|POS|ONLINE|FPX|JOMPAY|REF|REF\.|ID|ID:|INWARD|OUTWARD|SA|CA|TT|\*)$/;
  R.key = function (desc) {
    var w = norm(desc).replace(/[^A-Z0-9'&\/ .*:-]/g, ' ').split(' ').filter(Boolean);
    var out = [];
    for (var i = 0; i < w.length && out.length < 2; i++) {
      var t = w[i];
      if (NOISE.test(t)) continue;
      if (/^REF/.test(t)) break;
      if (t.length < 3 || /^[\d.:\/-]+$/.test(t) || /\d{4,}/.test(t)) continue;
      out.push(t);
    }
    return out.join(' ');
  };
  function dirOf(amount) { return Number(amount) >= 0 ? 'in' : 'out'; }

  R.loadRules = function (force) {
    var t = tid();
    if (!t) return Promise.resolve([]);
    if (!force && R.rules && String(R.rulesTenant) === String(t)) return Promise.resolve(R.rules);
    var fallback = function () { R.rules = lsRules(); R.rulesTenant = t; R.db = false; return R.rules; };
    try {
      return sb.from('bank_recon_rules').select('id,pattern,direction,category').eq('tenant_id', t).is('deleted_at', null)
        .then(function (res) {
          if (res.error) return fallback();
          R.rules = (res.data || []).concat(lsRules().filter(function (l) {
            return !(res.data || []).some(function (d) { return d.pattern === l.pattern && d.direction === l.direction; });
          }));
          R.rulesTenant = t; R.db = true; return R.rules;
        }, fallback);
    } catch (e) { return Promise.resolve(fallback()); }
  };
  function ruleFor(desc, amount) {
    if (!R.rules || String(R.rulesTenant) !== String(tid())) return null;
    var d = dirOf(amount), n = norm(desc);
    var best = null;
    R.rules.forEach(function (r) {
      if (!r.pattern || (r.direction && r.direction !== d)) return;
      if (n.indexOf(norm(r.pattern)) === -1) return;
      if (!best || r.pattern.length > best.pattern.length) best = r; /* longest pattern wins */
    });
    return best;
  }
  R.saveRule = function (pattern, direction, category) {
    var t = tid();
    if (!t || !pattern || !category) return Promise.resolve(false);
    var local = function () {
      var list = lsRules().filter(function (r) { return !(r.pattern === pattern && r.direction === direction); });
      list.push({ pattern: pattern, direction: direction, category: category });
      try { localStorage.setItem(lsKey(), JSON.stringify(list.slice(-300))); } catch (e) {}
      return true;
    };
    var cache = function () {
      R.rules = (R.rules || []).filter(function (r) { return !(r.pattern === pattern && r.direction === direction); });
      R.rules.push({ pattern: pattern, direction: direction, category: category }); R.rulesTenant = t;
    };
    try {
      return sb.from('bank_recon_rules').upsert({
        tenant_id: t, pattern: pattern, direction: direction, category: category,
        created_by: (APP.user && APP.user.id) || null, deleted_at: null, updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id,pattern,direction' }).then(function (res) {
        if (res.error) { if (!missing(res.error)) console.warn('bank_recon_rules save', res.error.message); local(); }
        cache(); return true;
      }, function () { local(); cache(); return true; });
    } catch (e) { local(); cache(); return Promise.resolve(true); }
  };

  /* D: tenant rules first (explicit user choice), then the original rule/pattern logic */
  function wrapSuggest() {
    var orig = window._brSuggestCategory;
    if (typeof orig !== 'function' || orig._recot) return;
    window._brSuggestCategory = function (desc, amount) {
      var r = ruleFor(desc, amount);
      if (r) return { category: r.category, confidence: 99, source: 'tenant_rule', keyword: r.pattern };
      return orig.apply(this, arguments);
    };
    window._brSuggestCategory._recot = true;
  }

  /* C: lines still waiting for a category = no category / default fallback / auto "Other" */
  function pendingCat(t) {
    if (!t || t.status === 'posted' || t._state === 'confirmed') return false;
    if (!t.category || t.categorySource === 'default') return true;
    return /^Other /i.test(t.category) && t.categorySource !== 'manual';
  }
  function fitsDir(cat, amount) {
    var ty = (typeof _BR_CATEGORY_TYPE !== 'undefined') ? _BR_CATEGORY_TYPE[cat] : null;
    return !ty || ty === dirOf(amount);
  }
  R.similar = function (i) {
    var src = _recoTxns[i]; if (!src) return [];
    var k = R.key(src.description); if (!k) return [];
    var out = [];
    _recoTxns.forEach(function (t, j) {
      if (j === i || !pendingCat(t) || dirOf(t.amount) !== dirOf(src.amount) || !fitsDir(src.category, t.amount)) return;
      if (R.key(t.description) === k) out.push(j);
    });
    return out;
  };
  R.applySimilar = function (i) {
    var src = _recoTxns[i]; if (!src) return;
    var idx = R.similar(i);
    idx.forEach(function (j) {
      var t = _recoTxns[j];
      t.category = src.category; t.categorySource = 'manual'; t.categoryConfidence = 100; delete t._aiSuggestion;
    });
    _brSaveStore(_recoTxns);
    _recoRenderResults();
    showToast(L(idx.length + ' line(s) updated to ' + _brCatLabel(src.category) + '.', idx.length + ' baris dikemas kini ke ' + _brCatLabel(src.category) + '.'), 'success');
  };
  R.remember = function (i, btn) {
    var src = _recoTxns[i]; if (!src || !allowed()) return;
    var k = R.key(src.description);
    if (!k) { showToast(L('No clear name in this line to remember.', 'Tiada nama jelas dalam baris ini untuk diingat.'), 'warning'); return; }
    if (btn) btn.disabled = true;
    R.saveRule(k, dirOf(src.amount), src.category).then(function () {
      if (btn) { btn.innerHTML = '<i class="ti ti-check"></i> ' + L('Remembered', 'Diingat'); }
      showToast(L('Saved: "' + k + '" → ' + _brCatLabel(src.category) + ' for next imports.', 'Disimpan: "' + k + '" → ' + _brCatLabel(src.category) + ' untuk import seterusnya.'), 'success');
    });
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function showBar(i) {
    var tr = document.querySelector('#reco-result tr[data-i="' + i + '"]');
    var td = tr && tr.querySelector('td.rc-cat');
    if (!td || !allowed()) return;
    var old = td.querySelector('.rc-bar'); if (old) old.remove();
    var oldHint = td.querySelector('.rc-hint'); if (oldHint) oldHint.remove();
    var t = _recoTxns[i]; if (!t) return;
    var n = R.similar(i).length, k = R.key(t.description);
    var hint = typeof _brCategoryHintHtml === 'function' ? _brCategoryHintHtml(t.category) : '';
    var html = hint + '<div class="rc-bar" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center">' +
      (n ? '<button type="button" class="btn btn-outline btn-sm" style="white-space:nowrap" onclick="RECOT.applySimilar(' + i + ')"><i class="ti ti-copy-check"></i> ' +
        L('Apply to ' + n + ' similar', 'Guna pada ' + n + ' serupa') + '</button>' : '') +
      (k ? '<button type="button" class="btn btn-outline btn-sm" style="white-space:nowrap" title="' + esc(L('Next imports with "' + k + '" get this category', 'Import seterusnya dengan "' + k + '" dapat kategori ini')) +
        '" onclick="RECOT.remember(' + i + ',this)"><i class="ti ti-bookmark"></i> ' + L('Remember for next time?', 'Ingat untuk lain kali?') + '</button>' : '') +
      '</div>';
    td.insertAdjacentHTML('beforeend', html);
  }
  function wrapSetCategory() {
    var orig = window._recoSetCategory;
    if (typeof orig !== 'function' || orig._recot) return;
    window._recoSetCategory = function (i, cat) {
      var r = orig.apply(this, arguments);
      try { showBar(i); } catch (e) { console.warn('reco-tools bar', e); }
      return r;
    };
    window._recoSetCategory._recot = true;
  }

  function wrapApply() {
    var orig = window._recoApplySuggestion;
    if (typeof orig !== 'function' || orig._recot) return;
    window._recoApplySuggestion = function (i) {
      var r = orig.apply(this, arguments);
      try { showBar(i); } catch (e) {}
      return r;
    };
    window._recoApplySuggestion._recot = true;
  }

  /* G: duplicate / overlapping import warning + import log */
  function fmt(d) { try { return formatDate(d); } catch (e) { return d; } }
  function wrapImport() {
    var orig = window._recoImportCategorize;
    if (typeof orig !== 'function' || orig._recot) return;
    window._recoImportCategorize = async function () {
      var self = this, args = arguments;
      await Promise.race([R.loadRules(), new Promise(function (ok) { setTimeout(ok, 2500); })]);
      var ta = document.getElementById('reco-csv-text');
      var text = ta && ta.value || '';
      var t = tid();
      if (!text.trim() || !t || (typeof _recoImportBusy !== 'undefined' && _recoImportBusy)) return orig.apply(self, args);
      var all = [];
      try { var saved = _recoTxns; _recoTxns = []; all = _recoParseCsvText(text); _recoTxns = saved; } catch (e) { all = []; }
      if (!all.length) return orig.apply(self, args);
      var memFp = {}; (_recoTxns || []).forEach(function (x) { if (x.fingerprint) memFp[x.fingerprint] = 1; });
      var dup = all.filter(function (x) { return memFp[x.fingerprint]; }).length;
      var rest = all.filter(function (x) { return !memFp[x.fingerprint]; }).map(function (x) { return x.fingerprint; });
      try {
        for (var c = 0; c < rest.length; c += 100) {
          var res = await sb.from('bank_statement_lines').select('fingerprint').eq('tenant_id', t).in('fingerprint', rest.slice(c, c + 100));
          if (res.error) break;
          dup += (res.data || []).length;
        }
      } catch (e) {}
      var dates = all.map(function (x) { return x.date; }).sort();
      var meta = window._recoPendingStmtMeta || {};
      var from = meta.from || dates[0], to = meta.to || dates[dates.length - 1], acct = meta.acct4 || null;
      var overlap = null;
      try {
        var q = await sb.from('bank_recon_imports').select('id,acct4,period_from,period_to,created_at').eq('tenant_id', t).is('deleted_at', null)
          .lte('period_from', to).gte('period_to', from).order('created_at', { ascending: false }).limit(20);
        /* unknown account on either side (CSV/AI import) → treat as possibly the same account */
        if (!q.error) overlap = (q.data || []).find(function (r) { return !acct || !r.acct4 || String(r.acct4) === String(acct); }) || null;
      } catch (e) {}
      if (dup || overlap) {
        var msg = [];
        if (overlap) msg.push(L(
          'A statement' + (acct ? ' for account ••' + acct : '') + ' covering ' + fmt(overlap.period_from) + ' – ' + fmt(overlap.period_to) + ' was already imported on ' + fmt(overlap.created_at) + '.',
          'Penyata' + (acct ? ' akaun ••' + acct : '') + ' bagi ' + fmt(overlap.period_from) + ' – ' + fmt(overlap.period_to) + ' sudah diimport pada ' + fmt(overlap.created_at) + '.'));
        if (dup) msg.push(L(dup + ' of ' + all.length + ' line(s) were already imported before and will be skipped or not posted twice.',
          dup + ' daripada ' + all.length + ' baris sudah pernah diimport dan akan dilangkau atau tidak diposkan dua kali.'));
        msg.push(L('Import anyway?', 'Teruskan import?'));
        if (!confirm(msg.join('\n\n'))) return;
      }
      var before = (_recoTxns || []).length;
      var r = await orig.apply(self, args);
      var added = (_recoTxns || []).length - before;
      if (added > 0) {
        var sumIn = 0, sumOut = 0;
        all.forEach(function (x) { if (x.amount >= 0) sumIn += x.amount; else sumOut += -x.amount; });
        try {
          var ins = await sb.from('bank_recon_imports').insert({
            tenant_id: t, bank: meta.bank || null, acct4: acct, period_from: from, period_to: to,
            line_count: all.length, total_in: Math.round(sumIn * 100) / 100, total_out: Math.round(sumOut * 100) / 100,
            created_by: (APP.user && APP.user.id) || null
          });
          if (ins.error && !missing(ins.error)) console.warn('bank_recon_imports', ins.error.message);
        } catch (e) {}
        window._recoPendingStmtMeta = null;
      }
      return r;
    };
    window._recoImportCategorize._recot = true;
  }
  function boot() { wrapSuggest(); wrapSetCategory(); wrapApply(); wrapImport(); if (tid()) R.loadRules(); }
  boot();
  setTimeout(boot, 400);
})();
