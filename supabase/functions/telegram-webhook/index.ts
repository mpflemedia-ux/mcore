// NexERP — Telegram Bot webhook for /start CODE linking
// Secrets: TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY
// Set webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<SUPABASE_FN_URL>/telegram-webhook

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

    if (text.startsWith('/start')) {
      const code = text.replace(/^\/start\s*/, '').trim()
      if (!code) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: 'Open NexERP → Notifications Settings → Link Telegram to get your link.',
          }),
        })
        return json({ ok: true })
      }

      const { data: row } = await sb.from('telegram_link_codes').select('*').eq('code', code).maybeSingle()
      if (!row || new Date(row.expires_at) < new Date()) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: 'Link expired or invalid. Generate a new link in NexERP.' }),
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
          text: '✅ Linked to NexERP. You will receive notifications here.',
        }),
      })
    }
    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ ok: false }, 500)
  }
})
