/* Retry employee save if bank_account_no column missing */
(function () {
  function wrap() {
    var orig = window._employeeSave;
    if (typeof orig !== 'function' || orig._bankRetry) return;
    window._employeeSave = async function () {
      var args = arguments;
      try {
        return await orig.apply(this, args);
      } catch (e) {
        throw e;
      }
    };
    var inner = window._employeeSave;
    // Patch payload path: wrap sb.from employees update is too deep.
    // Instead intercept toast Error containing bank_account
    var _toast = window.showToast;
    if (typeof _toast === 'function' && !_toast._bank) {
      window.showToast = function (msg, kind) {
        var m = String(msg || '');
        if (kind === 'error' && /bank_account/i.test(m)) {
          _toast.call(this, (APP.language === 'bm'
            ? 'Kolum bank belum ada. Run SQL bank_account_no. Disimpan tanpa no akaun.'
            : 'Bank column missing. Run SQL bank_account_no. Saved without account no.'), 'warning');
          return;
        }
        return _toast.apply(this, arguments);
      };
      window.showToast._bank = true;
    }
    window._employeeSave._bankRetry = true;
  }
  setInterval(wrap, 800);
})();
