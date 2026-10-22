// M-Core push-send — Web Push sender (VAPID) + Telegram fallback + scheduler tick.
// Secrets (Dashboard -> Edge Functions -> Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_CRON_SECRET, TELEGRAM_BOT_TOKEN (existing).
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. Deploy with --no-verify-jwt (auth is checked inside: user JWT, x-push-secret, or signed read token).
// POST {action:'flush'|'test'} (user JWT) · {action:'tick'} / DB webhook INSERT payload (x-push-secret) · {action:'read', id, uid, t} (from sw.js)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { handle, cleanSecret } from './handler.ts';
import { makeRepo } from './repo.ts';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const env = (k: string) => Deno.env.get(k) || '';
const URL0 = env('SUPABASE_URL'), sb = createClient(URL0, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const vapid = { subject: env('VAPID_SUBJECT') || 'mailto:mpflemedia@gmail.com', publicKey: env('VAPID_PUBLIC_KEY'), privateKey: env('VAPID_PRIVATE_KEY') };
const enc = new TextEncoder();
let hkey: CryptoKey | null = null;
async function sign(nid: string, uid: string): Promise<string> {
  if (!hkey) hkey = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', enc.encode('mcore-read:' + vapid.privateKey)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', hkey, enc.encode(nid + ':' + uid)));
  return btoa(String.fromCharCode(...s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 32);
}
async function push(sub: Record<string, any>, body: Record<string, any>, prio: number): Promise<number> {
  const d = webpush.generateRequestDetails({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(body),
    { TTL: prio >= 2 ? 259200 : 86400, urgency: prio >= 1 ? 'high' : 'normal', vapidDetails: vapid });
  const r = await fetch(d.endpoint, { method: d.method, headers: d.headers as Record<string, string>, body: d.body });
  return r.status;
}
async function telegram(chatId: string, text: string): Promise<boolean> {
  const token = env('TELEGRAM_BOT_TOKEN'); if (!token) return false;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3500), disable_web_page_preview: true }) });
  const j = await r.json().catch(() => ({})); return r.ok && !!(j as { ok?: boolean }).ok;
}
async function authUser(jwt: string): Promise<string | null> { const { data } = await sb.auth.getUser(jwt); return data?.user?.id || null; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'POST only' }), { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } });
  if (!vapid.publicKey || !vapid.privateKey) return new Response(JSON.stringify({ ok: false, error: 'VAPID secrets not set' }), { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } });
  try {
    const body = await req.json().catch(() => ({}));
    const r = await handle(body, req.headers, { now: () => new Date(), db: makeRepo(sb), push, telegram, sign, authUser, secret: env('PUSH_CRON_SECRET'), fnUrl: URL0 + '/functions/v1/push-send' });
    if (r.status === 401 && (r.body as { error?: string }).error === 'secret') { const h = req.headers.get('x-push-secret'), e0 = env('PUSH_CRON_SECRET') || ''; console.warn(JSON.stringify({ diag: 'secret_mismatch', action: (body as { action?: string }).action || (body as { type?: string }).type || null, hdr_present: h != null, hdr_len: (h || '').length, env_len: e0.length, clean_len: [cleanSecret(h).length, cleanSecret(e0).length] })); }
    else if ((body as { action?: string }).action === 'tick' || (body as { action?: string }).action === 'flush' || (body as { type?: string }).type === 'INSERT') console.log(JSON.stringify({ diag: 'result', action: (body as { action?: string }).action || 'webhook', status: r.status, body: r.body }));
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message || 'error' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
