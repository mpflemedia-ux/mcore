/* M-Core Onboarding Checklist - platform admin data: paged loads, per-tenant rows, reminders, CSV templates, open-time PA reminder. */
(function () {
  var C = window.COB; if (!C || C._adata) return; C._adata = 1;
  var E = C.esc, L = C.L;
  /* PostgREST caps rows per request; page through. */
  C.all = function (mk) {
    var out = [], n = 1000;
    function step(i) { return mk().range(i, i + n - 1).then(function (r) { if (r.error) throw r.error; out = out.concat(r.data || []); return (r.data || []).length === n ? step(i + n) : out; }); }
    return step(0);
  };
  C.loadAll = function () {
    return Promise.all([
      C.all(function () { return sb.from('cob_checklists').select('*').is('deleted_at', null); }),
      C.all(function () { return sb.from('cob_items').select('id,tenant_id,status,section_core,urgent,expiry_date,code').is('deleted_at', null); }),
      C.all(function () { return sb.from('cob_submissions').select('id,tenant_id,item_id,submitted_at,decision').is('deleted_at', null); })
    ]).then(function (r) {
      var ids = r[0].map(function (c) { return c.tenant_id; });
      return (ids.length ? sb.from('tenants').select('*').in('id', ids) : Promise.resolve({ data: [] })).then(function (t) {
        if (t.error) throw t.error; var tm = {}; (t.data || []).forEach(function (x) { tm[x.id] = x; });
        return { cls: r[0], items: r[1], subs: r[2], tm: tm };
      });
    });
  };
  C.rows = function (d) {
    var now = Date.now(), m0 = C.today().slice(0, 7);
    return d.cls.map(function (cl) {
      var it = d.items.filter(function (i) { return i.tenant_id === cl.tenant_id; }), st = C.stats(it), ss = d.subs.filter(function (s) { return s.tenant_id === cl.tenant_id; });
      var pend = ss.filter(function (s) { return !s.decision; }), urg = pend.filter(function (s) { var i = it.find(function (x) { return x.id === s.item_id; }); return i && i.urgent; });
      var oldest = pend.reduce(function (m, s) { return !m || s.submitted_at < m ? s.submitted_at : m; }, null);
      var last = ss.reduce(function (m, s) { return !m || s.submitted_at > m ? s.submitted_at : m; }, null) || cl.started_at;
      var idle = Math.floor((now - new Date(last).getTime()) / 86400000), ex = C.expiring(it, 30), t = d.tm[cl.tenant_id] || {};
      return { cl: cl, t: t, name: t.name || '—', st: st, pend: pend.length, urg: urg.length, oldest: oldest, rej: st.rejected, ex: ex, idle: idle,
        stuck: cl.status === 'active' && idle > 7, done: cl.status === 'completed', newm: C.myt(cl.started_at).toISOString().slice(0, 7) === m0,
        donem: cl.completed_at && C.myt(cl.completed_at).toISOString().slice(0, 7) === m0, open: st.pending + st.rejected,
        remindable: cl.status === 'active' && (st.pending + st.rejected) > 0 && (!cl.last_reminder_at || now - new Date(cl.last_reminder_at).getTime() > 3 * 86400000) };
    }).sort(function (a, b) { return (a.done - b.done) || (b.pend - a.pend) || a.name.localeCompare(b.name); });
  };
  C.remind = function (tids) {
    if (!tids.length || !window.confirm(L('Send onboarding reminder (bell + Telegram) to ', 'Hantar peringatan onboarding (loceng + Telegram) kepada ') + tids.length + ' tenant?')) return Promise.resolve();
    return tids.reduce(function (p, tid) {
      return p.then(function () {
        return sb.rpc('cob_remind', { p_tenant: tid }).then(function (r) {
          if (r.error) throw r.error; var d = r.data || {};
          (d.owners || []).forEach(function (o) { sb.functions.invoke('telegram-send', { body: { tenant_id: o.tenant_id, subject_type: 'user', subject_id: o.user_id, text: 'Peringatan onboarding M-Core: ' + d.open + ' item belum lengkap (' + d.core + ' UTAMA). Buka M-Core › Onboarding.' } }).catch(function () {}); });
        });
      });
    }, Promise.resolve()).then(function () { C.toast(L('Reminders sent', 'Peringatan dihantar'), 'success'); C.go('cob_admin', APP.currentParams || {}); })
      .catch(function (e) { C.toast(C.err(e), 'error'); });
  };
  C.tpl = function () {
    sb.from('cob_master_versions').select('id,version').eq('status', 'published').is('deleted_at', null).order('version', { ascending: false }).limit(1).then(function (r) {
      if (r.error || !r.data || !r.data[0]) throw r.error || new Error(L('No published master', 'Tiada master diterbitkan'));
      return sb.from('cob_master_items').select('code,label_bm,label_en,template_header,sort_order').eq('version_id', r.data[0].id).eq('item_type', 'list').is('deleted_at', null);
    }).then(function (r) {
      if (r.error) throw r.error;
      var list = (r.data || []).filter(function (i) { return i.template_header; }).sort(function (a, b) { return a.code < b.code ? -1 : 1; });
      var h = '<div class="cob-root">' + list.map(function (i) { return '<button class="row cob-item" data-c="' + E(i.code) + '" style="width:100%;background:none;border:0;border-top:1px solid var(--border);color:inherit;font-family:inherit;text-align:left"><i class="ti ti-file-spreadsheet" style="color:var(--cob-ok);font-size:18px"></i><div class="grow"><div style="font-size:13px;font-weight:500"><span class="cob-mono" style="color:var(--cob-t3)">' + E(i.code) + '</span> ' + E(C.lab(i, 'label')) + '</div><div class="cob-xs cob-ell">' + E(i.template_header) + '</div></div><i class="ti ti-download"></i></button>'; }).join('') + '</div>';
      C.modal(L('CSV templates', 'Templat CSV'), h);
      document.querySelectorAll('[data-c]').forEach(function (b) { b.onclick = function () { var i = list.find(function (x) { return x.code === b.dataset.c; }); C.csv(i.code, i.template_header); }; });
    }).catch(function (e) { C.toast(C.err(e), 'error'); });
  };
  C.readyHooks.push(function () {
    if (!C.isPA()) return;
    var key = 'cob_pa_' + C.today(); try { if (localStorage.getItem(key)) return; } catch (e) {}
    C.loadAll().then(function (d) {
      var R = C.rows(d), pend = R.reduce(function (s, r) { return s + r.pend; }, 0), urg = R.reduce(function (s, r) { return s + r.urg; }, 0), ex = R.reduce(function (s, r) { return s + r.ex.length; }, 0);
      if (!pend && !ex) return; try { localStorage.setItem(key, '1'); } catch (e) {}
      C.toast(L('Onboarding: ', 'Onboarding: ') + pend + L(' awaiting review', ' menunggu semakan') + (urg ? ' (' + urg + L(' urgent)', ' segera)') : '') + (ex ? ' · ' + ex + L(' documents expiring', ' dokumen hampir tamat') : ''), 'warning');
    }).catch(function () {});
  });
})();
