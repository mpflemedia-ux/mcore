/* M-Core invoice pay align - extra EN/BM keys for ordinary invoices on the shared bkpay spine. New keys only. v1 */
(function () {
  var E = {
    pTitleInv: 'Pay this invoice',
    pHoldHintInv: 'Upload here so staff can verify. WhatsApp backup does not count until staff verify or you upload.',
    pWaMsgInv: 'Payment {i} {a}',
    pCountsInv: 'We have your receipt. Payment counts only after our staff verify it.',
    sKeptInv: 'We have your receipt. No need to pay again while we check it.',
    sRejNewInv: 'Upload a new receipt to try again.',
    sConfInv: 'Invoice paid',
    sConfBalInv: 'Part paid — balance still due',
    sShareMsgInv: 'My receipt {n} for invoice {b}: {u}',
    sBalInv: 'Balance {b}',
    sPartMoreInv: 'We received {a}. Please pay the remaining {b}.',
    qSubAll: 'Booking and invoice receipts. Payment counts only after you verify.',
    qPartInv: 'Part payment recorded. Balance still due on the invoice.',
    qRejDoneInv: 'Receipt rejected. The customer sees your reason on the invoice link.',
    qRoleAll: 'Only an owner or admin can verify payments.',
    wDateInv: 'Receipt date {d} is before the invoice was issued'
  };
  var B = {
    pTitleInv: 'Bayar invois ini',
    pHoldHintInv: 'Muat naik di sini supaya staf boleh sahkan. Backup WhatsApp tidak dikira sehingga staf sahkan atau anda muat naik.',
    pWaMsgInv: 'Bayaran {i} {a}',
    pCountsInv: 'Kami sudah terima resit anda. Bayaran dikira selepas staf kami sahkan.',
    sKeptInv: 'Kami sudah terima resit anda. Tidak perlu bayar lagi semasa kami semak.',
    sRejNewInv: 'Muat naik resit baharu untuk cuba lagi.',
    sConfInv: 'Invois dibayar',
    sConfBalInv: 'Dibayar sebahagian — baki masih perlu',
    sShareMsgInv: 'Resit {n} untuk invois {b}: {u}',
    sBalInv: 'Baki {b}',
    sPartMoreInv: 'Kami terima {a}. Sila bayar baki {b}.',
    qSubAll: 'Resit tempahan dan invois. Bayaran dikira selepas anda sahkan.',
    qPartInv: 'Bayaran separa direkod. Baki masih perlu pada invois.',
    qRejDoneInv: 'Resit ditolak. Pelanggan nampak sebab anda pada link invois.',
    qRoleAll: 'Hanya pemilik atau admin boleh sahkan bayaran.',
    wDateInv: 'Tarikh resit {d} sebelum invois dikeluarkan'
  };
  if (window.BKPAYI && BKPAYI.S) {
    Object.keys(E).forEach(function (k) { BKPAYI.S.en[k] = E[k]; BKPAYI.S.bm[k] = B[k]; });
  }
  if (window.PAYX && PAYX.add) PAYX.add({ en: E, bm: B });
})();
