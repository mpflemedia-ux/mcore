/* Public job-application form (?public_apply=TOKEN) + Share link on applicants list. */
(function () {
  const TOKEN_QS = 'public_apply'
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
  function isBm() {
    try { return (window.APP && APP.language === 'bm') || (navigator.language || '').startsWith('ms') } catch (e) { return false }
  }
  function toast(msg, kind) {
    if (typeof showToast === 'function') showToast(msg, kind || 'success')
    else alert(msg)
  }
  function publicBase() {
    return (location.origin + location.pathname).replace(/index\.html$/, '').replace(/\/?$/, '/')
  }
  window._appSharePublicLink = async function () {
    if (!window.sb || !window.APP || !APP.tenant) { toast('Not signed in', 'error'); return }
    const { data: row, error } = await sb.from('tenants').select('id,job_apply_token,name').eq('id', APP.tenant.id).single()
    if (error) {
      toast((isBm() ? 'Gagal. Run SQL job_apply_token. ' : 'Failed. Run job_apply_token SQL. ') + error.message, 'error')
      return
    }
    let token = row && row.job_apply_token
    if (!token) {
      token = (crypto.randomUUID && crypto.randomUUID().replace(/-/g, '')) || (Date.now().toString(36) + Math.random().toString(36).slice(2))
      const up = await sb.from('tenants').update({ job_apply_token: token }).eq('id', APP.tenant.id)
      if (up.error) {
        toast((isBm() ? 'Gagal simpan token. Run SQL: ' : 'Failed to save token. Run SQL: ') + up.error.message, 'error')
        return
      }
    }
    const link = publicBase() + '?' + TOKEN_QS + '=' + encodeURIComponent(token)
    window._publicInvLink = link
    if (typeof _showPublicLinkModal === 'function') {
      _showPublicLinkModal(link, (isBm() ? 'Borang permohonan kerja' : 'Job application form') + ' — ' + (row.name || ''))
      const hdr = document.querySelector('#public-link-modal .modal-box-header')
      if (hdr) hdr.textContent = isBm() ? 'Link awam permohonan kerja' : 'Public job application link'
      const p = document.querySelector('#public-link-modal .modal-box-body p')
      if (p) p.textContent = isBm()
        ? 'Pemohon buka link ni tanpa login. Field pejabat (temuduga/status) tak keluar.'
        : 'Applicant opens this link without login. Office-use fields are hidden.'
    } else {
      try { await navigator.clipboard.writeText(link) } catch (e) {}
      toast(link, 'success')
    }
  }
  const _origList = window.renderApplicantList
  if (typeof _origList === 'function') {
    window.renderApplicantList = async function () {
      await _origList.apply(this, arguments)
      const header = document.querySelector('#main .page-header')
      if (!header || header.querySelector('[data-app-share]')) return
      const btn = document.createElement('button')
      btn.className = 'btn btn-outline'
      btn.setAttribute('data-app-share', '1')
      btn.innerHTML = '<i class="ti ti-share"></i> Share link'
      btn.onclick = () => _appSharePublicLink()
      if (header.children.length >= 2) {
        const right = header.children[header.children.length - 1]
        const wrap = document.createElement('div')
        wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center'
        wrap.appendChild(btn)
        if (right.tagName === 'BUTTON') {
          header.replaceChild(wrap, right)
          wrap.appendChild(right)
        } else header.appendChild(btn)
      } else header.appendChild(btn)
    }
  }
  window._pubApplyEdu = []
  window._pubApplyEmp = []
  function rowBtns(kind, i) {
    return '<td style="width:36px"><button type="button" class="btn btn-outline btn-sm" style="padding:4px 8px" onclick="_pubApplyRemove(\''+kind+'\','+i+')">×</button></td>'
  }
  window._pubApplyAdd = function (kind) {
    if (kind === 'edu') _pubApplyEdu.push({ qualification: '', institution: '', year_completed: '' })
    else _pubApplyEmp.push({ company: '', position_duration: '', reason_leaving: '' })
    _pubApplyRenderRows()
  }
  window._pubApplyRemove = function (kind, i) {
    if (kind === 'edu') _pubApplyEdu.splice(i, 1)
    else _pubApplyEmp.splice(i, 1)
    _pubApplyRenderRows()
  }
  function _pubApplyRenderRows() {
    const edu = document.getElementById('pub-edu-body')
    const emp = document.getElementById('pub-emp-body')
    if (edu) edu.innerHTML = _pubApplyEdu.map((r, i) => '<tr><td><input class="form-input" value="'+esc(r.qualification)+'" oninput="_pubApplyEdu['+i+'].qualification=this.value"></td><td><input class="form-input" value="'+esc(r.institution)+'" oninput="_pubApplyEdu['+i+'].institution=this.value"></td><td><input class="form-input" value="'+esc(r.year_completed)+'" oninput="_pubApplyEdu['+i+'].year_completed=this.value"></td>'+rowBtns('edu', i)+'</tr>').join('')
    if (emp) emp.innerHTML = _pubApplyEmp.map((r, i) => '<tr><td><input class="form-input" value="'+esc(r.company)+'" oninput="_pubApplyEmp['+i+'].company=this.value"></td><td><input class="form-input" value="'+esc(r.position_duration)+'" oninput="_pubApplyEmp['+i+'].position_duration=this.value"></td><td><input class="form-input" value="'+esc(r.reason_leaving)+'" oninput="_pubApplyEmp['+i+'].reason_leaving=this.value"></td>'+rowBtns('emp', i)+'</tr>').join('')
  }
  window._pubApplySubmit = async function (token) {
    const err = document.getElementById('pub-apply-err')
    const btn = document.getElementById('pub-apply-btn')
    if (err) err.style.display = 'none'
    const name = document.getElementById('pub-full-name') && document.getElementById('pub-full-name').value.trim()
    const pos = document.getElementById('pub-position') && document.getElementById('pub-position').value.trim()
    if (!name || !pos) {
      if (err) { err.textContent = isBm() ? 'Nama dan jawatan wajib.' : 'Name and position are required.'; err.style.display = 'block' }
      return
    }
    const g = function(id){ var el=document.getElementById(id); return el?el.value:''; }
    const payload = {
      position_applied: pos,
      expected_salary: g('pub-salary'),
      available_date: g('pub-avail'),
      full_name: name,
      ic_no: g('pub-ic'),
      dob: g('pub-dob'),
      gender: g('pub-gender'),
      nationality: g('pub-nat'),
      marital_status: g('pub-marital'),
      mobile_no: g('pub-mobile'),
      email: g('pub-email'),
      home_address: g('pub-addr'),
      education: _pubApplyEdu.filter(function(r){ return r.qualification || r.institution }),
      employment_history: _pubApplyEmp.filter(function(r){ return r.company || r.position_duration }),
      language_proficiency: {
        bm: { spoken: g('pub-bm-s'), written: g('pub-bm-w') },
        en: { spoken: g('pub-en-s'), written: g('pub-en-w') },
        others: { name: g('pub-lang-name'), spoken: g('pub-ot-s'), written: g('pub-ot-w') }
      },
      emergency_name: g('pub-em-name'),
      emergency_relationship: g('pub-em-rel'),
      emergency_mobile: g('pub-em-mobile'),
      emergency_address: g('pub-em-addr')
    }
    if (btn) btn.disabled = true
    const res = await sb.rpc('submit_public_application', { p_token: token, p_payload: payload })
    if (btn) btn.disabled = false
    if (res.error) {
      if (err) { err.textContent = res.error.message; err.style.display = 'block' }
      return
    }
    const ref = (res.data && res.data.ref_no) || ''
    document.getElementById('pub-apply-root').innerHTML = '<div class="card" style="max-width:560px;margin:40px auto;padding:28px;text-align:center"><div style="font-size:22px;font-weight:700;margin-bottom:8px">'+(isBm()?'Permohonan dihantar':'Application submitted')+'</div><div style="color:var(--text-3)">'+(isBm()?'No. rujukan':'Reference')+': <strong>'+esc(ref)+'</strong></div></div>'
  }
  window._tryShowPublicApply = async function () {
    const token = new URLSearchParams(location.search).get(TOKEN_QS)
    if (!token) return false
    document.getElementById('shell') && document.getElementById('shell').classList.remove('active')
    const auth = document.getElementById('auth-page')
    if (auth) auth.style.display = 'none'
    let root = document.getElementById('pub-apply-root')
    if (!root) {
      root = document.createElement('div')
      root.id = 'pub-apply-root'
      root.style.cssText = 'min-height:100vh;padding:16px 12px 48px;background:var(--bg,#0f172a)'
      document.body.appendChild(root)
    }
    const res = await sb.rpc('get_public_apply_form', { p_token: token })
    if (res.error || !res.data) {
      root.innerHTML = '<div class="card" style="max-width:480px;margin:40px auto;padding:24px"><p>'+(isBm()?'Link tidak sah.':'Invalid link.')+'</p><p style="font-size:12px;color:#94a3b8">Admin: run SQL get_public_apply_form / job_apply_token.</p></div>'
      return true
    }
    const data = res.data
    const bm = isBm()
    const prof = '<option value="">-</option><option value="good">'+(bm?'Baik':'Good')+'</option><option value="average">'+(bm?'Sederhana':'Average')+'</option><option value="basic">'+(bm?'Asas':'Basic')+'</option>'
    root.innerHTML = '<div class="card" style="max-width:720px;margin:0 auto;padding:20px">'
      + '<div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">'
      + (data.logo_url ? '<img src="'+esc(data.logo_url)+'" style="height:40px;object-fit:contain">' : '')
      + '<div><div style="font-weight:700">'+esc(data.tenant_name||'')+'</div><div style="font-size:13px;color:var(--text-3)">'+(bm?'Borang Permohonan Kerja':'Job Application Form')+'</div></div></div>'
      + '<div class="form-group"><label class="form-label">'+(bm?'Jawatan Dipohon *':'Position Applied *')+'</label><input class="form-input" id="pub-position"></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="form-group"><label class="form-label">'+(bm?'Gaji Dijangka (RM)':'Expected Salary (RM)')+'</label><input class="form-input" id="pub-salary" type="number" min="0" step="0.01"></div><div class="form-group"><label class="form-label">'+(bm?'Tarikh Boleh Mula':'Available Date')+'</label><input class="form-input" id="pub-avail" type="date"></div></div>'
      + '<div style="font-weight:700;margin:16px 0 8px">'+(bm?'Butiran Peribadi':'Personal Particulars')+'</div>'
      + '<div class="form-group"><label class="form-label">'+(bm?'Nama Penuh *':'Full Name *')+'</label><input class="form-input" id="pub-full-name"></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px"><div class="form-group"><label class="form-label">IC</label><input class="form-input" id="pub-ic"></div><div class="form-group"><label class="form-label">'+(bm?'Tarikh Lahir':'Date of Birth')+'</label><input class="form-input" id="pub-dob" type="date"></div><div class="form-group"><label class="form-label">'+(bm?'Jantina':'Gender')+'</label><select class="form-select" id="pub-gender"><option value="">-</option><option value="male">'+(bm?'Lelaki':'Male')+'</option><option value="female">'+(bm?'Perempuan':'Female')+'</option></select></div></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px"><div class="form-group"><label class="form-label">'+(bm?'Warganegara':'Nationality')+'</label><input class="form-input" id="pub-nat"></div><div class="form-group"><label class="form-label">'+(bm?'Status Perkahwinan':'Marital Status')+'</label><select class="form-select" id="pub-marital"><option value="">-</option><option value="single">'+(bm?'Bujang':'Single')+'</option><option value="married">'+(bm?'Berkahwin':'Married')+'</option><option value="divorced">'+(bm?'Bercerai':'Divorced')+'</option><option value="widowed">'+(bm?'Balu/Duda':'Widowed')+'</option></select></div><div class="form-group"><label class="form-label">'+(bm?'No. Bimbit':'Mobile No.')+'</label><input class="form-input" id="pub-mobile"></div></div>'
      + '<div class="form-group"><label class="form-label">Email</label><input class="form-input" id="pub-email" type="email"></div>'
      + '<div class="form-group"><label class="form-label">'+(bm?'Alamat Rumah':'Home Address')+'</label><textarea class="form-input" id="pub-addr" rows="2"></textarea></div>'
      + '<div style="font-weight:700;margin:16px 0 8px">'+(bm?'Pendidikan':'Education')+'</div>'
      + '<div style="overflow-x:auto"><table><thead><tr><th>'+(bm?'Kelayakan':'Qualification')+'</th><th>'+(bm?'Institusi':'Institution')+'</th><th>'+(bm?'Tahun':'Year')+'</th><th></th></tr></thead><tbody id="pub-edu-body"></tbody></table></div>'
      + '<button type="button" class="btn btn-outline btn-sm" style="margin:8px 0" onclick="_pubApplyAdd(\'edu\')">+ '+(bm?'Tambah':'Add Row')+'</button>'
      + '<div style="font-weight:700;margin:16px 0 8px">'+(bm?'Sejarah Pekerjaan':'Employment History')+'</div>'
      + '<div style="overflow-x:auto"><table><thead><tr><th>'+(bm?'Syarikat':'Company')+'</th><th>'+(bm?'Jawatan & Tempoh':'Position & Duration')+'</th><th>'+(bm?'Sebab Berhenti':'Reason Leaving')+'</th><th></th></tr></thead><tbody id="pub-emp-body"></tbody></table></div>'
      + '<button type="button" class="btn btn-outline btn-sm" style="margin:8px 0" onclick="_pubApplyAdd(\'emp\')">+ '+(bm?'Tambah':'Add Row')+'</button>'
      + '<div style="font-weight:700;margin:16px 0 8px">'+(bm?'Kemahiran Bahasa':'Language Proficiency')+'</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:end"><div></div><div class="form-label">'+(bm?'Lisan':'Spoken')+'</div><div class="form-label">'+(bm?'Bertulis':'Written')+'</div><div>Bahasa Malaysia</div><select class="form-select" id="pub-bm-s">'+prof+'</select><select class="form-select" id="pub-bm-w">'+prof+'</select><div>English</div><select class="form-select" id="pub-en-s">'+prof+'</select><select class="form-select" id="pub-en-w">'+prof+'</select><input class="form-input" id="pub-lang-name" placeholder="'+(bm?'Nama bahasa':'Language name')+'"><select class="form-select" id="pub-ot-s">'+prof+'</select><select class="form-select" id="pub-ot-w">'+prof+'</select></div>'
      + '<div style="font-weight:700;margin:16px 0 8px">'+(bm?'Kenalan Kecemasan':'Emergency Contact')+'</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="form-group"><label class="form-label">'+(bm?'Nama':'Name')+'</label><input class="form-input" id="pub-em-name"></div><div class="form-group"><label class="form-label">'+(bm?'Hubungan':'Relationship')+'</label><input class="form-input" id="pub-em-rel"></div><div class="form-group"><label class="form-label">'+(bm?'No. Telefon':'Mobile No.')+'</label><input class="form-input" id="pub-em-mobile"></div><div class="form-group"><label class="form-label">'+(bm?'Alamat':'Address')+'</label><input class="form-input" id="pub-em-addr"></div></div>'
      + '<div id="pub-apply-err" style="display:none;color:var(--danger);font-size:13px;margin:8px 0"></div>'
      + '<button id="pub-apply-btn" class="btn btn-primary" style="margin-top:12px" onclick="_pubApplySubmit(\''+esc(token)+'\')">'+(bm?'Hantar Permohonan':'Submit Application')+'</button></div>'
    window._pubApplyEdu = []
    window._pubApplyEmp = []
    return true
  }
  function boot() {
    try {
      if (new URLSearchParams(location.search).get(TOKEN_QS)) {
        const go = function(){ if (window.sb) _tryShowPublicApply(); else setTimeout(go, 80) }
        go()
      }
    } catch (e) { console.error(e) }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
