/* M-Core booking payment flow - Settings > Public booking: deposit % per service (blank = full payment; booking confirms once the deposit
   is verified) and booking payment review settings (grace after reject / part payment, slow-review reminder) in pay_settings. v1 */
(function () {
  var P = window.PAYX; if (!P || window.BKPAYD) return;
  var D = window.BKPAYD = {}, E = P.esc, t = P.t, busy = false;
  function lab(txt, inp) { return '<label style="font-size:12px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap">' + E(txt) + ' ' + inp + '</label>'; }
  function lab2(txt, inp) { return '<label style="font-size:12px;display:flex;flex-direction:column;align-items:flex-start;gap:4px;flex:1 1 200px;min-width:0;color:var(--text-2)">' + E(txt) + inp + '</label>'; }
  /* deposit input on each service row (rows are drawn newest first, same as booking-settings-ui.js) */
  D.svc = function (list) {
    if (busy || !P.tid()) return; busy = true;
    sb.from('booking_services').select('id,name,deposit_pct').eq('tenant_id', P.tid()).order('created_at', { ascending: false }).then(function (q) {
      busy = false; if (q.error) return; var rows = q.data || [], els = Array.prototype.filter.call(list.children, function (e) { return e.tagName === 'DIV'; });
      els.forEach(function (el, i) {
        var r = rows[i], sp = el.querySelector('span'); if (!r || el.querySelector('.bkd-dep') || !sp || sp.textContent.indexOf(r.name || '') !== 0) return;
        var w = document.createElement('span'); w.className = 'bkd-dep'; w.style.cssText = 'margin-left:auto;margin-right:8px';
        w.innerHTML = lab(t('qDeposit'), '<input type="number" class="form-input" min="1" max="100" step="1" inputmode="numeric" placeholder="-" title="' + E(t('qDepHint')) + '" aria-label="' + E(t('qDeposit') + ' · ' + r.name) + '" style="width:72px;min-height:36px" value="' + (r.deposit_pct ? Number(r.deposit_pct) : '') + '">');
        var btn = el.querySelector('button'); el.insertBefore(w, btn || null);
        var inp = w.querySelector('input');
        inp.onchange = function () {
          var v = inp.value === '' ? null : Math.round(Number(inp.value)); if (v != null && !(v >= 1 && v <= 100)) { inp.value = r.deposit_pct || ''; return P.toast(t('qDepHint'), 'error'); }
          sb.from('booking_services').update({ deposit_pct: v }).eq('id', r.id).eq('tenant_id', P.tid()).then(function (u) {
            if (u.error) { inp.value = r.deposit_pct || ''; return P.toast(t('qFail', { e: u.error.message }), 'error'); }
            r.deposit_pct = v; P.audit('update', 'booking_services', r.id); P.toast(t('qSaved'));
          });
        };
      });
    }, function () { busy = false; });
  };
  /* review settings card under the service list */
  D.set = function (list) {
    var host = list.parentNode; if (!host || host.querySelector('#bkd-set')) return;
    var box = document.createElement('div'); box.id = 'bkd-set'; box.style.cssText = 'margin-top:16px;padding-top:12px;border-top:1px solid var(--border)';
    box.innerHTML = '<div style="font-size:12px;font-weight:600;margin:0 0 4px">' + E(t('qPaySet')) + '</div><div style="font-size:12px;color:var(--text-2);margin-bottom:8px">' + E(t('qDepHint')) + '</div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">' + lab2(t('qGrace'), '<input id="bkd-g" type="number" class="form-input" min="10" max="2880" step="5" style="width:84px">') +
      lab2(t('qRemind'), '<input id="bkd-r" type="number" class="form-input" min="0" max="1440" step="5" style="width:84px">') +
      '<button type="button" class="btn btn-outline btn-sm" id="bkd-s" style="min-height:40px">' + E(t('qSave')) + '</button></div><div id="bkd-m" style="font-size:12px;margin-top:6px"></div>';
    var after = host.querySelector('#bk-staff-assign'); host.insertBefore(box, after ? after.nextSibling : null);
    var g = box.querySelector('#bkd-g'), rm = box.querySelector('#bkd-r'), m = box.querySelector('#bkd-m'), s = box.querySelector('#bkd-s');
    P.has('pay_settings').then(function (ok) {
      if (!ok) { m.textContent = t('qNeedSql'); s.disabled = true; return; }
      return sb.from('pay_settings').select('*').eq('tenant_id', P.tid()).maybeSingle().then(function (r) {
        var d = r.data || {}; if (r.error || (r.data && d.bk_grace_min === undefined)) { m.textContent = t('qNeedSql'); s.disabled = true; return; }
        g.value = d.bk_grace_min || 120; rm.value = d.bk_remind_min != null ? d.bk_remind_min : 30;
      });
    }).catch(function () { m.textContent = t('qNeedSql'); s.disabled = true; });
    s.onclick = function () {
      var gv = Math.round(Number(g.value)), rv = Math.round(Number(rm.value));
      if (!(gv >= 10 && gv <= 2880)) return g.focus(); if (!(rv >= 0 && rv <= 1440)) return rm.focus();
      s.disabled = true;
      sb.from('pay_settings').upsert({ tenant_id: P.tid(), bk_grace_min: gv, bk_remind_min: rv, updated_by: P.isPA() ? null : P.uid(), updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' }).then(function (u) {
        s.disabled = false; if (u.error) { m.textContent = t('qFail', { e: u.error.message }); return; }
        P.audit('update', 'pay_settings', P.tid()); m.textContent = t('qSaved');
      });
    };
  };
  function scan() {
    var list = document.getElementById('bk-svc-list'); if (!list) return;
    if (!list._bkd) { list._bkd = new MutationObserver(function () { setTimeout(function () { D.svc(list); }, 50); }); list._bkd.observe(list, { childList: true }); }
    if (list.children.length && !list.querySelector('.bkd-dep')) D.svc(list);
    D.set(list);
  }
  new MutationObserver(function () { clearTimeout(D._t); D._t = setTimeout(scan, 200); }).observe(document.body, { childList: true, subtree: true });

  (function tag(){ var box=document.getElementById('bkd-set'); if(!box||document.getElementById('bk-pay-dep-root')) return; var w=document.createElement('div'); w.id='bk-pay-dep-root'; box.parentNode.insertBefore(w, box.nextSibling); })(); setInterval(function(){ try{ tag(); }catch(e){} }, 1500);
})();