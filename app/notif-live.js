/* M-Core bell v2 — live items computed from source tables (always accurate, auto-resolve when acted). */
(function () {
  var NT = window.NT; if (!NT) return;
  var L = NT.L;
  function rm(n) { try { return formatRM(n); } catch (e) { return 'RM ' + Number(n || 0).toFixed(2); } }
  function dd(d) { try { return formatDate(d); } catch (e) { return String(d || '').slice(0, 10); } }
  var LT = { annual: ['Annual leave', 'Cuti tahunan'], medical: ['Medical leave', 'Cuti sakit'], emergency: ['Emergency leave', 'Cuti kecemasan'], unpaid: ['Unpaid leave', 'Cuti tanpa gaji'], maternity: ['Maternity leave', 'Cuti bersalin'], paternity: ['Paternity leave', 'Cuti bapa'] };
  function lt(k) { var x = LT[k]; return x ? L(x[0], x[1]) : (k || ''); }
  function ago(ts) { return (Date.now() - new Date(ts).getTime()) / 36e5; }
  function q(p) { return Promise.resolve(p).then(function (r) { return (r && r.data) || []; }, function () { return []; }); }
  function emps(ids) {
    ids = ids.filter(Boolean); if (!ids.length) return Promise.resolve({});
    return q(sb.from('employees').select('id,name').eq('tenant_id', NT.tid()).in('id', ids)).then(function (a) { var m = {}; a.forEach(function (e) { m[e.id] = e.name; }); return m; });
  }
  function esc24(it, created) {
    if (created && ago(created) >= 24) { it.late = 1; if (NT.role() === 'owner' || NT.isPA()) { it.prio = 1; it.esc = 1; } }
    return it;
  }
  NT.loadLive = function () {
    var tid = NT.tid(), out = [], adm = NT.isAdm(), hr = NT.hr(), today = NT.day(), jobs = [];
    var self = typeof _hrResolveSelfEmployee === 'function' ? _hrResolveSelfEmployee().catch(function () { return null; }) : Promise.resolve(null);
    if (adm) jobs.push(q(sb.from('leave_requests').select('id,employee_id,start_date,end_date,leave_type,days_count,created_at').eq('tenant_id', tid).eq('status', 'pending').limit(20)).then(function (a) {
      return emps(a.map(function (x) { return x.employee_id; })).then(function (m) {
        a.forEach(function (x) { out.push(esc24({ key: 'leave:' + x.id, kind: 'action', cat: 'approval', icon: 'ti-calendar-event', color: 'var(--primary)', ts: x.created_at, title: L('Leave ', 'Leave ') + (m[x.employee_id] || '—') + ' · ' + lt(x.leave_type) + (x.days_count ? ' ' + x.days_count + L(' day(s)', ' hari') : ''), meta: dd(x.start_date) + (x.end_date && x.end_date !== x.start_date ? ' – ' + dd(x.end_date) : '') + ' · ' + L('awaiting your approval', 'menunggu kelulusan kau'),
          go: ['hr', { view: 'leave' }], acts: [['approve', 'leave', x.id], ['reject', 'leave', x.id]] }, x.created_at)); });
      });
    }));
    if (hr) jobs.push(self.then(function (me) {
      return q(sb.from('outstation_requests').select('id,employee_id,start_date,end_date,location,created_at').eq('tenant_id', tid).eq('status', 'pending').is('deleted_at', null).limit(20)).then(function (a) {
        a = a.filter(function (x) { return !(me && NT.same(x.employee_id, me.id)); });
        return emps(a.map(function (x) { return x.employee_id; })).then(function (m) {
          a.forEach(function (x) { out.push(esc24({ key: 'os:' + x.id, kind: 'action', cat: 'approval', icon: 'ti-map-pin', color: 'var(--warning)', ts: x.created_at, title: 'Outstation ' + (m[x.employee_id] || '—'), meta: (x.start_date || '') + ' → ' + (x.end_date || '') + ' · ' + (x.location || ''), go: ['hr', { view: 'attendance' }], acts: [['approve', 'os', x.id], ['reject', 'os', x.id]] }, x.created_at)); });
        });
      });
    }));
    if (adm) jobs.push(q(sb.from('cash_advances').select('*').eq('tenant_id', tid).eq('status', 'pending').is('deleted_at', null).limit(20)).then(function (a) {
      return emps(a.map(function (x) { return x.employee_id; })).then(function (m) {
        a.forEach(function (x) { out.push(esc24({ key: 'adv:' + x.id, kind: 'action', cat: 'approval', icon: 'ti-cash', color: 'var(--primary)', ts: x.created_at, title: L('Advance ', 'Pendahuluan ') + (m[x.employee_id] || '—') + ' · ' + rm(x.amount), meta: L('awaiting your approval', 'menunggu kelulusan kau'), go: ['hr', { view: 'advance' }], acts: [['approve', 'adv', x.id], ['reject', 'adv', x.id]] }, x.created_at)); });
      });
    }));
    if (adm) jobs.push(q(sb.from('expense_claims').select('id,ref_no,total_amount,description,claimed_by,created_at').eq('tenant_id', tid).eq('status', 'pending').is('deleted_at', null).limit(20)).then(function (a) {
      a.filter(function (x) { return !NT.same(x.claimed_by, NT.uid()); }).forEach(function (x) { out.push(esc24({ key: 'claim:' + x.id, kind: 'action', cat: 'approval', icon: 'ti-receipt-2', color: 'var(--primary)', ts: x.created_at, title: L('Expense claim ', 'Tuntutan ') + (x.ref_no || '') + ' · ' + rm(x.total_amount), meta: String(x.description || '').slice(0, 80), go: ['accounting', { view: 'exp-form', id: x.id }], acts: [['approve', 'claim', x.id], ['reject', 'claim', x.id]] }, x.created_at)); });
    }));
    /* Salary Disbursement signed return — live Action (Leave pattern). No inline Approve; must open file via Review modal. */
    if (hr) jobs.push(q(sb.from('sd_approvals').select('id,approver_name,created_at,batch_id').eq('tenant_id', tid).eq('status', 'pending').is('deleted_at', null).order('created_at', { ascending: false }).limit(20)).then(function (a) {
      if (!a.length) return;
      var bids = [];
      a.forEach(function (x) { if (x.batch_id && bids.indexOf(x.batch_id) < 0) bids.push(x.batch_id); });
      return q(sb.from('salary_disbursement_batches').select('id,month,year').eq('tenant_id', tid).in('id', bids)).then(function (bs) {
        var bm = {}; (bs || []).forEach(function (b) { bm[b.id] = b; });
        var enM = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var bmM = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogos','Sep','Okt','Nov','Dis'];
        a.forEach(function (x) {
          var b = bm[x.batch_id] || {};
          var mi = Math.max(0, Math.min(11, (Number(b.month) || 1) - 1));
          var period = L(enM[mi], bmM[mi]) + (b.year ? ' ' + b.year : '');
          out.push(esc24({
            key: 'sdsig:' + x.id,
            kind: 'action',
            cat: 'approval',
            icon: 'ti-signature',
            color: 'var(--warning)',
            ts: x.created_at,
            title: L('Salary signature · ', 'Tandatangan gaji · ') + (x.approver_name || '—') + (period ? ' · ' + period : ''),
            meta: L('awaiting your review', 'menunggu semakan kau'),
            go: ['hr', { view: 'salary-disbursement', month: b.month, year: b.year, review: x.id }]
          }, x.created_at));
        });
      });
    }));
    /* OT claims pending — live Action (Leave/SD pattern). No inline Approve (hours prompt lives on OT Approvals page). */
    if (typeof _otIsApproverUser === 'function' && _otIsApproverUser()) jobs.push(self.then(function (me) {
      var isOwner = typeof _otIsOwnerUser === 'function' && _otIsOwnerUser();
      return q(sb.from('ot_claims').select('id,employee_id,claim_date,day_type,ot_hours,amount,created_at').eq('tenant_id', tid).eq('status', 'pending').is('deleted_at', null).order('claim_date', { ascending: false }).limit(20)).then(function (a) {
        if (!isOwner && me) a = a.filter(function (x) { return !NT.same(x.employee_id, me.id); });
        return emps(a.map(function (x) { return x.employee_id; })).then(function (m) {
          var DT = { normal: ['Normal', 'Biasa'], restday: ['Rest day', 'Hari rehat'], holiday: ['Public holiday', 'Cuti umum'] };
          a.forEach(function (x) {
            var dt = DT[x.day_type] || [x.day_type || '', x.day_type || ''];
            out.push(esc24({
              key: 'ot:' + x.id,
              kind: 'action',
              cat: 'approval',
              icon: 'ti-clock-dollar',
              color: 'var(--warning)',
              ts: x.created_at || x.claim_date,
              title: L('OT approval · ', 'Kelulusan OT · ') + (m[x.employee_id] || '—') + ' · ' + rm(x.amount),
              meta: dd(x.claim_date) + ' · ' + L(dt[0], dt[1]) + (x.ot_hours != null ? ' · ' + x.ot_hours + L(' hrs', ' jam') : '') + ' · ' + L('awaiting your approval', 'menunggu kelulusan kau'),
              go: ['hr', { view: 'ot-approvals' }]
            }, x.created_at || x.claim_date));
          });
        });
      });
    }));
    if (adm) jobs.push(q(sb.from('invoices').select('id,ref_no,customer_name,total,paid_amt,due_date').eq('tenant_id', tid).is('deleted_at', null).neq('status', 'paid').neq('status', 'cancelled').lt('due_date', today).order('due_date', { ascending: true }).limit(50)).then(function (a) {
      if (!a.length) return; var tot = 0, cs = [];
      a.forEach(function (x) { tot += Number(x.total || 0) - Number(x.paid_amt || 0); if (cs.indexOf(x.customer_name) < 0) cs.push(x.customer_name); });
      var old = Math.round((Date.now() - new Date(a[0].due_date).getTime()) / 864e5);
      out.push({ key: 'ov:' + today.slice(0, 7), kind: 'action', cat: 'overdue', icon: 'ti-file-invoice', color: 'var(--danger)', ts: Date.now() - 36e5, count: a.length, title: L('Overdue invoices ×', 'Invois overdue ×') + a.length + ' · ' + rm(tot),
        meta: cs.slice(0, 2).join(', ') + (cs.length > 2 ? ' +' + (cs.length - 2) + L(' more', ' lagi') : '') + ' · ' + L('oldest ', 'tertua ') + old + L(' days', ' hari'), go: a.length === 1 ? ['sales', { view: 'inv-detail', id: a[0].id }] : ['sales', {}], snooze: 1 });
    }));
    if (adm || NT.isPA()) jobs.push(q(NT.isPA() ? sb.from('service_contracts').select('*').is('deleted_at', null).gte('end_date', today).limit(200) : sb.from('service_contracts').select('*').eq('tenant_id', tid).is('deleted_at', null).gte('end_date', today).limit(50)).then(function (a) {
      a.forEach(function (x) { var d = Math.round((new Date(x.end_date).getTime() - new Date(today).getTime()) / 864e5); if (d > 30) return;
        out.push({ key: 'ctr:' + x.id + ':' + (d <= 7 ? 7 : d <= 14 ? 14 : 30), kind: 'for_you', cat: 'contract', icon: 'ti-file-time', color: d <= 7 ? 'var(--danger)' : 'var(--warning)', ts: Date.now() - 2 * 36e5, prio: d <= 7 ? 1 : 0, title: L('Service contract ends in ', 'Kontrak servis tamat dalam ') + d + L(' days', ' hari'), meta: (x.title || '') + ' · ' + dd(x.end_date), go: NT.isPA() ? ['admin', { view: 'sd_contracts' }] : ['servis_saya', {}] }); });
    }));
    var tn = window.APP && APP.tenant;
    if (NT.role() === 'owner' && tn && (tn.plan_expires_at || tn.trial_ends_at)) {
      var ex = tn.trial_ends_at || tn.plan_expires_at, dl = Math.ceil((new Date(ex).getTime() - Date.now()) / 864e5), show = true;
      try { if (!tn.trial_ends_at) show = _shouldShowMyPlanExpiry(tn, null); } catch (e) {}
      if (show && dl >= 0 && dl <= 14) out.push({ key: 'bill:' + NT.day(ex) + ':' + (dl <= 3 ? 3 : dl <= 7 ? 7 : 14), kind: 'for_you', cat: 'contract', icon: 'ti-credit-card', color: 'var(--warning)', ts: Date.now() - 3 * 36e5, prio: dl <= 3 ? 1 : 0, title: (tn.trial_ends_at ? L('Trial ends in ', 'Percubaan tamat dalam ') : L('M-Core plan renews in ', 'Pelan M-Core tamat dalam ')) + dl + L(' days', ' hari'), meta: dd(ex), go: ['settings', {}] });
    }
    if (NT.isPA()) jobs.push(q(sb.from('service_requests').select('id,ref_no,title,status,created_at,tenant_id').is('deleted_at', null).in('status', ['submitted','triaged','in_progress']).order('created_at', { ascending: false }).limit(30)).then(function (a) {
      return q(sb.from('tenants').select('id,name')).then(function (tn) {
        var nm = {}; (tn || []).forEach(function (t) { nm[t.id] = t.name; });
        var muted = {}; try { JSON.parse(localStorage.getItem('mcore_nt_mute_' + NT.uid()) || '[]').forEach(function (k) { muted[k] = 1; }); } catch (e) {}
        var by = {};
        a.forEach(function (x) {
          if (muted[x.tenant_id]) return;
          var g = by[x.tenant_id] = by[x.tenant_id] || [];
          g.push(x);
        });
        Object.keys(by).forEach(function (tid) {
          var g = by[tid], x = g[0], n = g.length;
          var title = (nm[tid] || '') + (n > 1 ? L(' · ', ' · ') + n + L(' open', ' terbuka') : L(' · open', ' · terbuka'));
          var meta = n > 1 ? g.slice(0, 3).map(function (r) { return r.ref_no; }).join(', ') : ((x.ref_no || '') + ' · ' + (x.title || ''));
          out.push(esc24({ key: 'sd:' + tid, kind: 'action', cat: 'sd', icon: 'ti-headset', color: 'var(--primary)', ts: x.created_at, title: title, meta: meta, go: ['admin', { view: 'sd_desk', id: n > 1 ? null : x.id }], tenant: tid }, x.created_at));
        });
      });
    }));
    if (NT.isPA()) jobs.push(q(sb.from('content_posts').select('id').eq('status', 'planned').limit(50)).then(function (a) {
      if (a.length) out.push({ key: 'cp:' + today, kind: 'for_you', cat: 'assigned', icon: 'ti-calendar-star', color: 'var(--primary)', ts: new Date(today + 'T00:30:00').getTime(), title: L('Content Planner: ', 'Content Planner: ') + a.length + L(' planned posts', ' post dirancang'), meta: L('Today', 'Hari ini'), go: ['admin', { view: 'content-planner' }] });
    }));
    jobs.push(self.then(function (me) {
      if (!me) return;
      return q(sb.from('project_tasks').select('id,project_id,title,due_date,column_key').eq('tenant_id', tid).eq('assignee_employee_id', me.id).is('deleted_at', null).neq('column_key', 'done').lte('due_date', today).limit(20)).then(function (a) {
        a.forEach(function (x) { var od = String(x.due_date).slice(0, 10) < today; out.push({ key: 'task:' + x.id + ':' + today, kind: 'for_you', cat: 'assigned', icon: od ? 'ti-alarm' : 'ti-checklist', color: od ? 'var(--danger)' : 'var(--warning)', ts: new Date(today + 'T00:10:00').getTime(), title: (od ? L('Overdue task: ', 'Task lewat: ') : L('Due today: ', 'Tarikh akhir hari ni: ')) + x.title, meta: L('Projects · due ', 'Projek · akhir ') + dd(x.due_date), go: ['projects', { id: x.project_id }] }); });
      });
    }));
    return Promise.all(jobs).then(function () { out.forEach(function (it) { it.live = 1; it.ts = new Date(it.ts).getTime(); }); NT.live = out; return out; });
  };
  /* inline actions reuse existing approval functions (same permission checks, journals, Telegram, audit) */
  NT.doAct = function (a, kind, id) {
    var st = a === 'approve' ? 'approved' : 'rejected';
    if (kind === 'leave' && typeof _leaveSetStatus === 'function') return Promise.resolve(_leaveSetStatus(id, st));
    if (kind === 'os' && typeof _attReviewOutstation === 'function') return Promise.resolve(_attReviewOutstation(id, st));
    if (kind === 'adv' && typeof _advSetStatus === 'function') return Promise.resolve(_advSetStatus(id, st));
    if (kind === 'claim') return Promise.resolve(window.openPage('accounting', { view: 'exp-form', id: id })).then(function () {
      [300, 900, 1800].forEach(function (t) { setTimeout(function () { var s = document.getElementById('ef-status'); if (s && s.value !== st) { s.value = st; s.style.outline = '2px solid var(--primary)'; try { showToast(NT.L('Status set — press Save to confirm', 'Status dipilih — tekan Simpan untuk sahkan'), 'info'); } catch (e) {} } }, t); });
    });
    return Promise.resolve();
  };
})();
