// M-Core sd-agent — Supabase (service role) data access. Every query is tenant-scoped at the
// call site (service role itself bypasses RLS, so app code enforces the same boundaries RLS
// would). Soft delete only, mirroring the rest of this codebase's convention.
// deno-lint-ignore-file no-explicit-any
export type Row = Record<string, any>;

export interface Repo {
  profile(uid: string): Promise<Row | null>;
  firstPlatformAdmin(): Promise<Row | null>;
  tenant(id: string): Promise<Row | null>;
  agentSettings(tenantId: string): Promise<Row | null>;
  sr(id: string): Promise<Row | null>;
  listEnabledTenantIds(): Promise<string[]>;
  queueCandidates(tenantIds: string[]): Promise<Row[]>;
  events(requestId: string, limit: number): Promise<Row[]>;
  insertEvent(row: Row): Promise<Row>;
  updateStatus(id: string, fromStatus: string, patch: Row): Promise<Row | null>;
  insertRun(row: Row): Promise<void>;
  insertNotification(row: Row): Promise<void>;
  tenantStaff(tenantId: string, roles: string[]): Promise<Row[]>;
  signedUrl(path: string, seconds: number): Promise<string | null>;
  uploadFile(path: string, bytes: Uint8Array, contentType: string): Promise<boolean>;
  incrCounter(tenantId: string, counterKey: string): Promise<number>;
}

export function makeRepo(sb: any): Repo {
  const rows = async (q: any): Promise<Row[]> => { const r = await q; if (r.error) throw r.error; return r.data || []; };
  const one = async (q: any): Promise<Row | null> => { const r = await q; if (r.error) return null; return r.data || null; };
  const OPEN_FOR_AGENT = ['submitted', 'triaged', 'in_progress', 'revision'];

  return {
    profile: (uid) => one(sb.from('user_profiles').select('id,tenant_id,role,language,full_name').eq('id', uid).maybeSingle()),
    firstPlatformAdmin: () => one(sb.from('user_profiles').select('id,tenant_id,full_name').eq('role', 'platform_admin').order('created_at', { ascending: true }).limit(1).maybeSingle()),
    tenant: (id) => one(sb.from('tenants').select('id,name,code,config').eq('id', id).maybeSingle()),
    agentSettings: (tenantId) => one(sb.from('sd_agent_settings').select('*').eq('tenant_id', tenantId).is('deleted_at', null).maybeSingle()),
    sr: (id) => one(sb.from('service_requests').select('*').eq('id', id).is('deleted_at', null).maybeSingle()),
    listEnabledTenantIds: async () => (await rows(sb.from('sd_agent_settings').select('tenant_id').eq('enabled', true).is('deleted_at', null))).map((r) => r.tenant_id),
    // candidate pool: open-ish SRs in tenants the agent is allowed to touch (settings-filtering,
    // and the ai-draft-freshness / client-reply / revision condition, happen in handler.ts --
    // this just narrows by status + tenant to keep the query small).
    queueCandidates: (tenantIds) => tenantIds.length
      ? rows(sb.from('service_requests').select('*').in('status', OPEN_FOR_AGENT).in('tenant_id', tenantIds).is('deleted_at', null).order('created_at', { ascending: true }).limit(200))
      : Promise.resolve([]),
    events: (requestId, limit) => rows(sb.from('service_request_events').select('*').eq('request_id', requestId).order('created_at', { ascending: false }).limit(limit)),
    insertEvent: async (row) => { const r = await sb.from('service_request_events').insert(row).select().single(); if (r.error) throw r.error; return r.data; },
    updateStatus: async (id, fromStatus, patch) => {
      const r = await sb.from('service_requests').update(patch).eq('id', id).eq('status', fromStatus).select().maybeSingle();
      if (r.error) throw r.error;
      return r.data || null; // null = optimistic lock lost (status changed under us) -- caller aborts
    },
    insertRun: async (row) => { await sb.from('sd_agent_runs').insert(row); },
    insertNotification: async (row) => { await sb.from('notifications').insert(row); },
    tenantStaff: (tenantId, roles) => rows(sb.from('user_profiles').select('id,tenant_id,role,language').eq('tenant_id', tenantId).is('deleted_at', null).in('role', roles)),
    signedUrl: async (path, seconds) => { const r = await sb.storage.from('service-files').createSignedUrl(path, seconds); return r.error ? null : r.data.signedUrl; },
    uploadFile: async (path, bytes, contentType) => { const r = await sb.storage.from('service-files').upload(path, bytes, { contentType, upsert: false }); return !r.error; },
    // Atomic increment with retry-on-conflict, same idiom as app/sd-data.js SD.createRequest's
    // ref_no generation (no new Postgres function allowed -- plain UPDATE/INSERT only).
    incrCounter: async (tenantId, counterKey) => {
      // The JS client has no "SET last_seq = last_seq + 1" primitive, so this reads the current
      // value then writes it back guarded by .eq('last_seq', <value just read>) -- if another
      // call won the race in between, that guard matches zero rows and the loop retries.
      for (let n = 0; n < 6; n++) {
        const cur = await sb.from('doc_counters').select('last_seq').eq('tenant_id', tenantId).eq('counter_key', counterKey).maybeSingle();
        if (cur.data) {
          const next = Number(cur.data.last_seq || 0) + 1;
          const w = await sb.from('doc_counters').update({ last_seq: next }).eq('tenant_id', tenantId).eq('counter_key', counterKey).eq('last_seq', cur.data.last_seq).select('last_seq').maybeSingle();
          if (w.data) return w.data.last_seq;
          continue; // lost the race, retry
        }
        const ins = await sb.from('doc_counters').insert({ tenant_id: tenantId, counter_key: counterKey, last_seq: 1 }).select('last_seq').maybeSingle();
        if (ins.data) return ins.data.last_seq;
        // 23505 (row appeared concurrently) -- loop and read it next pass
      }
      throw new Error('doc_counters increment failed after retries');
    },
  };
}
