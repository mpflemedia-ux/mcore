// M-Core sd-agent — locked backend for the external SR-processing agent (scheduled Claude
// task, runs hourly). The agent never touches Supabase storage or the DB directly; every
// action goes through this function, authenticated by a shared secret header.
// Secrets (Dashboard -> Edge Functions -> Secrets): SD_AGENT_SECRET, SD_AGENT_SECRET_NEXT
// (rotation: set NEXT first, roll the agent's config, then swap NEXT into SECRET and clear NEXT).
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. Deploy with --no-verify-jwt
// (auth is this function's own x-agent-secret check, not a Supabase user JWT).
// POST {action:'queue'|'file_url'|'letterhead_url'|'ask_client'|'resume'|'upload_draft'|'next_ref'|'note'|'log', ...}
// See README.md in this folder for the full action list + example request/response per action.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handle } from './handler.ts';
import { makeRepo } from './repo.ts';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-agent-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const env = (k: string) => Deno.env.get(k) || '';
const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'POST only' }), { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } });
  try {
    const body = await req.json().catch(() => ({}));
    const r = await handle(body, req.headers, { now: () => new Date(), db: makeRepo(sb), secretPrimary: env('SD_AGENT_SECRET'), secretNext: env('SD_AGENT_SECRET_NEXT') });
    if (r.status === 401) {
      const h = req.headers.get('x-agent-secret');
      console.warn(JSON.stringify({ diag: 'secret_mismatch', action: (body as { action?: string }).action || null, hdr_present: h != null, hdr_len: (h || '').length }));
    } else {
      console.log(JSON.stringify({ diag: 'result', action: (body as { action?: string }).action || null, status: r.status }));
    }
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message || 'error' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
