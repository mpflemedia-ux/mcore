/* M-Core phone alerts P3 — owner/admin card on Notification settings: role-based phone routing (default: every role,
   as today) + urgent escalation minutes (platform admin). Writes push_settings (tenant scoped, RLS owner/admin/PA).
   Hidden from non-admin roles; never hidden in platform admin mode. Inert until push_01.sql has run. */
(function () {
  var NT = window.NT; if (!NT || !NT.push || NT.pushAdmin) return;
  var P = NT.push, esc = NT.esc, CATS = ['approval', 'sd', 'assigned', 'overdue', 'contract'], RK = { approval: 'rApproval', sd: 'rSd', assigned: 'rAssigned', overdue: 'rOverdue', contract: 'rContract' };
  function T(k) { return P.T(k); }
  function TS(k) { try { return LANG[APP.language === 'bm' ? 'bm' : 'en'].notifSet[k] || k; } catch (e) { return k; } }
  function admin() { try { return (typeof isTenantAdmin === 'function' && isTenantAdmin()) || (typeof isPlatformAdmin === 'function' && isPlatformAdmin()); } catch (e) { return false; } }
  function pa() { try { return typeof isPlatformAdmin === 'function' && isPlatformAdmin(); } catch (e) { return false; } }
  function roles() { try { return typeof _allTenantRoles === 'function' ? _allTenantRoles() : ['owner', 'admin', 'staff']; } catch (e) { return ['owner', 'admin', 'staff']; } }
  function rl(r) { try { return typeof _roleLabel === 'function' ? _roleLabel(r, APP.language === 'bm') : r; } catch (e) { return r; } }
  NT.pushAdmin = function (m) {
    if (!admin() || !NT.tid()) return;
    P.probe().then(function (on) {
      if (!on || !m.isConnected || m.querySelector('#nt-padm')) return;
      return Promise.resolve(sb.from('push_settings').select('id,settings').eq('tenant_id', NT.tid()).is('deleted_at', null).maybeSingle()).then(function (r) {
        var row = (r && r.data) || null, S = (row && row.settings) || {}, R = S.roles || {}, card = document.createElement('div');
        card.className = 'nt-card nt-pad'; card.id = 'nt-padm';
        var ref = m.querySelector('#nt-push'); if (ref && ref.parentNode) ref.parentNode.insertBefore(card, ref.nextSibling); else return;
        var em = S.escalate_min == null ? 30 : +S.escalate_min;
        card.innerHTML = '<div class="nt-row"><i class="ti ti-route nt-big"></i><div class="nt-bd"><b>' + esc(T('rtTitle')) + '</b><div class="nt-m">' + esc(T('rtD')) + '</div></div></div>' +
          roles().map(function (ro) {
            var list = Array.isArray(R[ro]) ? R[ro] : null;
            return '<div class="nt-pdev" data-role="' + esc(ro) + '"><b>' + esc(rl(ro)) + '</b><div class="nt-days" style="margin-top:6px">' + CATS.map(function (c) {
              var onc = !list || list.indexOf(c) >= 0; return '<button type="button" class="nt-day' + (onc ? ' on' : '') + '" data-c="' + c + '" aria-pressed="' + onc + '">' + esc(TS(RK[c])) + '</button>';
            }).join('') + '</div></div>';
          }).join('') +
          (pa() ? '<div class="nt-pdev"><b>' + esc(T('esc')) + '</b><div class="nt-m">' + esc(T('escD')) + '</div><div class="nt-row" style="margin-top:6px;gap:8px"><input id="nt-esc" type="number" min="0" max="1440" step="5" class="form-input" style="width:96px" value="' + esc(em) + '" aria-label="' + esc(T('esc') + ' (' + T('min') + ')') + '"><span class="nt-m">' + esc(T('min') + ' · ' + T('escOff')) + '</span></div></div>' : '') +
          '<div class="nt-pbtns"><button type="button" class="btn btn-sm btn-outline" data-rts="1">' + esc(T('rtSave')) + '</button></div>';
        card.querySelectorAll('[data-c]').forEach(function (b) { b.onclick = function () { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); }; });
        card.querySelector('[data-rts]').onclick = function () {
          var b = this, out = {}; b.disabled = true;
          card.querySelectorAll('[data-role]').forEach(function (d) { var on = [].map.call(d.querySelectorAll('[data-c].on'), function (x) { return x.dataset.c; }); if (on.length < CATS.length) out[d.dataset.role] = on; });
          var ns = Object.assign({}, S, { roles: out }), ei = card.querySelector('#nt-esc');
          if (ei) { var v = Math.max(0, Math.min(1440, Math.round(+ei.value || 0))); ns.escalate_min = v; ei.value = v; }
          var now = new Date().toISOString(), q = row ? sb.from('push_settings').update({ settings: ns, updated_by: NT.uid(), updated_at: now }).eq('id', row.id).eq('tenant_id', NT.tid())
            : sb.from('push_settings').insert({ tenant_id: NT.tid(), settings: ns, updated_by: NT.uid(), updated_at: now }).select('id,settings').single();
          Promise.resolve(q).then(function (x) {
            b.disabled = false; var ok = x && !x.error; if (ok) { S = ns; if (!row && x.data) row = x.data; }
            try { showToast(T(ok ? 'rtSaved' : 'rtFail'), ok ? 'success' : 'error'); } catch (e) {}
          }, function () { b.disabled = false; try { showToast(T('rtFail'), 'error'); } catch (e) {} });
        };
      });
    }).catch(function () {});
  };
})();
