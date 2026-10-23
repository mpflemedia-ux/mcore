// M-Core — Telegram Bot webhook for /start CODE linking + Projects "import from doc" (send a PDF or photo to the bot)
// Secrets: TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY
// Set webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<SUPABASE_FN_URL>/telegram-webhook
// Import also needs: GROQ_API_KEY (already used by ai-proxy), TELEGRAM_WEBHOOK_SECRET (any long random text), and the webhook set with
// &secret_token=<same text> so Telegram sends header X-Telegram-Bot-Api-Secret-Token. Without the secret, import replies "not switched on"
// and creates nothing. Optional: APP_URL (default https://mpflemedia.my/app/). /start linking is unchanged and does not need the secret.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------- Projects import from Telegram (PDF / photo -> AI -> tasks in the linked user's tenant) ----------
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>
const TG_MAX_BYTES = 20 * 1024 * 1024
const TG_MAX_IMG_B64 = 3500000
const DEFAULT_VISION_MODEL = 'qwen/qwen3.6-27b'
const DEFAULT_CHAT_MODEL = 'llama-3.3-70b-versatile'
const HOME_CODES = ['MPWORK24', 'MPWORK']

function tgText(lang: string, en: string, bm: string) { return lang === 'bm' ? bm : en }
async function tgSend(token: string, chatId: string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3500), disable_web_page_preview: true }) })
  } catch (e) { console.warn('tgSend', e) }
}
function b64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
function ymdAdd(s: string, n: number) { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
function mytToday() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) }
function okYmd(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(v + 'T00:00:00Z'); return isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v
}
function norm(s: unknown) { return String(s || '').toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, ' ').trim() }
/* weekend / public holiday -> previous working day (not before today), else next working day (same rule as app/pj-ai-import.js) */
function shiftDue(d: string, hol: Record<string, number>, today: string) {
  const work = (x: string) => { const w = new Date(x + 'T00:00:00Z').getUTCDay(); return w !== 0 && w !== 6 && !hol[x] }
  if (d < today) d = today
  if (work(d)) return d
  let b = d
  for (let n = 0; n < 10; n++) { b = ymdAdd(b, -1); if (b < today) break; if (work(b)) return b }
  let f = d
  for (let n = 0; n < 14; n++) { f = ymdAdd(f, 1); if (work(f)) return f }
  return d
}
async function groqTasks(text: string, image: { base64: string; mime: string } | null, lang: string, today: string, projects: string[]) {
  const key = Deno.env.get('GROQ_API_KEY'); if (!key) throw new Error('GROQ_API_KEY not set')
  const model = image ? (Deno.env.get('GROQ_VISION_MODEL') || DEFAULT_VISION_MODEL) : (Deno.env.get('GROQ_CHAT_MODEL') || DEFAULT_CHAT_MODEL)
  const sys = 'You turn a business document into an internal project task list for a Malaysian SME task board. Suggest a short project name ' +
    '(return an existing name exactly if one clearly matches) and break the work into concrete actionable tasks (max 30; do not invent work). ' +
    'Titles: sentence case, start with a verb, max 70 characters. Dates YYYY-MM-DD; today is ' + today + '; working days Mon-Fri; never before today; ' +
    'if no deadline, spread due dates sensibly. est_hours: number or null. urgent = due within 3 working days or marked urgent; important = client-facing, money, legal or key deliverable. ' +
    'todo: 2-6 short steps. tag: one or two words for the type of work. Never invent people, prices or legal facts. Respond with ONLY JSON: ' +
    '{"project_name": "<string or null>", "tasks": [{"title": "", "tag": "", "due_date": null, "est_hours": null, "important": false, "urgent": false, "todo": [""], "notes": ""}]}. ' +
    'Write in ' + (lang === 'bm' ? 'Bahasa Melayu Malaysia (DBP standard, not Indonesian)' : 'English') + '.\nExisting project names: ' + (projects.length ? projects.join(' | ') : '(none)')
  const user: unknown = image
    ? [{ type: 'text', text: text ? 'Caption: ' + text : 'The document is in the image.' }, { type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } }]
    : 'Document text:\n"""\n' + text.slice(0, 24000) + '\n"""'
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0.3, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
  })
  if (!res.ok) throw new Error('AI error ' + res.status + ': ' + (await res.text()).slice(0, 200))
  const data = await res.json()
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}') as Row
  const str = (v: unknown, m: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, m) : '')
  const seen = new Set<string>()
  const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks : []).map((t: Row) => ({
    title: str(t?.title, 120), tag: str(t?.tag, 40), due: okYmd(t?.due_date),
    h: typeof t?.est_hours === 'number' && t.est_hours > 0 ? Math.min(999, Math.max(0.25, Math.round(t.est_hours * 4) / 4)) : null,
    imp: t?.important === true, urg: t?.urgent === true, notes: str(t?.notes, 600),
    todo: (Array.isArray(t?.todo) ? t.todo : []).map((s: unknown) => str(s, 160)).filter(Boolean).slice(0, 10) as string[],
  })).filter((t: Row) => { const k = t.title.toLowerCase(); if (!t.title || seen.has(k)) return false; seen.add(k); return true }).slice(0, 30)
  return { project: str(parsed.project_name, 120), tasks }
}
/* insert, dropping optional columns once if this database does not have them yet */
async function insertTasks(sb: Row, rows: Row[]) {
  let r = await sb.from('project_tasks').insert(rows).select('id,title,sort_order')
  if (r.error && /column/i.test(r.error.message || '')) r = await sb.from('project_tasks').insert(rows.map((x) => { const y = { ...x }; delete y.est_hours; delete y.remind_before_min; return y })).select('id,title,sort_order')
  return r
}

async function importDoc(sb: Row, token: string, update: Row, msg: Row) {
  const chatId = String(msg.chat.id)
  const say = (t: string) => tgSend(token, chatId, t)
  /* Telegram retries a webhook it thinks failed: claim the update id once */
  const c0 = await sb.from('pj_auto_log').insert({ dedupe_key: 'tgu:' + update.update_id, kind: 'tg_update' }).select('id')
  if (c0.error) { if (c0.error.code !== '23505') await say('M-Core: Telegram import is not set up yet (pj_auto_01.sql).'); return }
  const lk = await sb.from('telegram_links').select('tenant_id,subject_id,linked_at').eq('chat_id', chatId).eq('subject_type', 'user').order('linked_at', { ascending: false }).limit(1)
  const link = lk.data && lk.data[0]
  if (!link) { await say('M-Core: link your account first — open M-Core → Notification settings → Link Telegram.'); return }
  const tenant = String(link.tenant_id)
  let pf = await sb.from('user_profiles').select('id,tenant_id,email,full_name,language').eq('id', link.subject_id).maybeSingle()
  if (pf.error) pf = await sb.from('user_profiles').select('id,tenant_id,email,full_name').eq('id', link.subject_id).maybeSingle()
  const prof = pf.data as Row | null
  if (!prof || String(prof.tenant_id) !== tenant) { await say('M-Core: this Telegram link is no longer valid. Link it again in M-Core.'); return }
  const lang = prof.language === 'bm' ? 'bm' : 'en'
  const tn = await sb.from('tenants').select('id,name,code,plan_id').eq('id', tenant).maybeSingle()
  const t = (tn.data || {}) as Row
  const home = HOME_CODES.indexOf(String(t.code || '').toUpperCase()) >= 0 || ['mp workspace', 'mpworkspace'].indexOf(String(t.name || '').trim().toLowerCase()) >= 0
  if (!home && t.plan_id) {
    const pl = await sb.from('plans').select('code').eq('id', t.plan_id).maybeSingle()
    if (pl.data && String(pl.data.code).toLowerCase() === 'free') { await say(tgText(lang, 'M-Core: the Free plan does not include AI. Upgrade to Starter or higher.', 'M-Core: Pelan Free tidak termasuk AI. Naik taraf ke Starter atau lebih tinggi.')); return }
  }
  /* file */
  const doc = msg.document as Row | undefined, photo = Array.isArray(msg.photo) && msg.photo.length ? msg.photo[msg.photo.length - 1] : null
  const fileId = doc ? doc.file_id : photo ? photo.file_id : null
  const mime = doc ? String(doc.mime_type || '') : 'image/jpeg'
  const name = doc ? String(doc.file_name || 'document') : 'photo-' + update.update_id + '.jpg'
  const isPdf = /pdf/i.test(mime) || /\.pdf$/i.test(name), isImg = /^image\//i.test(mime)
  if (!fileId || !(isPdf || isImg)) { await say(tgText(lang, 'M-Core: send a PDF or a photo of the document.', 'M-Core: hantar PDF atau gambar dokumen.')); return }
  if (Number((doc || photo || {}).file_size || 0) > TG_MAX_BYTES) { await say(tgText(lang, 'M-Core: file is over 20 MB.', 'M-Core: fail melebihi 20 MB.')); return }
  await say(tgText(lang, '⏳ Reading your document… (10-40 seconds)', '⏳ Sedang baca dokumen… (10-40 saat)'))
  const gf = await (await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`)).json()
  if (!gf.ok || !gf.result?.file_path) { await say(tgText(lang, 'M-Core: could not download the file.', 'M-Core: tak dapat muat turun fail.')); return }
  const bytes = new Uint8Array(await (await fetch(`https://api.telegram.org/file/bot${token}/${gf.result.file_path}`)).arrayBuffer())
  let text = '', image: { base64: string; mime: string } | null = null
  const caption = String(msg.caption || '').trim()
  if (isPdf) {
    const { extractText, getDocumentProxy } = await import('npm:unpdf@0.12.1')
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    const ex = await extractText(pdf, { mergePages: false })
    text = (ex.text as string[]).map((s, i) => '--- page ' + (i + 1) + ' ---\n' + s).join('\n\n')
    if (text.replace(/--- page \d+ ---/g, '').trim().length < 50) { await say(tgText(lang, 'M-Core: this PDF looks scanned (no text). Send photos of the pages instead, one per message.', 'M-Core: PDF ini nampak macam imbasan (tiada teks). Hantar gambar setiap muka surat, satu gambar satu mesej.')); return }
    if (caption) text = 'Caption: ' + caption + '\n\n' + text
  } else {
    const s = b64(bytes)
    if (s.length > TG_MAX_IMG_B64) { await say(tgText(lang, 'M-Core: image is too large. Send it as a photo (not as a file).', 'M-Core: gambar terlalu besar. Hantar sebagai gambar (bukan fail).')); return }
    image = { base64: s, mime: isImg ? mime : 'image/jpeg' }; text = caption
  }
  const today = mytToday()
  const pr = await sb.from('projects').select('id,name,archived_at').eq('tenant_id', tenant).is('deleted_at', null).limit(500)
  const projects = ((pr.data || []) as Row[]).filter((p) => !p.archived_at)
  let ai
  try { ai = await groqTasks(text, image, lang, today, projects.map((p) => String(p.name))) } catch (e) { await say('M-Core: ' + ((e as Error).message || 'AI error')); return }
  if (!ai.tasks.length) { await say(tgText(lang, 'M-Core: no actionable tasks found in this document.', 'M-Core: tiada task yang boleh dibuat dalam dokumen ini.')); return }
  /* project: caption names one > AI suggestion matches one > same album as an earlier photo > new internal project */
  const capHit = caption ? projects.find((p) => norm(p.name) && (norm(caption).indexOf(norm(p.name)) >= 0 || norm(p.name).indexOf(norm(caption)) >= 0)) : null
  const aiHit = ai.project ? projects.find((p) => norm(p.name) === norm(ai.project)) : null
  let pid = capHit ? String(capHit.id) : aiHit ? String(aiHit.id) : ''
  let pname = capHit ? String(capHit.name) : aiHit ? String(aiHit.name) : ''
  const mg = msg.media_group_id ? String(msg.media_group_id) : ''
  let leader = true
  if (mg && !pid) {
    const g = await sb.from('pj_auto_log').insert({ dedupe_key: 'tgmg:' + mg, tenant_id: tenant, user_id: prof.id, kind: 'tg_group' }).select('id')
    if (g.error) {
      leader = false
      for (let i = 0; i < 16 && !pid; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        const w = await sb.from('pj_auto_log').select('project_id').eq('dedupe_key', 'tgmg:' + mg).maybeSingle()
        if (w.data && w.data.project_id) pid = String(w.data.project_id)
      }
      const p2 = pid ? projects.find((p) => String(p.id) === pid) : null; if (p2) pname = String(p2.name)
    }
  }
  if (!pid) {
    pname = (ai.project || name.replace(/\.[^.]+$/, '') || 'Telegram import').slice(0, 120)
    const np = await sb.from('projects').insert({ tenant_id: tenant, name: pname, kind: 'internal', customer_id: null, color: '#0E7490' }).select('id').single()
    if (np.error) { await say('M-Core: ' + np.error.message); return }
    pid = String(np.data.id)
  }
  if (mg && leader) await sb.from('pj_auto_log').update({ project_id: pid }).eq('dedupe_key', 'tgmg:' + mg)
  /* owner = the linked user's staff record (email, then full name) */
  const em = await sb.from('employees').select('id,name,email').eq('tenant_id', tenant).is('deleted_at', null)
  const emps = (em.data || []) as Row[], pe = String(prof.email || '').trim().toLowerCase(), pn = String(prof.full_name || '').trim().toLowerCase()
  const owner = (emps.find((e) => pe && String(e.email || '').trim().toLowerCase() === pe) || emps.find((e) => pn && String(e.name || '').trim().toLowerCase() === pn) || null)
  /* duplicates in that project are skipped */
  const ex = await sb.from('project_tasks').select('title,sort_order').eq('tenant_id', tenant).eq('project_id', pid).is('deleted_at', null).limit(2000)
  const exRows = (ex.data || []) as Row[], exT = exRows.map((x) => norm(x.title))
  const fresh = ai.tasks.filter((k: Row) => { const a = norm(k.title); return !exT.some((b) => a === b || (a.length >= 12 && b.length >= 12 && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0))) })
  const skipped = ai.tasks.length - fresh.length
  if (!fresh.length) { await say(tgText(lang, 'M-Core: every task found already exists in "' + pname + '". Nothing new created.', 'M-Core: semua task yang dijumpai sudah ada dalam "' + pname + '". Tiada task baru dicipta.')); return }
  const hp = await sb.from('platform_activities').select('notes').eq('tenant_id', tenant).is('deleted_at', null).like('notes', 'MY_PH:%').limit(400)
  const hol: Record<string, number> = {}; ((hp.data || []) as Row[]).forEach((x) => { const m = String(x.notes || '').match(/^MY_PH:\d{4}:(\d{4}-\d{2}-\d{2})/); if (m) hol[m[1]] = 1 })
  const chk = !(await sb.from('project_task_checklist').select('id', { head: true, count: 'exact' }).limit(1)).error
  const base = exRows.reduce((m, x) => Math.max(m, Number(x.sort_order) || 0), 0)
  const rows = fresh.map((k: Row, i: number) => {
    const due = k.due ? shiftDue(k.due, hol, today) : null
    const head = (k.tag ? tgText(lang, 'Suggested tag: ', 'Tag dicadang: ') + k.tag + '\n' : '') + (k.notes ? k.notes + '\n' : '') + tgText(lang, 'Source: Telegram · ', 'Sumber: Telegram · ') + name
    const todo = chk ? '' : '\n\n' + tgText(lang, 'To do:\n', 'Perlu buat:\n') + k.todo.map((s: string) => '- ' + s).join('\n') + tgText(lang, '\n\nIn progress:\n\nDone:\n', '\n\nSedang buat:\n\nSudah siap:\n')
    const r: Row = { tenant_id: tenant, project_id: pid, title: k.title, column_key: 'backlog', tag: 'AI Import', assignee_employee_id: owner ? owner.id : null, start_date: today, due_date: due, progress: 0, notes: head + todo, sort_order: base + i + 1, is_important: k.imp, is_urgent: k.urg }
    if (k.h) r.est_hours = k.h
    if (due) r.remind_before_min = 1440
    return r
  })
  const ins = await insertTasks(sb, rows)
  if (ins.error) { await say('M-Core: ' + ins.error.message); return }
  const made = ((ins.data || []) as Row[]).sort((a, b) => a.sort_order - b.sort_order)
  if (owner && made.length) await sb.from('project_task_assignees').insert(made.map((k) => ({ tenant_id: tenant, task_id: k.id, employee_id: owner.id, is_owner: true })))
  if (chk) {
    const cl: Row[] = []
    made.forEach((k, i) => (fresh[i].todo as string[]).slice(0, 30).forEach((s, j) => cl.push({ tenant_id: tenant, task_id: k.id, label: s.slice(0, 300), sort_order: j + 1 })))
    if (cl.length) await sb.from('project_task_checklist').insert(cl)
  }
  const safe = (Date.now() + '-' + (name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file')).slice(0, 120)
  await sb.storage.from('company-assets').upload(tenant + '/projects/' + pid + '/' + safe, bytes, { contentType: isPdf ? 'application/pdf' : (isImg ? mime : 'image/jpeg'), upsert: false })
  try { await sb.from('pj_auto_log').update({ tenant_id: tenant, user_id: prof.id, project_id: pid, ref: String(made.length) }).eq('dedupe_key', 'tgu:' + update.update_id) } catch (_e) { /* log only */ }
  const app = (Deno.env.get('APP_URL') || 'https://mpflemedia.my/app/').replace(/\/?$/, '/')
  await say(tgText(lang,
    '✅ ' + made.length + ' task(s) created in "' + pname + '"' + (skipped ? ' (' + skipped + ' skipped as duplicates)' : '') + '.\nOwner: ' + (owner ? owner.name : 'unassigned (no staff record with your email)') + ' · tag "AI Import" · column Backlog.\nOpen: ' + app + '?pj_task=' + made[0].id,
    '✅ ' + made.length + ' task dicipta dalam "' + pname + '"' + (skipped ? ' (' + skipped + ' di-skip, berganda)' : '') + '.\nOwner: ' + (owner ? owner.name : 'tiada (tiada rekod staf dengan emel kau)') + ' · tag "AI Import" · lajur Backlog.\nBuka: ' + app + '?pj_task=' + made[0].id))
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: true })

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
  const url = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!botToken || !url || !serviceKey) return json({ ok: false, error: 'config' }, 503)

  const sb = createClient(url, serviceKey)

  try {
    const update = await req.json()
    const msg = update?.message || update?.edited_message
    if (!msg?.chat?.id) return json({ ok: true })

    const chatId = String(msg.chat.id)
    const username = msg.chat.username || msg.from?.username || null
    const text = String(msg.text || '').trim()

    /* Projects import: only new messages (not edits) that carry a PDF/photo, only with the webhook secret header */
    if (update?.message && (update.message.document || (Array.isArray(update.message.photo) && update.message.photo.length))) {
      const secret = (Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '').trim()
      if (!secret) { await tgSend(botToken, chatId, 'M-Core: import from Telegram is not switched on yet. Ask your admin.'); return json({ ok: true }) }
      if ((req.headers.get('x-telegram-bot-api-secret-token') || '').trim() !== secret) return json({ ok: true }) /* ignored; 200 so Telegram does not keep retrying it */
      const job = importDoc(sb, botToken, update, update.message).catch(async (e) => { console.error('tg import', e); await tgSend(botToken, chatId, 'M-Core: import failed — ' + ((e as Error).message || 'error')) })
      // deno-lint-ignore no-explicit-any
      const rt = (globalThis as any).EdgeRuntime
      if (rt && typeof rt.waitUntil === 'function') rt.waitUntil(job); else await job
      return json({ ok: true })
    }

    if (text.startsWith('/start')) {
      const code = text.replace(/^\/start\s*/, '').trim()
      if (!code) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: 'Open M-Core → Notifications Settings → Link Telegram to get your link.',
          }),
        })
        return json({ ok: true })
      }

      const { data: row } = await sb.from('telegram_link_codes').select('*').eq('code', code).maybeSingle()
      if (!row || new Date(row.expires_at) < new Date()) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: 'Link expired or invalid. Generate a new link in M-Core.' }),
        })
        return json({ ok: true })
      }

      await sb.from('telegram_links').upsert({
        tenant_id: row.tenant_id,
        subject_type: row.subject_type,
        subject_id: row.subject_id,
        chat_id: chatId,
        username,
        linked_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,subject_type,subject_id' })

      await sb.from('telegram_link_codes').delete().eq('code', code)

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ Linked to M-Core. You will receive notifications here.',
        }),
      })
    }
    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ ok: false }, 500)
  }
})
