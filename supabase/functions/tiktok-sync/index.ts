// M-Core — TikTok Login Kit + video.list → content_posts
// Secrets: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
// Optional: TIKTOK_APP_RETURN_URL (default GitHub Pages app)
// GET  = OAuth callback (no JWT). POST = platform_admin start/sync/status.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const FIELDS = [
  'id', 'title', 'create_time', 'share_url', 'video_description',
  'like_count', 'view_count', 'comment_count', 'share_count', 'cover_image_url',
].join(',')

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function redirect(url: string) {
  return new Response(null, { status: 302, headers: { ...CORS, Location: url } })
}

function sbAdmin() {
  const url = Deno.env.get('SUPABASE_URL') || ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!url || !key) throw new Error('supabase env missing')
  return createClient(url, key)
}

function clientKey() { return (Deno.env.get('TIKTOK_CLIENT_KEY') || '').trim() }
function clientSecret() { return (Deno.env.get('TIKTOK_CLIENT_SECRET') || '').trim() }
function redirectUri() {
  const base = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')
  return `${base}/functions/v1/tiktok-sync`
}
function appReturn(qs: string) {
  const raw = (Deno.env.get('TIKTOK_APP_RETURN_URL') ||
    'https://mpflemedia-ux.github.io/nexerp/app/').replace(/\/?$/, '/')
  return `${raw}#/admin?view=content-planner&${qs}`
}

function guessCategory(title: string) {
  const t = (title || '').toLowerCase()
  if (/(raya|maulid|merdeka|kebangsaan|ramadan|ramadhan|hari raya|cny|tahun baru)/.test(t)) return 'seasonal'
  if (/\bvs\b|banding|bandingan|bandingkan/.test(t)) return 'comparison'
  if (/(menyesal|masalah|kenapa|tak siap|terburu|sakit|lejar merapu|dalam kepala)/.test(t)) return 'pain_point'
  if (/(demo|log masuk|login|modul|cara |mula kerja|penyelesaian)/.test(t)) return 'demo'
  return 'other'
}

async function requirePlatformAdmin(req: Request) {
  const auth = req.headers.get('Authorization') || ''
  const jwt = auth.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) throw new Error('Not authenticated')
  const sb = sbAdmin()
  const { data: u, error } = await sb.auth.getUser(jwt)
  if (error || !u?.user?.id) throw new Error('Not authenticated')
  const { data: prof } = await sb.from('user_profiles').select('id, role').eq('id', u.user.id).maybeSingle()
  if (String(prof?.role || '').toLowerCase() !== 'platform_admin') throw new Error('platform_admin only')
  return { sb, userId: u.user.id }
}

async function loadTikTokRow(sb: ReturnType<typeof sbAdmin>) {
  const { data } = await sb.from('platform_integrations').select('*').eq('provider', 'tiktok').maybeSingle()
  return data
}

async function upsertTikTokRow(sb: ReturnType<typeof sbAdmin>, patch: Record<string, unknown>) {
  const existing = await loadTikTokRow(sb)
  if (existing) {
    const { error } = await sb.from('platform_integrations').update({ ...patch, updated_at: new Date().toISOString() }).eq('provider', 'tiktok')
    if (error) throw error
  } else {
    const { error } = await sb.from('platform_integrations').insert({ provider: 'tiktok', ...patch })
    if (error) throw error
  }
}

async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    client_key: clientKey(),
    client_secret: clientSecret(),
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(),
  })
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || data.message || 'token exchange failed')
  }
  return data
}

async function refreshAccess(sb: ReturnType<typeof sbAdmin>, row: Record<string, unknown>) {
  const exp = row.expires_at ? new Date(String(row.expires_at)).getTime() : 0
  if (row.access_token && exp > Date.now() + 60_000) return String(row.access_token)
  if (!row.refresh_token) throw new Error('TikTok not connected')
  const body = new URLSearchParams({
    client_key: clientKey(),
    client_secret: clientSecret(),
    grant_type: 'refresh_token',
    refresh_token: String(row.refresh_token),
  })
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) throw new Error(data.error_description || data.error || 'refresh failed')
  await upsertTikTokRow(sb, {
    access_token: data.access_token,
    refresh_token: data.refresh_token || row.refresh_token,
    expires_at: new Date(Date.now() + Number(data.expires_in || 86400) * 1000).toISOString(),
    open_id: data.open_id || row.open_id,
  })
  return String(data.access_token)
}

async function tiktokUser(token: string) {
  const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return data?.data?.user || {}
}

async function listAllVideos(token: string) {
  const out: Record<string, unknown>[] = []
  let cursor = 0
  let hasMore = true
  let guard = 0
  while (hasMore && guard < 25) {
    guard++
    const res = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${encodeURIComponent(FIELDS)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_count: 20, cursor }),
    })
    const data = await res.json()
    const errCode = String(data?.error?.code || '').toLowerCase()
    // TikTok returns { error: { code: "ok" } } on SUCCESS — do not treat as failure.
    if (!res.ok || (errCode && errCode !== 'ok')) {
      throw new Error(data?.error?.message || data?.message || errCode || 'video.list failed')
    }
    const videos = data?.data?.videos || []
    out.push(...videos)
    hasMore = !!data?.data?.has_more
    cursor = Number(data?.data?.cursor || 0)
  }
  return out
}

function titleOf(v: Record<string, unknown>) {
  const t = String(v.title || v.video_description || '').trim()
  return t.slice(0, 180) || `TikTok ${v.id}`
}

async function syncVideos(sb: ReturnType<typeof sbAdmin>, token: string) {
  const videos = await listAllVideos(token)
  const { data: existing } = await sb.from('content_posts').select('id, title, post_url, tiktok_video_id, category, notes')
  const rows = existing || []
  let inserted = 0, updated = 0
  for (const v of videos) {
    const vid = String(v.id || '')
    if (!vid) continue
    const title = titleOf(v)
    const postedAt = v.create_time
      ? new Date(Number(v.create_time) * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
    const views = v.view_count == null ? null : Number(v.view_count)
    const likes = v.like_count == null ? null : Number(v.like_count)
    const url = v.share_url ? String(v.share_url) : `https://www.tiktok.com/video/${vid}`
    const hit = rows.find((r: { tiktok_video_id?: string; post_url?: string; title?: string }) =>
      String(r.tiktok_video_id || '') === vid ||
      (r.post_url && String(r.post_url).includes(vid)) ||
      String(r.title || '').trim().toLowerCase() === title.toLowerCase()
    )
    if (hit) {
      const { error } = await sb.from('content_posts').update({
        tiktok_video_id: vid,
        platform: 'TikTok',
        title,
        status: 'published',
        views,
        likes,
        post_url: url,
        posted_at: postedAt,
      }).eq('id', hit.id)
      if (error) throw error
      updated++
    } else {
      const { error } = await sb.from('content_posts').insert({
        tiktok_video_id: vid,
        platform: 'TikTok',
        title,
        category: guessCategory(title),
        status: 'published',
        views,
        likes,
        post_url: url,
        posted_at: postedAt,
        notes: 'TikTok auto-sync',
      })
      if (error) throw error
      inserted++
    }
  }
  await upsertTikTokRow(sb, { last_synced_at: new Date().toISOString() })
  return { fetched: videos.length, inserted, updated }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (!clientKey() || !clientSecret()) {
      if (req.method === 'GET') return redirect(appReturn('tiktok=err&msg=secrets'))
      return json({ success: false, error: 'TIKTOK_CLIENT_KEY / SECRET not set' }, 503)
    }

    if (req.method === 'GET') {
      const u = new URL(req.url)
      const err = u.searchParams.get('error')
      const code = u.searchParams.get('code')
      if (err) return redirect(appReturn('tiktok=err'))
      if (!code) return json({ ok: true, hint: 'POST start|sync|status' })
      const sb = sbAdmin()
      const tok = await exchangeCode(code)
      const user = await tiktokUser(tok.access_token)
      await upsertTikTokRow(sb, {
        access_token: tok.access_token,
        refresh_token: tok.refresh_token,
        expires_at: new Date(Date.now() + Number(tok.expires_in || 86400) * 1000).toISOString(),
        open_id: tok.open_id || user.open_id || null,
        display_name: user.display_name || null,
        meta: { avatar_url: user.avatar_url || null },
      })
      try { await syncVideos(sb, tok.access_token) } catch (_) { /* first sync optional */ }
      return redirect(appReturn('tiktok=ok'))
    }

    if (req.method !== 'POST') return json({ success: false, error: 'POST or GET only' }, 405)
    const { sb } = await requirePlatformAdmin(req)
    const body = await req.json().catch(() => ({})) as { action?: string }
    const action = String(body.action || 'status')

    if (action === 'start') {
      const state = crypto.randomUUID()
      await upsertTikTokRow(sb, { meta: { oauth_state: state } })
      const auth = new URL('https://www.tiktok.com/v2/auth/authorize/')
      auth.searchParams.set('client_key', clientKey())
      auth.searchParams.set('response_type', 'code')
      auth.searchParams.set('scope', 'user.info.basic,video.list')
      auth.searchParams.set('redirect_uri', redirectUri())
      auth.searchParams.set('state', state)
      return json({ success: true, url: auth.toString() })
    }

    if (action === 'status') {
      const row = await loadTikTokRow(sb)
      return json({
        success: true,
        connected: !!(row && row.refresh_token),
        display_name: row?.display_name || null,
        last_synced_at: row?.last_synced_at || null,
      })
    }

    if (action === 'sync') {
      const row = await loadTikTokRow(sb)
      if (!row?.refresh_token && !row?.access_token) return json({ success: false, error: 'Connect TikTok first' }, 400)
      const token = await refreshAccess(sb, row as Record<string, unknown>)
      const stats = await syncVideos(sb, token)
      return json({ success: true, ...stats })
    }

    if (action === 'disconnect') {
      await sb.from('platform_integrations').delete().eq('provider', 'tiktok')
      return json({ success: true })
    }

    return json({ success: false, error: 'unknown action' }, 400)
  } catch (e) {
    const msg = (e as Error).message || 'error'
    if (req.method === 'GET') return redirect(appReturn('tiktok=err'))
    const code = /not authenticated|platform_admin/i.test(msg) ? 401 : 500
    return json({ success: false, error: msg }, code)
  }
})
