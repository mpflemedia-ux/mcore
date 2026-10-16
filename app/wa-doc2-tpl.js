/* WhatsApp document share (Phase 2) - Settings: tenant template editor (EN/BM, tags, live preview, reset). Owner/admin only. v1 */
(function () {
  if (!window.WAD2 || WAD2.openTpl) return;
  var W = WAD, X = WAD2, E = W.esc;
  var st = document.createElement('style');
  st.textContent = '.wd2-tags{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 8px}.wd2-tag{border:1px solid var(--border-2,var(--border));background:var(--bg);color:var(--text);border-radius:99px;padding:5px 10px;font-size:12.5px;font-family:ui-monospace,monospace;cursor:pointer;min-height:30px}' +
    '.wd2-sel{width:100%;box-sizing:border-box;border:1px solid var(--border-2,var(--border));border-radius:8px;padding:10px;font-size:14px;background:var(--bg);color:var(--text)}' +
    '.wd2-ta{width:100%;box-sizing:border-box;min-height:140px;border:1px solid var(--border-2,var(--border));border-radius:8px;padding:10px;font:inherit;font-size:14px;line-height:1.45;background:var(--bg);color:var(--text);resize:vertical}' +
    '.wd2-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 0 4px}.wd2-st{font-size:12px;font-weight:700}';
  document.head.appendChild(st);
  var G = { inv: 'gInv', quo: 'gQuo', booking: 'gBk', pos: 'gPos' };
  var SAMPLE = { name: 'Nurbella Empire', doc_no: 'INV-0006', amount: 'RM 1,250.00', due_date: '11/10/2026', days_late: '5', pay_by: '23/10/2026', service: 'Facial 60 min', when: '17/10/2026 10:00 AM', items: '2× Kopi O' };
  var cur = null;
  function sample(k) {
    var m = X.key(k), base = W.base(), co = W.company(), v = Object.assign({}, SAMPLE, { company: co });
    if (m.doc === 'quo') { v.doc_no = 'QUO-0012'; v.due_date = '28/10/2026'; v.link = base + '?public_quo=7f3a…'; }
    else if (m.doc === 'inv') { v.link = base + '?public_inv=7f3a…'; v.pay_link = v.link + '#pay'; }
    else if (m.doc === 'pos') { v.doc_no = 'R-000123'; v.amount = 'RM 7.00'; } else v.doc_no = 'BK-0031';
    return v;
  }
  X.openTpl = function () {
    cur = { k: 'inv_send', lang: W.bm() ? 'bm' : 'en', text: null };
    cur.bg = document.createElement('div'); cur.bg.className = 'wad-bg'; cur.bg.id = 'wd2-tpl';
    cur.bg.onclick = function (e) { if (e.target === cur.bg) close(); };
    document.body.appendChild(cur.bg); load(); paint();
  };
  function close() { if (cur && cur.bg) cur.bg.remove(); cur = null; }
  function load() { var c = X.custom(cur.k, cur.lang); cur.row = c; cur.text = c ? c.body : X.defaultBody(cur.k, cur.lang); }
  function t(k, v) { return X.t(k, null, v); }
  function prev() { var v = sample(cur.k); return X.render(cur.text, v); }
  function paint() {
    var m = X.key(cur.k), opts = '', grp = '';
    X.KEYS.forEach(function (x) {
      if (x.doc !== grp) { opts += (grp ? '</optgroup>' : '') + '<optgroup label="' + E(t(G[x.doc])) + '">'; grp = x.doc; }
      opts += '<option value="' + x.k + '"' + (x.k === cur.k ? ' selected' : '') + '>' + E(W.t(x.label)) + (X.custom(x.k, 'en') || X.custom(x.k, 'bm') ? ' •' : '') + '</option>';
    });
    cur.bg.innerHTML = '<div class="wad-sh" role="dialog" aria-modal="true"><div class="wad-grab"></div><div class="wad-hd"><div class="wad-ti">' + E(t('tplTitle')) + '</div>' +
      '<div class="wad-seg"><button data-l="en" class="' + (cur.lang === 'en' ? 'on' : '') + '">EN</button><button data-l="bm" class="' + (cur.lang === 'bm' ? 'on' : '') + '">BM</button></div></div>' +
      '<div class="wad-lb" style="margin-top:10px">' + E(t('tplPick')) + '</div><select class="wd2-sel" id="wd2-k">' + opts + '</optgroup></select>' +
      '<div class="wd2-row"><span class="wad-lb" style="margin:0">' + E(t('tags')) + '</span><span class="wad-pill ' + (cur.row ? 'wad-inf' : 'wad-ok') + ' wd2-st">' + E(cur.row ? t('custom') : t('deflt')) + '</span></div>' +
      '<div class="wd2-tags">' + m.tags.map(function (g) { return '<button type="button" class="wd2-tag" data-tag="' + g + '">{' + g + '}</button>'; }).join('') + '</div>' +
      '<textarea class="wd2-ta" id="wd2-ta" data-no-titlecase="1" maxlength="2000">' + E(cur.text) + '</textarea>' +
      '<div class="wad-lb" style="margin-top:10px">' + E(t('preview')) + '</div><div class="wad-bub" id="wd2-pv" style="white-space:pre-wrap;min-height:0;margin-top:0">' + E(prev()) + '</div>' +
      '<div class="wad-ft"><button class="btn btn-outline" data-a="reset"' + (cur.row ? '' : ' disabled') + '>' + E(t('reset')) + '</button><button class="btn btn-primary" data-a="save">' + E(t('save')) + '</button></div>' +
      '<div class="wad-ft" style="margin-top:8px"><button class="btn btn-outline" data-a="close">' + E(W.t('close')) + '</button></div></div>';
    wire();
  }
  function wire() {
    var r = cur.bg, ta = r.querySelector('#wd2-ta');
    r.querySelectorAll('[data-l]').forEach(function (b) { b.onclick = function () { cur.lang = b.dataset.l; load(); paint(); }; });
    r.querySelector('#wd2-k').onchange = function () { cur.k = this.value; load(); paint(); };
    ta.oninput = function () { cur.text = ta.value; r.querySelector('#wd2-pv').textContent = prev(); };
    r.querySelectorAll('[data-tag]').forEach(function (b) { b.onclick = function () {
      var s = ta.selectionStart || ta.value.length, e = ta.selectionEnd || s, tag = '{' + b.dataset.tag + '}';
      ta.value = ta.value.slice(0, s) + tag + ta.value.slice(e); ta.focus(); ta.selectionStart = ta.selectionEnd = s + tag.length; ta.oninput();
    }; });
    r.querySelector('[data-a=close]').onclick = close;
    r.querySelector('[data-a=save]').onclick = save;
    r.querySelector('[data-a=reset]').onclick = function () {
      if (!cur.row || !confirm(t('resetAsk'))) return;
      sb.from('wa_templates').update({ deleted_at: new Date().toISOString() }).eq('id', cur.row.id).eq('tenant_id', W.tid()).then(function (q) {
        if (q.error) throw q.error; return X.loadTpl(); }).then(function () { W.toast(t('resetOk')); load(); paint(); }, err);
    };
  }
  function err(e) { W.toast(W.t('err') + ((e && e.message) || e), 'error'); }
  function save() {
    var body = String(cur.text || '').trim();
    if (!body) return W.toast(t('empty'), 'error');
    if (body.length > 2000) return W.toast(t('tooLong'), 'error');
    if (!cur.row && body === X.defaultBody(cur.k, cur.lang).trim()) return W.toast(t('saved'));
    var m = X.key(cur.k), q = cur.row
      ? sb.from('wa_templates').update({ body: body, updated_at: new Date().toISOString(), updated_by: W.uid() }).eq('id', cur.row.id).eq('tenant_id', W.tid())
      : sb.from('wa_templates').insert({ tenant_id: W.tid(), doc_type: m.doc, template_key: cur.k, lang: cur.lang, body: body, created_by: W.uid(), updated_by: W.uid() });
    q.then(function (r) { if (r.error) throw r.error; return X.loadTpl(); }).then(function () { W.toast(t('saved')); load(); paint(); }, err);
  }
  /* Settings card, placed after the AI Document Generator card */
  function hook() {
    if (document.getElementById('wd2-card')) return;
    var after = document.getElementById('stg-docgen'); if (!after) return;
    var c = document.createElement('div'); c.id = 'wd2-card'; c.className = 'card'; c.style.cssText = 'max-width:500px;margin-top:16px;display:none';
    after.parentNode.insertBefore(c, after.nextSibling);
    X.ready().then(function (ok) {
      if (!ok || !X.allowedOwner() || !c.isConnected) return c.remove();
      c.innerHTML = '<div class="card-header"><div class="card-title"><i class="ti ti-brand-whatsapp" style="color:#128C7E"></i> ' + E(t('tplCard')) + '</div></div>' +
        '<div style="padding:16px;display:flex;flex-direction:column;gap:12px"><div style="font-size:13px;color:var(--text-2)">' + E(t('tplCardD')) + '</div>' +
        '<button class="btn btn-primary btn-sm" style="align-self:flex-start"><i class="ti ti-pencil"></i> ' + E(t('tplEdit')) + '</button></div>';
      c.style.display = ''; c.querySelector('button').onclick = X.openTpl;
    });
  }
  var tm = 0;
  new MutationObserver(function () { if (!tm) tm = setTimeout(function () { tm = 0; hook(); }, 150); }).observe(document.body, { childList: true, subtree: true });
  hook();
})();
