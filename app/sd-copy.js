/* M-Core Service Desk - "Copy instructions" on the request detail (client tenant + platform admin, same SD.detail view).
   Copies r.description as plain text (line breaks kept). Chained onto SD.waInject (called at the end of SD.detail). v1 */
(function () {
  var SD = window.SD; if (!SD || SD._copyInstr) return; SD._copyInstr = 1;
  var S = {
    en: { btn: 'Copy instructions', ok: 'Copied', fail: 'Could not copy. Select the text and copy it manually.' },
    bm: { btn: 'Salin arahan', ok: 'Disalin', fail: 'Tidak dapat salin. Pilih teks dan salin secara manual.' }
  };
  try { if (window.LANG) ['en', 'bm'].forEach(function (l) { if (LANG[l] && !LANG[l].sdCopy) LANG[l].sdCopy = S[l]; }); } catch (e) {}
  function T(k) { var l = window.APP && APP.language === 'bm' ? 'bm' : 'en', d = (window.LANG && LANG[l] && LANG[l].sdCopy) || S[l]; return d[k] != null ? d[k] : S.en[k]; }
  function toast(m, k) { if (typeof showToast === 'function') showToast(m, k || 'success'); }
  function legacy(txt) {
    var ta = document.createElement('textarea'), ok = false;
    ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { ta.setSelectionRange(0, txt.length); } catch (e) {}
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove(); return ok;
  }
  SD.copyText = function (txt) {
    txt = String(txt == null ? '' : txt).replace(/\r\n?/g, '\n');
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext !== false) {
      return navigator.clipboard.writeText(txt).then(function () { return true; }, function () { return legacy(txt); });
    }
    return Promise.resolve(legacy(txt));
  };
  function inject(m, r) {
    if (!r || !r.description || !String(r.description).trim()) return;
    var head = m && m.querySelector('.cob-root > .cob-card'); if (!head || head.querySelector('.sd-copy-row')) return;
    var p = head.querySelector('p.cob-sm'); if (!p) return;
    var row = document.createElement('div'); row.className = 'sd-copy-row';
    row.style.cssText = 'display:flex;justify-content:flex-end;margin-top:6px';
    row.innerHTML = '<button type="button" class="btn btn-sm btn-outline sd-copy" style="min-height:36px;gap:6px"><i class="ti ti-copy" aria-hidden="true"></i> <span>' + SD.esc(T('btn')) + '</span></button>';
    p.parentNode.insertBefore(row, p.nextSibling);
    var b = row.querySelector('button');
    b.onclick = function () {
      b.disabled = true;
      SD.copyText(r.description).then(function (ok) {
        b.disabled = false;
        if (ok) { toast(T('ok')); b.querySelector('i').className = 'ti ti-check'; setTimeout(function () { var i = b.querySelector('i'); if (i) i.className = 'ti ti-copy'; }, 1500); }
        else toast(T('fail'), 'error');
      });
    };
  }
  var prev = SD.waInject;
  SD.waInject = function (m, r, ev, admin) {
    if (typeof prev === 'function') { try { prev.apply(this, arguments); } catch (e) { console.warn('[sd-copy] prev', e); } }
    try { inject(m, r); } catch (e) { console.warn('[sd-copy]', e); }
  };
})();
