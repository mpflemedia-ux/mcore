/* M-Core Onboarding Checklist - data loaders, stats, scoped print, open-time reminders (no server cron). */
(function () {
  var C = window.COB; if (!C || C._data) return; C._data = 1;
  var L = C.L;
  function q(r) { if (r.error) throw r.error; return r.data; }
  C.loadT = function (tid) {
    return Promise.all([
      sb.from('cob_checklists').select('*').eq('tenant_id', tid).is('deleted_at', null).maybeSingle(),
      sb.from('cob_items').select('*').eq('tenant_id', tid).is('deleted_at', null),
      sb.from('cob_submissions').select('id,item_id,seq,decision,decision_reason,decided_at,restore_result,submitted_at').eq('tenant_id', tid).is('deleted_at', null)
    ]).then(function (r) {
      var items = (q(r[1]) || []).sort(function (a, b) { return (a.section_sort - b.section_sort) || (a.sort_order - b.sort_order); });
      var subs = (q(r[2]) || []).sort(function (a, b) { return b.seq - a.seq; });
      return { cl: q(r[0]), items: items, subs: subs };
    });
  };
  C.stats = function (items) {
    var s = { tot: items.length, done: 0, core: 0, coreDone: 0, approved: 0, submitted: 0, rejected: 0, pending: 0, na: 0 };
    items.forEach(function (i) { s[i.status] = (s[i.status] || 0) + 1; if (C.done(i.status)) s.done++; if (i.section_core) { s.core++; if (C.done(i.status)) s.coreDone++; } });
    s.pct = s.tot ? Math.round(s.done * 100 / s.tot) : 0; s.corePct = s.core ? Math.round(s.coreDone * 100 / s.core) : 0;
    return s;
  };
  C.groups = function (items) {
    var g = [], m = {};
    items.forEach(function (i) { var k = i.section_key; if (!m[k]) { m[k] = { key: k, name_bm: i.section_name_bm, name_en: i.section_name_en, core: i.section_core, items: [] }; g.push(m[k]); } m[k].items.push(i); });
    return g;
  };
  C.expiring = function (items, days) {
    return items.filter(function (i) { var d = C.daysTo(i.expiry_date); return i.expiry_date && d !== null && d <= days; })
      .sort(function (a, b) { return a.expiry_date < b.expiry_date ? -1 : 1; });
  };
  C.print = function () {
    document.body.classList.add('cob-print');
    var done = function () { document.body.classList.remove('cob-print'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(function () { window.print(); }, 50);
  };
  /* Open-time reminder (no server cron): once per day per tenant admin, toast open MAIN items + expiring documents. */
  C.readyHooks.push(function () {
    if (!C.isTA() || C.isPA()) return;
    var key = 'cob_rem_' + C.tid() + '_' + C.today();
    try { if (localStorage.getItem(key)) return; } catch (e) {}
    C.loadT(C.tid()).then(function (d) {
      if (!d.cl || d.cl.status === 'completed') return;
      var open = d.items.filter(function (i) { return i.section_core && (i.status === 'pending' || i.status === 'rejected'); }).length;
      var rej = d.items.filter(function (i) { return i.status === 'rejected'; }).length, ex = C.expiring(d.items, 30).length;
      if (!open && !rej && !ex) return;
      try { localStorage.setItem(key, '1'); } catch (e) {}
      C.toast(L('Onboarding: ', 'Onboarding: ') + open + L(' MAIN items open', ' item UTAMA belum lengkap') + (rej ? ' · ' + rej + L(' rejected', ' ditolak') : '') + (ex ? ' · ' + ex + L(' documents expiring', ' dokumen hampir tamat') : ''), 'warning');
    }).catch(function () {});
  });
})();
