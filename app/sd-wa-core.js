/* M-Core Service Desk - Share WhatsApp core (SDW): probe, status templates EN/BM + service wording, SLA x/y, recipients,
   result link (sha256 token, 7 days), share log + wa_notified event. Hidden until servicedesk_07_wa_share.sql is run. */
(function () {
  var SD = window.SD; if (!SD || window.SDW) return;
  var W = window.SDW = { on: false, shares: {}, dismiss: {} };
  W.L = function (en, bm) { return SD.L(en, bm); };
  W.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var probed = null, logged = false;
  W.probe = function () {
    if (probed) return probed;
    probed = Promise.all(['service_request_shares', 'service_result_links'].map(function (t) { return Promise.resolve(sb.from(t).select('id', { head: true, count: 'exact' }).limit(1)).then(function (r) { return r && r.error; }, function (e) { return e || 1; }); }))
      .then(function (errs) {
        W.on = SD.isPA() && !errs.some(Boolean);
        if (!logged && errs.some(function (e) { return e && SD.missing(e); })) { logged = true; console.info('[M-Core Service Desk] Share WhatsApp tables not found - hidden until servicedesk_07_wa_share.sql is run'); }
        return W.on;
      });
    return probed;
  };
  W.TPL = ['received', 'need_info', 'in_progress', 'done', 'reminder'];
  W.suggest = function (st) { return st === 'delivered' ? 'done' : st === 'waiting_client' ? 'need_info' : (st === 'in_progress' || st === 'revision') ? 'in_progress' : st === 'closed' ? 'reminder' : 'received'; };
  var TN = { received: ['Received', 'Diterima'], need_info: ['Need info', 'Perlu maklumat'], in_progress: ['In progress', 'Dalam proses'], done: ['Done', 'Siap'], reminder: ['Reminder', 'Peringatan'] };
  W.tplName = function (t, lang) { var x = TN[t] || TN.done; return lang ? (lang === 'bm' ? x[1] : x[0]) : W.L(x[0], x[1]); };
  /* SLA from existing columns: due_at = created_at + SLA business hours; taken = created -> delivered minus paused */
  W.sla = function (r) {
    var y = r.due_at ? Math.round(SD.bhBetween(r.created_at, r.due_at)) : null, end = r.delivered_at || r.closed_at;
    var x = end ? Math.max(0, Math.round(SD.bhBetween(r.created_at, end) - (r.sla_paused_seconds || 0) / 3600)) : null;
    return { x: x, y: y, ok: x != null && y != null && x <= y };
  };
  W.phone = function (p) { var d = String(p || '').replace(/\D/g, ''); if (!d) return ''; if (d.charAt(0) === '0') d = '6' + d; return d.length >= 8 && d.length <= 15 ? d : ''; };
  W.waUrl = function (ph, t) { return 'https://wa.me/' + (ph || '') + '?text=' + encodeURIComponent(t); };
  W.open = function (u) { var w = window.open(u, '_blank', 'noopener'); if (!w) location.href = u; };
  W.me = function () { var u = (window.APP && APP.user) || {}; return String(u.full_name || u.name || (u.user_metadata && u.user_metadata.full_name) || u.email || '').slice(0, 120); };
  W.bubble = function (txt) {
    var h = W.esc(txt).replace(/\*([^*\n]+)\*/g, '<b>*$1*</b>').replace(/(^|\n)_([^_\n]+)_/g, '$1<i style="opacity:.7">_$2_</i>').replace(/\n/g, '<br>');
    return '<div class="pjw-chat"><div class="pjw-bub">' + h + '</div></div>';
  };
  W.rnd = function (n) { var a = new Uint8Array(n), c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return c[x % c.length]; }).join(''); };
  W.hex = function (s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }); };
  W.resultUrl = function (tok, lang) { return location.origin + location.pathname.replace(/[^/]*$/, '') + '?sr_result=' + tok + '&lang=' + lang; };
  W.withLink = function (tpl, r) { return true; };
  /* recipients: requester (public sender contact or user profile), tenant owner/admin, company phone */
  W.recips = function (r) {
    var pick = function (p) { return p ? (p.phone || p.mobile || p.phone_number || p.whatsapp || '') : ''; };
    return Promise.all([
      r.created_by ? Promise.resolve(sb.from('user_profiles').select('*').eq('id', r.created_by).maybeSingle()).then(function (x) { return x.data; }, function () { return null; }) : null,
      Promise.resolve(sb.from('service_public_requests').select('sender_name,sender_contact').eq('request_id', r.id).maybeSingle()).then(function (x) { return x.data; }, function () { return null; }),
      Promise.resolve(sb.from('user_profiles').select('*').eq('tenant_id', r.tenant_id)).then(function (x) { return x.data || []; }, function () { return []; }),
      Promise.resolve(sb.from('tenants').select('name,phone').eq('id', r.tenant_id).maybeSingle()).then(function (x) { return x.data; }, function () { return null; })
    ]).then(function (x) {
      var out = [], pub = x[1], me = x[0];
      if (pub) out.push({ id: 'pub', kind: 'requester', n: pub.sender_name, s: W.L('Requester (public link)', 'Pemohon (link awam)'), ph: W.phone(pub.sender_contact) });
      else if (me) out.push({ id: String(me.id), kind: 'requester', n: me.full_name || '—', s: W.L('Requester', 'Pemohon'), ph: W.phone(pick(me)) });
      x[2].filter(function (u) { var ro = String(u.role || '').toLowerCase(); return (ro === 'owner' || ro === 'admin') && !(me && SD.same(u.id, me.id)); }).forEach(function (u) { out.push({ id: String(u.id), kind: 'pic', n: u.full_name || '—', s: (String(u.role).toLowerCase() === 'owner' ? 'Owner' : 'Admin') + (x[3] ? ' · ' + x[3].name : ''), ph: W.phone(pick(u)) }); });
      if (x[3] && W.phone(x[3].phone)) out.push({ id: 'co', kind: 'pic', n: x[3].name, s: W.L('Company phone', 'Telefon syarikat'), ph: W.phone(x[3].phone) });
      return out;
    });
  };
  W.loadShares = function (ids) {
    ids = ids.filter(Boolean); if (!ids.length || !W.on) return Promise.resolve(W.shares);
    return Promise.resolve(sb.from('service_request_shares').select('id,request_id,template,recipient_label,created_at,created_by_name').in('request_id', ids).is('deleted_at', null).order('created_at', { ascending: false }).limit(2000))
      .then(function (x) { ids.forEach(function (i) { W.shares[i] = []; }); (x.data || []).forEach(function (s) { (W.shares[s.request_id] = W.shares[s.request_id] || []).push(s); }); return W.shares; }, function () { return W.shares; });
  };
  /* 'Belum dimaklumkan' = delivered and no share at/after delivered_at */
  W.notified = function (r) { var d = r.delivered_at ? new Date(r.delivered_at).getTime() - 60000 : 0; return (W.shares[r.id] || []).some(function (s) { return new Date(s.created_at).getTime() >= d; }); };
  W.unnotified = function (r) { return r.status === 'delivered' && !W.notified(r); };
  /* log: [link] -> share row -> wa_notified event (tenant_id = request tenant) */
  W.log = function (r, o) {
    var lp = o.token ? W.hex(o.token).then(function (h) { return sb.from('service_result_links').insert({ tenant_id: r.tenant_id, request_id: r.id, token_hash: h, created_by: SD.uid() }).select('id').single(); }).then(function (x) { if (x.error) throw x.error; return x.data.id; }) : Promise.resolve(null);
    return lp.then(function (lid) {
      return sb.from('service_request_shares').insert({ tenant_id: r.tenant_id, request_id: r.id, template: o.tpl, lang: o.lang, recipient_kind: o.kind, recipient_label: o.label ? String(o.label).slice(0, 200) : null, phone: o.phone || null, message: o.text.slice(0, 6000), result_link_id: lid, created_by: SD.uid(), created_by_name: W.me() || null })
        .select('id,request_id,template,recipient_label,created_at,created_by_name').single().then(function (x) {
          if (x.error) throw x.error;
          (W.shares[r.id] = W.shares[r.id] || []).unshift(x.data);
          return SD.event(r, 'wa_notified', { body: null, meta: { template: o.tpl, lang: o.lang, recipient: o.label || null, link: !!lid } }).catch(function () {});
        });
    });
  };
  /* timeline label for the new event types (used by sd-detail evText hook) */
  SD.evTextX = function (e) {
    var m = e.meta || {};
    if (e.type === 'wa_notified') return '<b>' + W.L('Notified via WhatsApp', 'Dimaklumkan via WhatsApp') + '</b>' + (m.template ? ' · ' + W.L('template ', 'templat ') + W.esc(W.tplName(m.template)) + (m.lang ? ' (' + W.esc(String(m.lang).toUpperCase()) + ')' : '') : '') + (m.recipient ? ' · ' + W.L('to ', 'kepada ') + W.esc(m.recipient) : '');
    if (e.type === 'status' && m.via === 'result_link') return '<b>' + W.esc(SD.stLabel(e.to_status)) + '</b> · ' + W.L('by client via result link', 'oleh client melalui link hasil');
    return '';
  };
})();
