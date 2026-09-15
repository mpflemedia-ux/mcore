/* Sales achievements — amend / delete unlocked badges */
(function () {
  var KEYS = ['bronze','silver','gold','platinum','first_sale_of_month','streak_gold_3mo'];
  function canEdit() {
    try {
      if (typeof isTenantAdmin === 'function' && isTenantAdmin()) return true;
      if (typeof canManageHR === 'function' && canManageHR()) return true;
    } catch (e) {}
    return false;
  }
  function labelKey(k) {
    if (typeof _scBadgeLabel === 'function') return _scBadgeLabel(k, APP.language === 'bm');
    return k;
  }
  async function attachIds() {
    var raw = window._scAchievementsRaw || [];
    if (!raw.length || !window.sb || !APP.tenant) return raw;
    if (raw.every(function (r) { return r.id; })) return raw;
    var q = await sb.from('sales_achievements')
      .select('id,sales_person_id,badge_key,period_month,period_year,unlocked_at')
      .eq('tenant_id', APP.tenant.id).is('deleted_at', null).limit(500);
    var rows = q.data || [];
    raw.forEach(function (a) {
      if (a.id) return;
      var hit = rows.find(function (x) {
        return x.sales_person_id === a.sales_person_id && x.badge_key === a.badge_key &&
          Number(x.period_month) === Number(a.period_month) && Number(x.period_year) === Number(a.period_year);
      });
      if (hit) a.id = hit.id;
    });
    return raw;
  }
  function removeModal() {
    var m = document.getElementById('sc-ach-modal');
    if (m) m.remove();
  }
  function openEdit(id) {
    var row = (window._scAchievementsRaw || []).find(function (r) { return String(r.id) === String(id); });
    if (!row) return;
    removeModal();
    var isBm = APP.language === 'bm';
    var opts = KEYS.map(function (k) {
      return '<option value="' + k + '"' + (row.badge_key === k ? ' selected' : '') + '>' + labelKey(k) + '</option>';
    }).join('');
    var box = document.createElement('div');
    box.id = 'sc-ach-modal';
    box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    box.innerHTML = '<div class="card" style="width:min(420px,100%);padding:20px">' +
      '<div style="font-weight:700;margin-bottom:12px">' + (isBm ? 'Pinda lencana' : 'Amend badge') + '</div>' +
      '<div class="form-group"><label class="form-label">Badge</label>' +
      '<select id="sc-ach-key" class="form-select">' + opts + '</select></div>' +
      '<div style="display:flex;gap:12px">' +
      '<div class="form-group" style="flex:1"><label class="form-label">' + (isBm ? 'Bulan' : 'Month') + '</label>' +
      '<input id="sc-ach-m" type="number" min="1" max="12" class="form-input" value="' + Number(row.period_month || 1) + '"></div>' +
      '<div class="form-group" style="flex:1"><label class="form-label">' + (isBm ? 'Tahun' : 'Year') + '</label>' +
      '<input id="sc-ach-y" type="number" min="2020" class="form-input" value="' + Number(row.period_year || 2026) + '"></div></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn btn-outline" id="sc-ach-cancel">' + (isBm ? 'Batal' : 'Cancel') + '</button>' +
      '<button class="btn btn-primary" id="sc-ach-save">' + (isBm ? 'Simpan' : 'Save') + '</button></div></div>';
    document.body.appendChild(box);
    document.getElementById('sc-ach-cancel').onclick = removeModal;
    box.addEventListener('click', function (e) { if (e.target === box) removeModal(); });
    document.getElementById('sc-ach-save').onclick = async function () {
      var payload = {
        badge_key: document.getElementById('sc-ach-key').value,
        period_month: Number(document.getElementById('sc-ach-m').value),
        period_year: Number(document.getElementById('sc-ach-y').value)
      };
      var { error } = await sb.from('sales_achievements').update(payload).eq('id', id).eq('tenant_id', APP.tenant.id);
      if (error) { showToast(error.message, 'error'); return; }
      showToast(isBm ? 'Lencana dikemaskini' : 'Badge updated', 'success');
      removeModal();
      if (typeof _scLoadAchievements === 'function') _scLoadAchievements();
    };
  }
  async function delBadge(id) {
    var isBm = APP.language === 'bm';
    if (!confirm(isBm ? 'Padam lencana ini?' : 'Delete this badge?')) return;
    var { error } = await sb.from('sales_achievements').update({
      deleted_at: new Date().toISOString()
    }).eq('id', id).eq('tenant_id', APP.tenant.id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(isBm ? 'Lencana dipadam' : 'Badge deleted', 'success');
    if (typeof _scLoadAchievements === 'function') _scLoadAchievements();
  }
  window._scEditAchievement = openEdit;
  window._scDeleteAchievement = delBadge;
  function decorate() {
    if (!canEdit()) return;
    var wrap = document.getElementById('sc-achievements-wrap');
    if (!wrap) return;
    wrap.querySelectorAll('[data-ach-id]').forEach(function (el) {
      if (el.querySelector('.sc-ach-act')) return;
      var id = el.getAttribute('data-ach-id');
      if (!id) return;
      var act = document.createElement('span');
      act.className = 'sc-ach-act';
      act.style.marginLeft = '6px';
      act.innerHTML = '<button class="btn btn-outline btn-sm" style="padding:2px 6px" onclick="event.preventDefault();_scEditAchievement(\'' + id + '\')"><i class="ti ti-pencil"></i></button> ' +
        '<button class="btn btn-outline btn-sm" style="padding:2px 6px" onclick="event.preventDefault();_scDeleteAchievement(\'' + id + '\')"><i class="ti ti-trash"></i></button>';
      el.appendChild(act);
    });
  }
  function tagChips() {
    var wrap = document.getElementById('sc-achievements-wrap');
    if (!wrap) return;
    var raw = window._scAchievementsRaw || [];
    var chips = wrap.querySelectorAll('span');
    chips.forEach(function (span) {
      if (span.getAttribute('data-ach-id')) return;
      var txt = (span.textContent || '').replace(/\s+/g, ' ').trim();
      var hit = raw.find(function (a) {
        var lab = labelKey(a.badge_key);
        var per = String(a.period_month).padStart(2, '0') + '/' + a.period_year;
        return txt.indexOf(lab) >= 0 && txt.indexOf(per) >= 0;
      });
      if (hit && hit.id) span.setAttribute('data-ach-id', hit.id);
    });
    decorate();
  }
  function wrapList() {
    var orig = window._scRenderAchievementsList;
    if (typeof orig !== 'function' || orig._achWrapped) return;
    var wrapped = async function () {
      await attachIds();
      var r = orig.apply(this, arguments);
      setTimeout(tagChips, 0);
      return r;
    };
    wrapped._achWrapped = true;
    window._scRenderAchievementsList = wrapped;
  }
  function wrapLoad() {
    var orig = window._scLoadAchievements;
    if (typeof orig !== 'function' || orig._achWrapped) return;
    var wrapped = async function () {
      var r = await orig.apply(this, arguments);
      await attachIds();
      setTimeout(tagChips, 0);
      return r;
    };
    wrapped._achWrapped = true;
    window._scLoadAchievements = wrapped;
  }
  function boot() {
    wrapLoad();
    wrapList();
    attachIds().then(tagChips);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 800);
})();
