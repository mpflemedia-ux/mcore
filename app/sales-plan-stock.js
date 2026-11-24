/* Sales Plan — phase 2c. Stock & Financing tab (mockups 3 / 3b): outstanding + next due,
   batch cards (stock, principal, fee, repayment, repaid bar), repayments list, actions. */
(function () {
  'use strict';
  var SP = window.SP, st = SP.state, t = SP.t, esc = SP.esc, num = SP.num;
  SP.batchName = function (b) { return b.label || ('Batch ' + b.code); };
  SP.mixText = function (b) {
    var mx = Array.isArray(b.product_mix) ? b.product_mix : [];
    return mx.map(function (x) { return (x.qty != null && x.qty !== '' ? SP.fmtNum(x.qty) + ' × ' : '') + (x.name || ''); }).filter(Boolean).join(' · ');
  };
  function row(l, v, strong) { return '<div class="sp-brow"><span>' + esc(l) + '</span>' + (strong ? '<b>' + esc(v) + '</b>' : '<span class="sp-bval">' + esc(v) + '</span>') + '</div>'; }
  function canWrite() { return st.plan.status !== 'archived'; }
  function repayList(c, b, k) {
    if (!k.repays.length) return '';
    var cur = c.plan.currency, admin = SP.isAdmin() && canWrite();
    return '<div class="sp-rplist"><div class="sp-rph">' + esc(t('Repayments', 'Bayaran balik')) + '</div>' + k.repays.map(function (r) {
      return '<div class="sp-rprow"><div><b>' + esc(SP.money(r.amount, cur)) + '</b><div class="sp-hint">' + esc(SP.fmtDate(r.repaid_on) + ' · ' + t('principal ', 'prinsipal ') + SP.fmtNum(r.principal_portion, 2) + ' + ' + t('fee ', 'fi ') + SP.fmtNum(r.fee_portion, 2) + (r.bank_account_id ? ' · ' + SP.acctLabel(r.bank_account_id) : '')) + '</div></div>' +
        (admin ? '<button type="button" class="sp-iconbtn sp-del" data-act="rp-del" data-id="' + esc(r.id) + '" aria-label="' + esc(t('Delete (reverse) repayment', 'Padam (balikkan) bayaran')) + '" title="' + esc(t('Delete (reverse)', 'Padam (balikkan)')) + '"><i class="ti ti-arrow-back-up"></i></button>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function cardHtml(c, b) {
    var k = SP.batchCalc(c, b), cur = c.plan.currency, admin = SP.isAdmin() && canWrite(), mix = SP.mixText(b);
    var ffmSold = SP.batchFfmSold ? SP.batchFfmSold(b) : null, soldN = ffmSold ? ffmSold.sold : num(b.units_sold);
    if (ffmSold && num(b.actual_qty) > 0 && window.FFMS) {
      var pk0 = FFMS.pace({ sold: soldN, qty: num(b.actual_qty), today: SP.todayISO(), due: k.dueDate, inbound: b.actual_inbound, watchPct: num(c.plan.watch_pct) || 85 });
      k.status = pk0;
    }
    var inb = b.actual_inbound ? t('Inbound ', 'Masuk ') + SP.fmtDate(b.actual_inbound) + ' · ' + t('received', 'diterima') : b.target_inbound ? t('Inbound planned ', 'Dijangka masuk ') + SP.fmtDate(b.target_inbound) : t('Inbound date not set', 'Tarikh masuk belum ditetapkan');
    var h = '<div class="card sp-bcard" data-bid="' + esc(b.id) + '"><div class="sp-bcard-h"><div class="sp-bcard-t"><b>' + esc(SP.batchName(b)) + '</b>' + (mix ? '<div class="sp-hint">' + esc(mix) + '</div>' : '') + '</div>' + SP.kpiBadge(k.status) + '</div>' +
      '<div class="sp-hint sp-binb"><i class="ti ti-truck" aria-hidden="true"></i> ' + esc(inb) + '</div>';
    if (num(b.actual_qty) > 0) h += row(t('Sold', 'Terjual'), SP.fmtNum(soldN || 0) + ' / ' + SP.fmtNum(b.actual_qty) + ' (' + SP.pct1(num(soldN) / num(b.actual_qty) * 100) + ')' + (ffmSold ? ' · ' + t('from FFM', 'dari FFM') : ''));
    if (!k.fin) {
      if (k.cost) h += row(t('Stock value (TikTok price)', 'Nilai stok (harga TikTok)'), SP.money(k.cost, cur));
      h += row(t('Financing', 'Pembiayaan'), t('Not financed', 'Tiada pembiayaan'), true);
    } else {
      h += row(t('Stock value (TikTok price)', 'Nilai stok (harga TikTok)'), SP.money(k.cost, cur), true) + row(t('Funded cost', 'Kos dibiayai') + ' (' + t('principal', 'prinsipal') + ' ' + num(b.financed_pct) + '%)' + (k.drawn ? ' · ' + t('drawn ', 'dikeluarkan ') + SP.fmtDate(b.drawn_date) : ''), SP.money(k.principal, cur), true) +
        row(t('Fee ', 'Fi ') + num(b.fee_pct) + '%' + (k.revBasis ? ' ' + t('of revenue', 'daripada revenue') + ' (' + SP.money(k.revenue, cur) + ')' : ''), SP.money(k.fee, cur), true) + row(t('Repayment', 'Bayaran balik') + (k.dueDate ? ' · ' + t('due ', 'tamat ') + SP.fmtDate(k.dueDate) : ''), SP.money(k.due, cur), true);
      if (k.drawn) h += '<div class="sp-brepaid"><div class="sp-brow sp-hint"><span>' + esc(t('Repaid ', 'Dibayar ') + SP.money(k.repaid, cur) + t(' of ', ' daripada ') + SP.money(k.due, cur)) + '</span><span>' + esc(SP.pct1(k.pctRepaid).replace('.0%', '%')) + '</span></div>' +
        '<div class="sp-bar"><i style="width:' + k.pctRepaid.toFixed(1) + '%;background:var(--success)"></i></div></div>';
      if (k.drawn && c.plan.currency !== 'MYR' && b.fx_rate_to_myr) h += '<div class="sp-hint">' + esc('FX 1 ' + c.plan.currency + ' = ' + num(b.fx_rate_to_myr) + ' MYR') + '</div>';
    }
    if (ffmSold && num(b.actual_qty) > 0) {
      var price = SP.batchTiktokPrice ? SP.batchTiktokPrice(b) : 0, sales = SP.r2(num(soldN) * price);
      var days = k.dueDate ? SP.diffDays(SP.todayISO(), k.dueDate) : null, left = Math.max(0, num(b.actual_qty) - num(soldN));
      var pk = window.FFMS ? FFMS.pace({ sold: soldN, qty: num(b.actual_qty), today: SP.todayISO(), due: k.dueDate, inbound: b.actual_inbound, watchPct: num(c.plan.watch_pct) || 85 }) : k.status;
      k.status = pk === 'ach' ? 'ach' : pk;
      h += '<div class="sp-pace">' + row(t('Sales so far', 'Jualan setakat ini'), SP.money(sales, cur)) + row(t('Target', 'Sasaran'), SP.money(k.due, cur)) +
        row(t('Balance', 'Baki'), SP.money(Math.max(0, SP.r2(k.due - sales)), cur), true) +
        row(t('Bottles left', 'Botol tinggal'), SP.fmtNum(left)) +
        (days != null ? row(t('Days to due', 'Hari ke tarikh tamat'), String(days)) : '') +
        '<div class="sp-brow"><span>' + esc(t('Pace', 'Rentak')) + '</span>' + SP.kpiBadge(k.status) + '</div></div>';
    }
    h += repayList(c, b, k);
    var a = '';
    if (k.fin && k.drawn && k.outstanding > 0 && st.canEdit && canWrite()) a += '<button type="button" class="btn btn-primary btn-sm" data-act="rp-add" data-id="' + esc(b.id) + '"><i class="ti ti-cash"></i>' + esc(t('Record repayment', 'Rekod bayaran balik')) + '</button>';
    if (k.fin && !k.drawn && admin) a += '<button type="button" class="btn btn-primary btn-sm" data-act="bt-draw" data-id="' + esc(b.id) + '"><i class="ti ti-building-bank"></i>' + esc(t('Draw funding', 'Keluarkan pembiayaan')) + '</button>';
    if (st.canEdit && canWrite()) a += '<button type="button" class="btn btn-outline btn-sm" data-act="bt-edit" data-id="' + esc(b.id) + '"><i class="ti ti-pencil"></i>' + esc(admin ? t('Edit', 'Ubah') : t('Update stock', 'Kemas kini stok')) + '</button>';
    if (admin && !k.drawn && !k.repays.length) a += '<button type="button" class="sp-iconbtn sp-del" data-act="bt-del" data-id="' + esc(b.id) + '" aria-label="' + esc(t('Delete batch ', 'Padam batch ') + b.code) + '"><i class="ti ti-trash"></i></button>';
    return h + (a ? '<div class="sp-bacts">' + a + '</div>' : '') + '</div>';
  }
  SP.tabs.stock = function () {
    var c = SP.ctx(), cur = c.plan.currency, f = SP.finSummary(c), admin = SP.isAdmin() && canWrite();
    var drawn = 0, repaid = 0;
    c.batches.forEach(function (b) { var k = SP.batchCalc(c, b); if (k.drawn) drawn += k.principal; repaid += k.repaid; });
    var box = function (l, v, cls) { return '<div class="card sp-wsum' + (cls || '') + '"><div class="sp-kpi-l">' + esc(l) + '</div><div class="sp-kpi-v"><b>' + esc(v) + '</b></div></div>'; };
    var sums = '<div class="sp-wsums sp-fsums">' + box(t('Outstanding', 'Tertunggak'), SP.money(f.outstanding, cur)) + box(t('Next due', 'Tarikh bayar seterusnya'), f.next ? SP.fmtDate(f.next.date) : '—') +
      box(t('Principal drawn', 'Prinsipal dikeluarkan'), SP.money(drawn, cur), ' sp-hide-sm') + box(t('Repaid to date', 'Dibayar setakat ini'), SP.money(repaid, cur), ' sp-hide-sm') + '</div>';
    var p = c.plan, missing = [];
    if (!p.loan_account_id) missing.push(t('Financier Loan', 'Pinjaman Pembiaya'));
    if (!p.fee_account_id) missing.push(t('Financing Fee', 'Fi Pembiayaan'));
    if (!p.draw_debit_account_id) missing.push(t('Inventory/Bank (draw)', 'Inventori/Bank (pengeluaran)'));
    var overMsg = [];
    if (window.FFMS && (st.listedRows || []).length && (st.ffmStock || []).length) {
      var cmap = FFMS.comboMap(st.comboRows || []);
      (st.ffmStock || []).forEach(function (s) {
        var need = FFMS.listedNeeded(st.listedRows, cmap, s.barcode);
        if (need > Number(s.available_qty || 0)) overMsg.push(s.barcode + ' — ' + t('listed needs ', 'senarai perlukan ') + need + t(', FFM available ', ', FFM tersedia ') + Number(s.available_qty || 0));
      });
    }
    var warn = (missing.length && admin ? '<div class="sp-warn sp-warn-top"><i class="ti ti-alert-triangle"></i><span>' + esc(t('Journals need these accounts in Settings: ', 'Jurnal perlukan akaun ini dalam Tetapan: ') + missing.join(', ')) + '</span></div>' : '') +
      (overMsg.length ? '<div class="sp-warn sp-warn-top"><i class="ti ti-alert-triangle"></i><span>' + esc(t('Oversell risk: ', 'Risiko lebih jual: ') + overMsg.join('; ')) + '</span></div>' : '');
    var add = admin ? '<button type="button" class="btn btn-primary btn-sm" data-act="bt-add"><i class="ti ti-plus"></i>' + esc(t('Add batch', 'Tambah batch')) + '</button>' : '';
    var head = '<div class="sp-mhead"><div class="sp-hint">' + esc(t('Funding draws and repayments post journals automatically (Dr Inventory / Cr Financier Loan; Dr Loan + Fee / Cr Bank).', 'Pengeluaran pembiayaan dan bayaran balik menyiarkan jurnal secara automatik (Dt Inventori / Kt Pinjaman Pembiaya; Dt Pinjaman + Fi / Kt Bank).')) + '</div>' + add + '</div>';
    if (!c.batches.length) return warn + SP.emptyCard('ti-packages', t('No stock batches yet', 'Belum ada batch stok'), t('Add a batch for each stock inbound. Financed batches track principal, fee and repayments.', 'Tambah batch untuk setiap stok masuk. Batch berpembiayaan menjejak prinsipal, fi dan bayaran balik.'), add);
    return warn + sums + head + '<div class="sp-bgrid">' + c.batches.map(function (b) { return cardHtml(c, b); }).join('') + '</div>';
  };
})();
