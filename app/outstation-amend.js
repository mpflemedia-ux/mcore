/* Outstation: Edit fills form, Submit updates same row */
(function () {
  window._osRows = window._osRows || [];
  window._osEditId = null;
  function isBm() { return APP.language === 'bm'; }
  function wrapList() {
    var orig = window._attLoadOutstationList;
    if (typeof orig !== 'function' || orig._amd) return;
    window._attLoadOutstationList = async function () {
      var r = await orig.apply(this, arguments);
      try {
        var q = sb.from('outstation_requests')
          .select('id,start_date,end_date,depart_time,return_time,location,purpose,status,employee_id')
          .eq('tenant_id', APP.tenant.id).is('deleted_at', null)
          .order('created_at', { ascending: false }).limit(30);
        var res = await q;
        window._osRows = res.data || [];
      } catch (e) {}
      setTimeout(injectBtns, 40);
      return r;
    };
    window._attLoadOutstationList._amd = true;
  }
  function injectBtns() {
    var el = document.getElementById('os-list');
    if (!el) return;
    var cards = el.querySelectorAll(':scope > div');
    var rows = window._osRows || [];
    cards.forEach(function (card, i) {
      if (card.querySelector('[data-os-edit]')) return;
      var rec = rows[i];
      if (!rec) return;
      var bar = document.createElement('div');
      bar.style.cssText = 'margin-top:6px';
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-outline btn-sm';
      b.setAttribute('data-os-edit', rec.id);
      b.textContent = isBm() ? 'Amend' : 'Amend';
      b.onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); window._attEditOutstation(rec.id); };
      bar.appendChild(b);
      card.appendChild(bar);
    });
  }
  window._attEditOutstation = function (id) {
    var r = (window._osRows || []).find(function (x) { return String(x.id) === String(id); });
    if (!r) { showToast('Record not found', 'error'); return; }
    window._osEditId = id;
    var set = function (i, v) { var n = document.getElementById(i); if (n) n.value = v || ''; };
    set('os-from', r.start_date);
    set('os-to', r.end_date);
    set('os-depart', r.depart_time);
    set('os-return', r.return_time);
    set('os-loc', r.location);
    set('os-purpose', r.purpose);
    var btn = document.querySelector('#os-list') && document.querySelector('button[onclick*="_attSubmitOutstation"]');
    var submit = document.querySelector('[onclick="_attSubmitOutstation()"]') || document.querySelector('button.btn-primary');
    var formBtn = null;
    document.querySelectorAll('button').forEach(function (b) {
      if (/Submit request|Hantar permohonan/i.test(b.textContent || '')) formBtn = b;
    });
    if (formBtn) formBtn.textContent = isBm() ? 'Simpan pindaan' : 'Save changes';
    showToast(isBm() ? 'Edit mode — ubah field atas, tekan Simpan pindaan' : 'Edit mode — change fields above, tap Save changes', 'info');
    var box = document.getElementById('os-from');
    if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  function wrapSave() {
    var orig = window._attSubmitOutstation;
    if (typeof orig !== 'function' || orig._amd) return;
    window._attSubmitOutstation = async function () {
      var editId = window._osEditId;
      if (!editId) return orig.apply(this, arguments);
      var start = (document.getElementById('os-from') || {}).value;
      var end = (document.getElementById('os-to') || {}).value;
      var depart = ((document.getElementById('os-depart') || {}).value || '').trim();
      var ret = ((document.getElementById('os-return') || {}).value || '').trim();
      var location = ((document.getElementById('os-loc') || {}).value || '').trim();
      var purpose = ((document.getElementById('os-purpose') || {}).value || '').trim();
      if (!start || !end) { showToast(isBm() ? 'Isi tarikh' : 'Dates required', 'error'); return; }
      var patch = {
        start_date: start, end_date: end, location: location, purpose: purpose,
        updated_at: new Date().toISOString()
      };
      if (depart) patch.depart_time = depart;
      if (ret) patch.return_time = ret;
      var res = await sb.from('outstation_requests').update(patch).eq('id', editId).eq('tenant_id', APP.tenant.id);
      if (res.error) { showToast(res.error.message, 'error'); return; }
      window._osEditId = null;
      document.querySelectorAll('button').forEach(function (b) {
        if (/Simpan pindaan|Save changes/i.test(b.textContent || '')) {
          b.textContent = isBm() ? 'Hantar permohonan' : 'Submit request';
        }
      });
      showToast(isBm() ? 'Outstation dikemaskini' : 'Outstation updated', 'success');
      if (typeof _attLoadOutstationList === 'function') _attLoadOutstationList();
    };
    window._attSubmitOutstation._amd = true;
  }
  function boot() { wrapList(); wrapSave(); injectBtns(); }
  setInterval(boot, 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
