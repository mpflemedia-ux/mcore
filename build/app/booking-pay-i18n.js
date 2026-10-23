/* M-Core booking payment flow - EN/BM text keys (public booking page + staff review queue). New keys only, prefix bkpay. v2 */
(function () {
  if (window.BKPAYI) return;
  var S = {
    en: {
      pAwait: 'Awaiting payment', pTitle: 'Pay to confirm your booking', pNow: 'Pay now', pFull: 'Full amount', pDep: 'Deposit {p}% of {t}',
      pBalLater: 'Balance {b} at your visit', pRef: 'Payment ref', pRefHint: 'Put this ref in your transfer note so we can match it fast.',
      pCopy: 'Copy', pCopied: 'Copied', pHeld: 'Slot held until {t}', pLeft: '{m} min left', pStep1: 'Pay with DuitNow QR or bank transfer',
      pSaveQr: 'Save QR', pStep2: 'Upload your receipt', pCam: 'Take photo', pPick: 'Choose file', pAmt: 'Amount paid (RM)',
      pFileHint: 'Photo or PDF, max 10 MB', pSend: 'Send receipt', pSending: 'Sending…', pOr: 'or', pWa: 'Send receipt via WhatsApp',
      pWaMsg: 'Payment {i} {a} booking {b}', pCounts: 'Your slot is kept while we check your receipt. Payment counts only after our staff verify it.',
      pKeep: 'Keep this link to check your payment status later.', pCopyLink: 'Copy link', pRemove: 'Remove',
      pNeed: 'Please attach your receipt and fill in the amount.', pType: 'File type not supported. Use a photo or PDF.', pBig: 'File too large (max 10 MB).',
      pFail: 'Could not send. Please try again or send it via WhatsApp.', pBusy: 'Too many uploads. Please wait a few minutes or use WhatsApp.',
      sRecv: 'Receipt received', sRev: 'Under review', sVer: 'Verified', sReview: 'We are checking your receipt', sKept: 'Your slot is kept for you. No need to pay again.',
      sAsk: 'Ask us on WhatsApp', sRej: 'Receipt not accepted', sRejWhy: 'Reason', sRejNew: 'Upload a new receipt before {t} to keep your slot.',
      sOk: 'Payment verified', sConf: 'Your booking is confirmed', sRcpt: 'Receipt {n}', sDl: 'Download receipt', sShare: 'Send to my WhatsApp',
      sShareMsg: 'My receipt {n} for booking {b}: {u}', sBal: 'Balance {b} at your visit', sPart: 'Part payment received',
      sPartMore: 'We received {a}. Please pay {b} more before {t} to confirm.', sExp: 'Hold expired', sExpD: 'Your slot was released because payment was not received in time.',
      sAgain: 'Book again', sPaid: 'Paid in full', sBasic: 'Pay with the QR below, then send us your receipt on WhatsApp.', sOpenInv: 'Open invoice',
      pWaWho: 'Send on WhatsApp to', pWaTo: 'Send to {c} ({p})', pWaPick: 'Choose contact in WhatsApp'
    },
    bm: {
      pAwait: 'Menunggu bayaran', pTitle: 'Bayar untuk sahkan tempahan', pNow: 'Bayar sekarang', pFull: 'Jumlah penuh', pDep: 'Deposit {p}% daripada {t}',
      pBalLater: 'Baki {b} semasa hadir', pRef: 'Rujukan bayaran', pRefHint: 'Tulis rujukan ini dalam nota pindahan supaya kami cepat padankan.',
      pCopy: 'Salin', pCopied: 'Disalin', pHeld: 'Slot ditahan hingga {t}', pLeft: '{m} min lagi', pStep1: 'Bayar guna DuitNow QR atau pindahan bank',
      pSaveQr: 'Simpan QR', pStep2: 'Muat naik resit', pCam: 'Ambil gambar', pPick: 'Pilih fail', pAmt: 'Jumlah dibayar (RM)',
      pFileHint: 'Gambar atau PDF, maks 10 MB', pSend: 'Hantar resit', pSending: 'Menghantar…', pOr: 'atau', pWa: 'Hantar resit melalui WhatsApp',
      pWaMsg: 'Bayaran {i} {a} tempahan {b}', pCounts: 'Slot anda disimpan semasa kami semak resit. Bayaran dikira selepas staf kami sahkan.',
      pKeep: 'Simpan link ini untuk semak status bayaran nanti.', pCopyLink: 'Salin link', pRemove: 'Buang',
      pNeed: 'Sila lampirkan resit dan isi jumlah.', pType: 'Jenis fail tidak disokong. Guna gambar atau PDF.', pBig: 'Fail terlalu besar (maks 10 MB).',
      pFail: 'Tidak berjaya menghantar. Cuba lagi atau hantar melalui WhatsApp.', pBusy: 'Terlalu banyak muat naik. Tunggu beberapa minit atau guna WhatsApp.',
      sRecv: 'Resit diterima', sRev: 'Dalam semakan', sVer: 'Disahkan', sReview: 'Kami sedang menyemak resit anda', sKept: 'Slot anda disimpan. Tidak perlu bayar lagi.',
      sAsk: 'Tanya kami di WhatsApp', sRej: 'Resit tidak diterima', sRejWhy: 'Sebab', sRejNew: 'Muat naik resit baharu sebelum {t} untuk kekalkan slot.',
      sOk: 'Bayaran disahkan', sConf: 'Tempahan anda disahkan', sRcpt: 'Resit {n}', sDl: 'Muat turun resit', sShare: 'Hantar ke WhatsApp saya',
      sShareMsg: 'Resit {n} untuk tempahan {b}: {u}', sBal: 'Baki {b} semasa hadir', sPart: 'Bayaran separa diterima',
      sPartMore: 'Kami terima {a}. Sila bayar {b} lagi sebelum {t} untuk sahkan.', sExp: 'Tempoh tahan tamat', sExpD: 'Slot anda telah dilepaskan kerana bayaran tidak diterima dalam masa.',
      sAgain: 'Tempah semula', sPaid: 'Dibayar penuh', sBasic: 'Bayar guna QR di bawah, kemudian hantar resit kepada kami di WhatsApp.', sOpenInv: 'Buka invois',
      pWaWho: 'Hantar di WhatsApp kepada', pWaTo: 'Hantar ke {c} ({p})', pWaPick: 'Pilih kenalan dalam WhatsApp'
    }
  };
  var Q = {
    en: {
      qTab: 'Payments to review', qTitle: 'Payments to review', qSub: 'Booking receipts sent by customers. Payment counts only after you verify.',
      qEmpty: 'No receipts waiting. New uploads appear here and in your alerts.', qWait: 'waiting {m}', qSent: 'Customer sent',
      qSlip: 'Customer receipt', qInv: 'Invoice', qBk: 'Booking', qSvc: 'Service', qWhen: 'Slot', qTotal: 'Total', qPaid: 'Paid so far', qDue: 'To pay now',
      qChecks: 'Checks', qAi: 'AI read', qAiRun: 'Reading receipt…', qAiNo: 'AI could not read this receipt. Check it by eye.',
      wAmtLow: 'Amount is less than expected ({a})', wAmtHigh: 'Amount is more than the balance. Only {a} will be recorded.', wAmtOk: 'Amount matches',
      wAiAmt: 'AI read amount {a}, customer typed {b}', wDate: 'Receipt date {d} is before the booking was made', wDateOk: 'Date looks right',
      wDup: 'Same file was already used on another payment', wDupRef: 'Bank ref {r} was already used', wRef: 'Payment ref {r} found on receipt', wRefNo: 'Payment ref not seen on receipt',
      wBankRef: 'Bank ref {r}', wBankNo: 'Bank ref not detected',
      qVerify: 'Verify payment', qReject: 'Reject', qRejWhy: 'Reason (the customer will see this)', qRejGo: 'Reject receipt', qBack: 'Back',
      qMaker: 'You created this invoice, so another owner or admin must verify it.', qRole: 'Only an owner or admin can verify booking payments.',
      qDoing: 'Recording payment…', qDone: 'Payment verified. Receipt {n} is ready for the customer.', qPart: 'Part payment recorded. Customer has until {t} to pay the balance.',
      qRejDone: 'Receipt rejected. The customer sees your reason and has until {t} to upload again.', qFail: 'Could not record the payment: {e}',
      qOpen: 'Open invoice', qZoom: 'Open full size', qNoFile: 'No file', qDeposit: 'Deposit (%)', qDepN: 'deposit {p}%', qDepHint: 'Blank = full payment', qGrace: 'Grace after a rejected or part payment (min)',
      qRemind: 'Remind owners if not reviewed after (min, 0 = off)', qSave: 'Save', qSaved: 'Saved', qPaySet: 'Booking payments',
      qNeedSql: 'Run supabase/booking_pay_01.sql to turn on deposits and review settings.',
      qRoOk: 'Already verified on {t}. Nothing to do.', qRoRej: 'Rejected on {t}. Reason: {w}', qRoSt: 'Status: {s}', qRoNf: 'This receipt is no longer available.'
    },
    bm: {
      qTab: 'Bayaran untuk disemak', qTitle: 'Bayaran untuk disemak', qSub: 'Resit tempahan daripada pelanggan. Bayaran dikira selepas anda sahkan.',
      qEmpty: 'Tiada resit menunggu. Muat naik baharu akan muncul di sini dan dalam amaran anda.', qWait: 'menunggu {m}', qSent: 'Pelanggan hantar',
      qSlip: 'Resit pelanggan', qInv: 'Invois', qBk: 'Tempahan', qSvc: 'Servis', qWhen: 'Slot', qTotal: 'Jumlah', qPaid: 'Sudah dibayar', qDue: 'Perlu dibayar',
      qChecks: 'Semakan', qAi: 'Bacaan AI', qAiRun: 'Membaca resit…', qAiNo: 'AI tidak dapat membaca resit ini. Semak secara manual.',
      wAmtLow: 'Jumlah kurang daripada dijangka ({a})', wAmtHigh: 'Jumlah melebihi baki. Hanya {a} akan direkod.', wAmtOk: 'Jumlah sepadan',
      wAiAmt: 'AI baca jumlah {a}, pelanggan isi {b}', wDate: 'Tarikh resit {d} sebelum tempahan dibuat', wDateOk: 'Tarikh nampak betul',
      wDup: 'Fail yang sama sudah digunakan pada bayaran lain', wDupRef: 'Rujukan bank {r} sudah digunakan', wRef: 'Rujukan bayaran {r} ada pada resit', wRefNo: 'Rujukan bayaran tidak kelihatan pada resit',
      wBankRef: 'Rujukan bank {r}', wBankNo: 'Rujukan bank tidak dikesan',
      qVerify: 'Sahkan bayaran', qReject: 'Tolak', qRejWhy: 'Sebab (pelanggan akan nampak)', qRejGo: 'Tolak resit', qBack: 'Kembali',
      qMaker: 'Anda yang buat invois ini, jadi pemilik atau admin lain perlu sahkan.', qRole: 'Hanya pemilik atau admin boleh sahkan bayaran tempahan.',
      qDoing: 'Merekod bayaran…', qDone: 'Bayaran disahkan. Resit {n} sedia untuk pelanggan.', qPart: 'Bayaran separa direkod. Pelanggan ada hingga {t} untuk bayar baki.',
      qRejDone: 'Resit ditolak. Pelanggan nampak sebab anda dan ada hingga {t} untuk muat naik semula.', qFail: 'Tidak dapat merekod bayaran: {e}',
      qOpen: 'Buka invois', qZoom: 'Buka saiz penuh', qNoFile: 'Tiada fail', qDeposit: 'Deposit (%)', qDepN: 'deposit {p}%', qDepHint: 'Kosong = bayaran penuh', qGrace: 'Tempoh tambahan selepas ditolak atau bayaran separa (min)',
      qRemind: 'Ingatkan pemilik jika belum disemak selepas (min, 0 = tutup)', qSave: 'Simpan', qSaved: 'Disimpan', qPaySet: 'Bayaran tempahan',
      qNeedSql: 'Jalankan supabase/booking_pay_01.sql untuk buka deposit dan tetapan semakan.',
      qRoOk: 'Sudah disahkan pada {t}. Tiada tindakan perlu.', qRoRej: 'Ditolak pada {t}. Sebab: {w}', qRoSt: 'Status: {s}', qRoNf: 'Resit ini tidak lagi tersedia.'
    }
  };
  ['en', 'bm'].forEach(function (l) { Object.keys(Q[l]).forEach(function (k) { S[l][k] = Q[l][k]; }); });
  window.BKPAYI = {
    S: S,
    t: function (lang, k, v) { var d = S[lang === 'bm' ? 'bm' : 'en'], s = d[k] != null ? d[k] : (S.en[k] != null ? S.en[k] : k);
      return v ? String(s).replace(/\{(\w+)\}/g, function (m, x) { return v[x] != null ? v[x] : m; }) : s; }
  };
  if (window.PAYX && PAYX.add) PAYX.add({ en: Q.en, bm: Q.bm });
})();
