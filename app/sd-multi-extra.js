/* M-Core Service Desk - multi-request extras: admin CSV with group_ref, monthly report 'Group summary', public link
   multi-service (approve -> one group, one bell; quota shown per group). Off until sd_multi_01.sql is live. */
(function () {
  var SD = window.SD, MG = SD && SD.MG; if (!MG || SD._mgX) return; SD._mgX = 1;
  /* CSV: same columns as sd-board plus group_ref */
  SD.mgCsv = function (m, S, G, vis) {
    var b = m.querySelector('#sd-csv'); if (!b) return;
    b.onclick = function () {
      var cell = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lines = [['ref_no', 'group_ref', 'client', 'service', 'title', 'status', 'priority', 'created_at', 'sla_due', 'assigned']].concat((vis && vis.length ? S.rows.filter(function (r) { return vis.indexOf(r.id) >= 0; }) : S.rows).map(function (r) { var d = SD.due(r); return [r.ref_no, r.group_id && G[r.group_id] ? G[r.group_id].ref_no : '', S.tn[r.tenant_id], SD.svcName(r.service_code), r.title, r.status, r.priority, r.created_at, d ? d.toISOString() : '', S.names[r.assigned_to] || '']; }));
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.map(function (l) { return l.map(cell).join(','); }).join('\n')], { type: 'text/csv' }));
      a.download = 'service-desk-' + SD.today() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    };
  };
  /* monthly report: Group summary card after the SLA card (same markup, so print/PDF keeps the pack style) */
  var rep = SD.view.laporan_bulanan;
  if (rep) SD.view.laporan_bulanan = function (p) {
    return Promise.resolve(rep(p)).then(function (x) {
      MG.probe().then(function (on) {
        var s = document.getElementById('sd-m'), sla = document.getElementById('sd-r-sla'); if (!on || !s || !sla || document.getElementById('sd-r-grp')) return;
        var mo = String(s.value).slice(0, 7), a = new Date(Date.parse(mo + '-01T00:00:00+08:00')), b = new Date(a.getFullYear(), a.getMonth() + 1, 1);
        var start = new Date(Date.parse(mo + '-01T00:00:00+08:00')).toISOString(), end = new Date(Date.parse(b.getFullYear() + '-' + String(b.getMonth() + 1).padStart(2, '0') + '-01T00:00:00+08:00')).toISOString();
        sla.insertAdjacentHTML('afterend', '<div class="cob-card" style="padding:16px;margin-bottom:12px" id="sd-r-grp"><b style="font-size:15px"><i class="ti ti-stack-2"></i> ' + SD.L('Group summary', 'Ringkasan kumpulan') + '</b><div style="margin-top:10px;overflow-x:auto"><div class="spinner"></div></div></div>');
        sb.from('service_request_groups').select('id,created_at,rating').eq('tenant_id', SD.tid()).is('deleted_at', null).gte('created_at', start).lt('created_at', end).then(function (g) {
          var gs = g.data || [], box = document.querySelector('#sd-r-grp > div');
          if (!gs.length) { if (box) box.innerHTML = '<span class="cob-xs">' + SD.L('No multi-service requests this month', 'Tiada permohonan berbilang servis bulan ini') + '</span>'; return; }
          return sb.from('service_requests').select('group_id,status,delivered_at,closed_at').in('group_id', gs.map(function (z) { return z.id; })).is('deleted_at', null).then(function (r) {
            var rows = r.data || [], done = 0, hrs = [], n = 0, rt = gs.filter(function (z) { return z.rating; });
            gs.forEach(function (z) {
              var m = rows.filter(function (q) { return SD.same(q.group_id, z.id); }), pr = MG.prog(m); n += m.length;
              if (pr.st === 'completed') { done++; var last = m.map(function (q) { return q.delivered_at || q.closed_at; }).filter(Boolean).sort().pop(); if (last) hrs.push(SD.bhBetween(z.created_at, last)); }
            });
            var st = [[SD.L('Groups', 'Kumpulan'), gs.length], [SD.L('Avg requests / group', 'Purata permohonan / kumpulan'), (n / gs.length).toFixed(1)], [SD.L('Groups completed', 'Kumpulan selesai'), Math.round(done / gs.length * 100) + '%'], [SD.L('Avg group completion', 'Purata siap kumpulan'), hrs.length ? Math.round(hrs.reduce(function (s, h) { return s + h; }, 0) / hrs.length) + SD.L(' h', ' j') : '—']];
            if (rt.length) st.push([SD.L('Avg rating', 'Purata rating'), (rt.reduce(function (s, z) { return s + z.rating; }, 0) / rt.length).toFixed(1) + ' / 5']);
            if (box) box.innerHTML = '<div class="sd-sum">' + st.map(function (x) { return '<div><div class="cob-xs">' + x[0] + '</div><b style="font-size:16px">' + x[1] + '</b></div>'; }).join('') + '</div>';
          });
        });
      });
      return x;
    });
  };
  /* public link: approving a row of a multi-service submission joins/creates its group; bell only on the first approval */
  SD.mgPub = function (r) {
    if (!r || !r.group_key) return Promise.resolve(null);
    return MG.probe().then(function (on) {
      if (!on) return null;
      return sb.from('service_public_requests').select('id', { count: 'exact', head: true }).eq('tenant_id', r.tenant_id).eq('group_key', r.group_key).then(function (c) {
        if (!c || c.error || (c.count || 0) < 2) return null;
        var find = function () { return sb.from('service_request_groups').select('id').eq('tenant_id', r.tenant_id).eq('pub_group_key', r.group_key).is('deleted_at', null).limit(1).then(function (x) { return x.data && x.data[0]; }); };
        return find().then(function (g) {
          if (g) return { gid: g.id, first: false };
          return MG.createGroup({ tenant_id: r.tenant_id, title: r.title, source: 'public', pub_group_key: r.group_key }).then(function (n) { return { gid: n.id, first: true, ref: n.ref_no }; }, function () { return find().then(function (g2) { return g2 ? { gid: g2.id, first: false } : null; }); });
        });
      });
    }, function () { return null; });
  };
  /* owner quota card: 1 quota per group (rows without group_key count 1 each), same as the RLS check */
  var pl = SD.pubLoad;
  if (pl) SD.pubLoad = function () {
    return Promise.resolve(pl.apply(this, arguments)).then(function (x) {
      return MG.probe().then(function (on) {
        var l = SD.pub && SD.pub.link; if (!on || !l) return x;
        return sb.from('service_public_requests').select('id,group_key').eq('link_id', l.id).gte('created_at', SD.monthIso()).then(function (r) {
          if (r && !r.error) { var k = {}; (r.data || []).forEach(function (q) { k[q.group_key || q.id] = 1; }); SD.pub.used = Object.keys(k).length; }
          return x;
        });
      });
    });
  };
})();
