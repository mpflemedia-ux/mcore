// M-Core Projects — Public Report Link (no login): view-only project report + "leave a message".
// Deploy with verify_jwt OFF (same reason as sd-result / toyyibpay-webhook — no Supabase session
// on this link).
//
// Token model mirrors service_public_links / sd-result's result-link: the plaintext token lives
// only in the URL copied from the "Share public report" button on the Projects page; only its
// sha256 hash is stored on project_share_links.token_hash. projects/project_tasks have no anon RLS
// at all, so an anonymous caller can only ever reach them through this function's service-role key
// — only the fields assembled in buildPayload() below ever leave this function.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

function sbAdmin() {
  const url = Deno.env.get('SUPABASE_URL') || ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!url || !key) throw new Error('supabase env missing')
  return createClient(url, key)
}

async function hashToken(t: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function todayKL() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
}

type Link = {
  id: string; tenant_id: string; project_id: string; expires_on: string
  revoked_at: string | null; view_count: number; viewed_at: string | null
}

async function findLink(sb: ReturnType<typeof createClient>, token: string): Promise<Link | null> {
  if (!token || token.length < 16 || token.length > 64) return null
  const h = await hashToken(token)
  const { data: l } = await sb.from('project_share_links')
    .select('id,tenant_id,project_id,expires_on,revoked_at,view_count,viewed_at')
    .eq('token_hash', h).is('deleted_at', null).maybeSingle()
  if (!l) return null
  const row = l as unknown as Link
  if (row.revoked_at) return null
  if (row.expires_on < todayKL()) return null
  return row
}

// same formula as app/projects.js stats() — total/in-progress/done/overdue/avg progress
function stats(tasks: Record<string, unknown>[]) {
  const today = todayKL()
  const total = tasks.length
  const progress = tasks.filter((x) => x.column_key === 'progress').length
  const done = tasks.filter((x) => x.column_key === 'done').length
  const overdue = tasks.filter((x) => x.due_date && String(x.due_date).slice(0, 10) < today && x.column_key !== 'done').length
  const sum = tasks.reduce((n, x) => n + Math.max(0, Math.min(100, Number(x.progress) || 0)), 0)
  const pct = total ? Math.round(sum / total) : 0
  return { total, progress, done, overdue, pct }
}

async function buildPayload(sb: ReturnType<typeof createClient>, link: Link) {
  const [{ data: proj }, { data: tasks }] = await Promise.all([
    sb.from('projects').select('name,kind').eq('id', link.project_id).maybeSingle(),
    sb.from('project_tasks').select('id,title,column_key,tag,assignee_employee_id,start_date,due_date,progress,notes,is_important,is_urgent')
      .eq('project_id', link.project_id).is('deleted_at', null).order('sort_order'),
  ])
  const rows = (tasks || []) as Record<string, unknown>[]
  const empIds = Array.from(new Set(rows.map((t) => t.assignee_employee_id).filter(Boolean))) as string[]
  const names: Record<string, string> = {}
  if (empIds.length) {
    const { data: emps } = await sb.from('employees').select('id,name,nickname').in('id', empIds).is('deleted_at', null)
    ;((emps || []) as Record<string, unknown>[]).forEach((e) => { names[e.id as string] = (e.nickname as string) || (e.name as string) || '' })
  }
  // attachments: screenshots pasted on project_task_comments (not the WhatsApp share log, which
  // stays internal-only) - signed URLs, 5 min, same pattern as sd-result's deliverable files.
  const taskIds = rows.map((t) => t.id) as string[]
  const attByTask: Record<string, { name: string; url: string; by: string; created_at: string }[]> = {}
  if (taskIds.length) {
    const { data: comments } = await sb.from('project_task_comments')
      .select('task_id,file_path,file_name,created_by_name,created_at')
      .in('task_id', taskIds).not('file_path', 'is', null).is('deleted_at', null).order('created_at')
    const commentRows = (comments || []) as Record<string, unknown>[]
    const paths = commentRows.map((c) => c.file_path).filter(Boolean) as string[]
    let urlByPath: Record<string, string> = {}
    if (paths.length) {
      const { data: su } = await sb.storage.from('project-comments').createSignedUrls(paths, 300)
      ;(su || []).forEach((x) => { if (x.path && x.signedUrl) urlByPath[x.path] = x.signedUrl })
    }
    commentRows.forEach((c) => {
      const tid = c.task_id as string
      ;(attByTask[tid] = attByTask[tid] || []).push({
        name: (c.file_name as string) || 'image', url: urlByPath[c.file_path as string] || '',
        by: (c.created_by_name as string) || '', created_at: c.created_at as string,
      })
    })
  }

  const tasksOut = rows.map((t) => ({
    id: t.id, title: t.title, column_key: t.column_key, tag: t.tag,
    assignee_name: t.assignee_employee_id ? (names[t.assignee_employee_id as string] || '') : '',
    start_date: t.start_date, due_date: t.due_date, progress: t.progress, notes: t.notes,
    is_important: !!t.is_important, is_urgent: !!t.is_urgent,
    attachments: attByTask[t.id as string] || [],
  }))
  return {
    project_name: (proj as Record<string, unknown>)?.name || '', project_kind: (proj as Record<string, unknown>)?.kind || 'internal',
    stats: stats(rows), tasks: tasksOut, expires_on: link.expires_on,
  }
}

// mirrors SD.bellFor's tenant-owner branch: notify this project's own tenant owner/admin
async function notifyOwners(sb: ReturnType<typeof createClient>, tenantId: string, title: string, body: string) {
  try {
    const { data: ps } = await sb.from('user_profiles').select('id,tenant_id,role').eq('tenant_id', tenantId)
    const rows = ((ps || []) as Record<string, unknown>[])
      .filter((p) => ['owner', 'admin'].includes(String(p.role || '').toLowerCase()))
      .map((p) => ({ tenant_id: p.tenant_id, user_id: p.id, title, body, category: 'projects' }))
    if (rows.length) await sb.from('notifications').insert(rows)
  } catch (_e) { /* notification failures never block the action */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const sb = sbAdmin()
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const token = url.searchParams.get('t') || ''
      const link = await findLink(sb, token)
      if (!link) return json({ success: false, error: 'not_found' }, 404)
      const now = new Date().toISOString()
      await sb.from('project_share_links').update({ view_count: (link.view_count || 0) + 1, viewed_at: now }).eq('id', link.id)
      return json({ success: true, data: await buildPayload(sb, link) })
    }
    if (req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as Record<string, string>
      const token = String(body.t || '')
      const message = String(body.message || '').trim().slice(0, 2000)
      const link = await findLink(sb, token)
      if (!link) return json({ success: false, error: 'not_found' }, 404)
      if (!message) return json({ success: false, error: 'message_required' }, 400)
      const { error: insErr } = await sb.from('project_share_messages').insert({
        tenant_id: link.tenant_id, project_id: link.project_id, link_id: link.id, body: message,
      })
      if (insErr) throw insErr
      const { data: proj } = await sb.from('projects').select('name').eq('id', link.project_id).maybeSingle()
      await notifyOwners(sb, link.tenant_id, ((proj as Record<string, unknown>)?.name || 'Project') + ': new message', message)
      return json({ success: true })
    }
    return json({ success: false, error: 'method_not_allowed' }, 405)
  } catch (e) {
    console.error('pj-report: error', e)
    return json({ success: false, error: (e as Error).message || 'error' }, 500)
  }
})
