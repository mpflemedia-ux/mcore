/* M-Core Service Desk - Admin "Agent" tab: master switch, per-tenant enable+services, sd_agent_runs
   audit log. Needs supabase/sd_agent_01.sql + sd_agent_02.sql. Hidden until sd_agent_settings exists
   (SD.has.agent probe in sd-core.js). */
(function () {
  var SD = window.SD; if (!SD || SD._agentAdmin) return; SD._agentAdmin = 1;
  var ST = { catalog: [], master: null, paTenantId: null, tenants: [], runs: [], runFilter: 'all', selTenantId: '', selRow: null };
  function tenantLabel(t) { return (t && t.name || '') + (t && t.code ? ' (' + t.code + ')' : ''); }

  function loadMaster() {
    return sb.from('user_profiles').select('tenant_id').eq('role', 'platform_admin').order('created_at', { ascending: true }).limit(1).maybeSingle()
      .then(function (pa) {
        var tid = pa.data && pa.data.tenant_id;
        ST.paTenantId = tid || null;
        if (!tid) return null;
        return sb.from('sd_agent_settings').select('*').eq('tenant_id', tid).maybeSingle().then(function (r) { return r.data || { tenant_id: tid, enabled: false, services: [] }; });
      });
  }
  function loadRuns() {
    var q = sb.from('sd_agent_runs').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(50);
    if (ST.runFilter !== 'all') q = q.eq('status', ST.runFilter);
    return q.then(function (r) { return r.data || []; });
  }
  function loadTenantRow(tid) {
    if (!tid) return Promise.resolve(null);
    return sb.from('sd_agent_settings').select('*').eq('tenant_id', tid).maybeSingle().then(function (r) { return r.data || { tenant_id: tid, enabled: false, services: [] }; });
  }

  SD.admin.sd_agent = function () {
    return Promise.all([SD.catalog(), loadMaster(), loadRuns(), sb.from('tenants').select('id,name,code').is('deleted_at', null).order('name')]).then(function (x) {
      ST.catalog = x[0] || []; ST.master = x[1]; ST.runs = x[2]; ST.tenants = (x[3] && x[3].data) || [];
      paint();
    });
  };

  function svcList(selected, prefix) {
    return '<div class="sd-pick" id="' + prefix + '-svcs">' + ST.catalog.map(function (c) {
      return '<label><input type="checkbox" value="' + SD.esc(c.code) + '"' + ((selected || []).indexOf(c.code) >= 0 ? ' checked' : '') + '><span>' + SD.esc(SD.L(c.name_en, c.name_bm)) + '</span></label>';
    }).join('') + '</div>';
  }
  var STATUS_COLOR = { ok: 'green', error: 'red', skipped: 'gray' };

  function runRow(run) {
    var t = (ST.tenants || []).find(function (x) { return SD.same(x.id, run.tenant_id); });
    return '<div class="cob-card" style="padding:10px 12px;margin-bottom:6px"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">' +
      '<span class="badge badge-' + (STATUS_COLOR[run.status] || 'gray') + '">' + SD.esc(run.status) + '</span>' +
      '<b style="font-size:13px">' + SD.esc(run.action) + '</b>' +
      (t ? '<span class="cob-xs">' + SD.esc(t.name) + '</span>' : '') +
      '<span class="cob-xs" style="margin-left:auto;white-space:nowrap">' + SD.dt(run.created_at) + '</span></div>' +
      (run.detail && Object.keys(run.detail).length ? '<div class="cob-xs" style="margin-top:4px;overflow-wrap:anywhere">' + SD.esc(JSON.stringify(run.detail)) + '</div>' : '') + '</div>';
  }

  function paint() {
    var m = SD.main(); if (!m) return;
    var isBm = SD.bm();
    var rotated = ST.master && ST.master.secret_rotated_at ? new Date(ST.master.secret_rotated_at) : null;
    var days = rotated ? Math.floor((Date.now() - rotated.getTime()) / 864e5) : null;
    var warn = days != null && days > 30;
    var selTenant = ST.tenants.find(function (t) { return t.id === ST.selTenantId; });
    var tenantDl = '<datalist id="sd-agent-tl">' + ST.tenants.map(function (t) { return '<option value="' + SD.esc(tenantLabel(t)) + '">'; }).join('') + '</datalist>';
    m.innerHTML = '<div class="cob-root">' + SD.head(SD.L('Admin — Service Desk Agent', 'Admin — Agent Service Desk'), SD.L('External SR-processing agent: master switch, per-tenant access, run log', 'Agent pemprosesan SR luaran: suis induk, akses per-tenant, log larian')) + SD.tabs('sd_agent') +
      '<div class="cob-card" style="padding:16px;margin-bottom:16px;border-left:3px solid var(--primary)">' +
      '<div class="row" style="gap:8px;align-items:flex-start"><i class="ti ti-info-circle" style="color:var(--primary);margin-top:2px"></i><div>' +
      '<b style="font-size:14px">' + SD.L('How the agent runs', 'Macam mana agent ni jalan') + '</b>' +
      '<p class="cob-xs" style="margin-top:4px">' + SD.L(
        'This agent lives outside M-Core — a scheduled Claude task that runs automatically every hour, calling the sd-agent backend to process any Service Request that needs a draft.',
        'Agent ni berada di luar M-Core — satu scheduled Claude task yang jalan automatik setiap jam, memanggil backend sd-agent untuk proses mana-mana Service Request yang perlukan draf.'
      ) + '</p>' +
      '<p class="cob-xs" style="margin-top:6px">' + SD.L(
        'To run it right now instead of waiting for the next hour: go to ',
        'Untuk jalankan dia sekarang tanpa tunggu sejam: pergi '
      ) + '<b>claude.ai</b> → <b>' + SD.L('Scheduled tasks', 'Scheduled tasks') + '</b> (' + SD.L('also called Routines', 'juga dipanggil Routines') + ') → ' + SD.L('find', 'cari') + ' <b>"M-Core Service Desk — SR Agent (hourly)"</b> → ' + SD.L('tap', 'tekan') + ' <b>"Run now"</b>.</p>' +
      '</div></div></div>' +
      '<div class="cob-card" style="padding:16px;margin-bottom:16px">' +
      '<div class="row" style="justify-content:space-between;align-items:center;gap:10px"><div><b style="font-size:15px">' + SD.L('Master switch', 'Suis induk') + '</b><div class="cob-xs" style="margin-top:2px">' + SD.L('Turns the agent off for every tenant at once, regardless of per-tenant settings.', 'Matikan agent untuk semua tenant sekali gus, tanpa kira tetapan per-tenant.') + '</div></div>' +
      '<label class="row cob-sm" style="gap:8px;align-items:center;white-space:nowrap"><input type="checkbox" id="sd-agent-master"' + (ST.master && ST.master.enabled ? ' checked' : '') + '> ' + SD.L('Enabled', 'Dibenarkan') + '</label></div>' +
      (ST.master && ST.master.enabled ? '<div style="margin-top:10px"><div class="cob-xs" style="font-weight:700;margin-bottom:6px">' + SD.L('Allowed services (platform tenant)', 'Servis dibenarkan (tenant platform)') + '</div>' + svcList(ST.master && ST.master.services, 'sd-agent-master') + '</div>' : '') +
      '<div class="row" style="justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);gap:8px;flex-wrap:wrap"><div class="cob-xs">' +
      (rotated ? SD.L('Secret last rotated ', 'Secret terakhir ditukar ') + days + SD.L(' days ago', ' hari lalu') : SD.L('Secret rotation date not recorded yet.', 'Tarikh pertukaran secret belum direkod.')) +
      (warn ? ' <span class="badge badge-red">' + SD.L('Rotate soon', 'Tukar tak lama lagi') + '</span>' : '') + '</div>' +
      '<button class="btn btn-outline btn-sm" id="sd-agent-rotated"><i class="ti ti-key"></i> ' + SD.L('Mark secret just rotated', 'Tanda secret baru ditukar') + '</button></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm" id="sd-agent-master-save"><i class="ti ti-device-floppy"></i> ' + SD.L('Save', 'Simpan') + '</button></div></div>' +
      '<div class="cob-card" style="padding:16px;margin-bottom:16px"><b style="font-size:15px">' + SD.L('Per-tenant access', 'Akses per-tenant') + '</b>' +
      '<div class="form-group" style="margin-top:10px"><input class="form-input" data-no-titlecase="1" id="sd-agent-tenant-pick" list="sd-agent-tl" placeholder="' + SD.L('Type to search…', 'Taip untuk cari…') + '" value="' + SD.esc(selTenant ? tenantLabel(selTenant) : '') + '">' + tenantDl + '</div>' +
      '<div id="sd-agent-tenant-panel">' + (ST.selRow ? tenantPanel() : '') + '</div></div>' +
      '<div class="cob-card" style="padding:16px"><div class="row" style="justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b style="font-size:15px">' + SD.L('Run log', 'Log larian') + '</b>' +
      '<select class="form-select" id="sd-agent-run-filter" style="width:auto"><option value="all"' + (ST.runFilter === 'all' ? ' selected' : '') + '>' + SD.L('All', 'Semua') + '</option><option value="ok"' + (ST.runFilter === 'ok' ? ' selected' : '') + '>OK</option><option value="error"' + (ST.runFilter === 'error' ? ' selected' : '') + '>Error</option><option value="skipped"' + (ST.runFilter === 'skipped' ? ' selected' : '') + '>Skipped</option></select></div>' +
      '<div style="margin-top:10px;max-height:420px;overflow-y:auto">' + (ST.runs.length ? ST.runs.map(runRow).join('') : '<div class="cob-xs" style="text-align:center;padding:20px 0">' + SD.L('No runs yet.', 'Tiada larian lagi.') + '</div>') + '</div></div></div>';
    wire();
  }

  function tenantPanel() {
    var r = ST.selRow;
    return '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">' +
      '<label class="row cob-sm" style="gap:8px;align-items:center"><input type="checkbox" id="sd-agent-t-enabled"' + (r.enabled ? ' checked' : '') + '> ' + SD.L('Enabled for this tenant', 'Dibenarkan untuk tenant ini') + '</label>' +
      '<div style="margin-top:10px">' + svcList(r.services, 'sd-agent-t') + '</div>' +
      '<button class="btn btn-primary btn-sm" id="sd-agent-t-save" style="margin-top:10px"><i class="ti ti-device-floppy"></i> ' + SD.L('Save', 'Simpan') + '</button></div>';
  }

  function checkedVals(sel) { return [].map.call(document.querySelectorAll(sel + ' input:checked'), function (x) { return x.value; }); }

  function wire() {
    var m = SD.main(); if (!m) return;
    var ms = m.querySelector('#sd-agent-master-save'); if (ms) ms.onclick = function () {
      ms.disabled = true;
      var enabled = m.querySelector('#sd-agent-master').checked;
      var services = checkedVals('#sd-agent-master-svcs');
      var payload = { tenant_id: ST.paTenantId, enabled: enabled, services: services, updated_by: SD.uid(), updated_at: new Date().toISOString() };
      sb.from('sd_agent_settings').upsert(payload, { onConflict: 'tenant_id' }).then(function (x) {
        ms.disabled = false;
        if (x.error) return SD.toast(SD.err(x.error), 'error');
        SD.toast(SD.L('Saved.', 'Disimpan.'), 'success'); SD.admin.sd_agent();
      });
    };
    var rt = m.querySelector('#sd-agent-rotated'); if (rt) rt.onclick = function () {
      if (!confirm(SD.L('Mark the agent secret as just rotated (today)?', 'Tanda secret agent baru ditukar (hari ini)?'))) return;
      sb.from('sd_agent_settings').upsert({ tenant_id: ST.paTenantId, secret_rotated_at: new Date().toISOString() }, { onConflict: 'tenant_id' }).then(function (x) {
        if (x.error) return SD.toast(SD.err(x.error), 'error');
        SD.toast(SD.L('Noted.', 'Dicatat.'), 'success'); SD.admin.sd_agent();
      });
    };
    var pick = m.querySelector('#sd-agent-tenant-pick'); if (pick) pick.oninput = function () {
      var v = (pick.value || '').trim().toLowerCase();
      var t = ST.tenants.find(function (x) { return tenantLabel(x).toLowerCase() === v; });
      if (!t) { if (ST.selTenantId) { ST.selTenantId = ''; ST.selRow = null; m.querySelector('#sd-agent-tenant-panel').innerHTML = ''; } return; }
      if (t.id === ST.selTenantId) return;
      ST.selTenantId = t.id;
      loadTenantRow(t.id).then(function (row) { ST.selRow = row; m.querySelector('#sd-agent-tenant-panel').innerHTML = tenantPanel(); wireTenantSave(); });
    };
    var filt = m.querySelector('#sd-agent-run-filter'); if (filt) filt.onchange = function () { ST.runFilter = filt.value; loadRuns().then(function (r) { ST.runs = r; paint(); }); };
    wireTenantSave();
  }
  function wireTenantSave() {
    var m = SD.main(); if (!m) return;
    var ts = m.querySelector('#sd-agent-t-save'); if (!ts) return;
    ts.onclick = function () {
      ts.disabled = true;
      var enabled = m.querySelector('#sd-agent-t-enabled').checked;
      var services = checkedVals('#sd-agent-t-svcs');
      var payload = { tenant_id: ST.selTenantId, enabled: enabled, services: services, updated_by: SD.uid(), updated_at: new Date().toISOString() };
      sb.from('sd_agent_settings').upsert(payload, { onConflict: 'tenant_id' }).then(function (x) {
        ts.disabled = false;
        if (x.error) return SD.toast(SD.err(x.error), 'error');
        SD.toast(SD.L('Saved.', 'Disimpan.'), 'success');
      });
    };
  }
})();
