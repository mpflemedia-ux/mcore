/* M-Core Service Desk - Public Link form + thank-you (no login, /app/?service_link=TOKEN). Needs sd-pub-base.js.
   Writes are limited by RLS (token hash, allowed service, burst + monthly quota, lengths); honeypot + min fill time + checkbox here. */
(function () {
  if (window._sdPub || !window.SDP) return; window._sdPub = 1;
  var P = SDP, TOK = P.TOK, SEC = P.SEC, L = function (a, b) { return P.L(a, b); }, esc = P.esc, page = P.page, card = P.card, fg = P.fg, inactive = P.inactive, statusUrl = P.statusUrl, hex = P.hex, rnd = P.rnd;
  var TYPES = /\.(pdf|jpe?g|png|webp|heic|xlsx?|csv|txt|docx?)$/i, MAX = 10485760, link, svcs = [], started = Date.now(), root;
  var form = { name: '', contact: '', svc: '', svcs: [], title: '', desc: '', file: null, human: false }, multi = false; /* multi = sd_multi_01.sql live: pick up to 5, 1 quota per group */
  function renderForm() {
    var nm = svcs.map(function (s) { return '<option value="' + esc(s.code) + '"' + (form.svc === s.code ? ' selected' : '') + '>' + esc(P.lang() === 'bm' ? s.name_bm : s.name_en) + '</option>'; }).join('');
    page(card('<form id="sp-f" novalidate><b style="font-size:16px">' + L('Send a service request', 'Hantar permohonan servis') + '</b><div class="cob-xs" style="margin:2px 0 14px">' + L('No login needed. Your request will be reviewed by ', 'Tiada log masuk diperlukan. Permohonan akan disemak oleh pihak ') + esc(link.display_name) + (/\.$/.test(link.display_name) ? '' : '.') + '</div>' +
      fg(L('Name', 'Nama'), '<input class="form-input" data-no-titlecase="1" id="sp-n" maxlength="120" autocomplete="name" value="' + esc(form.name) + '">') +
      fg(L('Email / Phone', 'Email / Telefon'), '<input class="form-input" data-no-titlecase="1" id="sp-c" maxlength="160" autocomplete="email" value="' + esc(form.contact) + '">') +
      (multi ? fg(L('Services (up to 5)', 'Servis (maksimum 5)'), '<div class="sd-pick" id="sp-ms">' + svcs.map(function (s) { return '<label><input type="checkbox" value="' + esc(s.code) + '"' + (form.svcs.indexOf(s.code) >= 0 ? ' checked' : '') + '><span>' + esc(P.lang() === 'bm' ? s.name_bm : s.name_en) + '</span></label>'; }).join('') + '</div>') : fg(L('Service', 'Servis'), '<select class="form-input" id="sp-s"><option value="">' + L('Choose…', 'Pilih…') + '</option>' + nm + '</select>')) +
      fg(L('Title', 'Tajuk'), '<input class="form-input" data-no-titlecase="1" id="sp-t" maxlength="200" value="' + esc(form.title) + '">') +
      fg(L('Details', 'Butiran'), '<textarea class="form-input" data-no-titlecase="1" id="sp-d" rows="4" maxlength="4000">' + esc(form.desc) + '</textarea>') +
      fg(L('Attachment (optional, max 10 MB: PDF, image, Excel, Word, CSV)', 'Lampiran (pilihan, maks 10 MB: PDF, gambar, Excel, Word, CSV)'), '<input type="file" class="form-input" id="sp-file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.xlsx,.xls,.csv,.txt,.docx,.doc">') +
      '<input id="sp-hp" name="company_website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px" aria-hidden="true">' +
      '<label class="cob-card" style="padding:12px;display:flex;gap:10px;align-items:center;margin-bottom:14px;cursor:pointer"><input type="checkbox" id="sp-h" style="width:20px;height:20px;accent-color:var(--primary)"' + (form.human ? ' checked' : '') + '><span style="font-size:13px">' + L("I'm not a robot", 'Saya bukan robot') + '</span><i class="ti ti-shield-check" style="margin-left:auto;font-size:22px;color:var(--text-3)"></i></label>' +
      '<div id="sp-err" class="cob-banner err" style="display:none;margin-bottom:12px"></div><button class="btn btn-primary" id="sp-go" style="width:100%;justify-content:center;min-height:46px"><i class="ti ti-send"></i> ' + L('Send', 'Hantar') + '</button></form>'), link.display_name);
    root.querySelector('#sp-f').onsubmit = submit;
    root.querySelectorAll('#sp-ms input').forEach(function (i) { i.onchange = function () { var on = root.querySelectorAll('#sp-ms input:checked').length; root.querySelectorAll('#sp-ms input').forEach(function (x) { x.disabled = !x.checked && on >= 5; }); }; i.onchange(); });
  }
  function grab() { var g = function (i) { return root.querySelector(i); }; form.name = g('#sp-n').value.trim(); form.contact = g('#sp-c').value.trim(); form.svcs = multi ? [].map.call(root.querySelectorAll('#sp-ms input:checked'), function (x) { return x.value; }).slice(0, 5) : []; form.svc = multi ? form.svcs[0] || '' : g('#sp-s').value; form.title = g('#sp-t').value.trim(); form.desc = g('#sp-d').value.trim(); form.human = g('#sp-h').checked; if (g('#sp-file').files[0]) form.file = g('#sp-file').files[0]; }
  function err(m) { var e = root.querySelector('#sp-err'); e.textContent = m; e.style.display = 'flex'; e.scrollIntoView({ block: 'center' }); }
  function submit(ev) {
    ev.preventDefault(); grab();
    if (root.querySelector('#sp-hp').value || Date.now() - started < 4000) return err(L('Please try again in a moment.', 'Sila cuba sebentar lagi.'));
    if (form.name.length < 2 || form.contact.length < 5 || !form.svc || form.title.length < 3) return err(L('Please fill in name, contact, service and title.', 'Sila isi nama, hubungan, servis dan tajuk.'));
    if (!form.human) return err(L("Please tick “I'm not a robot”.", 'Sila tanda “Saya bukan robot”.'));
    if (form.file && (form.file.size > MAX || !TYPES.test(form.file.name))) return err(L('Attachment must be PDF, image, Excel, Word or CSV, max 10 MB.', 'Lampiran mesti PDF, gambar, Excel, Word atau CSV, maks 10 MB.'));
    var btn = root.querySelector('#sp-go'); btn.disabled = true;
    var sec = rnd(28), path = null, n = 0;
    var up = form.file ? sb.storage.from('service-public').upload(TOK + '/' + Date.now() + '-' + form.file.name.replace(/[^\w.\-]+/g, '_').slice(-80), form.file, { upsert: false }).then(function (u) { if (u.error) throw u.error; path = u.data.path; }) : Promise.resolve();
    var all = multi && form.svcs.length > 1 ? form.svcs : [form.svc], gk = all.length > 1 ? rnd(16) : null, refs = [];
    function ins(h, k) {
      return sb.from('service_public_requests').select('ref_no').eq('tenant_id', link.tenant_id).order('ref_no', { ascending: false }).limit(1).then(function (r) {
        var last = r.data && r.data[0] ? parseInt(String(r.data[0].ref_no).slice(7), 10) || 0 : 0, ref = 'SR-PUB-' + String(last + 1 + n).padStart(4, '0');
        return sb.from('service_public_requests').insert(Object.assign({ tenant_id: link.tenant_id, link_id: link.id, link_token: TOK, ref_no: ref, status_hash: h, service_code: all[k], sender_name: form.name, sender_contact: form.contact, title: form.title, description: form.desc || null, file_path: path, file_name: form.file ? form.file.name.slice(-200) : null, file_size: form.file ? form.file.size : null, lang: P.lang() }, gk ? { group_key: gk } : {}))
          .then(function (x) { if (x.error && x.error.code === '23505' && ++n < 6) return ins(h, k); if (x.error) throw x.error; refs.push(ref); return ref; });
      });
    }
    up.then(function () { return hex(sec); }).then(function (h) { return all.reduce(function (p, s, k) { return p.then(function () { return k ? hex(sec + '-' + k).then(function (h2) { return ins(h2, k); }) : ins(h, 0); }); }, Promise.resolve()); }).then(function () { var ref = refs[0] + (refs.length > 1 ? ' +' + (refs.length - 1) : '');
      try { localStorage.setItem('sd_pub_last', JSON.stringify({ sec: sec, ref: ref, title: form.title, name: link.display_name })); } catch (e) {}
      thanks(ref, sec);
    }).catch(function (e) {
      btn.disabled = false;
      err(/row-level|42501|policy/i.test((e && (e.message || e.code)) || '') ? L('This link cannot accept more requests right now (limit reached or link changed). Please try later.', 'Link ini tidak dapat menerima permohonan sekarang (had dicapai atau link berubah). Sila cuba kemudian.') : L('Could not send. Check the attachment and try again.', 'Tidak dapat dihantar. Semak lampiran dan cuba lagi.'));
    });
  }
  function thanks(ref, sec) {
    var url = statusUrl(sec);
    page(card('<div style="text-align:center;padding:10px 0"><div style="width:64px;height:64px;border-radius:50%;background:var(--primary-light);color:var(--success);display:inline-flex;align-items:center;justify-content:center"><i class="ti ti-circle-check" style="font-size:38px"></i></div>' +
      '<div style="font-weight:700;font-size:18px;margin-top:12px">' + L('Thank you, ', 'Terima kasih, ') + esc(form.name.split(' ')[0]) + '</div><div class="cob-sm" style="margin-top:4px">' + L('Your request was received and is waiting for approval by ', 'Permohonan anda telah diterima dan menunggu kelulusan ') + esc(link.display_name) + '.</div>' +
      '<div class="cob-card" style="padding:14px;margin:16px 0 12px"><div class="cob-xs">' + L('Reference no.', 'No. rujukan') + '</div><div class="sd-ref" style="font-size:20px;font-weight:700;color:var(--text);margin-top:2px">' + esc(ref) + '</div></div>' +
      '<div class="cob-xs" style="margin-bottom:14px">' + L('Save the status link below to check progress later.', 'Simpan link status di bawah untuk semak perkembangan kemudian.') + '</div>' +
      '<a class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:8px" href="' + esc(url) + '"><i class="ti ti-search"></i> ' + L('Check status', 'Semak status') + '</a><button type="button" class="btn btn-outline" id="sp-cp" style="width:100%;justify-content:center"><i class="ti ti-copy"></i> ' + L('Copy status link', 'Salin link status') + '</button></div>'), link.display_name);
    root.querySelector('#sp-cp').onclick = function () { try { navigator.clipboard.writeText(url); this.innerHTML = '<i class="ti ti-check"></i> ' + L('Copied', 'Disalin'); } catch (e) {} };
  }
  function render() {
    if (SEC) return P.status(SEC);
    if (!link) return inactive();
    renderForm();
  }
  function start() {
    P.mount(); root = P.root(); P.onLang = render; root.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    if (SEC) return render();
    hex(TOK).then(function (h) { return sb.from('service_public_links').select('id,tenant_id,display_name,services,monthly_quota,expires_on').eq('token_hash', h).maybeSingle(); })
      .then(function (r) {
        var l = r && r.data, today = new Date(Date.now() + 288e5).toISOString().slice(0, 10);
        if (!l || (l.expires_on && l.expires_on < today)) return inactive();
        link = l;
        return Promise.all([sb.from('service_catalog').select('code,name_en,name_bm,sort').in('code', l.services || []), sb.from('service_public_requests').select('group_key').limit(0)]).then(function (cc) {
          var c = cc[0]; multi = !!(cc[1] && !cc[1].error);
          svcs = (c.data || []).sort(function (a, b) { return (+a.sort || 0) - (+b.sort || 0); });
          if (!svcs.length) { link = null; return inactive(); }
          render();
        });
      }).catch(function () { inactive(); });
  }
  (function go() { if (window.sb && document.body) start(); else setTimeout(go, 80); })();
})();
