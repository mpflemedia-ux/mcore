(function () {
  var KINDS = [
    { key: 'morning', en: 'Morning', bm: 'Pagi', start: '09:00', end: '17:00', bg: '#F5E6C8', fg: '#8A5A00' },
    { key: 'mid', en: 'Afternoon', bm: 'Tengahari', start: '12:00', end: '20:00', bg: '#F3D7D2', fg: '#8A3B32' },
    { key: 'closing', en: 'Night', bm: 'Malam', start: '16:00', end: '22:00', bg: '#D7E8D4', fg: '#2F6B45' },
    { key: 'off', en: 'Off', bm: 'Off', start: '', end: '', bg: '#E7E5E4', fg: '#57534E' }
  ];
  function spanHours(k) {
    if (!k.start || !k.end) return 0;
    var a = k.start.split(':'), b = k.end.split(':');
    var mins = (Number(b[0]) * 60 + Number(b[1])) - (Number(a[0]) * 60 + Number(a[1]));
    if (mins < 0) mins += 24 * 60;
    return Math.round(mins / 6) / 10;
  }
  function applyHours() {
    var cfg = (APP.tenant && APP.tenant.config && APP.tenant.config.shift_hours) || {};
    KINDS.forEach(function (k) {
      if (k.key === 'off') return;
      var row = cfg[k.key] || {};
      if (row.start) k.start = row.start;
      if (row.end) k.end = row.end;
    });
  }
  function clock(hm) {
    var p = String(hm || '').split(':');
    if (!p[0]) return '';
    var h = Number(p[0]);
    var m = p[1] || '00';
    return (h % 12 || 12) + ':' + m + ' ' + (h >= 12 ? 'PM' : 'AM');
  }
  function range(k) { return k.start && k.end ? clock(k.start) + '–' + clock(k.end) : ''; }
  var state = { week: null, employees: [], shifts: [], leaves: [], swaps: [] };

  function t(en, bm) { return (typeof APP !== 'undefined' && APP.language === 'bm') ? bm : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' })[c]; }); }
  function tid() { return APP.tenant && APP.tenant.id; }
  function nick(e) { return (e.nickname && String(e.nickname).trim()) || e.name || ''; }
  function monday(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = x.getDay() || 7;
    x.setDate(x.getDate() - day + 1);
    return x;
  }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function kindOf(key) { return KINDS.filter(function (k) { return k.key === key; })[0] || KINDS[0]; }
  function days() { return [0, 1, 2, 3, 4, 5, 6].map(function (n) { return addDays(state.week, n); }); }
  function shiftAt(emp, day) {
    return state.shifts.filter(function (s) { return String(s.employee_id) === String(emp.id) && s.shift_date === day; })[0];
  }
  function leaveAt(emp, day) {
    return state.leaves.filter(function (l) {
      return String(l.employee_id) === String(emp.id) && l.start_date <= day && l.end_date >= day && l.status === 'approved';
    })[0];
  }

  function css() {
    return '.sh-wrap{display:flex;flex-direction:column;gap:12px;color:var(--text)}' +
      '.sh-top,.sh-head{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}' +
      '.sh-scroll{overflow:auto;border:1px solid var(--border);border-radius:12px;background:var(--bg-card)}' +
      '.sh-grid{border-collapse:collapse;min-width:720px;width:100%}' +
      '.sh-grid th,.sh-grid td{border-bottom:1px solid var(--border);padding:8px;font-size:12px;text-align:center}' +
      '.sh-grid th:first-child,.sh-grid td:first-child{text-align:left;position:sticky;left:0;background:var(--bg-card)}' +
      '.sh-grid th.sh-today{color:var(--primary);font-weight:700}' +
      '.sh-cell{border:0;border-radius:8px;padding:6px 4px;min-width:84px;font-size:11px;cursor:pointer;line-height:1.2;white-space:normal}' +
      '.sh-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}' +
      '.sh-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:12px}' +
      '.sh-muted{color:var(--text-2);font-size:12px}' +
      '.sh-pack-head{display:none}' +
      '@media print{' +
      'body.sh-printing *{visibility:hidden!important}' +
      'body.sh-printing .sh-pack,body.sh-printing .sh-pack *{visibility:visible!important}' +
      'body.sh-printing .sh-pack{position:absolute;left:0;top:0;width:100%;background:#fff;color:#000}' +
      'body.sh-printing .sh-pack-head{display:block;margin-bottom:10px}' +
      'body.sh-printing .sh-grid th.sh-today{color:#000}' +
      'body.sh-printing .sh-grid tr{break-inside:avoid}' +
      '}';
  }

  function cellHtml(emp, day) {
    var leave = leaveAt(emp, day);
    if (leave) return '<button type="button" class="sh-cell" disabled style="background:#EDE9FE;color:#5B21B6">' + esc(t('Leave', 'Cuti')) + '</button>';
    var s = shiftAt(emp, day);
    if (!s) return '<button type="button" class="sh-cell" data-emp="' + esc(emp.id) + '" data-day="' + day + '" style="background:transparent;color:var(--text-3)">+</button>';
    var k = kindOf(s.kind);
    return '<button type="button" class="sh-cell" data-emp="' + esc(emp.id) + '" data-day="' + day + '" style="background:' + k.bg + ';color:' + k.fg + '">' + esc(t(k.en, k.bm)) + '<br>' + esc(range(k)) + '</button>';
  }

  function gridHtml() {
    var ds = days();
    var todayIso = iso(new Date());
    var labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var labelsBm = ['Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab', 'Ahd'];
    var head = ds.map(function (d, i) { return '<th' + (iso(d) === todayIso ? ' class="sh-today"' : '') + '>' + esc(t(labels[i], labelsBm[i])) + '<br>' + d.getDate() + '</th>'; }).join('');
    var body = state.employees.map(function (e) {
      return '<tr><td><b>' + esc(nick(e)) + '</b><div class="sh-muted">' + esc(e.position || '') + '</div></td>' +
        ds.map(function (d) { return '<td>' + cellHtml(e, iso(d)) + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<div class="sh-scroll"><table class="sh-grid"><thead><tr><th>' + esc(t('Staff', 'Staff')) + '</th>' + head + '</tr></thead><tbody>' +
      (body || '<tr><td colspan="8">' + esc(t('No staff', 'Tiada staff')) + '</td></tr>') + '</tbody></table></div>';
  }

  function hours(emp) {
    return days().reduce(function (n, d) {
      var s = shiftAt(emp, iso(d));
      return n + (s ? spanHours(kindOf(s.kind)) : 0);
    }, 0);
  }
  function openShifts() {
    return state.shifts.filter(function (s) { return s.kind === 'open' || !s.employee_id; });
  }

  function cardsHtml() {
    var opens = state.shifts.filter(function (s) { return !shiftAt({ id: s.employee_id }, s.shift_date) && false; });
    var empty = [];
    state.employees.forEach(function (e) {
      days().forEach(function (d) {
        var day = iso(d);
        if (!shiftAt(e, day) && !leaveAt(e, day)) empty.push({ emp: e, day: day });
      });
    });
    var openHtml = empty.slice(0, 5).map(function (x) {
      return '<div class="sh-muted">' + esc(nick(x.emp)) + ' · ' + x.day + '</div>';
    }).join('') || '<div class="sh-muted">' + esc(t('No open slot', 'Tiada slot kosong')) + '</div>';
    var leaveHtml = state.leaves.filter(function (l) { return l.status === 'approved' && l.end_date >= iso(state.week); }).slice(0, 5).map(function (l) {
      var e = state.employees.filter(function (x) { return String(x.id) === String(l.employee_id); })[0];
      return '<div class="sh-muted">' + esc(e ? nick(e) : '') + ' · ' + esc(l.start_date) + '</div>';
    }).join('') || '<div class="sh-muted">' + esc(t('No approved leave', 'Tiada cuti lulus')) + '</div>';
    var swapHtml = state.swaps.filter(function (s) { return s.status === 'pending'; }).map(function (s) {
      return '<div class="sh-muted">' + esc(s.shift_date) + ' <button type="button" data-swap="' + esc(s.id) + '">' + esc(t('Approve', 'Lulus')) + '</button></div>';
    }).join('') || '<div class="sh-muted">' + esc(t('No swap request', 'Tiada permintaan tukar')) + '</div>';
    var total = state.employees.reduce(function (n, e) { return n + hours(e); }, 0);
    return '<div class="sh-cards">' +
      '<div class="sh-card"><b>' + esc(t('Open slots', 'Slot kosong')) + '</b>' + openHtml + '</div>' +
      '<div class="sh-card"><b>' + esc(t('Approved leave', 'Cuti lulus')) + '</b>' + leaveHtml + '</div>' +
      '<div class="sh-card"><b>' + esc(t('Swap requests', 'Tukar syif')) + '</b>' + swapHtml + '</div>' +
      '<div class="sh-card"><b>' + esc(t('Scheduled hours', 'Jam dijadual')) + '</b><div style="font-size:28px">' + total + '</div><div class="sh-muted">' + esc(t('This week. Not posted to payroll.', 'Minggu ini. Tak masuk gaji.')) + '</div></div>' +
      '</div>';
  }


  function hoursForm() {
    return '<div class="sh-card"><b>' + esc(t('Shift hours', 'Jam syif')) + '</b><div class="sh-muted">' + esc(t('Tenant setting. Not payroll.', 'Set tenant. Bukan gaji.')) + '</div>' +
      KINDS.filter(function (k) { return k.key !== 'off'; }).map(function (k) {
        return '<label class="sh-muted">' + esc(t(k.en, k.bm)) +
          ' <input data-sh="' + k.key + '" data-part="start" type="time" value="' + esc(k.start) + '">' +
          ' <input data-sh="' + k.key + '" data-part="end" type="time" value="' + esc(k.end) + '"></label>';
      }).join('') + '<div><button type="button" id="sh-save-hours" class="btn btn-sm btn-primary">' + esc(t('Save hours', 'Simpan jam')) + '</button></div></div>';
  }
  function colorLegend() {
    return '<div class="sh-muted">' + KINDS.map(function (k) { return '<span style="display:inline-block;margin-right:10px;color:' + k.fg + '">' + esc(t(k.en, k.bm)) + ' ' + esc(range(k)) + '</span>'; }).join('') + esc(t('Leave', 'Cuti')) + '</div>';
  }
  function packHeadHtml() {
    var end = addDays(state.week, 6);
    return '<div class="sh-pack-head"><b>' + esc((APP.tenant && APP.tenant.name) || '') + '</b> — ' + esc(t('Weekly schedule', 'Jadual minggu')) + '<div class="sh-muted">' + iso(state.week) + ' → ' + iso(end) + '</div></div>';
  }

  function dayShort(d) {
    var en = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var bm = ['Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab', 'Ahd'];
    return (APP.language === 'bm' ? bm : en)[(d.getDay() + 6) % 7] + ' ' + d.getDate();
  }
  function dayLabel(emp, day) {
    if (leaveAt(emp, day)) return t('Leave', 'Cuti');
    var s = shiftAt(emp, day);
    if (!s) return t('Off', 'Off');
    var k = kindOf(s.kind);
    return k.key === 'off' ? t('Off', 'Off') : t(k.en, k.bm) + ' ' + range(k);
  }
  function shareText(mode, oneEmp) {
    var co = (APP.tenant && APP.tenant.name) || 'M-Core';
    var end = addDays(state.week, 6);
    var ds = days();
    var list = mode === 'one' && oneEmp ? [oneEmp] : state.employees;
    var out = ['*' + t('Weekly Schedule', 'Jadual Minggu') + ' · ' + co + '*', iso(state.week) + ' – ' + iso(end), ''];
    list.forEach(function (e) {
      out.push('*' + nick(e) + '*');
      var i = 0;
      while (i < ds.length) {
        var lbl = dayLabel(e, iso(ds[i]));
        var j = i;
        while (j + 1 < ds.length && dayLabel(e, iso(ds[j + 1])) === lbl) j++;
        out.push((j > i ? dayShort(ds[i]) + '-' + dayShort(ds[j]) : dayShort(ds[i])) + ': ' + lbl);
        i = j + 1;
      }
      out.push('');
    });
    out.push('_' + t('Sent via M-Core', 'Dihantar melalui M-Core') + '_');
    return out.join('\n');
  }
  function shareModal() {
    if (!state.employees.length) { showToast(t('No staff to share', 'Tiada staff untuk dikongsi'), 'error'); return; }
    var opts = state.employees.map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(nick(e)) + '</option>'; }).join('');
    var html = '<div class="modal-overlay active" id="sh-share-modal"><div class="modal-box" style="max-width:420px">' +
      '<div class="modal-box-header"><i class="ti ti-brand-whatsapp"></i> ' + esc(t('Share WhatsApp', 'Kongsi WhatsApp')) + '</div>' +
      '<div class="modal-box-body">' +
      '<div class="form-group"><label class="form-label">' + esc(t('Send to', 'Hantar kepada')) + '</label>' +
      '<select class="form-select" id="sh-sm-mode">' +
      '<option value="all">' + esc(t('Everyone (you pick recipient)', 'Semua (anda pilih penerima)')) + '</option>' +
      '<option value="one">' + esc(t('One staff (uses their phone number)', 'Seorang staff (guna nombor telefon dia)')) + '</option>' +
      '</select></div>' +
      '<div class="form-group" id="sh-sm-emp-wrap" style="display:none"><label class="form-label">' + esc(t('Staff', 'Staff')) + '</label><select class="form-select" id="sh-sm-emp">' + opts + '</select></div>' +
      '</div><div class="modal-box-footer"><button type="button" class="btn btn-outline" id="sh-sm-cancel">' + esc(t('Cancel', 'Batal')) + '</button>' +
      '<button type="button" class="btn btn-primary" id="sh-sm-go"><i class="ti ti-brand-whatsapp"></i> ' + esc(t('Open WhatsApp', 'Buka WhatsApp')) + '</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    var modal = document.getElementById('sh-share-modal');
    var modeSel = modal.querySelector('#sh-sm-mode'), empWrap = modal.querySelector('#sh-sm-emp-wrap');
    modeSel.onchange = function () { empWrap.style.display = modeSel.value === 'one' ? '' : 'none'; };
    modal.querySelector('#sh-sm-cancel').onclick = function () { modal.remove(); };
    modal.querySelector('#sh-sm-go').onclick = function () {
      var mode = modeSel.value, emp = null, phone = '';
      if (mode === 'one') {
        emp = state.employees.filter(function (e) { return String(e.id) === modal.querySelector('#sh-sm-emp').value; })[0];
        if (!emp) { showToast(t('Pick a staff', 'Pilih staff'), 'error'); return; }
        phone = window.PJW && typeof PJW.phone === 'function' ? PJW.phone(emp.phone) : '';
        if (!phone) { showToast(t('This staff has no valid phone number', 'Staff ini tiada nombor telefon sah'), 'error'); return; }
      }
      var text = shareText(mode, emp);
      var url = window.PJW && typeof PJW.waUrl === 'function' ? PJW.waUrl(phone, text) : ('https://wa.me/' + phone + '?text=' + encodeURIComponent(text));
      if (window.PJW && typeof PJW.open === 'function') PJW.open(url); else window.open(url, '_blank', 'noopener');
      modal.remove();
    };
  }

  function paint() {
    var main = document.getElementById('main');
    if (!main) return;
    var end = addDays(state.week, 6);
    main.innerHTML = '<style>' + css() + '</style><div class="sh-wrap"><div class="sh-top"><div><b>' + esc(t('Weekly schedule', 'Jadual minggu')) + '</b><div class="sh-muted">' + iso(state.week) + ' → ' + iso(end) + '</div></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
      '<button type="button" id="sh-prev" class="btn btn-sm btn-outline">‹</button> <button type="button" id="sh-today" class="btn btn-sm btn-outline">' + esc(t('Today', 'Hari ini')) + '</button> <button type="button" id="sh-next" class="btn btn-sm btn-outline">›</button>' +
      '<span style="width:1px;align-self:stretch;background:var(--border);margin:0 2px"></span>' +
      '<button type="button" id="sh-print" class="btn btn-sm btn-outline"><i class="ti ti-printer"></i> ' + esc(t('Print', 'Cetak')) + '</button>' +
      '<button type="button" id="sh-share" class="btn btn-sm btn-outline"><i class="ti ti-brand-whatsapp"></i> ' + esc(t('Share WhatsApp', 'Kongsi WhatsApp')) + '</button>' +
      '</div></div>' +
      '<div class="sh-pack">' + packHeadHtml() + gridHtml() + colorLegend() + '</div>' + hoursForm() + cardsHtml() + '</div>';
    document.getElementById('sh-prev').onclick = function () { state.week = addDays(state.week, -7); refresh(); };
    document.getElementById('sh-next').onclick = function () { state.week = addDays(state.week, 7); refresh(); };
    document.getElementById('sh-today').onclick = function () { state.week = monday(new Date()); refresh(); };
    document.getElementById('sh-print').onclick = function () {
      var tname = (APP.tenant && (APP.tenant.code || APP.tenant.name)) || 'MCore';
      if (typeof _pdocSetPageOrientation === 'function') _pdocSetPageOrientation('landscape', 8);
      if (typeof _pdocSetPrintFilename === 'function' && typeof _pdocSlug === 'function' && typeof _pdocDateStamp === 'function') {
        _pdocSetPrintFilename('Shifts_' + _pdocSlug(tname) + '_' + iso(state.week) + '_' + _pdocDateStamp());
      }
      document.body.classList.add('sh-printing');
      window.addEventListener('afterprint', function off() { document.body.classList.remove('sh-printing'); window.removeEventListener('afterprint', off); });
      window.print();
    };
    document.getElementById('sh-share').onclick = shareModal;
    var saveHours = document.getElementById('sh-save-hours');
    if (saveHours) saveHours.onclick = saveShiftHours;
    main.querySelectorAll('.sh-cell[data-emp]').forEach(function (btn) {
      btn.onclick = function () { cycle(btn.getAttribute('data-emp'), btn.getAttribute('data-day')); };
    });
    main.querySelectorAll('[data-swap]').forEach(function (btn) {
      btn.onclick = function () { approveSwap(btn.getAttribute('data-swap')); };
    });
  }

  async function load() {
    var from = iso(state.week);
    var to = iso(addDays(state.week, 6));
    var emp = await sb.from('employees').select('id,name,nickname,position').eq('tenant_id', tid()).is('deleted_at', null).order('name');
    if (emp.error) throw emp.error;
    state.employees = emp.data || [];
    var sh = await sb.from('shifts').select('id,employee_id,shift_date,kind').eq('tenant_id', tid()).is('deleted_at', null).gte('shift_date', from).lte('shift_date', to);
    if (sh.error) throw sh.error;
    state.shifts = sh.data || [];
    var lv = await sb.from('leave_requests').select('id,employee_id,start_date,end_date,status,leave_type').eq('tenant_id', tid()).eq('status', 'approved').lte('start_date', to).gte('end_date', from);
    state.leaves = lv.error ? [] : (lv.data || []);
    var sw = await sb.from('shift_swaps').select('id,from_employee_id,to_employee_id,shift_date,status').eq('tenant_id', tid()).is('deleted_at', null).eq('status', 'pending');
    state.swaps = sw.error ? [] : (sw.data || []);
  }

  async function cycle(empId, day) {
    if (leaveAt({ id: empId }, day)) return;
    var order = ['morning', 'mid', 'closing', 'off', ''];
    var cur = shiftAt({ id: empId }, day);
    var next = order[(order.indexOf(cur ? cur.kind : '') + 1) % order.length];
    if (cur && !next) {
      var del = await sb.from('shifts').update({ deleted_at: new Date().toISOString() }).eq('id', cur.id).eq('tenant_id', tid());
      if (del.error) { showToast(del.error.message, 'error'); return; }
    } else if (cur) {
      var up = await sb.from('shifts').update({ kind: next }).eq('id', cur.id).eq('tenant_id', tid());
      if (up.error) { showToast(up.error.message, 'error'); return; }
    } else if (next) {
      var ins = await sb.from('shifts').insert({ tenant_id: tid(), employee_id: empId, shift_date: day, kind: next });
      if (ins.error) { showToast(ins.error.message, 'error'); return; }
    }
    refresh();
  }

  async function approveSwap(id) {
    var row = state.swaps.filter(function (s) { return String(s.id) === String(id); })[0];
    if (!row) return;
    var mine = state.shifts.filter(function (s) { return String(s.employee_id) === String(row.from_employee_id) && s.shift_date === row.shift_date; })[0];
    if (mine) {
      var moved = await sb.from('shifts').update({ employee_id: row.to_employee_id }).eq('id', mine.id).eq('tenant_id', tid());
      if (moved.error) { showToast(moved.error.message, 'error'); return; }
    }
    await sb.from('shift_swaps').update({ status: 'approved' }).eq('id', id).eq('tenant_id', tid());
    refresh();
  }


  async function saveShiftHours() {
    var patch = {};
    document.querySelectorAll('[data-sh]').forEach(function (el) {
      var key = el.getAttribute('data-sh');
      patch[key] = patch[key] || {};
      patch[key][el.getAttribute('data-part')] = el.value;
    });
    try {
      if (typeof _tenantConfigPatch === 'function') await _tenantConfigPatch({ shift_hours: patch });
      else throw new Error('config save missing');
      applyHours();
      showToast(t('Saved', 'Disimpan'), 'success');
      paint();
    } catch (err) { showToast((err && err.message) || String(err), 'error'); }
  }
  async function refresh() {
    try { await load(); paint(); }
    catch (err) {
      var main = document.getElementById('main');
      var msg = (err && err.message) || String(err);
      if (main) main.innerHTML = '<div class="card" style="padding:16px"><b>' + esc(t('Shifts need the SQL migration', 'Syif perlukan migrasi SQL')) + '</b><p>' + esc(msg) + '</p></div>';
      if (typeof showToast === 'function') showToast(msg, 'error');
    }
  }

  window.renderShifts = function () {
    if (typeof canAccess === 'function' && !canAccess('hr') && !canAccess('core')) {
      showToast(t('Access denied', 'Akses ditolak'), 'error');
      return;
    }
    state.week = state.week || monday(new Date());
    applyHours();
    refresh();
  };
})();
