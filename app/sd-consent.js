/* M-Core Service Desk - support access consent: client Settings 'Akses Sokongan' + consent check around the existing
   support session (support-tenant.js / enter_support_tenant RPC unchanged). App-side control + logging only: RLS still
   lets platform admin read data, procedural control, not a security boundary. Missing table => old behaviour. */
(function () {
  var SD = window.SD; if (!SD || SD._consent) return; SD._consent = 1;
  var KEY = 'mcore_sd_support', MODS = [['sales', 'ti-receipt', 'Sales', 'Jualan'], ['accounting', 'ti-calculator', 'Accounting', 'Perakaunan'], ['hr', 'ti-users', 'HR & Payroll', 'SDM & Gaji'], ['crm', 'ti-address-book', 'Customers (CRM)', 'Pelanggan (CRM)']];
  /* spec module -> app module keys (NAV_ITEMS.module) */
  var MAP = { sales: ['sales', 'sales_plan', 'sales_commission', 'sales_academy', 'pos'], accounting: ['accounting', 'vouchers', 'reports', 'purchasing'], hr: ['hr', 'hr_recruit'], crm: ['crm'] };
  function sess() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function inSupport() { try { return SD.isPA() && !!sessionStorage.getItem('mcore_support_session'); } catch (e) { return false; } }
  function get(tid) { return sb.from('support_access_consents').select('*').eq('tenant_id', tid).is('deleted_at', null).maybeSingle(); }

  /* ---- client: Settings card + page ---- */
  SD.settingsHook = function () {
    if (!SD.has.consent || !SD.isTA() || SD.isPA() || APP.currentPage !== 'settings') return;
    var m = SD.main(); if (!m || document.getElementById('sd-acc-card')) return;
    var d = document.createElement('div'); d.id = 'sd-acc-card'; d.className = 'card'; d.style.cssText = 'padding:14px 16px;margin-bottom:16px;display:flex;gap:12px;align-items:center';
    d.innerHTML = '<i class="ti ti-shield-lock" style="font-size:22px;color:var(--primary)"></i><div style="flex:1;min-width:0"><b>' + SD.L('Support Access', 'Akses Sokongan') + '</b><div style="font-size:12.5px;color:var(--text-3)">' + SD.L('Control when the M-Core team may enter your workspace', 'Kawal bila pasukan M-Core boleh masuk ke ruang kerja anda') + '</div></div><button class="btn btn-sm btn-outline">' + SD.L('Manage', 'Urus') + ' <i class="ti ti-chevron-right"></i></button>';
    d.querySelector('button').onclick = function () { SD.go('sd_access'); };
    var ph = m.querySelector('.page-header'); if (ph && ph.parentNode === m) ph.after(d); else m.insertBefore(d, m.firstChild);
  };
  SD.view.sd_access = function () {
    var tid = SD.tid();
    return Promise.all([get(tid), sb.from('service_request_events').select('created_at,meta,request_id,actor_id').eq('tenant_id', tid).eq('type', 'support_access').order('created_at', { ascending: false }).limit(30)])
      .then(function (r) { if (r[0].error) throw r[0].error; return SD.names((r[1].data || []).map(function (e) { return e.actor_id; })).then(function (n) { paint(r[0].data, r[1].data || [], n); }); });
  };
  function paint(c, log, names) {
    var m = SD.main(); c = c || { enabled: false, scope: 'open_request_only', allowed_modules: ['sales', 'accounting', 'hr', 'crm'] };
    var mods = c.allowed_modules || [];
    var radio = function (v, en, bm, sen, sbm) { return '<label class="row" style="gap:10px;padding:10px 0;align-items:flex-start;cursor:pointer"><input type="radio" name="sd-sc" value="' + v + '"' + (c.scope === v ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--primary);margin-top:2px"><div><b style="font-size:13.5px">' + SD.L(en, bm) + '</b><div class="cob-xs">' + SD.L(sen, sbm) + '</div></div></label>'; };
    m.innerHTML = '<div class="cob-root" style="max-width:720px"><button class="btn btn-sm btn-outline" onclick="openPage(\'settings\')" style="margin-bottom:12px"><i class="ti ti-arrow-left"></i> ' + SD.L('Settings', 'Tetapan') + '</button>' +
      '<div class="cob-card" style="padding:16px;margin-bottom:12px"><div class="row"><div class="grow"><b style="font-size:15px">' + SD.L('Allow support access', 'Benarkan akses sokongan') + '</b><div class="cob-xs">' + SD.L('M-Core staff can enter your workspace to do contracted work', 'Staf M-Core boleh masuk ruang kerja anda untuk kerja dalam kontrak') + '</div></div><button type="button" class="cob-sw' + (c.enabled ? ' on' : '') + '" id="sd-en" aria-label="enable"></button></div></div>' +
      '<div class="cob-card" style="padding:16px;margin-bottom:12px"><b style="font-size:15px">' + SD.L('Scope', 'Skop') + '</b>' + radio('open_request_only', 'Only for an open request', 'Hanya untuk permohonan terbuka', 'Each session must be tied to one of your open requests', 'Setiap sesi mesti dikaitkan dengan permohonan terbuka anda') + radio('contract', 'Whole contract period', 'Sepanjang tempoh kontrak', 'Staff may enter any time while the contract is active', 'Staf boleh masuk bila-bila masa semasa kontrak aktif') + '</div>' +
      '<div class="cob-card" style="padding:16px;margin-bottom:12px"><b style="font-size:15px">' + SD.L('Modules staff may open', 'Modul yang boleh dibuka staf') + '</b><div class="sd-mods" style="margin-top:10px">' + MODS.map(function (x) { return '<label class="row cob-card" style="gap:8px;padding:10px;cursor:pointer"><input type="checkbox" value="' + x[0] + '"' + (mods.indexOf(x[0]) >= 0 ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--primary)"><i class="ti ' + x[1] + '"></i><span style="font-size:13px">' + SD.L(x[2], x[3]) + '</span></label>'; }).join('') + '</div>' +
      '<button class="btn btn-primary" id="sd-save" style="width:100%;margin-top:12px;justify-content:center"><i class="ti ti-device-floppy"></i> ' + SD.L('Save', 'Simpan') + '</button></div>' +
      '<div class="cob-card" style="padding:16px"><b style="font-size:15px">' + SD.L('Access log', 'Log akses') + '</b>' + (log.length ? log.map(function (e) { var mt = e.meta || {}; return '<div class="sd-ev"><i class="ti ' + (mt.action === 'end' ? 'ti-logout' : 'ti-login-2') + '"></i><div class="grow"><b style="font-size:13px">' + (mt.action === 'end' ? SD.L('Session ended', 'Sesi tamat') : SD.L('Session started', 'Sesi bermula')) + (mt.ref_no ? ' · ' + SD.esc(mt.ref_no) : '') + '</b><div class="cob-xs">' + SD.dt(e.created_at) + ' · ' + SD.esc(names[e.actor_id] || 'M-Core') + '</div></div></div>'; }).join('') : '<div class="cob-xs" style="padding:10px 0">' + SD.L('No support sessions yet.', 'Belum ada sesi sokongan.') + '</div>') + '</div></div>';
    m.querySelector('#sd-en').onclick = function () { this.classList.toggle('on'); };
    m.querySelector('#sd-save').onclick = function () {
      var b = this, rec = { tenant_id: SD.tid(), enabled: m.querySelector('#sd-en').classList.contains('on'), scope: (m.querySelector('input[name="sd-sc"]:checked') || {}).value || 'open_request_only',
        allowed_modules: Array.prototype.map.call(m.querySelectorAll('.sd-mods input:checked'), function (x) { return x.value; }), updated_by: SD.uid(), updated_at: new Date().toISOString() };
      b.disabled = true;
      (c.id ? sb.from('support_access_consents').update(rec).eq('id', c.id) : sb.from('support_access_consents').insert(rec)).then(function (r) {
        b.disabled = false; if (r.error) return SD.toast(SD.err(r.error), 'error'); SD.toast(SD.L('Saved', 'Disimpan'), 'success'); SD.view.sd_access();
      });
    };
  }
  /* ---- platform admin: consent gate around the existing support session ---- */
  function allowMod(m) {
    var s = sess(); if (!s || !inSupport() || !s.modules) return true;
    if (m === 'core' || m === 'admin') return true;
    return s.modules.some(function (k) { return (MAP[k] || []).indexOf(m) >= 0; });
  }
  function wrapGate() {
    var o = window._planAllowsModule; if (typeof o !== 'function' || o._sdGate) return;
    var w = function (m) { if (inSupport()) { var s = sess(); return s && s.modules ? allowMod(m) : true; } return o.apply(this, arguments); };
    w._sdGate = 1; w._supportFull = true; window._planAllowsModule = w;
  }
  SD.supportDialog = function (tid, cons, reqs, done) {
    var must = cons.scope === 'open_request_only';
    var w = SD.modal(SD.L('Start support session', 'Mulakan sesi sokongan'), '<div style="padding:14px"><div class="cob-banner ok" style="margin-bottom:12px"><i class="ti ti-shield-check"></i><div>' + SD.L('Client consent: ', 'Kebenaran klien: ') + '<b>' + (must ? SD.L('open requests only', 'permohonan terbuka sahaja') : SD.L('whole contract', 'sepanjang kontrak')) + '</b></div></div>' +
      '<label class="form-label">' + SD.L('Request', 'Permohonan') + (must ? ' *' : ' (' + SD.L('optional', 'pilihan') + ')') + '</label><select class="form-input" id="sd-rq">' + (must ? '' : '<option value="">—</option>') + reqs.map(function (r) { return '<option value="' + r.id + '">' + SD.esc(r.ref_no + ' · ' + r.title) + '</option>'; }).join('') + '</select>' +
      '<div class="cob-xs" style="margin:12px 0 6px">' + SD.L('Modules allowed', 'Modul dibenarkan') + '</div><div class="cob-chips">' + (cons.allowed_modules || []).map(function (k) { var x = MODS.find(function (y) { return y[0] === k; }); return x ? '<span class="cob-chip on"><i class="ti ' + x[1] + '"></i> ' + SD.L(x[2], x[3]) + '</span>' : ''; }).join('') + '</div>' +
      '<div class="cob-xs" style="margin-top:10px">' + SD.L('Start and end are logged in the request timeline and audit log.', 'Mula dan tamat direkod dalam garis masa permohonan dan log audit.') + '</div><div class="sd-acts" style="margin-top:14px"><button class="btn btn-outline" data-x style="flex:1">' + SD.L('Cancel', 'Batal') + '</button><button class="btn btn-primary" id="sd-go" style="flex:1"' + (must && !reqs.length ? ' disabled' : '') + '><i class="ti ti-login-2"></i> ' + SD.L('Enter workspace', 'Masuk workspace') + '</button></div></div>');
    w.querySelector('#sd-go').onclick = function () { var v = w.querySelector('#sd-rq').value; if (must && !v) return; SD.closeModal(); done(reqs.find(function (r) { return SD.same(r.id, v); }) || null); };
  };
  function log(rq, action) { if (!rq) return Promise.resolve(); return SD.event(rq, 'support_access', { body: null, meta: { action: action, ref_no: rq.ref_no } }).catch(function () {}); }
  function wrapSupport() {
    var en = window._enterSupportTenant, ex = window._exitSupportTenant;
    if (typeof en === 'function' && !en._sd) {
      var we = function (tid) {
        var self = this, args = arguments;
        return SD.probe().then(function () {
          if (!SD.has.consent || !SD.isPA()) return en.apply(self, args);
          return get(tid).then(function (c) {
            if (c.error && SD.missing(c.error)) return en.apply(self, args);
            var cons = c.data;
            if (!cons || !cons.enabled) { SD.toast(SD.L('The client has not allowed support access (Settings › Support Access).', 'Klien belum membenarkan akses sokongan (Tetapan › Akses Sokongan).'), 'error'); return; }
            return sb.from('service_requests').select('id,tenant_id,ref_no,title,status').eq('tenant_id', tid).in('status', ['triaged', 'in_progress', 'waiting_client', 'revision', 'submitted']).is('deleted_at', null).order('created_at', { ascending: false }).then(function (q) {
              SD.supportDialog(tid, cons, q.data || [], function (rq) {
                try { sessionStorage.setItem(KEY, JSON.stringify({ tid: tid, rid: rq && rq.id, ref: rq && rq.ref_no, modules: cons.allowed_modules || [], scope: cons.scope })); } catch (e) {}
                wrapGate();
                Promise.resolve(en.apply(self, args)).then(function () { log(rq, 'start'); try { buildSidebar(); } catch (e) {} });
              });
            });
          });
        });
      };
      we._sd = 1; window._enterSupportTenant = we;
    }
    if (typeof ex === 'function' && !ex._sd) {
      var wx = function () {
        var s = sess(), self = this, args = arguments;
        var rq = s && s.rid ? { id: s.rid, tenant_id: s.tid, ref_no: s.ref } : null;
        return log(rq, 'end').then(function () { try { sessionStorage.removeItem(KEY); } catch (e) {} return ex.apply(self, args); });
      };
      wx._sd = 1; window._exitSupportTenant = wx;
    }
  }
  var n = 0; (function tick() { wrapSupport(); if (sess()) wrapGate(); if (++n < 40) setTimeout(tick, 500); })();
})();
