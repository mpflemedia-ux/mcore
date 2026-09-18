// M-Core — send email via Hostinger SMTP
// Secrets: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

import nodemailer from 'npm:nodemailer@6.9.16'

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

  const host = Deno.env.get('SMTP_HOST') || 'smtp.hostinger.com'
  const port = Number(Deno.env.get('SMTP_PORT') || '465')
  const user = Deno.env.get('SMTP_USER') || ''
  const pass = Deno.env.get('SMTP_PASS') || ''
  const from = Deno.env.get('SMTP_FROM') || user
  if (!user || !pass) return json({ success: false, error: 'SMTP secrets not set' }, 503)

  const body = await req.json().catch(() => ({})) as Record<string, string>
  const to = String(body.to || '').trim()
  const subject = String(body.subject || '').trim()
  const text = String(body.text || '').trim()
  const html = String(body.html || '')
  if (!to || !subject || (!text && !html)) {
    return json({ success: false, error: 'to, subject, text required' }, 400)
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
    const info = await transporter.sendMail({
      from: from || user,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    })
    return json({ success: true, id: info.messageId || null })
  } catch (e) {
    return json({ success: false, error: (e as Error).message || 'send failed' }, 502)
  }
})
