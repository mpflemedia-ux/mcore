// M-Core Service Desk — Public Result Link (no login): view a delivered/closed service request's
// status, deliverables and full timeline, and reopen it. Deploy with verify_jwt OFF (same reason as
// toyyibpay-webhook / tiktok-sync's public callbacks — no Supabase session on this link).
//
// Token model mirrors service_public_links: the plaintext token lives only in the URL the admin
// shares (generated + copied from the "Share result link" button on the request detail page);
// only its sha256 hash is stored on service_requests.result_token_hash. service_requests and
// service_request_events have no anon RLS policy at all, so an anonymous caller can only ever
// reach them through this function's service-role key — and only the fields assembled in
// buildPayload() below leave this function. internal_note events are always dropped.
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

type Req = {
  id: string; tenant_id: string; contract_id: string | null; ref_no: string; service_code: string
  title: string; status: string; created_at: string; due_at: string | null
  delivered_at: string | null; closed_at: string | null; result_token_expires_on: string | null
}

async function findRequest(sb: ReturnType<typeof createClient>, token: string): Promise<Req | null> {
  if (!token || token.length < 16 || token.length > 64) return null
  const h = await hashToken(token)
  const { data: r } = await sb.from('service_requests')
    .select('id,tenant_id,contract_id,ref_no,service_code,title,status,created_at,due_at,delivered_at,closed_at,result_token_expires_on')
    .eq('result_token_hash', h).is('deleted_at', null).maybeSingle()
  if (!r) return null
  const row = r as unknown as Req
  if (row.result_token_expires_on && row.result_token_expires_on < todayKL()) return null
  return row
}

async function buildPayload(sb: ReturnType<typeof createClient>, r: Req) {
  const [{ data: tn }, { data: svc }, { data: ctr }, { data: evs }] = await Promise.all([
    sb.from('tenants').select('name').eq('id', r.tenant_id).maybeSingle(),
    sb.from('service_catalog').select('name_en,name_bm').eq('code', r.service_code).maybeSingle(),
    r.contract_id ? sb.from('service_contracts').select('sla_hours').eq('id', r.contract_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from('service_request_events')
      .select('type,from_status,to_status,body,file_path,actor_id,meta,created_at')
      .eq('request_id', r.id).neq('type', 'internal_note').order('created_at', { ascending: false }),
  ])
  const rows = (evs || []) as Record<string, unknown>[]
  const actorIds = Array.from(new Set(rows.map((e) => e.actor_id).filter(Boolean))) as string[]
  const names: Record<string, string> = {}
  if (actorIds.length) {
    const { data: ps } = await sb.from('user_profiles').select('id,full_name').in('id', actorIds)
    ;((ps || []) as Record<string, unknown>[]).forEach((p) => { names[p.id as string] = (p.full_name as string) || '' })
  }
  const events = []
  for (const e of rows) {
    let file: { name: string; size: number | null; url: string } | null = null
    const meta = (e.meta as Record<string, unknown>) || {}
    if (e.type === 'attachment' && e.file_path) {
      const { data: su } = await sb.storage.from('service-files').createSignedUrl(e.file_path as string, 300)
      file = {
        name: (e.body as string) || String(e.file_path).split('/').pop() || 'file',
        size: (meta.size as number) ?? null,
        url: su?.signedUrl || '',
      }
    }
    events.push({
      type: e.type, from_status: e.from_status, to_status: e.to_status,
      body: e.type === 'attachment' ? null : e.body,
      deliverable: !!meta.deliverable,
      actor_name: e.actor_id ? (names[e.actor_id as string] || '') : '',
      created_at: e.created_at, file,
    })
  }
  return {
    ref_no: r.ref_no, title: r.title, service_code: r.service_code,
    service_name_en: (svc as Record<string, unknown>)?.name_en || r.service_code,
    service_name_bm: (svc as Record<string, unknown>)?.name_bm || r.service_code,
    status: r.status, tenant_name: (tn as Record<string, unknown>)?.name || '',
    created_at: r.created_at, due_at: r.due_at, delivered_at: r.delivered_at, closed_at: r.closed_at,
    sla_hours: (ctr as Record<string, unknown>)?.sla_hours ?? null,
    expires_on: r.result_token_expires_on, events,
  }
}

// mirrors SD.bellFor's non-PA branch in app/sd-data.js: a client-side action notifies platform admins
async function notifyPlatformAdmins(sb: ReturnType<typeof createClient>, r: Req, title: string, body: string) {
  try {
    const { data: ps } = await sb.from('user_profiles').select('id,tenant_id,role').eq('role', 'platform_admin')
    const rows = ((ps || []) as Record<string, unknown>[]).map((p) => ({ tenant_id: p.tenant_id, user_id: p.id, title, body, category: 'service_desk' }))
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
      const r = await findRequest(sb, token)
      if (!r) return json({ success: false, error: 'not_found' }, 404)
      return json({ success: true, data: await buildPayload(sb, r) })
    }
    if (req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as Record<string, string>
      const token = String(body.t || '')
      const reason = String(body.reason || '').trim().slice(0, 1000)
      const r = await findRequest(sb, token)
      if (!r) return json({ success: false, error: 'not_found' }, 404)
      if (!reason) return json({ success: false, error: 'reason_required' }, 400)
      if (r.status !== 'closed' && r.status !== 'delivered') return json({ success: false, error: 'not_reopenable' }, 409)
      const now = new Date().toISOString()
      const { data: upd, error: updErr } = await sb.from('service_requests')
        .update({ status: 'revision', updated_at: now }).eq('id', r.id).eq('status', r.status).select().maybeSingle()
      if (updErr || !upd) return json({ success: false, error: 'update_failed' }, 409)
      await sb.from('service_request_events').insert({
        tenant_id: r.tenant_id, request_id: r.id, type: 'status',
        from_status: r.status, to_status: 'revision', body: reason, actor_id: null,
        meta: { via: 'public_result_link' },
      })
      await notifyPlatformAdmins(sb, r, r.ref_no + ': ' + 'Reopened by client', reason)
      const updatedR: Req = { ...r, status: 'revision' }
      return json({ success: true, data: await buildPayload(sb, updatedR) })
    }
    return json({ success: false, error: 'method_not_allowed' }, 405)
  } catch (e) {
    console.error('sd-result: error', e)
    return json({ success: false, error: (e as Error).message || 'error' }, 500)
  }
})
