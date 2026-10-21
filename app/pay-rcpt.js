/* M-Core payment attachments - Phase 3: official receipt PDF per customer payment (pdf-lib already loaded by index.html) + WhatsApp "Thanks, paid"
   with the receipt PDF via the existing share sheet (WAD); AI "Read slip" on Record Payment (existing ai-proxy action 'receipt'). Needs pay_attach_03.sql. v1 */
(function () {
  var P = window.PAYX; if (!P || P.rcpt) return;
  var E = P.esc, t = P.t;
  P.add({ en: { rBtn: 'Receipt', rPdf: 'Download receipt PDF', rWa: 'Send receipt on WhatsApp', rNo: 'PDF tool is still loading. Try again in a moment.', rT: 'OFFICIAL RECEIPT', rNo2: 'Receipt no.', rDate: 'Date', rFrom: 'Received from', rFor: 'For invoice', rAmt: 'Amount received', rM: 'Method', rRef: 'Bank ref.', rBal: 'Balance after this payment', rThx: 'Thank you for your payment.', rAuto: 'Computer-generated receipt. No signature required.' },
    bm: { rBtn: 'Resit', rPdf: 'Muat turun resit PDF', rWa: 'Hantar resit melalui WhatsApp', rNo: 'Alat PDF masih dimuatkan. Cuba sebentar lagi.', rT: 'RESIT RASMI', rNo2: 'No. resit', rDate: 'Tarikh', rFrom: 'Diterima daripada', rFor: 'Untuk invois', rAmt: 'Jumlah diterima', rM: 'Kaedah', rRef: 'Ruj. bank', rBal: 'Baki selepas bayaran ini', rThx: 'Terima kasih atas bayaran anda.', rAuto: 'Resit janaan komputer. Tandatangan tidak diperlukan.' } });
  var ML = { cash: ['Cash', 'Tunai'], bank_transfer: ['Bank transfer', 'Pindahan bank'], online_banking: ['Online banking', 'Perbankan dalam talian'], card: ['Card', 'Kad'], cheque: ['Cheque', 'Cek'], ewallet: ['E-wallet', 'E-dompet'], duitnow: ['DuitNow', 'DuitNow'], toyyibpay: ['ToyyibPay (online)', 'ToyyibPay (dalam talian)'] };
  function mlabel(p, bm) { var k = p.pay_channel || p.payment_method || ''; var x = ML[k]; return x ? x[bm ? 1 : 0] : String(k || '-').replace(/_/g, ' '); }
  function data(invId, payId) {
    return Promise.all([sb.from('payments').select('*').eq('id', payId).eq('tenant_id', P.tid()).maybeSingle(), sb.from('invoices').select('id,ref_no,customer_id,customer_name,total,paid_amt').eq('id', invId).eq('tenant_id', P.tid()).maybeSingle(),
      sb.from('payment_allocations').select('payment_id,amount,created_at').eq('invoice_id', invId).eq('tenant_id', P.tid()), typeof _pdocGetTenant === 'function' ? _pdocGetTenant() : Promise.resolve((window.APP && APP.tenant) || {})]).then(function (a) {
      var p = a[0].data, inv = a[1].data; if (!p || !inv) throw new Error('Not found');
      /* balance right after this payment: total - payments dated up to this one (same day: by created order) */
      var pays = (a[2].data || []), mine = pays.find(function (x) { return String(x.payment_id) === String(payId); }) || { created_at: p.created_at };
      var upto = pays.filter(function (x) { return !mine.created_at || !x.created_at || x.created_at <= mine.created_at; }).reduce(function (s, x) { return s + Number(x.amount || 0); }, 0);
      if (!pays.length) upto = Number(inv.paid_amt || 0);
      return { p: p, inv: inv, tn: a[3] || {}, bal: Math.max(0, Number(inv.total || 0) - upto), amt: Number(mine.amount != null ? mine.amount : p.amount) };
    });
  }
  P.rcpt = function (invId, payId) {
    if (!window.PDFLib) return Promise.reject(new Error(t('rNo')));
    return data(invId, payId).then(function (d) {
      var L = t;
      var PL = PDFLib; return PL.PDFDocument.create().then(function (doc) {
        return Promise.all([doc.embedFont(PL.StandardFonts.Helvetica), doc.embedFont(PL.StandardFonts.HelveticaBold)]).then(function (f) {
          var pg = doc.addPage([419.53, 595.28]), W = 419.53, y = 545, R = f[0], B = f[1], ink = PL.rgb(0.06, 0.09, 0.16), mut = PL.rgb(0.35, 0.4, 0.48), acc = PL.rgb(0.05, 0.45, 0.56);
          var clean = function (s) { return String(s == null ? '' : s).replace(/[^\x20-\x7E]/g, ' '); };
          var c = function (s, sz, fo, co) { s = clean(s); var w = fo.widthOfTextAtSize(s, sz); pg.drawText(s, { x: Math.max(24, (W - w) / 2), y: y, size: sz, font: fo, color: co }); y -= sz + 6; };
          var row = function (k, v, bold) { v = clean(v); pg.drawText(clean(k), { x: 36, y: y, size: 10, font: R, color: mut }); var fo = bold ? B : R, sz = bold ? 13 : 10, w = fo.widthOfTextAtSize(v, sz); pg.drawText(v, { x: Math.max(160, W - 36 - w), y: y, size: sz, font: fo, color: ink }); y -= bold ? 22 : 18; };
          c(d.tn.name || (window.APP && APP.tenant && APP.tenant.name) || '', 14, B, acc);
          if (typeof _pdocAddressLine === 'function' && (d.tn.address || d.tn.city)) c(_pdocAddressLine(d.tn).slice(0, 90), 8, R, mut);
          if (d.tn.phone) c('Tel: ' + d.tn.phone, 8, R, mut);
          y -= 10; c(L('rT'), 13, B, ink); y -= 6;
          pg.drawLine({ start: { x: 36, y: y + 8 }, end: { x: W - 36, y: y + 8 }, thickness: 0.6, color: mut }); y -= 8;
          row(L('rNo2'), d.p.ref_no || '-'); row(L('rDate'), P.date(d.p.payment_date)); row(L('rFrom'), d.inv.customer_name || '-'); row(L('rFor'), d.inv.ref_no || '-');
          row(L('rM'), mlabel(d.p, P.bm()) + (d.p.cheque_no ? ' #' + d.p.cheque_no : '')); if (d.p.bank_ref) row(L('rRef'), d.p.bank_ref);
          y -= 4; pg.drawLine({ start: { x: 36, y: y + 10 }, end: { x: W - 36, y: y + 10 }, thickness: 0.6, color: mut }); y -= 6;
          row(L('rAmt'), P.money(d.amt), true); row(L('rBal'), P.money(d.bal));
          y -= 18; c(L('rThx'), 10, B, ink); c(L('rAuto'), 7.5, R, mut);
          return doc.save();
        });
      }).then(function (bytes) { return { file: new File([bytes], 'Receipt_' + String(d.p.ref_no || 'RCP').replace(/[^\w-]/g, '') + '.pdf', { type: 'application/pdf' }), d: d }; });
    });
  };
  function dl(f) { var u = URL.createObjectURL(f), a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); }
  function wa(invId, payId) {
    if (!window.WAD || !WAD.open) return;
    data(invId, payId).then(function (d) {
      return sb.from('customers').select('phone').eq('id', d.inv.customer_id || '00000000-0000-0000-0000-000000000000').maybeSingle().then(function (r) {
        WAD.open({ docType: 'inv', docId: invId, docRef: d.inv.ref_no, to: d.inv.customer_name, phone: (r && r.data && r.data.phone) || '', step: 2,
          tpls: [{ k: 'thanks', label: 'thanks', desc: 'thanksD' }], k: 'thanks',
          file: function () { return P.rcpt(invId, payId).then(function (x) { return x.file; }); },
          build: function (k, lang) { var nm = String(d.inv.customer_name || '').split(/\s+(sdn|bhd|enterprise)\b/i)[0];
            return { text: WAD.tpl('thanks', lang, { name: nm, ref: d.inv.ref_no, amt: P.money(d.amt), bal: P.money(d.bal), co: WAD.company(), what: (lang === 'bm' ? 'invois ' : 'invoice ') + d.inv.ref_no + ' (' + P.money(d.amt) + (d.p.ref_no ? ', ' + d.p.ref_no : '') + ')' }) }; } });
      });
    }).catch(function (e) { P.toast(t('err') + ((e && e.message) || e), 'error'); });
  }
  P.histHooks.push(function (kind, rows) {
    if (kind !== 'inv') return;
    P.has('payment_claims').then(function (ok) {
      if (!ok) return;
      rows.forEach(function (r) {
        if (!r.p || !r.p.ref_no || r.act.querySelector('.payx-rc')) return;
        var w = document.createElement('span'); w.className = 'payx-rc'; w.style.cssText = 'display:inline-flex;gap:6px;margin-left:6px';
        w.innerHTML = '<button type="button" class="btn btn-outline btn-sm" data-p title="' + E(t('rPdf')) + '" aria-label="' + E(t('rPdf')) + '" style="min-height:36px;min-width:36px"><i class="ti ti-receipt"></i></button>' +
          (window.WAD ? '<button type="button" class="btn btn-outline btn-sm" data-w title="' + E(t('rWa')) + '" aria-label="' + E(t('rWa')) + '" style="min-height:36px;min-width:36px"><i class="ti ti-brand-whatsapp"></i></button>' : '');
        w.querySelector('[data-p]').onclick = function (e) { e.stopPropagation(); P.rcpt(r.doc, r.pay).then(function (x) { dl(x.file); }, function (er) { P.toast(t('err') + ((er && er.message) || er), 'error'); }); };
        if (w.querySelector('[data-w]')) w.querySelector('[data-w]').onclick = function (e) { e.stopPropagation(); wa(r.doc, r.pay); };
        r.act.appendChild(w);
      });
    });
  });
  /* AI slip reading: fills empty amount / date and the notes; bank ref is not returned by the AI action */
  P.attachHooks.push(function (kind, att, grid) {
    if (typeof _invokeAiProxy !== 'function' || typeof _compressImageToBase64 !== 'function') return;
    P.has('payment_claims').then(function (ok) {
      if (!ok || att.querySelector('.payx-ai')) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-outline btn-sm payx-ai'; b.style.cssText = 'margin-top:8px;min-height:40px'; b.innerHTML = '<i class="ti ti-sparkles"></i> ' + E(t('aiBtn'));
      b.onclick = function () {
        var f = (P.pend[kind] || []).map(function (x) { return x.f; }).find(function (x) { return /^image\/(jpeg|png|webp)$/i.test(x.type); });
        if (!f) return P.toast(t('aiNone'), 'warning');
        b.disabled = true; b.innerHTML = '<i class="ti ti-loader"></i> ' + E(t('aiWait'));
        _compressImageToBase64(f).then(function (z) { return _invokeAiProxy({ action: 'receipt', image_base64: z.base64, mime_type: z.mimeType || 'image/jpeg' }); }).then(function (r) {
          if (r.error) throw r.error; if (!r.data || !r.data.success) throw new Error((r.data && r.data.error) || 'AI');
          try { _usageCaptureAi(); } catch (e) {}
          var x = r.data.data || {}, pre = kind === 'bill' ? 'bill-pay-' : 'pay-', amt = document.getElementById(pre + 'amount'), dt = document.getElementById(pre + 'date'), nt = document.getElementById('payx-' + kind + '-notes');
          if (amt && Number(x.amount) > 0) amt.value = Number(x.amount).toFixed(2);
          if (dt && /^\d{4}-\d{2}-\d{2}$/.test(x.date || '')) dt.value = x.date;
          if (nt && !nt.value && (x.vendor || x.description)) nt.value = [x.vendor, x.description].filter(Boolean).join(' · ').slice(0, 500);
          P.toast(t('aiOk'));
        }).catch(function (e) { P.toast(t('aiErr') + ((e && e.message) || e), 'error'); }).then(function () { b.disabled = false; b.innerHTML = '<i class="ti ti-sparkles"></i> ' + E(t('aiBtn')); });
      };
      att.appendChild(b);
    });
  });
})();
