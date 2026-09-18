// M-Core — Hostinger SMTP. Phion tenants only.
import nodemailer from 'npm:nodemailer@6.9.16'
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

function isPhion(name: string, id: string) {
  if (id === PHION_ID) return true
  return /phion/i.test(name || '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ success: false, error: 'POST only' }, 405)

  const host = Deno.env.get('SMTP_HOST') || 'smtp.hostinger.com'
  const port = Number(Deno.env.get('SMTP_PORT') || '465')
  const user = Deno.env.get('SMTP_USER') || ''
  const pass = Deno.env.get('SMTP_PASS') || ''
  const from = Deno.env.get('SMTP_FROM') || user
  if (!user || !pass) return json({ success: false, error: 'SMTP secrets not set' }, 503)

  const body = await req.json().catch(() => ({})) as Record<string, string>
  const tenantId = String(body.tenant_id || '').trim()
  const to = String(body.to || '').trim()
  const subject = String(body.subject || '').trim()
  const text = String(body.text || '').trim()
  const html = String(body.html || '')
  if (!to || !subject || (!text && !html)) {
    return json({ success: false, error: 'to, subject, text required' }, 400)
  }

  const url = Deno.env.get('SUPABASE_URL') || ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
  const sb = createClient(url, key)
  let tname = ''
  if (tenantId) {
    const { data } = await sb.from('tenants').select('id,name,deleted_at').eq('id', tenantId).maybeSingle()
    if (!data || data.deleted_at) return json({ success: false, error: 'tenant not found' }, 403)
    tname = data.name || ''
    if (!isPhion(tname, data.id)) {
      return json({ success: false, error: 'SMTP enabled for Phion only' }, 403)
    }
  } else {
    return json({ success: false, error: 'tenant_id required' }, 403)
  }

  try {
    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass },
    })
    const info = await transporter.sendMail({
      from: from || user, to, subject,
      text: text || undefined, html: html || undefined,
    })
    return json({ success: true, id: info.messageId || null })
  } catch (e) {
    return json({ success: false, error: (e as Error).message || 'send failed' }, 502)
  }
})
