// M-Core Edge Function: sd-result - public client result page for Service Desk (?sr_result=TOKEN).
// Deploy: supabase functions deploy sd-result --no-verify-jwt   (public page has no user JWT; access = token only)
// Secrets: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically. Nothing else needed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cors, handle, type Db, type Link, type Req } from './handler.ts';

function db(): Db {
  const url = Deno.env.get('SUPABASE_URL') || '', key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) throw new Error('supabase env missing');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const one = async <T>(q: PromiseLike<{ data: T | null; error: unknown }>) => { const r = await q; if (r.error) throw r.error; return r.data; };
  return {
    linkByHash: (h) => one<Link>(sb.from('service_result_links').select('id,tenant_id,request_id,expires_at,revoked_at,deleted_at,viewed_at,view_count').eq('token_hash', h).maybeSingle()),
    request: (id) => one<Req>(sb.from('service_requests').select('*').eq('id', id).maybeSingle()),
    tenantName: async (id) => ((await one<{ name: string }>(sb.from('tenants').select('name').eq('id', id).maybeSingle())) || { name: '' }).name,
    service: (code) => one(sb.from('service_catalog').select('name_en,name_bm,default_sla_hours').eq('code', code).is('deleted_at', null).maybeSingle()),
    // Unlocked when the ticket's own contract is paid OR the tenant has a currently active paid contract. invoice_ref 'FREE…' counts as paid.
    contractPaid: async (tid, cid) => {
      type C = { id: string; payment_status: string; invoice_ref: string | null; status: string; start_date: string | null; end_date: string | null };
      const rows = (await one<C[]>(sb.from('service_contracts').select('id,payment_status,invoice_ref,status,start_date,end_date').eq('tenant_id', tid).is('deleted_at', null))) || [];
      const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // Asia/Kuala_Lumpur
      const paid = (c: C) => c.payment_status === 'paid' || /^FREE/i.test(c.invoice_ref || '');
      const live = (c: C) => c.status === 'active' && (!c.start_date || c.start_date.slice(0, 10) <= today) && (!c.end_date || today <= c.end_date.slice(0, 10));
      return rows.some((c) => paid(c) && ((!!cid && String(c.id) === String(cid)) || live(c)));
    },
    deliverables: async (rid) => ((await one<{ file_path: string; body: string | null; meta: Record<string, unknown> | null; created_at: string }[]>(
      sb.from('service_request_events').select('file_path,body,meta,created_at').eq('request_id', rid).eq('type', 'attachment').not('file_path', 'is', null).order('created_at'))) || [])
      .filter((e) => e.meta && (e.meta as { deliverable?: boolean }).deliverable === true),
    sign: async (paths, sec) => {
      const r = await sb.storage.from('service-files').createSignedUrls(paths, sec); const m: Record<string, string> = {};
      (r.data || []).forEach((x) => { if (x.path && x.signedUrl) m[x.path] = x.signedUrl; }); return m;
    },
    timeline: async (rid) => ((await one<{ type: string; body: string | null; created_at: string; actor_id: string | null }[]>(
      sb.from('service_request_events').select('type,body,created_at,actor_id').eq('request_id', rid).in('type', ['comment','status','attachment']).is('deleted_at', null).order('created_at', { ascending: false }).limit(30))) || [])
      .map((e) => ({ type: e.type, body: e.body, created_at: e.created_at, actor: e.actor_id })),

    markViewed: async (l, now) => { await sb.from('service_result_links').update({ viewed_at: l.viewed_at || now, view_count: (l.view_count || 0) + 1 }).eq('id', l.id); },
    responseCount: async (lid) => { const r = await sb.from('service_result_responses').select('id', { count: 'exact', head: true }).eq('link_id', lid); return r.count || 0; },
    lastResponse: (lid) => one(sb.from('service_result_responses').select('action,created_at').eq('link_id', lid).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle()),
    moveStatus: async (r, to, now) => {
      const p: Record<string, unknown> = { status: to, updated_at: now }; if (to === 'closed') p.closed_at = now;
      const x = await sb.from('service_requests').update(p).eq('id', r.id).eq('status', 'delivered').select('id');
      return !x.error && (x.data || []).length === 1;
    },
    insertResponse: async (row) => { const x = await sb.from('service_result_responses').insert(row); if (x.error) throw x.error; },
    insertEvent: async (row) => { const x = await sb.from('service_request_events').insert(row); if (x.error) throw x.error; },
    reopen: async (r, patch) => {
      const x = await sb.from('service_requests').update(patch).eq('id', r.id).eq('status', 'closed').select('id');
      return !x.error && (x.data || []).length === 1;
    },
    bellOwners: async (tid, title, body) => {
      const a = await sb.from('user_profiles').select('id,tenant_id,role').eq('tenant_id', tid).eq('role', 'owner');
      const rows = (a.data || []).map((u) => ({ tenant_id: u.tenant_id, user_id: u.id, title, body, category: 'service_desk' }));
      if (rows.length) await sb.from('notifications').insert(rows);
    },
    bellAdmins: async (title, body) => {
      const a = await sb.from('user_profiles').select('id,tenant_id').eq('role', 'platform_admin');
      const rows = (a.data || []).filter((u) => u.tenant_id).map((u) => ({ tenant_id: u.tenant_id, user_id: u.id, title, body, category: 'service_desk' }));
      if (rows.length) await sb.from('notifications').insert(rows);
    },
  };
}
Deno.serve(async (req) => {
  try { return await handle(req, db()); } catch (e) {
    console.error('sd-result', e);
    return new Response(JSON.stringify({ error: 'server' }), { status: 500, headers: { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' } });
  }
});
