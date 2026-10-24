/* Booking Inbox i18n (Details|Proof|Docs|Actions). New keys only. v1 */
(function () {
  var I = window.BKINBI = window.BKINBI || {};
  I.en = {
    tabDet: 'Details', tabProof: 'Payment proof', tabDocs: 'Documents', tabAct: 'Actions',
    noInv: 'No invoice linked — free booking or not created yet.',
    noClaim: 'No payment proof yet. Ask the customer to upload, or tap Received on WA.',
    pending: 'Waiting for your review', approved: 'Verified', rejected: 'Rejected',
    waRecv: 'Received on WA', waRecvHint: 'Creates a proof row so the booking stays in the payment spine (no file). Then Verify or ask for upload.',
    waRecvOk: 'WA proof recorded — review below', waBusy: 'Saving…',
    amt: 'Amount', wait: 'Waiting', srcUpload: 'Uploaded', srcWa: 'WhatsApp (staff)', srcCash: 'Closed by cash',
    verify: 'Verify', reject: 'Reject', openQ: 'Open in Payments list',
    docInv: 'Invoice', docSlip: 'Uploaded slip', docRcpt: 'Official receipt', docPay: 'Client status link',
    docNone: 'Not available yet', copy: 'Copy', open: 'Open',
    actShareWa: 'Share WhatsApp', actCash: 'Confirm cash / paid outside', actCashHint: 'Walk-in or paid outside the system. Closes any open proof and confirms the booking.',
    actRel: 'Release slot', actAmend: 'Amend', actDel: 'Delete',
    confBal: 'Confirmed — balance due later', confFull: 'Confirmed — paid',
    needSql: 'Run booking_flow_01.sql to enable WA proof and inbox.',
    fail: 'Could not save: {e}', balDue: 'Balance due: {b}'
  };
  I.bm = {
    tabDet: 'Butiran', tabProof: 'Bukti bayaran', tabDocs: 'Dokumen', tabAct: 'Tindakan',
    noInv: 'Tiada invois — tempahan percuma atau belum dicipta.',
    noClaim: 'Belum ada bukti bayaran. Minta pelanggan muat naik, atau ketik Terima di WA.',
    pending: 'Menunggu semakan anda', approved: 'Disahkan', rejected: 'Ditolak',
    waRecv: 'Terima di WA', waRecvHint: 'Cipta rekod bukti supaya tempahan kekal dalam aliran bayaran (tanpa fail). Kemudian Sahkan atau minta muat naik.',
    waRecvOk: 'Bukti WA direkod — semak di bawah', waBusy: 'Menyimpan…',
    amt: 'Jumlah', wait: 'Menunggu', srcUpload: 'Dimuat naik', srcWa: 'WhatsApp (staf)', srcCash: 'Ditutup oleh tunai',
    verify: 'Sahkan', reject: 'Tolak', openQ: 'Buka senarai Bayaran',
    docInv: 'Invois', docSlip: 'Resit dimuat naik', docRcpt: 'Resit rasmi', docPay: 'Link status pelanggan',
    docNone: 'Belum ada', copy: 'Salin', open: 'Buka',
    actShareWa: 'Share WhatsApp', actCash: 'Sahkan tunai / bayar luar sistem', actCashHint: 'Walk-in atau bayar di luar sistem. Tutup bukti terbuka dan sahkan tempahan.',
    actRel: 'Lepaskan slot', actAmend: 'Pinda', actDel: 'Padam',
    confBal: 'Disahkan — baki perlu dibayar kemudian', confFull: 'Disahkan — sudah dibayar',
    needSql: 'Jalankan booking_flow_01.sql untuk bukti WA dan peti tempahan.',
    fail: 'Tidak dapat simpan: {e}', balDue: 'Baki: {b}'
  };
  I.t = function (k, v) {
    var bm = (window.APP && APP.language === 'bm') || (window.PAYX && PAYX.bm && PAYX.bm());
    var s = (bm ? I.bm : I.en)[k] || (I.en[k] || k);
    if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(String(v[x])); });
    return s;
  };
})();
