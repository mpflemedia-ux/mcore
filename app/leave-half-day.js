/* Half-day leave: checkbox + AM/PM, days_count 0.5 */
(function () {
  function isBm() { return APP.language === 'bm'; }
  function inject() {
    if (!document.getElementById('lv-days') || document.getElementById('lv-half')) return;
    var days = document.getElementById('lv-days');
    var box = document.createElement('div');
    box.className = 'form-group';
    box.style.gridColumn = '1 / -1';
    box.innerHTML =
      '<label style="display:flex;align-items:center;gap:8px;font-size:14px">' +
      '<input type="checkbox" id="lv-half"> ' +
      (isBm() ? 'Cuti setengah hari' : 'Half-day leave') + '</label>' +
      '<div id="lv-half-session" style="display:none;margin-top:8px">' +
      '<label style="margin-right:12px"><input type="radio" name="lv-sess" value="am" checked> ' +
      (isBm() ? 'Pagi (AM)' : 'Morning (AM)') + '</label>' +
      '<label><input type="radio" name="lv-sess" value="pm"> ' +
      (isBm() ? 'Petang (PM)' : 'Afternoon (PM)') + '</label></div>';
    var host = days.closest('.form-group') || days.parentNode;
    if (host && host.parentNode) host.parentNode.insertBefore(box, host.nextSibling);
    else days.parentNode.appendChild(box);
    document.getElementById('lv-half').onchange = function () {
      var sess = document.getElementById('lv-half-session');
      if (sess) sess.style.display = this.checked ? '' : 'none';
      var start = document.getElementById('lv-start');
      var end = document.getElementById('lv-end');
      if (this.checked && start && end) {
        if (start.value) end.value = start.value;
        end.disabled = true;
        days.value = '0.5';
      } else if (end) {
        end.disabled = false;
        if (typeof _leaveCalcDays === 'function') _leaveCalcDays();
      }
    };
    var start = document.getElementById('lv-start');
    if (start && !start._halfBound) {
      start.addEventListener('change', function () {
        if (document.getElementById('lv-half') && document.getElementById('lv-half').checked) {
          var end = document.getElementById('lv-end');
          if (end) end.value = start.value;
          days.value = '0.5';
        }
      });
      start._halfBound = true;
    }
  }
  function wrapCalc() {
    var orig = window._leaveCalcDays;
    if (typeof orig !== 'function' || orig._half) return;
    window._leaveCalcDays = function () {
      if (document.getElementById('lv-half') && document.getElementById('lv-half').checked) {
        var start = document.getElementById('lv-start');
        var end = document.getElementById('lv-end');
        var days = document.getElementById('lv-days');
        if (start && end && start.value) end.value = start.value;
        if (days) days.value = '0.5';
        return;
      }
      return orig.apply(this, arguments);
    };
    window._leaveCalcDays._half = true;
  }
  function wrapSave() {
    var orig = window._leaveSave;
    if (typeof orig !== 'function' || orig._half) return;
    window._leaveSave = async function () {
      var half = document.getElementById('lv-half') && document.getElementById('lv-half').checked;
      if (half) {
        var start = document.getElementById('lv-start');
        var end = document.getElementById('lv-end');
        var days = document.getElementById('lv-days');
        if (start && end) { end.disabled = false; end.value = start.value; }
        if (days) days.value = '0.5';
      }
      var r = await orig.apply(this, arguments);
      return r;
    };
    window._leaveSave._half = true;
  }
  function wrapInsert() {
    if (!window.sb || window.sb._halfLeave) return;
    var origFrom = window.sb.from.bind(window.sb);
    /* patch after insert by wrapping _leaveSave more tightly */
  }
  async function patchLastPending() {
    if (!window.sb || !APP.tenant) return;
    var half = document.getElementById('lv-half') && document.getElementById('lv-half').checked;
    if (!half) return;
    var sess = (document.querySelector('input[name="lv-sess"]:checked') || {}).value || 'am';
    var emp = (document.getElementById('lv-employee') || {}).value;
    var start = (document.getElementById('lv-start') || {}).value;
    if (!emp || !start) return;
    await sb.from('leave_requests').update({ is_half_day: true, half_session: sess, days_count: 0.5 })
      .eq('tenant_id', APP.tenant.id).eq('employee_id', emp).eq('start_date', start).eq('status', 'pending');
  }
  function wrapSave2() {
    var orig = window._leaveSave;
    if (typeof orig !== 'function' || orig._half2) return;
    window._leaveSave = async function () {
      var half = document.getElementById('lv-half') && document.getElementById('lv-half').checked;
      if (half) {
        var start = document.getElementById('lv-start');
        var end = document.getElementById('lv-end');
        var days = document.getElementById('lv-days');
        if (start && end) { end.disabled = false; end.value = start.value; }
        if (days) days.value = '0.5';
      }
      var r = await orig.apply(this, arguments);
      await patchLastPending();
      return r;
    };
    window._leaveSave._half2 = true;
  }
  function boot() {
    if (!document.getElementById('lv-type')) return;
    inject();
    wrapCalc();
    wrapSave();
    wrapSave2();
  }
  setInterval(boot, 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
