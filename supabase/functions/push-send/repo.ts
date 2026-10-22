// M-Core push-send — Supabase (service role) data access. Every query is tenant/user scoped; soft delete only.
import type { Repo } from './handler.ts';
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
export function makeRepo(sb: any): Repo {
  const rows = async (q: any): Promise<Row[]> => { const r = await q; if (r.error) throw r.error; return r.data || []; };
  const one = async (q: any): Promise<Row | null> => { const r = await q; return r.error ? null : (r.data || null); };
  const OPEN = ['submitted', 'triaged', 'in_progress', 'revision'];
  return {
    notifications: (ids) => ids.length ? rows(sb.from('notifications').select('*').in('id', ids)) : Promise.resolve([]),
    recentNotifications: (since, limit) => rows(sb.from('notifications').select('*').gte('created_at', since).is('deleted_at', null).is('read_at', null).order('created_at', { ascending: true }).limit(limit)),
    loggedKeys: async (keys) => keys.length ? (await rows(sb.from('push_log').select('dedupe_key').in('dedupe_key', keys))).map((r) => r.dedupe_key) : [],
    claim: async (row) => { const r = await sb.from('push_log').insert(row).select('id'); return !r.error && !!(r.data && r.data.length); },
    updateLog: async (key, patch) => { await sb.from('push_log').update(patch).eq('dedupe_key', key); },
    addLog: async (row) => { await sb.from('push_log').insert(row); },
    profile: (uid) => one(sb.from('user_profiles').select('id,tenant_id,role').eq('id', uid).maybeSingle()),
    settings: (tid, uid) => one(sb.from('notification_settings').select('settings').eq('tenant_id', tid).eq('user_id', uid).is('deleted_at', null).maybeSingle()),
    tenantSettings: (tid) => one(sb.from('push_settings').select('settings').eq('tenant_id', tid).is('deleted_at', null).maybeSingle()),
    hadSub: async (tid, uid) => (await rows(sb.from('push_subscriptions').select('id').eq('tenant_id', tid).eq('user_id', uid).limit(1))).length > 0,
    subs: (tid, uid) => rows(sb.from('push_subscriptions').select('*').eq('tenant_id', tid).eq('user_id', uid).is('deleted_at', null).order('last_seen_at', { ascending: false }).limit(10)),
    touchSub: async (id, patch) => { await sb.from('push_subscriptions').update(patch).eq('id', id); },
    telegramChat: async (tid, uid) => (await one(sb.from('telegram_links').select('chat_id').eq('tenant_id', tid).eq('subject_type', 'user').eq('subject_id', uid).maybeSingle()))?.chat_id || null,
    recentPushed: async (uid, since, exceptId) => {
      const lg = await rows(sb.from('push_log').select('notification_id').eq('user_id', uid).eq('channel', 'push').in('status', ['sent', 'grouped']).gte('created_at', since).not('notification_id', 'is', null).limit(20));
      const ids = lg.map((x) => String(x.notification_id)).filter((x) => x !== String(exceptId));
      return ids.length ? rows(sb.from('notifications').select('id,title,user_id').in('id', ids).eq('user_id', uid)) : [];
    },
    sr: (id) => one(sb.from('service_requests').select('id,priority,tenant_id').eq('id', id).maybeSingle()),
    openSrs: () => rows(sb.from('service_requests').select('id,tenant_id,ref_no,title,status,priority,assigned_to,due_at,paused_at,sla_paused_seconds').in('status', OPEN).is('deleted_at', null).not('due_at', 'is', null).not('assigned_to', 'is', null).limit(500)),
    urgentUnpicked: (since) => rows(sb.from('service_requests').select('id,tenant_id,ref_no,title,created_at').eq('priority', 'urgent').eq('status', 'submitted').is('assigned_to', null).is('deleted_at', null).gte('created_at', since).limit(100)),
    paUsers: () => rows(sb.from('user_profiles').select('id,tenant_id,role').eq('role', 'platform_admin')),
    insertNotification: async (row) => { const r = await sb.from('notifications').insert(row).select('*').maybeSingle(); return r.error ? null : r.data; },
    unreadCount: async (tid, uid) => { const r = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('user_id', uid).is('read_at', null).is('deleted_at', null).neq('kind', 'activity').gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()); return r.count || 0; },
    allActiveSubs: () => rows(sb.from('push_subscriptions').select('*').is('deleted_at', null).limit(2000)),
    markRead: async (id, uid) => { await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', uid).is('read_at', null); },
    cleanupSubs: async (before) => { const now = new Date().toISOString(); const a = await sb.from('push_subscriptions').update({ deleted_at: now }).is('deleted_at', null).gte('fail_count', 5).select('id'); const b = await sb.from('push_subscriptions').update({ deleted_at: now }).is('deleted_at', null).lt('last_seen_at', before).select('id'); return ((a.data || []).length) + ((b.data || []).length); },
    tenantName: async (tid) => (await one(sb.from('tenants').select('name').eq('id', tid).maybeSingle()))?.name || '',
  };
}
