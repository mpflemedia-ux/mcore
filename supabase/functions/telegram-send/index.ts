// NexERP — Telegram Bot send
// Secret: TELEGRAM_BOT_TOKEN
// POST { chat_id, text } OR { tenant_id, subject_type, subject_id, text }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  if (req.method !== 'POST') return json({ success: false, error: 'POST only' }, 405)

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
  if (!token) return json({ success: false, error: 'TELEGRAM_BOT_TOKEN not set' }, 503)

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    let chatId = String(body.chat_id || '').trim()
    const text = String(body.text || '').slice(0, 3500)
    if (!text) return json({ success: false, error: 'text required' }, 400)

    if (!chatId && body.tenant_id && body.subject_type && body.subject_id) {
      const url = Deno.env.get('SUPABASE_URL') || ''
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
      const sb = createClient(url, key)
      const { data } = await sb.from('telegram_links').select('chat_id')
        .eq('tenant_id', String(body.tenant_id))
        .eq('subject_type', String(body.subject_type))
        .eq('subject_id', String(body.subject_id))
        .maybeSingle()
      chatId = data?.chat_id || ''
    }
    if (!chatId) return json({ success: false, error: 'no chat_id' }, 400)

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !(data as { ok?: boolean }).ok) {
      return json({ success: false, error: (data as { description?: string }).description || 'send failed' }, 502)
    }
    return json({ success: true, data })
  } catch (e) {
    return json({ success: false, error: (e as Error).message || 'error' }, 500)
  }
})
