/* Employee nickname — form field + dashboard labels */
(function () {
  function label(e) {
    if (!e) return 'Staff';
    var n = String(e.nickname || '').trim();
    return n || e.name || 'Staff';
  }
  function initials(name) {
    return String(name || 'S').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) {
      return w.charAt(0);
    }).join('').toUpperCase();
  }
  async function loadMap() {
    if (!window.sb || !window.APP || !APP.tenant || !APP.tenant.id) return [];
    var res = await sb.from('employees').select('id,name,nickname')
      .eq('tenant_id', APP.tenant.id).is('deleted_at', null).limit(400);
    if (res.error && /nickname/i.test(res.error.message || '')) {
      res = await sb.from('employees').select('id,name')
        .eq('tenant_id', APP.tenant.id).is('deleted_at', null).limit(400);
    }
    return res.data || [];
  }
  function injectForm(emp) {
    if (document.getElementById('emp-nickname')) {
      if (emp) document.getElementById('emp-nickname').value = emp.nickname || '';
      return;
    }
    var nameEl = document.getElementById('emp-name');
    if (!nameEl) return;
    var group = nameEl.closest('.form-group') || nameEl.parentNode;
    var wrap = document.createElement('div');
    wrap.className = 'form-group';
    wrap.style.gridColumn = '1 / -1';
    var isBm = APP.language === 'bm';
    wrap.innerHTML = '<label class="form-label">' + (isBm ? 'Nama panggilan' : 'Nickname') +
      '</label><input id="emp-nickname" class="form-input" maxlength="40" placeholder="' +
      (isBm ? 'Contoh: Hafizh / Mike' : 'e.g. Hafizh / Mike') + '" value="">' +
      '<div style="font-size:11px;color:var(--text-3);margin-top:4px">' +
      (isBm ? 'Dipapar pada People, Attendance Tracker dan Top Sales Person' :
        'Shown on People, Attendance Tracker and Top Sales Person') + '</div>';
    group.parentNode.insertBefore(wrap, group.nextSibling);
    if (emp) document.getElementById('emp-nickname').value = emp.nickname || '';
  }
  function wrapForm() {
    var orig = window.renderEmployeeForm;
    if (typeof orig !== 'function') return;
    window.renderEmployeeForm = async function (id) {
      var r = await orig.apply(this, arguments);
      var emp = null;
      if (id && window.sb) {
        var q = await sb.from('employees').select('*').eq('id', id).eq('tenant_id', APP.tenant.id).maybeSingle();
        emp = q.data;
      }
      injectForm(emp);
      return r;
    };
  }
  function wrapSave() {
    var orig = window._employeeSave;
    if (typeof orig !== 'function') return;
    window._employeeSave = async function (id) {
      var r = await orig.apply(this, arguments);
      var nickEl = document.getElementById('emp-nickname');
      if (!nickEl || !window.sb) return r;
      var nick = nickEl.value.trim() || null;
      var empId = id;
      if (!empId) {
        var name = (document.getElementById('emp-name') || {}).value;
        var q = await sb.from('employees').select('id').eq('tenant_id', APP.tenant.id).eq('name', name)
          .is('deleted_at', null).order('created_at', { ascending: false }).limit(1);
        empId = q.data && q.data[0] && q.data[0].id;
      }
      if (!empId) return r;
      var up = await sb.from('employees').update({ nickname: nick }).eq('id', empId).eq('tenant_id', APP.tenant.id);
      if (up.error && /nickname/i.test(up.error.message || '')) {
        console.warn('nickname column missing — run SQL');
      }
      return r;
    };
  }
  function wrapTopSales() {
    var orig = window._scLoadEmployees;
    if (typeof orig !== 'function') return;
    window._scLoadEmployees = async function () {
      var rows = await loadMap();
      return rows.map(function (e) { return { id: e.id, name: label(e) }; });
    };
  }
  function relabelPeople(rows) {
    var el = document.getElementById('db-people-list');
    if (!el) return;
    var byName = {};
    rows.forEach(function (e) { if (e.name) byName[e.name] = e; });
    el.querySelectorAll('div[style*="font-weight:600"]').forEach(function (div) {
      var cur = (div.textContent || '').trim();
      var e = byName[cur];
      if (!e) return;
      var lab = label(e);
      if (lab === cur) return;
      div.textContent = lab;
      var avatar = div.parentNode && div.parentNode.previousElementSibling;
      if (avatar && avatar.style && avatar.style.borderRadius === '50%') avatar.textContent = initials(lab);
    });
  }
  function relabelTracker(rows) {
    var el = document.getElementById('db-att-tracker');
    if (!el) return;
    var byName = {};
    rows.forEach(function (e) { if (e.name) byName[e.name] = e; });
    el.querySelectorAll('tbody td:first-child').forEach(function (td) {
      var cur = (td.getAttribute('title') || td.textContent || '').trim();
      var e = byName[cur];
      if (!e) return;
      var lab = label(e);
      td.setAttribute('title', lab);
      td.textContent = lab;
    });
  }
  function wrapDash() {
    [[' _dbLoadPeople', '_dbLoadPeople', relabelPeople], ['_dbLoadAttTracker', '_dbLoadAttTracker', relabelTracker], ['_dbRenderTopSalesPerson', '_dbRenderTopSalesPerson', null]].forEach(function (item) {
      var name = item[1], after = item[2];
      var orig = window[name];
      if (typeof orig !== 'function') return;
      window[name] = async function () {
        var r = await orig.apply(this, arguments);
        if (after) {
          try { after(await loadMap()); } catch (e) {}
        }
        return r;
      };
    });
  }
  function boot() {
    wrapForm();
    wrapSave();
    wrapTopSales();
    wrapDash();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
