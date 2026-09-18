// Hostinger SMTP from Edge is blocked. Send via Resend HTTPS.
// Secret: RESEND_API_KEY
// Phion tenants only. From: hello@phion.my
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const PHION_ID = 'c40847f5-63c1-49d5-8e28-8eae95f12ed5'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ success: false, error: 'POST only' }, 405)
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY') || ''
    if (!apiKey) return json({ success: false, error: 'RESEND_API_KEY not set' }, 503)

    const body = await req.json().catch(() => ({})) as Record<string, string>
    const tenantId = String(body.tenant_id || '').trim()
    const to = String(body.to || '').trim()
    const subject = String(body.subject || '').trim()
    const text = String(body.text || '').trim()
    const html = String(body.html || '')
    if (!to || !subject || !text) return json({ success: false, error: 'to, subject, text required' }, 400)
    if (!tenantId) return json({ success: false, error: 'tenant_id required' }, 403)

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '',
    )
    const { data: tn } = await sb.from('tenants').select('id,name,deleted_at').eq('id', tenantId).maybeSingle()
    if (!tn || tn.deleted_at) return json({ success: false, error: 'tenant not found' }, 403)
    if (tn.id !== PHION_ID && !/phion/i.test(tn.name || '')) {
      return json({ success: false, error: 'SMTP enabled for Phion only' }, 403)
    }

    const payload: Record<string, unknown> = {
      from: 'Phion Sdn. Bhd. <hello@phion.my>',
      to: [to],
      subject,
      text,
    }
    if (html) payload.html = html

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    if (!res.ok) {
      const detail = (data.error && (data.error as { message?: string }).message) || data.message || JSON.stringify(data)
      return json({ success: false, error: String(detail) }, 502)
    }
    return json({ success: true, id: data.id || null })
  } catch (e) {
    return json({ success: false, error: (e as Error).message || 'send failed' }, 502)
  }
})
