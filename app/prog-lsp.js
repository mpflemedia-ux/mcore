/* Programme Lead -> Sales -> Payment.
   Staff: CRM → Programmes (openPage('crm',{view:'programmes'})) — leads pipeline, enrolments + invoices + seat hold,
   participants, settlement of agent collections, programme settings.
   Public: ?prog_reg=TOKEN — participant registration form (no login).
   Data: prog_* tables + RPCs (supabase/prog_lsp_01 … 05). Payment proof reuses the public invoice link + Payments to review. */
(function () {
  if (window.renderProgrammes) return;
  var T = function (k, v) { return window.PLSPI ? PLSPI.t(k, v) : k; };
  var STAGES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
  var S = { progId: null, tab: 'leads', q: '', stage: '', openLead: null, upTo: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function tid() { return window.APP && APP.tenant && APP.tenant.id; }
  function isBm() { return window.APP && APP.language === 'bm'; }
  function rm(n) { return typeof formatRM === 'function' ? formatRM(n) : 'RM ' + Number(n || 0).toFixed(2); }
  function fdate(d) { if (!d) return '—'; return typeof formatDate === 'function' ? formatDate(d) : String(d).slice(0, 10); }
  function fdt(d) { if (!d) return '—'; try { return new Date(d).toLocaleString(isBm() ? 'ms-MY' : 'en-MY', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); } catch (e) { return String(d); } }
  function today() { try { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function toast(m, k) { if (typeof showToast === 'function') showToast(m, k || 'success'); }
  function msg(e) { return (e && (e.message || e.details)) || String(e || ''); }
  function sqlMissing(e) { return /prog_|does not exist|schema cache|Could not find/i.test(msg(e)); }
  function canSales() { return typeof canAccess === 'function' ? canAccess('sales') : true; }
  function digits(p) { var d = String(p || '').replace(/\D/g, ''); if (d[0] === '0') d = '6' + d; else if (d[0] === '1') d = '60' + d; return d.length >= 10 ? d : ''; }
  function wa(phone, text) { var d = digits(phone); return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text); }
  function langQs() { return '&lang=' + (isBm() ? 'bm' : 'en'); }
  function payLink(tok) { return location.origin + '/app/?public_inv=' + encodeURIComponent(tok) + langQs(); }
  function regLink(tok) { return location.origin + '/app/?prog_reg=' + encodeURIComponent(tok) + langQs(); }
  function copy(text) {
    try { navigator.clipboard.writeText(text).then(function () { toast(T('copied')); }, function () { window.prompt('', text); }); }
    catch (e) { window.prompt('', text); }
  }
  function badge(cls, text) { return '<span class="badge ' + cls + '">' + esc(text) + '</span>'; }
  var ST_CLS = { draft: 'badge-gray', held: 'badge-yellow', verifying: 'badge-blue', hrd_pending: 'badge-yellow', confirmed: 'badge-green', paid_full: 'badge-green', expired: 'badge-red', cancelled: 'badge-gray' };
  var LS_CLS = { new: 'badge-blue', contacted: 'badge-yellow', qualified: 'badge-yellow', proposal: 'badge-yellow', won: 'badge-green', lost: 'badge-gray' };
  function fundLabel(f) { return f ? T('f_' + f) : '—'; }
  function roleLabel(r) { return r ? T('r_' + r) : '—'; }
  function th(cols) { return '<thead><tr>' + cols.map(function (c) { return '<th style="text-align:left;padding:10px 12px;font-size:12px;color:var(--text-3);white-space:nowrap;border-bottom:1px solid var(--border)">' + esc(c) + '</th>'; }).join('') + '</tr></thead>'; }
  var TD = 'padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:top;font-size:13px';
  function table(cols, rows) {
    if (!rows.length) return '<div class="empty-state" style="padding:32px;color:var(--text-3)">' + esc(T('none')) + '</div>';
    // data-label per cell: on phones each row stacks into one column (label above value), see STACK_CSS
    var body = rows.map(function (r) { var i = 0; return /colspan=/.test(r) ? r : r.replace(/<td(?=[\s>])/g, function () { return '<td data-label="' + esc(cols[i++] || '') + '"'; }); }).join('');
    return '<div style="overflow-x:auto"><table class="pl-tbl">' + th(cols) + '<tbody>' + body + '</tbody></table></div>';
  }
  var STACK_CSS = '<style>@media (max-width:768px){' +
    '#pl-root .pl-tbl,#pl-root .pl-tbl tbody,#pl-root .pl-tbl tr,#pl-root .pl-tbl td{display:block;width:100%;box-sizing:border-box}' +
    '#pl-root .pl-tbl thead{display:none}' +
    '#pl-root .pl-tbl tr{border-bottom:1px solid var(--border);padding:6px 0}' +
    '#pl-root .pl-tbl td{border-bottom:none!important;padding:6px 16px!important;white-space:normal!important;word-break:break-word}' +
    '#pl-root .pl-tbl td[data-label]::before{content:attr(data-label);display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--text-3);margin-bottom:2px}' +
    '#pl-root .pl-tbl td .form-input,#pl-root .pl-tbl td .form-select{width:100%;min-width:0!important;box-sizing:border-box}' +
    '#pl-root .pl-tbl tr[data-detail] td{padding:12px 16px!important}' +
    '}</style>';
  function btn(act, label, extra, cls) { return '<button type="button" class="btn btn-sm ' + (cls || 'btn-outline') + '" data-pl="' + act + '" ' + (extra || '') + '>' + esc(label) + '</button>'; }
  function field(id, label, value, type, hint, attrs) {
    return '<div class="form-group"><label class="form-label" for="' + id + '">' + esc(label) + '</label>' +
      (type === 'textarea' ? '<textarea class="form-input" id="' + id + '" rows="5" style="resize:vertical" ' + (attrs || '') + '>' + esc(value) + '</textarea>'
        : '<input class="form-input" id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '" ' + (attrs || '') + '>') +
      (hint ? '<div style="font-size:12px;color:var(--text-3);margin-top:4px">' + esc(hint) + '</div>' : '') + '</div>';
  }
  function val(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
  function numOrNull(v) { if (v === '' || v == null) return null; var n = Number(v); return isFinite(n) ? n : null; }

  async function rpc(name, args) {
    var r = await sb.rpc(name, args);
    if (r.error) throw r.error;
    return r.data;
  }

  /* ---------------- page shell ---------------- */
  window.renderProgrammes = async function (params) {
    params = params || {};
    if (typeof canAccess === 'function' && !canAccess('crm')) { if (typeof renderAccessDenied === 'function') renderAccessDenied(); return; }
    if (params.tab) S.tab = params.tab;
    if (params.lead) { S.tab = 'leads'; S.openLead = String(params.lead); }
    var main = document.getElementById('main');
    if (!main) return;
    var hdr = document.getElementById('header-title');
    if (hdr) hdr.textContent = T('title');
    main.innerHTML = '<div class="page-loading"><div class="spinner dark"></div></div>';
    var r = await sb.from('prog_programmes').select('*').eq('tenant_id', tid()).is('deleted_at', null).order('created_at');
    if (r.error) { main.innerHTML = shell('', '<div class="card" style="padding:20px;color:var(--danger)">' + esc(sqlMissing(r.error) ? T('sqlMissing') : msg(r.error)) + '</div>'); wire(main); return; }
    var progs = r.data || [];
    if (!progs.length) { main.innerHTML = shell('', createForm()); wire(main); return; }
    var pg = progs.filter(function (p) { return String(p.id) === String(S.progId); })[0] || progs[0];
    S.progId = pg.id;
    var seats = null;
    try { seats = await rpc('prog_seats', { p_programme: pg.id }); } catch (e) { seats = null; }
    var picker = progs.length > 1 ? '<select class="form-select" data-plc="prog" style="width:auto">' + progs.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (String(p.id) === String(pg.id) ? ' selected' : '') + '>' + esc(p.code + ' · ' + p.name) + '</option>'; }).join('') + '</select>' : '';
    var tabs = ['leads', 'enr', 'part', 'settle', 'set'].map(function (k) {
      var lab = { leads: 'tLeads', enr: 'tEnr', part: 'tPart', settle: 'tSettle', set: 'tSet' }[k];
      return '<button type="button" class="btn btn-sm ' + (S.tab === k ? 'btn-primary' : 'btn-outline') + '" style="border:none" data-pl="tab" data-v="' + k + '">' + esc(T(lab)) + '</button>';
    }).join('');
    main.innerHTML = shell(picker,
      '<div style="font-weight:700;font-size:15px;margin-bottom:4px">' + esc(pg.name) + '</div>' +
      '<div style="font-size:13px;color:var(--text-3);margin-bottom:12px">' + esc(pg.code) + ' · ' + fdate(pg.starts_on) + ' – ' + fdate(pg.ends_on) + ' · ' + rm(pg.fee_per_pax) + ' / pax</div>' +
      seatChips(seats) +
      '<div style="display:flex;gap:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px;margin:12px 0 16px;width:fit-content;max-width:100%;flex-wrap:wrap">' + tabs + '</div>' +
      '<div id="pl-body"><div class="page-loading"><div class="spinner dark"></div></div></div>');
    wire(main);
    var body = document.getElementById('pl-body');
    try {
      if (S.tab === 'leads') await bodyLeads(body, pg);
      else if (S.tab === 'enr') await bodyEnr(body, pg);
      else if (S.tab === 'part') await bodyPart(body, pg);
      else if (S.tab === 'settle') await bodySettle(body, pg);
      else await bodySet(body, pg);
    } catch (e) {
      console.error('programmes', e);
      body.innerHTML = '<div class="card" style="padding:20px;color:var(--danger)">' + esc(sqlMissing(e) ? T('sqlMissing') : msg(e)) + '</div>';
    }
  };
  function rerender() { return window.renderProgrammes({}); }

  function shell(right, inner) {
    return '<div id="pl-root">' + STACK_CSS + '<div class="page-header"><div><div class="page-title">' + esc(T('title')) + '</div>' +
      '<div style="font-size:13px;color:var(--text-3);margin-top:2px;cursor:pointer" data-pl="back">← ' + esc(T('back')) + '</div></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' + right + '</div></div>' + inner + '</div>';
  }
  function seatChips(s) {
    if (!s) return '';
    var chip = function (label, v, color) { return '<div class="card" style="padding:10px 14px;margin:0;min-width:110px"><div style="font-size:11px;color:var(--text-3)">' + esc(label) + '</div><div style="font-weight:700;font-size:18px;color:' + color + '">' + esc(v) + '</div></div>'; };
    return '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      chip(T('capacity'), s.capacity == null ? T('unlimited') : s.capacity, 'var(--text)') +
      chip(T('confirmed'), s.confirmed, 'var(--success)') + chip(T('held'), s.held, 'var(--warning)') +
      chip(T('available'), s.available == null ? '—' : s.available, 'var(--primary)') + '</div>';
  }
  function createForm() {
    return '<div class="card" style="padding:20px;max-width:560px"><div style="font-weight:700;margin-bottom:12px">' + esc(T('noProg')) + '</div>' +
      field('pl-new-code', T('code'), '', 'text', '', 'maxlength="40"') + field('pl-new-name', T('name'), '', 'text', '', 'maxlength="160"') +
      field('pl-new-fee', T('fee'), '', 'number', '', 'min="0" step="0.01"') + btn('create', T('create'), '', 'btn-primary') + '</div>';
  }

  /* ---------------- events (bound to #pl-root only, never #main) ---------------- */
  function wire(main) {
    var root = main.querySelector('#pl-root');
    if (!root) return;
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-pl]');
      if (!b || !root.contains(b)) return;
      onAct(b.getAttribute('data-pl'), b).catch(function (e) { console.error(e); toast(T('err') + ': ' + msg(e), 'error'); });
    });
    root.addEventListener('change', function (ev) {
      var el = ev.target.closest('[data-plc]');
      if (!el) return;
      onChange(el.getAttribute('data-plc'), el).catch(function (e) { console.error(e); toast(T('err') + ': ' + msg(e), 'error'); });
    });
    root.addEventListener('input', function (ev) {
      if (!ev.target.matches('[data-pli="q"]')) return;
      S.q = ev.target.value;
      var q = S.q.toLowerCase();
      root.querySelectorAll('tr[data-search]').forEach(function (tr) {
        var hit = !q || String(tr.getAttribute('data-search')).indexOf(q) >= 0;
        tr.style.display = hit ? '' : 'none';
        var det = root.querySelector('tr[data-detail="' + tr.getAttribute('data-id') + '"]');
        if (det) det.style.display = hit ? '' : 'none';
      });
    });
  }

  async function onAct(act, b) {
    var id = b.getAttribute('data-id');
    if (act === 'back') { openPage('crm', {}); return; }
    if (act === 'tab') { S.tab = b.getAttribute('data-v'); S.openLead = null; return rerender(); }
    if (act === 'create') return createProg();
    if (act === 'lead-open') { S.openLead = String(S.openLead) === String(id) ? null : id; return rerender(); }
    if (act === 'lead-log') return leadLog(id);
    if (act === 'lead-enrol') return leadEnrol(id);
    if (act === 'copy') return copy(b.getAttribute('data-v'));
    if (act === 'enr-issue') return enrIssue(id);
    if (act === 'enr-balance') return enrBalance(id);
    if (act === 'enr-extend') return enrExtend(id);
    if (act === 'enr-hrd') return enrHrd(id, b.getAttribute('data-v'));
    if (act === 'enr-cancel') return enrCancel(id);
    if (act === 'enr-letter') return enrLetter(id);
    if (act === 'inv') { openPage('sales', { view: 'inv-detail', id: id }); return; }
    if (act === 'settle') return doSettle();
    if (act === 'settle-print') return printStatement();
    if (act === 'set-save') return saveSettings();
  }
  async function onChange(what, el) {
    var id = el.getAttribute('data-id');
    if (what === 'prog') { S.progId = el.value; S.openLead = null; return rerender(); }
    if (what === 'stage-filter') { S.stage = el.value; return rerender(); }
    if (what === 'lead-stage') {
      var to = el.value, reason = null;
      if (to === 'lost') {
        reason = window.prompt(T('lostReason')) || '';
        if (reason.trim().length < 3) { toast(T('reasonReq'), 'error'); el.value = el.getAttribute('data-from'); return; }
      }
      try { await rpc('prog_lead_set_stage', { p_lead: id, p_stage: to, p_reason: reason }); toast(T('saved')); }
      catch (e) { el.value = el.getAttribute('data-from'); throw e; }
      return rerender();
    }
    if (what === 'lead-follow') {
      var r = await sb.from('prog_leads').update({ next_follow_up_at: el.value || null, updated_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', tid());
      if (r.error) throw r.error; toast(T('saved')); return;
    }
    if (what === 'eta' || what === 'ins') {
      var patch = what === 'eta' ? { eta_status: el.value } : { insurance_status: el.value };
      patch.updated_at = new Date().toISOString();
      var r2 = await sb.from('prog_participants').update(patch).eq('id', id).eq('tenant_id', tid());
      if (r2.error) throw r2.error; toast(T('saved')); return;
    }
    if (what === 'upto') { S.upTo = el.value || null; return rerender(); }
  }

  async function createProg() {
    var code = val('pl-new-code'), name = val('pl-new-name'), fee = numOrNull(val('pl-new-fee'));
    if (code.length < 2 || name.length < 2) { toast(T('reasonReq'), 'error'); return; }
    var tok = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Date.now().toString(36)) + Math.random().toString(36).slice(2, 10);
    var r = await sb.from('prog_programmes').insert({ tenant_id: tid(), code: code, name: name, fee_per_pax: fee || 0, public_token: tok, created_by: APP.user && APP.user.id });
    if (r.error) throw r.error;
    toast(T('saved')); return rerender();
  }

  /* ---------------- Leads ---------------- */
  async function bodyLeads(body, pg) {
    var r = await sb.from('prog_leads').select('*').eq('tenant_id', tid()).eq('programme_id', pg.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(500);
    if (r.error) throw r.error;
    var leads = (r.data || []).filter(function (l) { return !S.stage || l.stage === S.stage; });
    var acts = [];
    if (S.openLead) {
      var a = await sb.from('prog_lead_activities').select('*').eq('tenant_id', tid()).eq('lead_id', S.openLead).is('deleted_at', null).order('occurred_at', { ascending: false }).limit(100);
      acts = a.data || [];
    }
    var filter = '<select class="form-select" data-plc="stage-filter" style="width:auto"><option value="">' + esc(T('all')) + '</option>' +
      STAGES.map(function (s) { return '<option value="' + s + '"' + (S.stage === s ? ' selected' : '') + '>' + esc(T('st_' + s)) + '</option>'; }).join('') + '</select>';
    var rows = [];
    leads.forEach(function (l) {
      var open = String(S.openLead) === String(l.id);
      var stageCell = (l.stage === 'won' || l.stage === 'lost') ? badge(LS_CLS[l.stage], T('st_' + l.stage))
        : '<select class="form-select" data-plc="lead-stage" data-id="' + esc(l.id) + '" data-from="' + esc(l.stage) + '" style="min-width:140px">' +
          STAGES.filter(function (s) { return s !== 'won'; }).map(function (s) { return '<option value="' + s + '"' + (l.stage === s ? ' selected' : '') + '>' + esc(T('st_' + s)) + '</option>'; }).join('') + '</select>';
      var src = [l.utm_source, l.utm_campaign, l.ref_code ? 'ref ' + l.ref_code : ''].filter(Boolean).join(' · ') || '—';
      var waText = (isBm() ? 'Salam ' : 'Hello ') + l.name + ', ' + pg.name + ' (' + l.ref_no + ')';
      rows.push('<tr data-search="' + esc([l.ref_no, l.name, l.organisation, l.phone, l.email].join(' ').toLowerCase()) + '" data-id="' + esc(l.id) + '">' +
        '<td style="' + TD + ';white-space:nowrap"><b>' + esc(l.ref_no) + '</b><div style="font-size:12px;color:var(--text-3)">' + fdt(l.created_at) + '</div></td>' +
        '<td style="' + TD + '"><b>' + esc(l.name) + '</b><div style="font-size:12px;color:var(--text-3)">' + esc(l.organisation || '') + '</div></td>' +
        '<td style="' + TD + ';white-space:nowrap">' + (l.phone ? '<a href="' + esc(wa(l.phone, waText)) + '" target="_blank" rel="noopener">' + esc(l.phone) + '</a>' : '—') + '<div style="font-size:12px;color:var(--text-3)">' + esc(l.email || '') + '</div></td>' +
        '<td style="' + TD + '">' + esc(l.pax) + '</td>' +
        '<td style="' + TD + '">' + esc(fundLabel(l.funding)) + '</td>' +
        '<td style="' + TD + '">' + esc(src) + '</td>' +
        '<td style="' + TD + '">' + stageCell + '</td>' +
        '<td style="' + TD + '"><input type="date" class="form-input" data-plc="lead-follow" data-id="' + esc(l.id) + '" value="' + esc(l.next_follow_up_at || '') + '" style="min-width:140px"></td>' +
        '<td style="' + TD + '">' + btn('lead-open', open ? T('close') : T('details'), 'data-id="' + esc(l.id) + '"') + '</td></tr>');
      if (open) rows.push('<tr data-detail="' + esc(l.id) + '"><td colspan="9" style="' + TD + ';background:var(--bg)">' + leadDetail(l, acts, pg) + '</td></tr>');
    });
    body.innerHTML = '<div class="card" style="margin-bottom:0"><div style="display:flex;gap:12px;padding:16px;border-bottom:1px solid var(--border);flex-wrap:wrap">' +
      '<div class="input-group" style="flex:1;min-width:220px"><i class="ti ti-search input-icon"></i><input type="text" class="form-input" data-pli="q" placeholder="' + esc(T('search')) + '" value="' + esc(S.q) + '"></div>' + filter + '</div>' +
      table([T('ref'), T('name'), T('contact'), T('pax'), T('funding'), T('source'), T('stage'), T('follow'), T('actions')], rows) + '</div>';
    if (S.q) { var inp = body.querySelector('[data-pli="q"]'); if (inp) inp.dispatchEvent(new Event('input', { bubbles: true })); }
    var det = body.querySelector('tr[data-detail]'); if (det) det.scrollIntoView({ block: 'nearest' });
  }
  function kv(k, v) { return '<div style="margin-bottom:6px"><span style="color:var(--text-3);font-size:12px">' + esc(k) + '</span><div style="word-break:break-word">' + (v == null || v === '' ? '—' : esc(v)) + '</div></div>'; }
  function leadDetail(l, acts, pg) {
    var info = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px 16px;margin-bottom:12px">' +
      kv(T('org'), l.organisation) + kv(T('role'), roleLabel(l.job_role)) + kv(T('email'), l.email) + kv(T('phone'), l.phone) +
      kv(T('campaign'), [l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content].filter(Boolean).join(' / ')) + kv(T('refCode'), l.ref_code) +
      kv(T('consent'), l.consent_at ? fdt(l.consent_at) + (l.consent_version ? ' · ' + l.consent_version : '') : '') +
      (l.stage === 'lost' ? kv(T('lostReason'), l.lost_reason) : '') + '</div>' + kv(T('message'), l.message);
    var log = '<div style="font-weight:700;margin:12px 0 6px">' + esc(T('activity')) + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;margin-bottom:8px">' +
      '<select class="form-select" id="pl-log-type" style="width:auto">' + ['call', 'whatsapp', 'email', 'meeting', 'note'].map(function (t) { return '<option value="' + t + '">' + esc(T('a_' + t)) + '</option>'; }).join('') + '</select>' +
      '<input class="form-input" id="pl-log-notes" maxlength="2000" style="flex:1;min-width:200px" placeholder="' + esc(T('notes')) + '">' + btn('lead-log', T('log'), 'data-id="' + esc(l.id) + '"', 'btn-primary') + '</div>' +
      (acts.length ? '<div>' + acts.map(function (a) {
        var what = a.type === 'stage' ? T('st_' + (a.from_stage || 'new')) + ' → ' + T('st_' + (a.to_stage || '')) : T('a_' + a.type);
        return '<div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-3)">' + fdt(a.occurred_at) + '</span> · <b>' + esc(what) + '</b>' + (a.notes ? ' — ' + esc(a.notes) : '') + '</div>';
      }).join('') + '</div>' : '');
    var enrol = '';
    if (l.stage !== 'won' && l.stage !== 'lost' && l.stage !== 'new') {
      var f = ['self', 'company', 'hrdcorp'].indexOf(l.funding) >= 0 ? l.funding : '';
      enrol = '<div style="font-weight:700;margin:16px 0 6px">' + esc(T('enrolTitle')) + '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0 12px">' +
        field('pl-en-payer', T('payer'), l.funding === 'company' || l.funding === 'hrdcorp' ? (l.organisation || l.name) : l.name, 'text', '', 'maxlength="160"') +
        '<div class="form-group"><label class="form-label" for="pl-en-type">' + esc(T('payerType')) + '</label><select class="form-select" id="pl-en-type">' +
        ['individual', 'company'].map(function (x) { return '<option value="' + x + '"' + ((x === 'company') === (l.funding === 'company' || l.funding === 'hrdcorp') ? ' selected' : '') + '>' + esc(T('pt_' + x)) + '</option>'; }).join('') + '</select></div>' +
        field('pl-en-pax', T('pax'), l.pax || 1, 'number', '', 'min="1" max="50" step="1"') +
        '<div class="form-group"><label class="form-label" for="pl-en-fund">' + esc(T('funding')) + '</label><select class="form-select" id="pl-en-fund">' +
        '<option value="" disabled' + (f ? '' : ' selected') + '>—</option>' +
        ['self', 'company', 'hrdcorp'].map(function (x) { return '<option value="' + x + '"' + (f === x ? ' selected' : '') + '>' + esc(T('f_' + x)) + '</option>'; }).join('') + '</select></div>' +
        field('pl-en-email', T('email'), l.email, 'email') + field('pl-en-phone', T('phone'), l.phone, 'tel') + '</div>' +
        btn('lead-enrol', T('enrolBtn'), 'data-id="' + esc(l.id) + '"', 'btn-primary');
    }
    return info + log + enrol;
  }
  async function leadLog(id) {
    var notes = val('pl-log-notes');
    if (!notes) { toast(T('notesReq'), 'error'); return; }
    await rpc('prog_lead_log', { p_lead: id, p_type: val('pl-log-type') || 'note', p_notes: notes });
    toast(T('saved')); return rerender();
  }
  async function leadEnrol(id) {
    var pax = parseInt(val('pl-en-pax'), 10), fund = val('pl-en-fund');
    if (!fund || !(pax >= 1 && pax <= 50) || val('pl-en-payer').length < 2) { toast(T('reasonReq'), 'error'); return; }
    await rpc('prog_create_enrolment', { p_lead: id, p_payer_name: val('pl-en-payer'), p_payer_type: val('pl-en-type'), p_pax: pax, p_funding: fund, p_email: val('pl-en-email') || null, p_phone: val('pl-en-phone') || null });
    toast(T('enrolDone')); S.tab = 'enr'; S.openLead = null; return rerender();
  }

  /* ---------------- Enrolments ---------------- */
  var ENR = [];
  async function bodyEnr(body, pg) {
    var r = await sb.from('prog_enrolments_v').select('*').eq('tenant_id', tid()).eq('programme_id', pg.id).order('created_at', { ascending: false });
    if (r.error) throw r.error;
    ENR = r.data || [];
    var sales = canSales();
    var rows = ENR.map(function (e) {
      var inv = function (ref, iid, total, paid, tok, label) {
        if (!iid) return '—';
        var bal = Number(total || 0) - Number(paid || 0);
        var payTxt = T('waPay', { payer: e.payer_name, ref: ref, programme: pg.name, amount: rm(bal > 0 ? bal : total), link: tok ? payLink(tok) : '' });
        return '<div><a href="javascript:void(0)" data-pl="inv" data-id="' + esc(iid) + '"><b>' + esc(ref) + '</b></a> · ' + rm(total) +
          '<div style="font-size:12px;color:var(--text-3)">' + esc(label) + ': ' + rm(paid) + '</div>' +
          (tok && bal > 0.005 ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">' + btn('copy', T('copyLink'), 'data-v="' + esc(payLink(tok)) + '"') +
            (digits(e.phone) ? '<a class="btn btn-sm btn-outline" target="_blank" rel="noopener" href="' + esc(wa(e.phone, payTxt)) + '">' + esc(T('sendWa')) + '</a>' : '') + '</div>' : '') + '</div>';
      };
      var paidLbl = isBm() ? 'Dibayar' : 'Paid';
      var a = [];
      if (sales) {
        if (e.status === 'draft') a.push(btn('enr-issue', T('issue'), 'data-id="' + esc(e.id) + '"', 'btn-primary'));
        if (['held', 'hrd_pending', 'expired', 'verifying'].indexOf(e.status) >= 0) a.push(btn('enr-extend', T('extend'), 'data-id="' + esc(e.id) + '"'));
        if (e.funding === 'hrdcorp' && e.deposit_invoice_id && e.status !== 'cancelled') a.push(btn('enr-hrd', T('hrdNo'), 'data-id="' + esc(e.id) + '" data-v="' + esc(e.hrd_approval_no || '') + '"'));
        if (e.funding !== 'hrdcorp' && (e.status === 'confirmed') && !e.balance_invoice_id && Number(e.fee_total || 0) - Number(e.deposit_total || 0) > 0.005) a.push(btn('enr-balance', T('issueBal'), 'data-id="' + esc(e.id) + '"', 'btn-primary'));
        if (e.status === 'confirmed' || e.status === 'paid_full') a.push(btn('enr-letter', T('letter'), 'data-id="' + esc(e.id) + '"'));
        if (e.status !== 'cancelled' && e.status !== 'paid_full') a.push(btn('enr-cancel', T('cancel'), 'data-id="' + esc(e.id) + '"'));
      }
      return '<tr data-search="' + esc([e.payer_name, e.dep_ref, e.bal_ref, e.email, e.phone].join(' ').toLowerCase()) + '" data-id="' + esc(e.id) + '">' +
        '<td style="' + TD + '"><b>' + esc(e.payer_name) + '</b><div style="font-size:12px;color:var(--text-3)">' + esc(T('pt_' + e.payer_type)) + ' · ' + esc(e.phone || e.email || '') + '</div></td>' +
        '<td style="' + TD + '">' + esc(e.pax) + '</td><td style="' + TD + '">' + esc(fundLabel(e.funding)) + (e.hrd_approval_no ? '<div style="font-size:12px;color:var(--text-3)">' + esc(e.hrd_approval_no) + '</div>' : '') + '</td>' +
        '<td style="' + TD + '">' + badge(ST_CLS[e.status] || 'badge-gray', T('s_' + e.status)) + (Number(e.claims_pending) > 0 && e.status !== 'verifying' ? '<div style="font-size:12px;color:var(--text-3);margin-top:4px">' + esc(T('s_verifying')) + '</div>' : '') + '</td>' +
        '<td style="' + TD + '">' + inv(e.dep_ref, e.deposit_invoice_id, e.dep_total, e.dep_paid, e.dep_token, paidLbl) + '</td>' +
        '<td style="' + TD + '">' + inv(e.bal_ref, e.balance_invoice_id, e.bal_total, e.bal_paid, e.bal_token, paidLbl) + '</td>' +
        '<td style="' + TD + ';white-space:nowrap">' + (e.hold_until && ['held', 'hrd_pending', 'verifying', 'expired'].indexOf(e.status) >= 0 ? fdt(e.hold_until) : '—') + '</td>' +
        '<td style="' + TD + '">' + esc(e.registered) + ' / ' + esc(e.pax) + '</td>' +
        '<td style="' + TD + '"><div style="display:flex;gap:4px;flex-wrap:wrap">' + a.join('') + '</div></td></tr>';
    });
    body.innerHTML = (sales ? '' : '<div class="card" style="padding:12px 16px;color:var(--text-3)">' + esc(T('noSales')) + '</div>') +
      '<div class="card" style="margin-bottom:0">' + table([T('payer'), T('pax'), T('funding'), T('status'), T('depInv'), T('balInv'), T('holdUntil'), T('registered'), T('actions')], rows) + '</div>';
  }
  function enr(id) { return ENR.filter(function (e) { return String(e.id) === String(id); })[0]; }
  async function enrIssue(id) {
    if (!window.confirm(T('issueConfirm'))) return;
    await rpc('prog_issue_deposit', { p_enrolment: id }); toast(T('issued')); return rerender();
  }
  async function enrBalance(id) { await rpc('prog_issue_balance', { p_enrolment: id }); toast(T('balDone')); return rerender(); }
  async function enrExtend(id) {
    var d = parseInt(window.prompt(T('extendAsk'), '7') || '', 10);
    if (!(d >= 1 && d <= 60)) return;
    await rpc('prog_extend_hold', { p_enrolment: id, p_days: d }); toast(T('extended')); return rerender();
  }
  async function enrHrd(id, cur) {
    var no = window.prompt(T('hrdAsk'), cur || '');
    if (no == null) return;
    await rpc('prog_set_hrd_approval', { p_enrolment: id, p_no: no }); toast(T('hrdSaved')); return rerender();
  }
  async function enrCancel(id) {
    var why = window.prompt(T('cancelAsk')) || '';
    if (why.trim().length < 3) { if (why) toast(T('reasonReq'), 'error'); return; }
    await rpc('prog_cancel_enrolment', { p_enrolment: id, p_reason: why }); toast(T('cancelled')); return rerender();
  }
  async function enrLetter(id) {
    var e = enr(id); if (!e) return;
    var r = await sb.from('prog_programmes').select('*').eq('id', e.programme_id).eq('tenant_id', tid()).maybeSingle();
    var pg = r.data || {};
    var tpl = String((isBm() ? pg.confirm_letter_bm : pg.confirm_letter_en) || pg.confirm_letter_en || pg.confirm_letter_bm || '').trim();
    if (!tpl) { toast(T('letterMissing'), 'error'); return; }
    var lr = e.lead_id ? await sb.from('prog_leads').select('ref_no').eq('id', e.lead_id).eq('tenant_id', tid()).maybeSingle() : { data: null };
    var ref = (lr.data && lr.data.ref_no) || e.dep_ref || '';
    var body = tpl.split('{payer}').join(e.payer_name).split('{pax}').join(String(e.pax)).split('{programme}').join(pg.name || '')
      .split('{dates}').join(fdate(pg.starts_on) + ' – ' + fdate(pg.ends_on)).split('{ref}').join(ref);
    var tn = APP.tenant || {}, d = today().split('-');
    var fname = 'CONF-' + String(pg.code || 'PRG').replace(/[^\w-]+/g, '') + '-' + String(ref).replace(/[^\w-]+/g, '') + '-' + d[2] + d[1] + d[0];
    var w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(fname) + '</title><style>body{font-family:Inter,system-ui,sans-serif;color:#0F172A;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.7;font-size:14px}h1{font-size:18px;margin:0}.muted{color:#64748B;font-size:12px}.body{white-space:pre-wrap;margin-top:28px}@media print{body{margin:0 auto}}</style></head><body>' +
      '<div style="display:flex;gap:12px;align-items:center;border-bottom:1px solid #E2E8F0;padding-bottom:12px">' + (tn.logo_url ? '<img src="' + esc(tn.logo_url) + '" style="height:48px">' : '') +
      '<div><h1>' + esc(tn.name || '') + '</h1><div class="muted">' + esc(fdate(today())) + ' · ' + esc(ref) + '</div></div></div><div class="body">' + esc(body) + '</div>' +
      '<script>setTimeout(function(){window.print()},300)<\/script></body></html>');
    w.document.close();
  }

  /* ---------------- Participants ---------------- */
  async function bodyPart(body, pg) {
    var r = await sb.from('prog_participants').select('*').eq('tenant_id', tid()).eq('programme_id', pg.id).is('deleted_at', null).order('created_at');
    if (r.error) throw r.error;
    var e = await sb.from('prog_enrolments_v').select('id,payer_name,status,phone').eq('tenant_id', tid()).eq('programme_id', pg.id);
    if (e.error) throw e.error;
    var byE = {}; (e.data || []).forEach(function (x) { byE[String(x.id)] = x; });
    var termsOk = !!String(pg.terms_url || '').trim();
    var rows = (r.data || []).filter(function (p) { var x = byE[String(p.enrolment_id)]; return x && x.status !== 'cancelled'; }).map(function (p) {
      var x = byE[String(p.enrolment_id)] || {};
      var link = regLink(p.public_token);
      var share = termsOk ? '<div style="display:flex;gap:4px;flex-wrap:wrap">' + btn('copy', T('regLink'), 'data-v="' + esc(link) + '"') +
        (digits(p.phone || x.phone) ? '<a class="btn btn-sm btn-outline" target="_blank" rel="noopener" href="' + esc(wa(p.phone || x.phone, T('waReg', { programme: pg.name, link: link }))) + '">' + esc(T('sendWa')) + '</a>' : '') + '</div>' : '—';
      var sel = function (kind, cur, opts, pre) { return '<select class="form-select" data-plc="' + kind + '" data-id="' + esc(p.id) + '" style="min-width:120px">' + opts.map(function (o) { return '<option value="' + o + '"' + (cur === o ? ' selected' : '') + '>' + esc(T(pre + o)) + '</option>'; }).join('') + '</select>'; };
      return '<tr data-search="' + esc([p.full_name_passport, x.payer_name, p.email, p.phone].join(' ').toLowerCase()) + '" data-id="' + esc(p.id) + '">' +
        '<td style="' + TD + '">' + esc(x.payer_name || '') + ' #' + esc(p.seq) + '</td>' +
        '<td style="' + TD + '"><b>' + esc(p.full_name_passport || T('notYet')) + '</b><div style="font-size:12px;color:var(--text-3)">' + esc([p.email, p.phone].filter(Boolean).join(' · ')) + '</div></td>' +
        '<td style="' + TD + '">' + esc(p.nationality || '—') + '</td>' +
        '<td style="' + TD + '">' + esc(p.dietary || '—') + '<div style="font-size:12px;color:var(--text-3)">' + esc(p.room_pref || '') + '</div></td>' +
        '<td style="' + TD + '">' + esc(p.emergency_name || '—') + '<div style="font-size:12px;color:var(--text-3)">' + esc(p.emergency_phone || '') + '</div></td>' +
        '<td style="' + TD + '">' + (p.terms_accepted_at ? badge('badge-green', fdt(p.terms_accepted_at)) : badge('badge-gray', T('notYet'))) + '</td>' +
        '<td style="' + TD + '">' + sel('eta', p.eta_status, ['pending', 'submitted', 'approved'], 'eta_') + '</td>' +
        '<td style="' + TD + '">' + sel('ins', p.insurance_status, ['pending', 'confirmed'], 'ins_') + '</td>' +
        '<td style="' + TD + '">' + share + '</td></tr>';
    });
    body.innerHTML = (termsOk ? '' : '<div class="card" style="padding:12px 16px;color:var(--warning)">' + esc(T('termsMissing')) + '</div>') +
      '<div class="card" style="margin-bottom:0">' + table([T('payer'), T('passName'), T('nationality'), T('diet') + ' / ' + T('room'), T('emergency'), T('terms'), T('eta'), T('insurance'), T('regLink')], rows) + '</div>';
  }

  /* ---------------- Settlement ---------------- */
  var UNS = [], SET_PG = null;
  async function bodySettle(body, pg) {
    SET_PG = pg;
    var upTo = S.upTo || today();
    UNS = (await rpc('prog_unsettled', { p_programme: pg.id, p_to: upTo })) || [];
    var h = await sb.from('prog_settlements').select('*').eq('tenant_id', tid()).eq('programme_id', pg.id).is('deleted_at', null).order('settled_on', { ascending: false }).limit(100);
    if (h.error) throw h.error;
    var total = UNS.reduce(function (s, u) { return s + Number(u.amount || 0); }, 0);
    var rows = UNS.map(function (u) {
      return '<tr><td style="' + TD + '">' + fdate(u.payment_date) + '</td><td style="' + TD + '"><a href="javascript:void(0)" data-pl="inv" data-id="' + esc(u.invoice_id) + '">' + esc(u.invoice_ref) + '</a></td>' +
        '<td style="' + TD + '">' + esc(u.payer_name) + '</td><td style="' + TD + '">' + esc(u.payment_method || '—') + ' ' + esc(u.payment_ref || '') + '</td><td style="' + TD + ';text-align:right;white-space:nowrap">' + rm(u.amount) + '</td></tr>';
    });
    var hist = (h.data || []).map(function (s) {
      return '<tr><td style="' + TD + '">' + fdate(s.settled_on) + '</td><td style="' + TD + '">' + fdate(s.period_to) + '</td><td style="' + TD + '">' + esc(s.bank_ref || '—') + '</td><td style="' + TD + '">' + esc(s.note || '') + '</td><td style="' + TD + ';text-align:right;white-space:nowrap">' + rm(s.amount) + '</td></tr>';
    });
    var sales = canSales();
    body.innerHTML = '<div class="card" style="padding:16px">' +
      '<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px"><div class="form-group" style="margin:0"><label class="form-label">' + esc(T('upTo')) + '</label>' +
      '<input type="date" class="form-input" data-plc="upto" value="' + esc(upTo) + '"></div>' + btn('settle-print', T('printStmt')) + '</div>' +
      '<div style="font-weight:700;margin-bottom:6px">' + esc(T('unsettled')) + '</div>' +
      table([T('payDate'), T('invoice'), T('payer'), T('method'), T('amount')], rows) +
      '<div style="text-align:right;font-weight:800;font-size:16px;margin:10px 0">' + esc(T('total')) + ': ' + rm(total) + '</div>' +
      (sales && UNS.length ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0 12px">' +
        field('pl-st-on', T('settledOn'), today(), 'date') + field('pl-st-ref', T('bankRef'), '', 'text', '', 'maxlength="80"') + field('pl-st-note', T('note'), '', 'text', '', 'maxlength="500"') + '</div>' +
        btn('settle', T('settle'), '', 'btn-primary') : '') + '</div>' +
      '<div class="card" style="padding:16px;margin-top:12px;margin-bottom:0"><div style="font-weight:700;margin-bottom:6px">' + esc(T('history')) + '</div>' +
      table([T('settledOn'), T('upTo'), T('bankRef'), T('note'), T('amount')], hist) + '</div>';
  }
  async function doSettle() {
    var total = UNS.reduce(function (s, u) { return s + Number(u.amount || 0); }, 0);
    if (!UNS.length || !window.confirm(T('settleAsk', { amount: rm(total) }))) return;
    await rpc('prog_settle', { p_programme: SET_PG.id, p_to: S.upTo || today(), p_settled_on: val('pl-st-on') || today(), p_bank_ref: val('pl-st-ref') || null, p_note: val('pl-st-note') || null });
    toast(T('settledOk')); return rerender();
  }
  function printStatement() {
    var pg = SET_PG || {}, upTo = S.upTo || today(), tn = APP.tenant || {}, d = upTo.split('-');
    var total = UNS.reduce(function (s, u) { return s + Number(u.amount || 0); }, 0);
    var fname = 'STMT-' + String(pg.code || 'PRG').replace(/[^\w-]+/g, '') + '-' + d.join('') + '-' + d[2] + d[1] + d[0];
    var w = window.open('', '_blank'); if (!w) return;
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(fname) + '</title><style>body{font-family:Inter,system-ui,sans-serif;color:#0F172A;max-width:820px;margin:32px auto;padding:0 20px;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #E2E8F0;padding:8px;text-align:left}td.r,th.r{text-align:right}.muted{color:#64748B}</style></head><body>' +
      '<h2 style="margin:0">' + esc(T('stmtTitle')) + '</h2><div class="muted">' + esc(tn.name || '') + ' · ' + esc(pg.code || '') + ' · ' + esc(T('upTo')) + ' ' + esc(fdate(upTo)) + '</div>' +
      '<table><thead><tr><th>' + esc(T('payDate')) + '</th><th>' + esc(T('invoice')) + '</th><th>' + esc(T('payer')) + '</th><th>' + esc(T('method')) + '</th><th class="r">' + esc(T('amount')) + '</th></tr></thead><tbody>' +
      UNS.map(function (u) { return '<tr><td>' + esc(fdate(u.payment_date)) + '</td><td>' + esc(u.invoice_ref) + '</td><td>' + esc(u.payer_name) + '</td><td>' + esc((u.payment_method || '') + ' ' + (u.payment_ref || '')) + '</td><td class="r">' + esc(rm(u.amount)) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><th colspan="4">' + esc(T('total')) + '</th><th class="r">' + esc(rm(total)) + '</th></tr></tfoot></table>' +
      '<script>setTimeout(function(){window.print()},300)<\/script></body></html>');
    w.document.close();
  }

  /* ---------------- Settings ---------------- */
  async function bodySet(body, pg) {
    var sec = function (t) { return '<div style="font-weight:700;margin:16px 0 8px">' + esc(t) + '</div>'; };
    var grid = function (inner) { return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 12px">' + inner + '</div>'; };
    body.innerHTML = '<div class="card" style="padding:16px;margin-bottom:0">' + sec(T('sProg')) + grid(
      field('ps-name', T('name'), pg.name, 'text', '', 'maxlength="160"') + field('ps-start', T('starts'), pg.starts_on, 'date') + field('ps-end', T('ends'), pg.ends_on, 'date') +
      field('ps-fee', T('fee'), pg.fee_per_pax, 'number', '', 'min="0" step="0.01"') + field('ps-dep', T('deposit'), pg.deposit_per_pax, 'number', T('depositHint'), 'min="0" step="0.01"') +
      field('ps-baldue', T('balDue'), pg.balance_due_on, 'date') + field('ps-cap', T('cap'), pg.capacity, 'number', T('capHint'), 'min="1" step="1"') +
      field('ps-hold', T('holdDays'), pg.hold_days, 'number', '', 'min="1" max="60" step="1"') + field('ps-hrdhold', T('hrdHold'), pg.hrd_hold_days, 'number', '', 'min="1" max="120" step="1"') +
      field('ps-wa', T('waNo'), pg.wa_phone, 'tel')) +
      sec(T('sPay')) + '<div style="font-size:12px;color:var(--text-3);margin-bottom:8px">' + esc(T('payHint')) + '</div>' + grid(
      field('ps-bank', T('bank'), pg.pay_bank_name, 'text', '', 'maxlength="80"') + field('ps-accname', T('accName'), pg.pay_account_name, 'text', '', 'maxlength="120"') +
      field('ps-accno', T('accNo'), pg.pay_account_number, 'text', '', 'maxlength="40"') + field('ps-qr', T('qrUrl'), pg.pay_qr_url, 'url')) +
      field('ps-paynote', T('payNote'), pg.pay_note, 'text', T('payNoteHint'), 'maxlength="300"') +
      sec(T('sTerms')) + grid(field('ps-terms', T('termsUrl'), pg.terms_url, 'url') + field('ps-termsv', T('termsVer'), pg.terms_version, 'text', '', 'maxlength="40"')) +
      sec(T('sLetter')) + '<div style="font-size:12px;color:var(--text-3);margin-bottom:8px">' + esc(T('letterHint')) + '</div>' +
      field('ps-letter-en', T('letterEn'), pg.confirm_letter_en, 'textarea') + field('ps-letter-bm', T('letterBm'), pg.confirm_letter_bm, 'textarea') +
      sec(T('sLp')) + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><code style="font-size:12px;word-break:break-all">' + esc(pg.public_token || '—') + '</code>' +
      (pg.public_token ? btn('copy', T('copyLink').split(' ')[0], 'data-v="' + esc(pg.public_token) + '"') : '') + '</div>' +
      '<div style="font-size:12px;color:var(--text-3);margin:4px 0 16px">' + esc(T('lpToken')) + '</div>' +
      btn('set-save', T('save'), '', 'btn-primary') + '</div>';
  }
  async function saveSettings() {
    var patch = {
      name: val('ps-name'), starts_on: val('ps-start') || null, ends_on: val('ps-end') || null,
      fee_per_pax: numOrNull(val('ps-fee')) || 0, deposit_per_pax: numOrNull(val('ps-dep')), balance_due_on: val('ps-baldue') || null,
      capacity: numOrNull(val('ps-cap')), hold_days: numOrNull(val('ps-hold')) || 7, hrd_hold_days: numOrNull(val('ps-hrdhold')) || 30,
      wa_phone: val('ps-wa') || null, pay_bank_name: val('ps-bank') || null, pay_account_name: val('ps-accname') || null,
      pay_account_number: val('ps-accno') || null, pay_qr_url: val('ps-qr') || null, pay_note: val('ps-paynote') || null,
      terms_url: val('ps-terms') || null, terms_version: val('ps-termsv') || null,
      confirm_letter_en: val('ps-letter-en') || null, confirm_letter_bm: val('ps-letter-bm') || null,
      updated_at: new Date().toISOString()
    };
    if (String(patch.name).length < 2) { toast(T('reasonReq'), 'error'); return; }
    var r = await sb.from('prog_programmes').update(patch).eq('id', S.progId).eq('tenant_id', tid());
    if (r.error) throw r.error;
    toast(T('saved')); return rerender();
  }

  /* ---------------- CRM customer list: "Programmes" button (no wrapping of renderCustomerList) ---------------- */
  function addProgBtn() {
    var main = document.getElementById('main');
    if (!main || !main.querySelector('#crm-search')) return;
    if (typeof canAccess === 'function' && !canAccess('crm')) return;
    var header = main.querySelector('.page-header');
    if (!header || header.querySelector('[data-pl-open]')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-outline'; b.setAttribute('data-pl-open', '1');
    b.innerHTML = '<i class="ti ti-school"></i> ' + esc(T('open'));
    b.onclick = function () { openPage('crm', { view: 'programmes' }); };
    var anchor = header.querySelector('[data-crm-share]');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(b, anchor);
    else header.appendChild(b);
  }

  /* ---------------- public registration (?prog_reg=TOKEN) ---------------- */
  function pubLang() { var q = new URLSearchParams(location.search).get('lang'); return q === 'bm' || q === 'ms' ? 'bm' : 'en'; }
  function R(k) { return window.PLSPI ? PLSPI.r(pubLang(), k) : k; }
  window._plRegSetLang = function (l) {
    try { var u = new URL(location.href); u.searchParams.set('lang', l === 'bm' ? 'bm' : 'en'); history.replaceState({}, '', u); } catch (e) {}
    showReg();
  };
  async function showReg() {
    var token = new URLSearchParams(location.search).get('prog_reg');
    if (!token) return false;
    var shellEl = document.getElementById('shell'); if (shellEl) shellEl.classList.remove('active');
    var auth = document.getElementById('auth-page'); if (auth) auth.style.display = 'none';
    try { document.documentElement.style.overflowY = 'auto'; document.body.style.overflowY = 'auto'; document.body.style.height = 'auto'; } catch (e) {}
    var root = document.getElementById('pl-reg-root');
    if (!root) {
      root = document.createElement('div'); root.id = 'pl-reg-root';
      root.style.cssText = 'min-height:100vh;width:100%;box-sizing:border-box;padding:16px 12px calc(48px + env(safe-area-inset-bottom,0px));background:var(--bg,#F8FAFC)';
      document.body.appendChild(root);
    }
    var card = function (inner) { return '<div class="card" style="width:100%;max-width:560px;margin:16px auto;padding:20px;box-sizing:border-box">' + inner + '</div>'; };
    root.innerHTML = card('<div class="spinner dark"></div>');
    var res = await sb.rpc('get_prog_registration', { p_token: token });
    if (res.error || !res.data) { root.innerHTML = card('<p>' + esc(R('invalid')) + '</p>'); return true; }
    var d = res.data;
    var head = '<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">' + (d.logo_url ? '<img src="' + esc(d.logo_url) + '" alt="" style="height:40px;object-fit:contain">' : '') +
      '<div style="flex:1;min-width:0"><div style="font-weight:700">' + esc(d.programme || '') + '</div><div style="font-size:13px;color:var(--text-3)">' + esc(R('title')) + ' · ' + esc(R('participant')) + ' ' + esc(d.seq) + ' ' + esc(R('of')) + ' ' + esc(d.pax) + '</div></div>' +
      '<div style="display:flex;gap:6px"><button type="button" class="btn btn-outline btn-sm" onclick="_plRegSetLang(\'en\')">EN</button><button type="button" class="btn btn-outline btn-sm" onclick="_plRegSetLang(\'bm\')">BM</button></div></div>';
    if (d.locked) { root.innerHTML = card(head + '<p>' + esc(R('closed')) + '</p>'); return true; }
    if (!d.terms_url) { root.innerHTML = card(head + '<p>' + esc(R('noTerms')) + '</p>'); return true; }
    var f = function (id, label, v, type) { return '<div class="form-group"><label class="form-label" for="' + id + '">' + esc(label) + '</label><input class="form-input" id="' + id + '" type="' + (type || 'text') + '" value="' + esc(v || '') + '" maxlength="160"></div>'; };
    root.innerHTML = card(head + (d.submitted_at ? '<div class="badge badge-green" style="margin-bottom:12px">' + esc(R('update')) + '</div>' : '') +
      f('pr-name', R('name'), d.full_name_passport) + f('pr-nat', R('nat'), d.nationality) + f('pr-email', R('email'), d.email, 'email') + f('pr-phone', R('phone'), d.phone, 'tel') +
      f('pr-diet', R('diet'), d.dietary) + f('pr-room', R('room'), d.room_pref) + f('pr-ename', R('eName'), d.emergency_name) + f('pr-ephone', R('ePhone'), d.emergency_phone, 'tel') +
      '<label style="display:flex;gap:10px;align-items:flex-start;margin:12px 0;font-size:13px"><input type="checkbox" id="pr-terms" style="margin-top:3px;width:18px;height:18px;flex-shrink:0">' +
      '<span>' + esc(R('agree')) + ' <a href="' + esc(d.terms_url) + '" target="_blank" rel="noopener">' + esc(R('terms')) + '</a>' + (d.terms_version ? ' (' + esc(d.terms_version) + ')' : '') + '. *</span></label>' +
      '<div id="pr-err" style="display:none;color:var(--danger);font-size:13px;margin:8px 0"></div>' +
      '<button type="button" id="pr-btn" class="btn btn-primary" style="width:100%;min-height:44px">' + esc(R('submit')) + '</button>');
    document.getElementById('pr-btn').onclick = async function () {
      var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
      var err = document.getElementById('pr-err'), b = this;
      var payload = { full_name_passport: g('pr-name'), nationality: g('pr-nat'), email: g('pr-email'), phone: g('pr-phone'), dietary: g('pr-diet'), room_pref: g('pr-room'),
        emergency_name: g('pr-ename'), emergency_phone: g('pr-ephone'), terms: document.getElementById('pr-terms').checked ? 'true' : 'false' };
      if (!payload.full_name_passport || !payload.nationality || !payload.email || !payload.phone || !payload.emergency_name || !payload.emergency_phone || payload.terms !== 'true') {
        err.textContent = R('req'); err.style.display = 'block'; return;
      }
      b.disabled = true;
      var r = await sb.rpc('submit_prog_registration', { p_token: token, p_payload: payload });
      b.disabled = false;
      if (r.error) { err.textContent = R('fail'); err.style.display = 'block'; return; }
      root.innerHTML = card(head + '<div style="font-size:18px;font-weight:700;margin:8px 0">' + esc(R('done')) + '</div>');
    };
    return true;
  }

  function boot() {
    try {
      setInterval(addProgBtn, 700);
      if (new URLSearchParams(location.search).get('prog_reg')) {
        var go = function () { if (window.sb) showReg(); else setTimeout(go, 80); };
        go();
      }
    } catch (e) { console.error(e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
