// NexERP — WhatsApp Cloud API sender (Phase 3 internal + Phase 4 customer)
// Secrets (Supabase → Edge Functions → Secrets):
//   WHATSAPP_TOKEN          — permanent system-user access token
//   WHATSAPP_PHONE_NUMBER_ID — Cloud API phone number ID
//   WHATSAPP_TEMPLATE_NAME  — optional default Utility template name (e.g. nexerp_alert)
//   WHATSAPP_TEMPLATE_LANG  — optional, default en
//
// Request POST JSON:
//   { to: "60123456789", text: "message body",
//     template?: string, language?: string, params?: string[] }
// Response: { success: true, data } | { success: false, error }

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

function normalizeMsPhone(raw: string): string | null {
  let d = String(raw || '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('0') && d.length >= 9) d = '60' + d.slice(1)
  if (d.length < 10 || d.length > 15) return null
  return d
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ success: false, error: 'POST only' }, 405)

  try {
    const auth = req.headers.get('Authorization') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') || ''
    if (supabaseUrl && supabaseAnon && auth) {
      const sb = createClient(supabaseUrl, supabaseAnon, {
        global: { headers: { Authorization: auth } },
      })
      const { data: userData, error: userErr } = await sb.auth.getUser()
      if (userErr || !userData?.user) {
        return json({ success: false, error: 'Unauthorized' }, 401)
      }
    }

    const token = Deno.env.get('WHATSAPP_TOKEN') || ''
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || ''
    if (!token || !phoneId) {
      return json({
        success: false,
        error: 'WhatsApp secrets not configured (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID)',
      }, 503)
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const to = normalizeMsPhone(String(body.to || ''))
    if (!to) return json({ success: false, error: 'Invalid to phone' }, 400)

    const text = String(body.text || '').slice(0, 1000)
    const template = String(body.template || Deno.env.get('WHATSAPP_TEMPLATE_NAME') || '').trim()
    const language = String(body.language || Deno.env.get('WHATSAPP_TEMPLATE_LANG') || 'en').trim() || 'en'
    const params = Array.isArray(body.params) ? (body.params as unknown[]).map(p => String(p)).slice(0, 10) : []

    let payload: Record<string, unknown>
    if (template) {
      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: language },
          ...(params.length
            ? {
                components: [{
                  type: 'body',
                  parameters: params.map(t => ({ type: 'text', text: t.slice(0, 200) })),
                }],
              }
            : {}),
        },
      }
    } else {
      if (!text) return json({ success: false, error: 'text or template required' }, 400)
      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }
    }

    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errMsg = (data as { error?: { message?: string } })?.error?.message || JSON.stringify(data)
      return json({ success: false, error: errMsg }, 502)
    }
    return json({ success: true, data })
  } catch (e) {
    return json({ success: false, error: (e as Error).message || 'send failed' }, 500)
  }
})
