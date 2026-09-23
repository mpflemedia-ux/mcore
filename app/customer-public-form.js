/* Public CRM customer self-fill form (?customer_form=TOKEN) + Share link on Customer List. */
(function () {
  const TOKEN_QS = 'customer_form'
  const STATES = ['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis','Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','W.P. Kuala Lumpur','W.P. Labuan','W.P. Putrajaya']

  function esc(s) {
    var A = String.fromCharCode(38)
    return String(s || '').replace(/[&<>"']/g, function (c) {
      if (c === '&') return A + 'amp;'
      if (c === '<') return A + 'lt;'
      if (c === '>') return A + 'gt;'
      if (c === '"') return A + 'quot;'
      return A + '#39;'
    })
  }
  function readLang() {
    try {
      var q = new URLSearchParams(location.search).get('lang')
      if (q === 'bm' || q === 'ms') return 'bm'
      if (q === 'en') return 'en'
      if (window._pubCustLang === 'bm' || window._pubCustLang === 'en') return window._pubCustLang
      if (window.APP && APP.language === 'bm') return 'bm'
      if (window.APP && APP.language === 'en') return 'en'
    } catch (e) {}
    return 'en'
  }
  function isBm() { return readLang() === 'bm' }
  function toast(msg, kind) {
    if (typeof showToast === 'function') showToast(msg, kind || 'success')
    else alert(msg)
  }
  function langQs() {
    try {
      if (window.APP && APP.language === 'bm') return '&lang=bm'
      if (window.APP && APP.language === 'en') return '&lang=en'
    } catch (e) {}
    return isBm() ? '&lang=bm' : '&lang=en'
  }
  function publicUrl(tok) {
    return location.origin + '/app/?' + TOKEN_QS + '=' + encodeURIComponent(tok) + langQs()
  }

  window._pubCustSetLang = function (lang) {
    window._pubCustLang = lang === 'bm' ? 'bm' : 'en'
    try {
      var u = new URL(location.href)
      u.searchParams.set('lang', window._pubCustLang)
      history.replaceState({}, '', u)
    } catch (e) {}
    if (typeof _tryShowPublicCustomerForm === 'function') _tryShowPublicCustomerForm()
  }

  async function ensureToken() {
    if (!window.sb || !window.APP || !APP.tenant) return null
    try {
      var r = await sb.rpc('ensure_customer_form_public_token')
      if (!r.error && r.data) return r.data
    } catch (e) {}
    var q = await sb.from('tenants').select('customer_form_public_token,name').eq('id', APP.tenant.id).maybeSingle()
    if (q.error) {
      toast((isBm() ? 'Gagal. Run SQL customer_form_public_token. ' : 'Failed. Run customer_form_public_token SQL. ') + q.error.message, 'error')
      return null
    }
    var tok = q.data && q.data.customer_form_public_token
    if (tok && String(tok).length >= 8) return tok
    tok = (crypto.randomUUID && crypto.randomUUID().replace(/-/g, '')) || (Date.now().toString(36) + Math.random().toString(36).slice(2))
    var up = await sb.from('tenants').update({ customer_form_public_token: tok }).eq('id', APP.tenant.id)
    if (up.error) {
      toast((isBm() ? 'Gagal simpan token. Run SQL: ' : 'Failed to save token. Run SQL: ') + up.error.message, 'error')
      return null
    }
    return tok
  }

  window._crmSharePublicLink = async function () {
    if (typeof canAccess === 'function' && !canAccess('crm')) {
      toast(isBm() ? 'Tiada akses CRM' : 'No CRM access', 'error')
      return
    }
    if (!window.sb || !window.APP || !APP.tenant) { toast('Not signed in', 'error'); return }
    var tok = await ensureToken()
    if (!tok) return
    var link = publicUrl(tok)
    var tenantName = (APP.tenant && APP.tenant.name) || ''
    window._publicInvLink = link
    if (typeof _showPublicLinkModal === 'function') {
      _showPublicLinkModal(link, (isBm() ? 'Borang pelanggan' : 'Customer form') + (tenantName ? ' — ' + tenantName : ''))
      var hdr = document.querySelector('#public-link-modal .modal-box-header')
      if (hdr) hdr.textContent = isBm() ? 'Link awam borang pelanggan' : 'Public customer form link'
      var p = document.querySelector('#public-link-modal .modal-box-body p')
      if (p) p.textContent = isBm()
        ? 'Pelanggan buka link ni tanpa login. Isi maklumat diri (nama, emel, alamat…).'
        : 'Customer opens this link without login. They fill their own details (name, email, address…).'
    } else {
      try { await navigator.clipboard.writeText(link) } catch (e) { prompt(isBm() ? 'Link awam' : 'Public link', link) }
      toast(link, 'success')
    }
  }

  function patchCustomerList() {
    var _orig = window.renderCustomerList
    if (typeof _orig !== 'function' || _orig._crmPublicSharePatched) return
    window.renderCustomerList = async function () {
      await _orig.apply(this, arguments)
      if (typeof canAccess === 'function' && !canAccess('crm')) return
      var header = document.querySelector('#main .page-header')
      if (!header || header.querySelector('[data-crm-share]')) return
      var btn = document.createElement('button')
      btn.className = 'btn btn-outline'
      btn.setAttribute('data-crm-share', '1')
      btn.innerHTML = '<i class="ti ti-share"></i> Share link'
      btn.onclick = function () { _crmSharePublicLink() }
      if (header.children.length >= 2) {
        var right = header.children[header.children.length - 1]
        var wrap = document.createElement('div')
        wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center'
        wrap.appendChild(btn)
        if (right.tagName === 'BUTTON') {
          header.replaceChild(wrap, right)
          wrap.appendChild(right)
        } else header.appendChild(btn)
      } else header.appendChild(btn)
    }
    window.renderCustomerList._crmPublicSharePatched = true
  }

  window._pubCustSubmit = async function (token) {
    var err = document.getElementById('pub-cust-err')
    var btn = document.getElementById('pub-cust-btn')
    if (err) err.style.display = 'none'
    var g = function (id) { var el = document.getElementById(id); return el ? el.value : '' }
    var name = (g('pcf-name') || '').trim()
    if (!name || name.length < 2) {
      if (err) {
        err.textContent = isBm() ? 'Nama wajib (min 2 aksara).' : 'Name is required (min 2 characters).'
        err.style.display = 'block'
      }
      return
    }
    var payload = {
      name: name,
      email: (g('pcf-email') || '').trim(),
      phone: (g('pcf-phone') || '').trim(),
      address_line1: (g('pcf-addr') || '').trim(),
      city: (g('pcf-city') || '').trim(),
      postcode: (g('pcf-postcode') || '').trim(),
      state: g('pcf-state') || '',
      notes: (g('pcf-notes') || '').trim()
    }
    if (btn) btn.disabled = true
    var res = await sb.rpc('submit_public_customer', { p_token: token, p_payload: payload })
    if (btn) btn.disabled = false
    if (res.error) {
      if (err) { err.textContent = res.error.message; err.style.display = 'block' }
      return
    }
    var mode = (res.data && res.data.mode) || 'created'
    var msg = isBm()
      ? (mode === 'updated' ? 'Maklumat dikemas kini. Terima kasih!' : 'Maklumat dihantar. Terima kasih!')
      : (mode === 'updated' ? 'Your details were updated. Thank you!' : 'Your details were submitted. Thank you!')
    var root = document.getElementById('pub-cust-root')
    if (root) {
      root.innerHTML = '<div class="card" style="max-width:560px;margin:40px auto;padding:28px;text-align:center">'
        + '<div style="font-size:22px;font-weight:700;margin-bottom:8px">' + esc(msg) + '</div>'
        + '<div style="color:var(--text-3)">' + (isBm() ? 'Anda boleh tutup halaman ini.' : 'You can close this page.') + '</div></div>'
    }
  }

  window._tryShowPublicCustomerForm = async function () {
    var token = new URLSearchParams(location.search).get(TOKEN_QS)
    if (!token) return false
    document.getElementById('shell') && document.getElementById('shell').classList.remove('active')
    var auth = document.getElementById('auth-page')
    if (auth) auth.style.display = 'none'
    var root = document.getElementById('pub-cust-root')
    if (!root) {
      root = document.createElement('div')
      root.id = 'pub-cust-root'
      root.style.cssText = 'min-height:100vh;padding:16px 12px 48px;background:var(--bg,#0f172a)'
      document.body.appendChild(root)
    }
    var res = await sb.rpc('get_public_customer_form', { p_token: token })
    if (res.error || !res.data) {
      root.innerHTML = '<div class="card" style="max-width:480px;margin:40px auto;padding:24px"><p>' + (isBm() ? 'Link tidak sah.' : 'Invalid link.') + '</p></div>'
      return true
    }
    var data = res.data
    var bm = isBm()
    var stateOpts = '<option value="">-- ' + (bm ? 'Pilih' : 'Select') + ' --</option>'
      + STATES.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>' }).join('')
    root.innerHTML = '<div class="card" style="max-width:700px;margin:0 auto;padding:20px">'
      + '<div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">'
      + (data.logo_url ? '<img src="' + esc(data.logo_url) + '" alt="" style="height:40px;object-fit:contain">' : '')
      + '<div style="flex:1"><div style="font-weight:700">' + esc(data.tenant_name || '') + '</div>'
      + '<div style="font-size:13px;color:var(--text-3)">' + (bm ? 'Borang Maklumat Pelanggan' : 'Customer Details Form') + '</div></div>'
      + '<div style="display:flex;gap:6px"><button type="button" class="btn btn-outline btn-sm" onclick="_pubCustSetLang(\'en\')">EN</button>'
      + '<button type="button" class="btn btn-outline btn-sm" onclick="_pubCustSetLang(\'bm\')">BM</button></div></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<div class="form-group" style="grid-column:1/-1"><label class="form-label">' + (bm ? 'Nama *' : 'Name *') + '</label>'
      + '<input class="form-input" id="pcf-name" placeholder="Nama penuh / Company name"></div>'
      + '<div class="form-group"><label class="form-label">' + (bm ? 'Emel' : 'Email') + '</label>'
      + '<input class="form-input" id="pcf-email" type="email" placeholder="email@example.com"></div>'
      + '<div class="form-group"><label class="form-label">' + (bm ? 'No. Telefon' : 'Phone') + '</label>'
      + '<input class="form-input" id="pcf-phone" placeholder="+601X-XXXXXXX"></div>'
      + '<div class="form-group" style="grid-column:1/-1"><label class="form-label">' + (bm ? 'Alamat' : 'Address') + '</label>'
      + '<input class="form-input" id="pcf-addr" placeholder="No, Jalan, Taman..."></div>'
      + '<div class="form-group"><label class="form-label">' + (bm ? 'Bandar' : 'City') + '</label>'
      + '<input class="form-input" id="pcf-city" placeholder="Kuala Lumpur"></div>'
      + '<div class="form-group"><label class="form-label">' + (bm ? 'Poskod' : 'Postcode') + '</label>'
      + '<input class="form-input" id="pcf-postcode" placeholder="50000" maxlength="5"></div>'
      + '<div class="form-group"><label class="form-label">' + (bm ? 'Negeri' : 'State') + '</label>'
      + '<select class="form-select" id="pcf-state">' + stateOpts + '</select></div>'
      + '<div class="form-group" style="grid-column:1/-1"><label class="form-label">' + (bm ? 'Nota' : 'Notes') + '</label>'
      + '<textarea class="form-input" id="pcf-notes" rows="3" style="resize:vertical"></textarea></div>'
      + '</div>'
      + '<div id="pub-cust-err" style="display:none;color:var(--danger);font-size:13px;margin:8px 0"></div>'
      + '<button id="pub-cust-btn" class="btn btn-primary" style="margin-top:12px" onclick="_pubCustSubmit(\'' + esc(token) + '\')">'
      + (bm ? 'Hantar' : 'Submit') + '</button></div>'
    return true
  }

  function boot() {
    try {
      patchCustomerList()
      setInterval(patchCustomerList, 1200)
      if (new URLSearchParams(location.search).get(TOKEN_QS)) {
        var go = function () { if (window.sb) _tryShowPublicCustomerForm(); else setTimeout(go, 80) }
        go()
      }
    } catch (e) { console.error(e) }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
