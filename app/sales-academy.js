/* Sales Academy — layer on existing customers (CRM). No duplicate prospect list. */
(function () {
  var STAGES = [
    { key: 'contacted', en: 'Contacted', bm: 'Dihubungi' },
    { key: 'discovery', en: 'Discovery Completed', bm: 'Discovery Selesai' },
    { key: 'proposal', en: 'Proposal', bm: 'Cadangan' },
    { key: 'verbal', en: 'Verbal Commitment', bm: 'Komitmen Lisan' },
    { key: 'signed', en: 'Signed Client', bm: 'Pelanggan Ditandatangani' }
  ];
  var STAGE_RANK = { contacted: 1, discovery: 2, proposal: 3, verbal: 4, signed: 5 };
  var state = { tab: 'overview', period: 'month', board: 'month' };

  function t(en, bm) { return APP.language === 'bm' ? bm : en; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' })[c]; }); }
  function tid() { return APP.tenant && APP.tenant.id; }
  function uid() { return APP.user && APP.user.id; }
  function admin() { return typeof isTenantAdmin === 'function' && isTenantAdmin(); }
  function klToday() {
    try { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function pct(n, d) {
    if (!d) return null;
    return Math.min(100, Math.round((Number(n) / Number(d)) * 100));
  }
  function pctText(n, d) {
    var v = pct(n, d);
    return v == null ? '—' : (v + '%');
  }
  function rank(stage) { return STAGE_RANK[stage] || 0; }
  function stageLabel(key) {
    var s = STAGES.filter(function (x) { return x.key === key; })[0];
    return s ? t(s.en, s.bm) : t('No stage', 'Tiada peringkat');
  }

  function missionsSeed() {
    return [
      [1, 1, 40, 'List 10 prospects', 'Senarai 10 prospek', 'Add 10 existing customers as prospects with a next follow-up date.', 'Tambah 10 pelanggan sedia ada sebagai prospek dengan tarikh susulan.'],
      [1, 2, 40, 'Open 5 conversations', 'Buka 5 perbualan', 'Log 5 call or WhatsApp activities.', 'Log 5 aktiviti panggilan atau WhatsApp.'],
      [1, 3, 30, 'Book 2 discovery slots', 'Tempah 2 slot discovery', 'Set a follow-up date on 2 prospects.', 'Tetapkan tarikh susulan pada 2 prospek.'],
      [2, 1, 50, 'Complete 2 discoveries', 'Selesaikan 2 discovery', 'Move 2 prospects to Discovery Completed.', 'Alih 2 prospek ke Discovery Selesai.'],
      [2, 2, 50, 'Send 1 proposal', 'Hantar 1 cadangan', 'Move 1 prospect to Proposal.', 'Alih 1 prospek ke Cadangan.'],
      [2, 3, 40, 'Note the need', 'Catat keperluan', 'Log a note on the proposal prospect.', 'Log nota pada prospek cadangan.'],
      [3, 1, 40, 'Follow up the proposal', 'Susul cadangan', 'Log a follow-up call or WhatsApp on a proposal prospect.', 'Log susulan panggilan atau WhatsApp pada prospek cadangan.'],
      [3, 2, 60, 'Confirm next step in writing', 'Sahkan langkah seterusnya', 'Move 1 prospect to Verbal Commitment.', 'Alih 1 prospek ke Komitmen Lisan.'],
      [3, 3, 80, 'Onboard a signed client', 'Onboard pelanggan ditandatangani', 'Move 1 prospect to Signed Client. Do not create a second customer.', 'Alih 1 prospek ke Pelanggan Ditandatangani. Jangan cipta pelanggan kedua.']
    ];
  }
  function modulesSeed() {
    return [
      [1, 'Prospecting', 'Mencari prospek', 'Open with a useful reason, not a pitch.', 'Buka dengan sebab yang berguna, bukan jualan.', 'Hi, we sell everything. Want a quote?', 'Hai, kami jual semua. Nak sebut harga?', 'Hi, I saw your outlet restocking weekly. Can I ask how you reorder today?', 'Hai, saya nampak cawangan anda restock setiap minggu. Boleh saya tanya cara anda pesan semula?'],
      [2, 'Discovery questions', 'Soalan discovery', 'Ask about the current process before offering.', 'Tanya proses semasa sebelum tawar.', 'Our package is RM500. Should I send it?', 'Pakej kami RM500. Nak saya hantar?', 'What breaks when the usual supplier is late?', 'Apa yang tergendala bila pembekal biasa lewat?'],
      [3, 'Presenting a proposal', 'Bentang cadangan', 'Tie the offer to the need you heard.', 'Ikat tawaran pada keperluan yang didengar.', 'Here is our standard brochure.', 'Ini brosur standard kami.', 'You said late delivery costs a shift. This plan keeps a 3-day buffer.', 'Anda kata penghantaran lewat rugi satu syif. Pelan ini kekalkan penimbal 3 hari.'],
      [4, 'Handling objections', 'Mengurus bantahan', 'Acknowledge, then ask what the price is compared with.', 'Akui, kemudian tanya harga itu dibanding dengan apa.', 'It is not expensive.', 'Ia tidak mahal.', 'Compared with the late-delivery cost, which part feels high?', 'Berbanding kos penghantaran lewat, bahagian mana yang terasa tinggi?'],
      [5, 'Closing and onboarding', 'Tutup dan onboard', 'Confirm the next step and the owner.', 'Sahkan langkah seterusnya dan pemiliknya.', 'Let me know.', 'Beritahu saya kemudian.', 'I will send the confirmation today. You approve by Friday, then we onboard Monday.', 'Saya hantar pengesahan hari ini. Anda luluskan sebelum Jumaat, kemudian kami onboard Isnin.']
    ];
  }

  async function ensureContent() {
    var existing = await sb.from('academy_missions').select('id').eq('tenant_id', tid()).is('deleted_at', null).limit(1);
    if (existing.error) return existing.error;
    if (existing.data && existing.data.length) return null;
    var mRows = missionsSeed().map(function (m) {
      return { tenant_id: tid(), day: m[0], sort: m[1], xp: m[2], title_en: m[3], title_bm: m[4], desc_en: m[5], desc_bm: m[6], created_by: uid() };
    });
    var modRows = modulesSeed().map(function (m) {
      return { tenant_id: tid(), sort: m[0], title_en: m[1], title_bm: m[2], content_en: m[3], content_bm: m[4], before_en: m[5], before_bm: m[6], after_en: m[7], after_bm: m[8], created_by: uid() };
    });
    var a = await sb.from('academy_missions').insert(mRows);
    if (a.error) return a.error;
    var b = await sb.from('academy_modules').insert(modRows);
    return b.error;
  }

  async function loadAll() {
    var today = klToday();
    var from = state.period === 'all' ? '2000-01-01' : today.slice(0, 8) + '01';
    var results = await Promise.all([
      sb.from('customers').select('id,name,phone,pipeline_stage,next_follow_up_at,created_at').eq('tenant_id', tid()).is('deleted_at', null).order('name').limit(500),
      sb.from('crm_activities').select('id,record_id,type,notes,occurred_at,user_id').eq('tenant_id', tid()).is('deleted_at', null).order('occurred_at', { ascending: false }).limit(200),
      sb.from('crm_stage_history').select('id,record_id,from_stage,to_stage,changed_by,changed_at').eq('tenant_id', tid()).is('deleted_at', null).gte('changed_at', from).limit(1000),
      sb.from('academy_missions').select('*').eq('tenant_id', tid()).is('deleted_at', null).order('day').order('sort'),
      sb.from('academy_modules').select('*').eq('tenant_id', tid()).is('deleted_at', null).order('sort'),
      sb.from('academy_progress').select('id,user_id,item_type,item_id,xp_awarded,completed_at').eq('tenant_id', tid()).is('deleted_at', null),
      sb.from('user_profiles').select('id,name').eq('tenant_id', tid()).limit(200)
    ]);
    return {
      customers: results[0].data || [],
      activities: results[1].data || [],
      history: results[2].data || [],
      missions: results[3].data || [],
      modules: results[4].data || [],
      progress: results[5].data || [],
      people: results[6].data || [],
      errors: results.map(function (r) { return r.error && r.error.message; }).filter(Boolean)
    };
  }

  function ever(history, stage) {
    var ids = {};
    history.forEach(function (h) { if (rank(h.to_stage) >= rank(stage)) ids[h.record_id] = 1; });
    return Object.keys(ids).length;
  }

  function myProgress(data) {
    return (data.progress || []).filter(function (p) { return String(p.user_id) === String(uid()); });
  }

  function achievements(data) {
    var mine = myProgress(data);
    var signedByMe = data.history.filter(function (h) { return h.to_stage === 'signed' && String(h.changed_by) === String(uid()); }).length;
    var talks = data.activities.filter(function (a) { return String(a.user_id) === String(uid()) && (a.type === 'call' || a.type === 'whatsapp' || a.type === 'meeting'); }).length;
    var proposals = data.history.filter(function (h) { return rank(h.to_stage) >= 3 && String(h.changed_by) === String(uid()); }).length;
    return [
      { en: 'First Close', bm: 'Tutup Pertama', ok: signedByMe > 0 },
      { en: 'First Conversation', bm: 'Perbualan Pertama', ok: talks > 0 },
      { en: 'Proposal Ready', bm: 'Cadangan Sedia', ok: proposals > 0 },
      { en: 'Challenge Done', bm: 'Cabaran Selesai', ok: mine.filter(function (p) { return p.item_type === 'mission'; }).length >= 9 },
      { en: 'Academy Done', bm: 'Akademi Selesai', ok: mine.filter(function (p) { return p.item_type === 'module'; }).length >= 5 }
    ];
  }

  function overviewHtml(data) {
    var today = klToday();
    var prospects = data.customers.length;
    var talks = data.activities.filter(function (a) { return a.type === 'call' || a.type === 'whatsapp' || a.type === 'meeting'; }).length;
    var proposalPlus = data.customers.filter(function (c) { return rank(c.pipeline_stage) >= 3; }).length;
    var signed = data.customers.filter(function (c) { return c.pipeline_stage === 'signed'; }).length;
    var verbal = data.customers.filter(function (c) { return c.pipeline_stage === 'verbal'; }).length;
    var target = Number((APP.tenant.config && APP.tenant.config.academy_signed_target) || 0);
    var targetPct = pct(signed, target);
    var mine = myProgress(data);
    var xp = mine.reduce(function (s, p) { return s + Number(p.xp_awarded || 0); }, 0);
    var overdue = data.customers.filter(function (c) { return c.next_follow_up_at && c.next_follow_up_at < today && c.pipeline_stage !== 'signed'; });
    var conv = [
      ['Contacted → Discovery', ever(data.history, 'contacted'), ever(data.history, 'discovery')],
      ['Discovery → Proposal', ever(data.history, 'discovery'), ever(data.history, 'proposal')],
      ['Proposal → Verbal', ever(data.history, 'proposal'), ever(data.history, 'verbal')],
      ['Verbal → Signed', ever(data.history, 'verbal'), ever(data.history, 'signed')]
    ];
    var recent = data.customers.slice().sort(function (a, b) { return String(a.next_follow_up_at || '9999') < String(b.next_follow_up_at || '9999') ? -1 : 1; }).slice(0, 5);
    return '<div class="card" style="padding:12px;margin-bottom:10px"><b>' + esc(t('Overview', 'Ringkasan')) + '</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">' +
      kpi(t('Total prospects', 'Jumlah prospek'), prospects) + kpi(t('Conversations', 'Perbualan'), talks) +
      kpi(t('Proposal stage & beyond', 'Peringkat cadangan dan ke atas'), proposalPlus) + kpi(t('Signed clients', 'Pelanggan ditandatangani'), signed) +
      '</div><p style="margin:8px 0 0;color:var(--text-muted)">' + esc(t('Verbal shown separately', 'Komitmen lisan dipapar berasingan')) + ': ' + verbal + '</p></div>' +
      '<div class="card" style="padding:12px;margin-bottom:10px"><b>' + esc(t('Team target (signed only)', 'Sasaran pasukan (ditandatangani sahaja)')) + '</b><p>' + signed + ' / ' + (target || '—') + ' · ' + (targetPct == null ? '—' : targetPct + '%') + '</p></div>' +
      '<div class="card" style="padding:12px;margin-bottom:10px"><b>' + esc(t('Your progress', 'Kemajuan anda')) + '</b><p>XP ' + xp + ' · ' + esc(t('missions', 'misi')) + ' ' + mine.filter(function (p) { return p.item_type === 'mission'; }).length + '/9 · ' + esc(t('modules', 'modul')) + ' ' + mine.filter(function (p) { return p.item_type === 'module'; }).length + '/5</p><p>' + achievements(data).filter(function (a) { return a.ok; }).map(function (a) { return esc(t(a.en, a.bm)); }).join(', ') + '</p></div>' +
      '<div class="card" style="padding:12px;margin-bottom:10px"><b>' + esc(t('Conversion snapshot', 'Ringkasan penukaran')) + '</b>' + conv.map(function (c) { return '<p>' + esc(c[0]) + ': ' + pctText(c[2], c[1]) + '</p>'; }).join('') + '</div>' +
      (overdue.length ? '<button class="btn btn-sm" data-sa="overdue" style="background:#b91c1c;color:#fff;margin-bottom:8px">' + esc(t('Overdue follow-ups', 'Susulan tertunggak')) + ' ' + overdue.length + '</button>' : '') +
      '<div class="card" style="padding:12px"><b>' + esc(t('Recent prospects', 'Prospek terkini')) + '</b>' + recent.map(function (c) { return '<p>' + esc(c.name) + ' · ' + esc(c.next_follow_up_at || '—') + (c.next_follow_up_at && c.next_follow_up_at < today ? ' <span style="color:#b91c1c">' + esc(t('Overdue', 'Tertunggak')) + '</span>' : '') + '</p>'; }).join('') + '</div>';
  }
  function kpi(label, value) { return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px"><span style="color:var(--text-muted);font-size:12px">' + esc(label) + '</span><b style="display:block;font-size:20px">' + esc(value) + '</b></div>'; }

  function challengeHtml(data) {
    var done = {};
    myProgress(data).forEach(function (p) { if (p.item_type === 'mission') done[p.item_id] = 1; });
    var days = [1, 2, 3].map(function (day) {
      var theme = day === 1 ? t('Build your list and start useful conversations.', 'Bina senarai dan mulakan perbualan yang berguna.') : day === 2 ? t('Understand needs and present a relevant offer.', 'Fahami keperluan dan bentang tawaran yang relevan.') : t('Agree next steps, confirm in writing and onboard.', 'Setuju langkah seterusnya, sahkan secara bertulis dan onboard.');
      var rows = data.missions.filter(function (m) { return Number(m.day) === day; }).map(function (m) {
        return '<article class="card" style="padding:10px;margin-top:8px"><b>' + esc(t(m.title_en, m.title_bm)) + '</b><p>' + esc(t(m.desc_en, m.desc_bm)) + '</p><p>XP ' + Number(m.xp || 0) + '</p>' +
          (done[m.id] ? '<span>' + esc(t('Done', 'Selesai')) + '</span>' : '<button class="btn btn-sm btn-primary" data-sa="done-mission" data-id="' + esc(m.id) + '" data-xp="' + Number(m.xp || 0) + '">' + esc(t('Mark done', 'Tanda selesai')) + '</button>') + '</article>';
      }).join('');
      return '<section style="margin-bottom:12px"><b>' + esc(t('Day', 'Hari')) + ' ' + day + '</b><p style="color:var(--text-muted)">' + esc(theme) + '</p>' + rows + '</section>';
    }).join('');
    return days;
  }

  function academyHtml(data) {
    var done = {};
    myProgress(data).forEach(function (p) { if (p.item_type === 'module') done[p.item_id] = 1; });
    return data.modules.map(function (m) {
      return '<article class="card" style="padding:10px;margin-bottom:8px"><b>' + esc(t(m.title_en, m.title_bm)) + '</b><p>' + esc(t(m.content_en, m.content_bm)) + '</p><p><b>' + esc(t('Before', 'Sebelum')) + '</b> ' + esc(t(m.before_en, m.before_bm)) + '</p><p><b>' + esc(t('After', 'Selepas')) + '</b> ' + esc(t(m.after_en, m.after_bm)) + '</p>' +
        (done[m.id] ? '<span>' + esc(t('Done', 'Selesai')) + '</span>' : '<button class="btn btn-sm btn-primary" data-sa="done-module" data-id="' + esc(m.id) + '">' + esc(t('Mark done', 'Tanda selesai')) + '</button>') + '</article>';
    }).join('');
  }

  function activityHtml(data) {
    var today = klToday();
    var opts = STAGES.map(function (s) { return '<option value="' + s.key + '">' + esc(t(s.en, s.bm)) + '</option>'; }).join('');
    var rows = data.customers.map(function (c) {
      var late = c.next_follow_up_at && c.next_follow_up_at < today && c.pipeline_stage !== 'signed';
      return '<article class="card" style="padding:10px;margin-bottom:8px"><b>' + esc(c.name) + '</b> ' + (late ? '<span style="color:#b91c1c">' + esc(t('Overdue', 'Tertunggak')) + '</span>' : '') +
        '<p>' + esc(stageLabel(c.pipeline_stage)) + ' · ' + esc(c.next_follow_up_at || '—') + '</p>' +
        '<select data-sa="stage" data-id="' + esc(c.id) + '" data-from="' + esc(c.pipeline_stage || '') + '"><option value="">' + esc(t('Set stage', 'Tetapkan peringkat')) + '</option>' + opts + '</select>' +
        '<input data-sa="follow" data-id="' + esc(c.id) + '" type="date" value="' + esc(c.next_follow_up_at || '') + '" style="margin-top:6px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:6px">' +
        '<button class="btn btn-sm btn-outline" data-sa="log" data-id="' + esc(c.id) + '" style="margin-top:6px">' + esc(t('Log activity', 'Log aktiviti')) + '</button></article>';
    }).join('');
    var log = data.activities.slice(0, 20).map(function (a) { return '<p>' + esc(a.occurred_at || '').slice(0, 10) + ' · ' + esc(a.type) + ' · ' + esc(a.notes || '') + '</p>'; }).join('');
    return rows + '<div class="card" style="padding:10px"><b>' + esc(t('Activity log', 'Log aktiviti')) + '</b>' + (log || '<p>' + esc(t('No activity yet', 'Belum ada aktiviti')) + '</p>') + '</div>';
  }

  function leaderboardHtml(data) {
    var people = {};
    data.people.forEach(function (p) { people[p.id] = p.name || p.id; });
    var scores = {};
    data.progress.forEach(function (p) {
      if (state.board === 'month' && String(p.completed_at || '').slice(0, 7) !== klToday().slice(0, 7)) return;
      if (!scores[p.user_id]) scores[p.user_id] = { xp: 0, signed: 0 };
      scores[p.user_id].xp += Number(p.xp_awarded || 0);
    });
    data.history.forEach(function (h) {
      if (h.to_stage !== 'signed') return;
      if (state.board === 'month' && String(h.changed_at || '').slice(0, 7) !== klToday().slice(0, 7)) return;
      if (!scores[h.changed_by]) scores[h.changed_by] = { xp: 0, signed: 0 };
      scores[h.changed_by].signed += 1;
    });
    var rows = Object.keys(scores).map(function (id) { return { id: id, name: people[id] || id, xp: scores[id].xp, signed: scores[id].signed }; });
    rows.sort(function (a, b) { return (b.xp + b.signed * 100) - (a.xp + a.signed * 100); });
    return '<div style="display:flex;gap:8px;margin-bottom:8px"><button class="btn btn-sm ' + (state.board === 'month' ? 'btn-primary' : 'btn-outline') + '" data-sa="board" data-v="month">' + esc(t('This month', 'Bulan ini')) + '</button><button class="btn btn-sm ' + (state.board === 'all' ? 'btn-primary' : 'btn-outline') + '" data-sa="board" data-v="all">' + esc(t('All time', 'Sepanjang masa')) + '</button></div>' +
      (rows.map(function (r, i) { return '<p>' + (i + 1) + '. ' + esc(r.name) + ' · XP ' + r.xp + ' · ' + esc(t('Signed', 'Ditandatangani')) + ' ' + r.signed + '</p>'; }).join('') || '<p>' + esc(t('No scores yet', 'Belum ada markah')) + '</p>');
  }

  function settingsHtml() {
    if (!admin()) return '<p>' + esc(t('Only an admin can edit content and the team target.', 'Hanya admin boleh ubah kandungan dan sasaran pasukan.')) + '</p>';
    var target = Number((APP.tenant.config && APP.tenant.config.academy_signed_target) || 0);
    return '<label>' + esc(t('Signed client target', 'Sasaran pelanggan ditandatangani')) + '</label><input id="sa-target" type="number" min="0" value="' + target + '" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:8px"><button class="btn btn-sm btn-primary" data-sa="save-target" style="margin-top:8px">' + esc(t('Save target', 'Simpan sasaran')) + '</button>';
  }

  function body(data) {
    if (state.tab === 'challenge') return challengeHtml(data);
    if (state.tab === 'academy') return academyHtml(data);
    if (state.tab === 'activity') return activityHtml(data);
    if (state.tab === 'board') return leaderboardHtml(data);
    if (state.tab === 'reports') return '<button class="btn btn-sm btn-primary" data-sa="csv">' + esc(t('Export CSV', 'Eksport CSV')) + '</button><p style="color:var(--text-muted)">' + esc(t('Pipeline, activities and leaderboard.', 'Talian, aktiviti dan carta kedudukan.')) + '</p>';
    if (state.tab === 'settings') return settingsHtml();
    return overviewHtml(data);
  }

  function tabs() {
    var items = [
      ['overview', 'Overview', 'Ringkasan'], ['challenge', '3-Day Challenge', 'Cabaran 3 Hari'], ['academy', 'Training', 'Latihan'],
      ['activity', 'Activity', 'Aktiviti'], ['board', 'Leaderboard', 'Carta'], ['reports', 'Reports', 'Laporan'], ['settings', 'Settings', 'Tetapan']
    ];
    return '<div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:10px">' + items.map(function (it) {
      return '<button class="btn btn-sm ' + (state.tab === it[0] ? 'btn-primary' : 'btn-outline') + '" data-sa="tab" data-v="' + it[0] + '" style="white-space:nowrap">' + esc(t(it[1], it[2])) + '</button>';
    }).join('') + '</div>';
  }

  async function setStage(id, from, to) {
    if (!to || to === from) return;
    var up = await sb.from('customers').update({ pipeline_stage: to, updated_at: new Date().toISOString() }).eq('id', id).eq('tenant_id', tid());
    if (up.error) { showToast(up.error.message, 'error'); return; }
    await sb.from('crm_stage_history').insert({ tenant_id: tid(), record_id: id, from_stage: from || null, to_stage: to, changed_by: uid(), changed_at: new Date().toISOString(), created_by: uid() });
    await sb.from('crm_activities').insert({ tenant_id: tid(), record_id: id, type: 'stage_change', notes: (from || '—') + ' → ' + to, occurred_at: new Date().toISOString(), user_id: uid(), created_by: uid() });
    if (to === 'signed') showToast(t('Signed on the existing customer. No second customer created.', 'Ditandatangani pada pelanggan sedia ada. Tiada pelanggan kedua.'), 'success');
    renderSalesAcademy({ tab: 'activity' });
  }

  async function markDone(type, id, xp) {
    var row = { tenant_id: tid(), user_id: uid(), item_type: type, item_id: id, xp_awarded: Number(xp || 0), completed_at: new Date().toISOString(), created_by: uid() };
    var ins = await sb.from('academy_progress').insert(row);
    if (ins.error) { showToast(ins.error.message, 'error'); return; }
    renderSalesAcademy({ tab: state.tab });
  }

  function exportCsv(data) {
    var lines = ['type,name,stage,follow_up'];
    data.customers.forEach(function (c) { lines.push(['prospect', c.name, c.pipeline_stage || '', c.next_follow_up_at || ''].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',')); });
    data.activities.forEach(function (a) { lines.push(['activity', a.type, a.notes || '', String(a.occurred_at || '').slice(0, 10)].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',')); });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sales-academy.csv';
    a.click();
  }

  window.renderSalesAcademy = async function (params) {
    if (typeof canAccess === 'function' && !canAccess('sales_academy')) {
      if (typeof renderAccessDenied === 'function') renderAccessDenied();
      return;
    }
    if (params && params.tab) state.tab = params.tab;
    var main = document.getElementById('main');
    main.innerHTML = '<div class="card" style="padding:16px">' + esc(t('Loading Sales Academy', 'Memuatkan Akademi Jualan')) + '</div>';
    var seedErr = await ensureContent();
    var data = await loadAll();
    if (seedErr) data.errors.push(seedErr.message || String(seedErr));
    var err = data.errors.length ? '<p style="color:#b91c1c">' + esc(data.errors[0]) + '</p>' : '';
    main.innerHTML = '<div style="padding:12px"><h2 style="margin:0 0 8px">' + esc(t('Sales Academy', 'Akademi Jualan')) + '</h2>' + err + tabs() + body(data) + '</div>';
    main.onclick = async function (ev) {
      var btn = ev.target.closest('[data-sa]');
      if (!btn) return;
      var act = btn.getAttribute('data-sa');
      if (act === 'tab') { state.tab = btn.getAttribute('data-v'); renderSalesAcademy(); }
      if (act === 'board') { state.board = btn.getAttribute('data-v'); renderSalesAcademy({ tab: 'board' }); }
      if (act === 'overdue') renderSalesAcademy({ tab: 'activity' });
      if (act === 'done-mission') markDone('mission', btn.getAttribute('data-id'), btn.getAttribute('data-xp'));
      if (act === 'done-module') markDone('module', btn.getAttribute('data-id'), 20);
      if (act === 'csv') exportCsv(data);
      if (act === 'log') {
        var notes = window.prompt(t('Activity note', 'Nota aktiviti'));
        if (!notes) return;
        await sb.from('crm_activities').insert({ tenant_id: tid(), record_id: btn.getAttribute('data-id'), type: 'note', notes: notes, occurred_at: new Date().toISOString(), user_id: uid(), created_by: uid() });
        renderSalesAcademy({ tab: 'activity' });
      }
      if (act === 'save-target') {
        var n = Number(document.getElementById('sa-target').value || 0);
        if (typeof _tenantConfigPatch === 'function') await _tenantConfigPatch({ academy_signed_target: n });
        showToast(t('Target saved', 'Sasaran disimpan'), 'success');
      }
    };
    main.onchange = function (ev) {
      var el = ev.target;
      if (el.getAttribute('data-sa') === 'stage') setStage(el.getAttribute('data-id'), el.getAttribute('data-from'), el.value);
      if (el.getAttribute('data-sa') === 'follow') sb.from('customers').update({ next_follow_up_at: el.value || null }).eq('id', el.getAttribute('data-id')).eq('tenant_id', tid());
    };
    paintChip(data);
  };

  function paintChip(data) {
    var bar = document.getElementById('db-shortcuts');
    if (!bar) return;
    var today = klToday();
    var n = (data.customers || []).filter(function (c) { return c.next_follow_up_at && c.next_follow_up_at < today && c.pipeline_stage !== 'signed'; }).length;
    var old = bar.querySelector('[data-sa-sc]');
    if (old) old.remove();
    if (!n) return;
    var row = bar.querySelector('div') || bar;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm';
    btn.setAttribute('data-sa-sc', '1');
    btn.style.cssText = 'background:#b91c1c;color:#fff;white-space:nowrap';
    btn.textContent = (APP.language === 'bm' ? 'Susulan tertunggak ' : 'Overdue follow-ups ') + n;
    btn.onclick = function () { openPage('sales_academy', { tab: 'activity' }); };
    row.appendChild(btn);
  }
})();
