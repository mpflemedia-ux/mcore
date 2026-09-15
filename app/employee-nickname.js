/* Employee nickname — form + People / Attendance Tracker / Top Sales */
(function () {
  function label(e) {
    if (!e) return '';
    var n = String(e.nickname || '').trim();
    return n || String(e.name || '').trim();
  }
  function initials(name) {
    return String(name || 'S').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) {
      return w.charAt(0);
    }).join('').toUpperCase();
  }
  function findByLegal(rows, text) {
    var t = String(text || '').replace(/…/g, '').replace(/\.\.\.$/, '').trim();
    if (!t) return null;
    for (var i = 0; i < rows.length; i++) {
      var e = rows[i];
      var nm = String(e.name || '').trim();
      if (!nm) continue;
      if (nm === t || nm.indexOf(t) === 0 || t.indexOf(nm) === 0) return e;
    }
    return null;
  }
  async function loadMap() {
    if (!window.sb || !window.APP || !APP.tenant || !APP.tenant.id) return [];
    var res = await sb.from('employees').select('id,name,nickname')
      .eq('tenant_id', APP.tenant.id).is('deleted_at', null).limit(400);
    if (res.error) {
      console.warn('nickname load', res.error.message);
      return [];
    }
    return res.data || [];
  }
  function injectForm(emp) {
    var nameEl = document.getElementById('emp-name');
    if (!nameEl) return;
    var existing = document.getElementById('emp-nickname');
    if (existing) {
      if (emp) existing.value = emp.nickname || '';
      return;
    }
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
    if (typeof orig !== 'function' || orig._nickWrapped) return;
    var wrapped = async function (id) {
      var r = await orig.apply(this, arguments);
      var emp = null;
      if (id && window.sb) {
        var q = await sb.from('employees').select('*').eq('id', id).eq('tenant_id', APP.tenant.id).maybeSingle();
        emp = q.data;
      }
      injectForm(emp);
      return r;
    };
    wrapped._nickWrapped = true;
    window.renderEmployeeForm = wrapped;
  }
  function wrapSave() {
    var orig = window._employeeSave;
    if (typeof orig !== 'function' || orig._nickWrapped) return;
    var wrapped = async function (id) {
      var nickEl = document.getElementById('emp-nickname');
      var nameEl = document.getElementById('emp-name');
      var nick = nickEl ? (nickEl.value.trim() || null) : undefined;
      var nameSnap = nameEl ? nameEl.value.trim() : '';
      if (id && nick !== undefined && window.sb) {
        var pre = await sb.from('employees').update({ nickname: nick }).eq('id', id).eq('tenant_id', APP.tenant.id);
        if (pre.error) console.warn('nickname pre-save', pre.error.message);
      }
      var r = await orig.apply(this, arguments);
      if (nick !== undefined && window.sb) {
        var empId = id;
        if (!empId && nameSnap) {
          var q = await sb.from('employees').select('id').eq('tenant_id', APP.tenant.id).eq('name', nameSnap)
            .is('deleted_at', null).order('created_at', { ascending: false }).limit(1);
          empId = q.data && q.data[0] && q.data[0].id;
        }
        if (empId) {
          var up = await sb.from('employees').update({ nickname: nick }).eq('id', empId).eq('tenant_id', APP.tenant.id);
          if (up.error) console.warn('nickname save', up.error.message);
        }
      }
      return r;
    };
    wrapped._nickWrapped = true;
    window._employeeSave = wrapped;
  }
  function wrapTopSalesEmployees() {
    var orig = window._scLoadEmployees;
    if (typeof orig !== 'function' || orig._nickWrapped) return;
    var wrapped = async function () {
      var rows = await loadMap();
      return rows.map(function (e) { return { id: e.id, name: label(e) || e.name }; });
    };
    wrapped._nickWrapped = true;
    window._scLoadEmployees = wrapped;
  }
  function relabelPeople(rows) {
    var el = document.getElementById('db-people-list');
    if (!el || !rows.length) return;
    el.querySelectorAll('div[style*="font-weight:600"]').forEach(function (div) {
      var cur = (div.textContent || '').trim();
      var e = findByLegal(rows, cur);
      if (!e) return;
      var lab = label(e);
      if (!lab || lab === cur) return;
      div.textContent = lab;
      var avatar = div.parentNode && div.parentNode.previousElementSibling;
      if (avatar) avatar.textContent = initials(lab);
    });
  }
  function relabelTracker(rows) {
    var el = document.getElementById('db-att-tracker');
    if (!el || !rows.length) return;
    el.querySelectorAll('tbody td:first-child').forEach(function (td) {
      var cur = (td.getAttribute('title') || td.textContent || '').trim();
      var e = findByLegal(rows, cur);
      if (!e) return;
      var lab = label(e);
      if (!lab) return;
      td.setAttribute('title', lab);
      td.textContent = lab;
    });
  }
  async function applyAll() {
    try {
      var rows = await loadMap();
      if (!rows.length) return;
      relabelPeople(rows);
      relabelTracker(rows);
      if (typeof window._dbRenderTopSalesPerson === 'function') {
        await window._dbRenderTopSalesPerson();
      }
    } catch (e) { console.warn('nickname apply', e); }
  }
  function wrapDash() {
    ['_dbLoadPeople', '_dbLoadAttTracker', 'loadDashboardData'].forEach(function (name) {
      var orig = window[name];
      if (typeof orig !== 'function' || orig._nickWrapped) return;
      var wrapped = async function () {
        var r = await orig.apply(this, arguments);
        setTimeout(applyAll, 50);
        return r;
      };
      wrapped._nickWrapped = true;
      window[name] = wrapped;
    });
  }
  function boot() {
    wrapForm();
    wrapSave();
    wrapTopSalesEmployees();
    wrapDash();
    applyAll();
    setTimeout(applyAll, 400);
    setTimeout(applyAll, 1200);
    setTimeout(applyAll, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
