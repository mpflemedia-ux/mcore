/* M-Core Onboarding Checklist - platform admin view of one tenant: checklist (ob1 layout) + PIC, target date, reminder, start. */
(function () {
  var C = window.COB; if (!C || C._pat) return; C._pat = 1;
  var E = C.esc, L = C.L;
  C.paTenant = function (tid) {
    return Promise.all([C.loadT(tid), sb.from('tenants').select('id,name').eq('id', tid).maybeSingle()]).then(function (r) {
      var d = r[0], t = (r[1] && r[1].data) || { name: '—' }, m = document.getElementById('main'); if (APP.currentPage !== 'cob_admin') return;
      var head = '<div class="cob-head"><div class="row" style="gap:6px"><button class="header-btn" data-a="back" style="width:40px;height:40px" aria-label="' + L('Back', 'Kembali') + '"><i class="ti ti-arrow-left"></i></button><div><div class="cob-h1">' + E(t.name) + '</div><div class="cob-sm">' + L('Client onboarding', 'Onboarding klien') + '</div></div></div>';
      if (!d.cl) {
        m.innerHTML = '<div class="cob-root" style="max-width:880px;margin:0 auto">' + head + '</div><div class="cob-card" style="padding:24px;text-align:center"><div class="cob-sm" style="margin-bottom:12px">' + L('This tenant has not started onboarding.', 'Tenant ini belum memulakan onboarding.') + '</div><button class="btn btn-primary" data-a="start"><i class="ti ti-player-play"></i>' + L('Start for tenant', 'Mula untuk tenant') + '</button></div></div>';
      } else {
        var draw = function () {
          m.innerHTML = '<div class="cob-root" style="max-width:880px;margin:0 auto">' + head + '<div class="row cob-noprint" style="gap:8px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" data-a="pic"><i class="ti ti-user-check"></i>' + L('Set PIC', 'Tetapkan PIC') + '</button><button class="btn btn-outline btn-sm" data-a="target"><i class="ti ti-calendar"></i>' + L('Target date', 'Tarikh sasaran') + '</button>' +
            '<button class="btn btn-outline btn-sm" data-a="review"><i class="ti ti-inbox"></i>' + L('Review', 'Semak') + '</button><button class="btn btn-outline btn-sm" data-a="remind"><i class="ti ti-bell-ringing"></i>' + L('Send reminder', 'Hantar peringatan') + '</button><button class="btn btn-primary btn-sm" data-a="pdf"><i class="ti ti-file-type-pdf"></i>' + L('Export PDF', 'Eksport PDF') + '</button></div></div>' + C.tenantBody(d, { tname: t.name }) + '</div>';
          C.bindTenant(m.firstChild, draw, function (id) { C.go('cob_admin', { view: 'item', id: id, tenant: tid }); });
          var inner = m.firstChild.onclick; m.firstChild.onclick = function (ev) { var b = ev.target.closest('[data-a]'); if (b) return act(b.dataset.a); return inner && inner(ev); };
        };
        draw(); return;
      }
      m.firstChild.onclick = function (ev) { var b = ev.target.closest('[data-a]'); if (b) act(b.dataset.a); };
      function act(a) {
        if (a === 'back') return C.go('cob_admin', {});
        if (a === 'review') return C.go('cob_admin', { view: 'review', tenant: tid });
        if (a === 'pdf') return C.print();
        if (a === 'remind') return C.remind([tid]);
        if (a === 'start') return sb.rpc('cob_start', { p_tenant: tid }).then(done).catch(fail);
        if (a === 'pic') {
          var n = window.prompt(L('M-Core PIC name', 'Nama PIC M-Core'), d.cl.pic_name || ''); if (n === null) return;
          return sb.from('cob_checklists').update({ pic_name: n.trim() || null, pic_user_id: n.trim() ? d.cl.pic_user_id : null }).eq('id', d.cl.id).select('id').then(chk).then(done).catch(fail);
        }
        if (a === 'target') {
          var v = window.prompt(L('Target date (YYYY-MM-DD)', 'Tarikh sasaran (YYYY-MM-DD)'), d.cl.target_date || ''); if (v === null) return;
          if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return C.toast(L('Use YYYY-MM-DD', 'Guna YYYY-MM-DD'), 'warning');
          return sb.from('cob_checklists').update({ target_date: v.trim() || null }).eq('id', d.cl.id).select('id').then(chk).then(done).catch(fail);
        }
      }
      function chk(r) { if (r.error) throw r.error; if (!r.data || !r.data.length) throw new Error(L('Not saved (no permission)', 'Tidak disimpan (tiada kebenaran)')); }
      function done() { C.toast(L('Saved', 'Disimpan'), 'success'); C.go('cob_admin', { view: 'tenant', tenant: tid }); }
      function fail(e) { C.toast(C.err(e), 'error'); }
    });
  };
})();
