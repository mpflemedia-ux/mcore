/* M-Core payment attachments - Phase 4: "Payment proof" section in the Monthly Report Pack (sd-report.js), after Accounts. Read-only. Needs pay_attach_01.sql. v1 */
(function () {
  var P = window.PAYX; if (!P || P.pack) return;
  var E = P.esc, t = P.t; P.pack = 1;
  function end(m) { var d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate(); return m + '-' + (d < 10 ? '0' : '') + d; }
  function gw(p) { return /toyyib|gateway/i.test((p.payment_method || '') + ' ' + (p.notes || '')); }
  function opt(q) { return Promise.resolve(q).then(function (r) { return r && !r.error ? r.data || [] : null; }, function () { return null; }); }
  function fill(box, m) {
    var tid = P.tid(), a = m + '-01', b = end(m);
    opt(sb.from('payments').select('id,amount,payment_method,notes').eq('tenant_id', tid).gte('payment_date', a).lte('payment_date', b)).then(function (pays) {
      pays = pays || []; var ids = pays.map(function (p) { return p.id; });
      return Promise.all([ids.length ? P.list('inv', ids) : {}, opt(sb.from('payment_voids').select('amount').eq('tenant_id', tid).gte('payment_date', a).lte('payment_date', b).is('deleted_at', null)),
        opt(sb.from('payment_claims').select('status').eq('tenant_id', tid).gte('created_at', a + 'T00:00:00+08:00').lte('created_at', b + 'T23:59:59+08:00').is('deleted_at', null))]).then(function (r) {
        var w = { n: 0, s: 0 }, o = { n: 0, s: 0 }, g = { n: 0, s: 0 }, all = { n: pays.length, s: 0 };
        pays.forEach(function (p) { var x = Number(p.amount || 0); all.s += x; var k = gw(p) ? g : (r[0][p.id] || []).length ? w : o; k.n++; k.s += x; });
        var row = function (k, v, warn) { return '<tr><td>' + E(t(k)) + '</td><td style="text-align:right' + (warn ? ';font-weight:700' : '') + '">' + E(v) + '</td></tr>'; };
        var nv = function (x) { return x.n + ' · ' + P.money(x.s); };
        var h = '<table class="payx-pk" style="width:100%;min-width:0"><tbody>' + row('pkN', nv(all)) + row('pkW', nv(w)) + row('pkO', nv(o), o.n > 0) + row('pkG', nv(g));
        if (r[1]) h += row('pkV', r[1].length + ' · ' + P.money(r[1].reduce(function (s, v) { return s + Number(v.amount || 0); }, 0)));
        if (r[2]) { var c = { pending: 0, approved: 0, rejected: 0 }; r[2].forEach(function (x) { c[x.status] = (c[x.status] || 0) + 1; }); h += row('pkC', c.pending + ' / ' + c.approved + ' / ' + c.rejected); }
        box.innerHTML = h + '</tbody></table>';
      });
    }).catch(function () { box.textContent = '-'; });
  }
  function scan() {
    var pk = document.querySelector('.sd-pack'), acc = pk && pk.querySelector('#sd-r-acc'), sel = document.getElementById('sd-m'); if (!acc || !sel || pk.querySelector('#sd-r-pay')) return;
    P.ready().then(function (ok) {
      if (!ok || pk.querySelector('#sd-r-pay')) return;
      var d = document.createElement('div'); d.className = 'cob-card'; d.id = 'sd-r-pay'; d.style.cssText = 'padding:16px;margin-bottom:12px';
      d.innerHTML = '<b style="font-size:15px"><i class="ti ti-paperclip"></i> ' + E(t('pkTi')) + '</b><div style="margin-top:10px;overflow-x:auto"><div class="spinner"></div></div>';
      acc.parentNode.insertBefore(d, acc.nextSibling); fill(d.lastElementChild, sel.value);
    });
  }
  var tm = 0; new MutationObserver(function () { if (!tm) tm = setTimeout(function () { tm = 0; scan(); }, 200); }).observe(document.body, { childList: true, subtree: true });
})();
