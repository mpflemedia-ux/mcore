// Hostinger SMTP over TLS 465 — no nodemailer (Deno Edge)
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

async function smtpSend(opts: {
  host: string; port: number; user: string; pass: string
  from: string; to: string; subject: string; text: string; html?: string
}) {
  const conn = await Deno.connectTls({ hostname: opts.host, port: opts.port })
  const enc = new TextEncoder()
  const dec = new TextDecoder()
  async function read() {
    const buf = new Uint8Array(8192)
    const n = await conn.read(buf)
    return dec.decode(buf.subarray(0, n || 0))
  }
  async function cmd(line: string) {
    await conn.write(enc.encode(line + '\r\n'))
    return await read()
  }
  const banner = await read()
  if (!/^220/.test(banner)) throw new Error('SMTP banner: ' + banner.slice(0, 120))
  await cmd('EHLO mcore.phion.my')
  let r = await cmd('AUTH LOGIN')
  if (!/^334/.test(r)) throw new Error('AUTH LOGIN: ' + r.slice(0, 120))
  r = await cmd(btoa(opts.user))
  if (!/^334/.test(r)) throw new Error('AUTH user: ' + r.slice(0, 120))
  r = await cmd(btoa(opts.pass))
  if (!/^235/.test(r)) throw new Error('AUTH pass failed')
  r = await cmd('MAIL FROM:<' + opts.from + '>')
  if (!/^250/.test(r)) throw new Error('MAIL FROM: ' + r.slice(0, 120))
  r = await cmd('RCPT TO:<' + opts.to + '>')
  if (!/^250/.test(r)) throw new Error('RCPT TO: ' + r.slice(0, 120))
  r = await cmd('DATA')
  if (!/^354/.test(r)) throw new Error('DATA: ' + r.slice(0, 120))
  const boundary = 'mc' + Date.now()
  const headers =
    'From: Phion Sdn. Bhd. <' + opts.from + '>\r\n' +
    'To: <' + opts.to + '>\r\n' +
    'Subject: ' + opts.subject.replace(/[\r\n]+/g, ' ') + '\r\n' +
    'MIME-Version: 1.0\r\n' +
    (opts.html
      ? 'Content-Type: multipart/alternative; boundary="' + boundary + '"\r\n\r\n' +
        '--' + boundary + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + opts.text + '\r\n' +
        '--' + boundary + '\r\nContent-Type: text/html; charset=utf-8\r\n\r\n' + opts.html + '\r\n' +
        '--' + boundary + '--'
      : 'Content-Type: text/plain; charset=utf-8\r\n\r\n' + opts.text)
  await conn.write(enc.encode(headers + '\r\n.\r\n'))
  r = await read()
  await cmd('QUIT').catch(() => '')
  try { conn.close() } catch { /* ignore */ }
  if (!/^250/.test(r)) throw new Error('SMTP send: ' + r.slice(0, 160))
  return r
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ success: false, error: 'POST only' }, 405)
  try {
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

    await smtpSend({ host, port, user, pass, from, to, subject, text, html })
    return json({ success: true })
  } catch (e) {
    return json({ success: false, error: (e as Error).message || 'send failed' }, 502)
  }
})
