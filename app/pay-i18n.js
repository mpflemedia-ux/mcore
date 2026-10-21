/* M-Core payment attachments - EN/BM strings (LANG.*.payAtt, new keys only). Load before pay-core.js. v1 */
(function () {
  if (window.PAYX_S) return;
  window.PAYX_S = {
    en: { ref: 'Bank ref.', refPh: 'e.g. M2U 1234 5678', chq: 'Cheque no.', notes: 'Notes', notesPh: 'Optional', attach: 'Proof of payment', attachD: 'Slip, receipt or any document · images, PDF, Office, CSV · max 10 MB each, 10 files',
      cam: 'Camera', file: 'File', add: 'Add file', view: 'View', dl: 'Download', rm: 'Remove', rmQ: 'Remove “{n}”? It is hidden from the payment but kept for audit.', rmLock: 'Books are locked for this date. Only the owner can remove it.',
      duit: 'DuitNow', ewal: 'E-wallet', cheque: 'Cheque', refCol: 'Ref.', proof: 'Proof', files: 'Payment proof', none: 'No files yet.', close: 'Close', up: 'Uploading {i} of {n}…', upOk: '{n} file(s) attached', upErr: 'Upload failed: ',
      big: '“{n}” is over 10 MB.', type: '“{n}” is not a supported file type.', many: 'Max 10 files per payment.', dup: '“{n}” looks like a slip already attached to {r}. Attach anyway?', dupSelf: 'this payment', another: 'another payment',
      byCust: 'from customer', byGw: 'gateway', saved: 'Saved', err: 'Error: ', load: 'Loading…', compress: 'Compressing photo…', noAccess: 'You do not have access to payment files.', viewOnly: 'View-only support session.' },
    bm: { ref: 'Ruj. bank', refPh: 'cth. M2U 1234 5678', chq: 'No. cek', notes: 'Catatan', notesPh: 'Pilihan', attach: 'Bukti bayaran', attachD: 'Slip, resit atau apa-apa dokumen · imej, PDF, Office, CSV · maks 10 MB setiap satu, 10 fail',
      cam: 'Kamera', file: 'Fail', add: 'Tambah fail', view: 'Lihat', dl: 'Muat turun', rm: 'Buang', rmQ: 'Buang “{n}”? Ia disembunyikan dari bayaran tetapi disimpan untuk audit.', rmLock: 'Buku dikunci untuk tarikh ini. Hanya pemilik boleh membuangnya.',
      duit: 'DuitNow', ewal: 'E-dompet', cheque: 'Cek', refCol: 'Ruj.', proof: 'Bukti', files: 'Bukti bayaran', none: 'Belum ada fail.', close: 'Tutup', up: 'Memuat naik {i} daripada {n}…', upOk: '{n} fail dilampirkan', upErr: 'Muat naik gagal: ',
      big: '“{n}” melebihi 10 MB.', type: '“{n}” bukan jenis fail yang disokong.', many: 'Maks 10 fail setiap bayaran.', dup: '“{n}” seperti slip yang sudah dilampirkan pada {r}. Lampirkan juga?', dupSelf: 'bayaran ini', another: 'bayaran lain',
      byCust: 'dari pelanggan', byGw: 'gateway', saved: 'Disimpan', err: 'Ralat: ', load: 'Memuat…', compress: 'Memampatkan foto…', noAccess: 'Anda tiada akses ke fail bayaran.', viewOnly: 'Sesi sokongan paparan sahaja.' }
  };
})();
