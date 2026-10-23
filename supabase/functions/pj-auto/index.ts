// M-Core pj-auto — Projects automation (scheduled by pg_cron every 15 min, see supabase/pj_auto_01.sql):
//   1. Repeating tasks: a task with recur_rule whose copy is not made yet (recur_spawned_at null) and that is Done or past its due date
//      gets ONE next copy (Backlog, 0%, same owner/assignees/checklist steps unticked). Claimed with a conditional update, so a rerun or
//      two overlapping runs never make duplicates.
//   2. Daily summary: tenants that switched it on (push_settings.settings.pj_digest.on = 1, set from the Projects "Today & overdue" card)
//      get one bell notification per person at pj_digest.at (default 09:00 MYT): tasks due today + overdue. push-send delivers it to the
//      phone / Telegram with the person's own notification settings. Once per person per day (pj_auto_log.dedupe_key).
// POST {action:'tick'} with header x-push-secret (same secret as push-send: PUSH_CRON_SECRET) · POST {action:'digest_me'} with a user JWT
// sends the caller's own summary now (manual test; no daily dedupe, tenant switch not required).
// Deploy: supabase functions deploy pj-auto --no-verify-jwt   (auth is checked inside)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { digestText, myt, nextDue, nextStart, Row, same, secretOk, userForEmp } from './logic.ts';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-push-secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const env = (k: string) => Deno.env.get(k) || '';
// deno-lint-ignore no-explicit-any
const sb: any = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const BASE = 'id,tenant_id,project_id,title,tag,assignee_employee_id,start_date,due_date,notes,is_important,is_urgent,sort_order,column_key,recur_rule,recur_until,recur_parent_id';
const EXTRA = ',start_time,due_time,remind_before_min,est_hours';

/* select with the optional multi-assignee columns; falls back to the base columns when pj_multi_01/02 are not run */
// deno-lint-ignore no-explicit-any
async function tasksQuery(build: (cols: string) => any): Promise<Row[]> {
  let r = await build(BASE + EXTRA);
  if (r.error && /column/i.test(r.error.message || '')) r = await build(BASE);
  if (r.error) throw r.error;
  return r.data || [];
}

async function recur(now: Date): Promise<Row> {
  const today = myt(now).day, out: Row = { made: 0, ended: 0, skipped: 0, failed: 0 };
  const rows = await tasksQuery((c) => sb.from('project_tasks').select(c).is('deleted_at', null).not('recur_rule', 'is', null).is('recur_spawned_at', null)
    .not('due_date', 'is', null).or('column_key.eq.done,due_date.lt.' + today).limit(200));
  if (!rows.length) return out;
  const pids = [...new Set(rows.map((k) => String(k.project_id)))];
  const pr = await sb.from('projects').select('id,deleted_at,archived_at').in('id', pids);
  const proj: Record<string, Row> = {}; (pr.data || []).forEach((p: Row) => { proj[String(p.id)] = p; });
  for (const k of rows) {
    const p = proj[String(k.project_id)];
    if (p && p.archived_at && !p.deleted_at) { out.skipped++; continue; } /* resumes when the project is restored */
    const next = nextDue(String(k.due_date).slice(0, 10), String(k.recur_rule), today);
    const stamp = new Date().toISOString();
    const claim = await sb.from('project_tasks').update({ recur_spawned_at: stamp }).eq('id', k.id).eq('tenant_id', k.tenant_id).is('recur_spawned_at', null).select('id');
    if (claim.error || !claim.data || !claim.data.length) { out.skipped++; continue; }
    if (!p || p.deleted_at || !next || (k.recur_until && next > String(k.recur_until).slice(0, 10))) { out.ended++; continue; }
    const row: Row = {
      tenant_id: k.tenant_id, project_id: k.project_id, title: k.title, column_key: 'backlog', tag: k.tag, assignee_employee_id: k.assignee_employee_id,
      start_date: nextStart(k.start_date ? String(k.start_date).slice(0, 10) : null, String(k.due_date).slice(0, 10), next), due_date: next, progress: 0,
      notes: k.notes, sort_order: k.sort_order, is_important: !!k.is_important, is_urgent: !!k.is_urgent,
      recur_rule: k.recur_rule, recur_until: k.recur_until, recur_parent_id: k.recur_parent_id || k.id,
    };
    ['start_time', 'due_time', 'remind_before_min', 'est_hours'].forEach((f) => { if (k[f] !== undefined) row[f] = k[f]; });
    const ins = await sb.from('project_tasks').insert(row).select('id').single();
    if (ins.error || !ins.data) {
      out.failed++; console.warn(JSON.stringify({ diag: 'recur_insert', id: k.id, error: ins.error && ins.error.message }));
      await sb.from('project_tasks').update({ recur_spawned_at: null }).eq('id', k.id).eq('tenant_id', k.tenant_id).eq('recur_spawned_at', stamp);
      continue;
    }
    const nid = ins.data.id;
    const as = await sb.from('project_task_assignees').select('employee_id,is_owner').eq('tenant_id', k.tenant_id).eq('task_id', k.id).is('deleted_at', null);
    if (!as.error && as.data && as.data.length) await sb.from('project_task_assignees').insert(as.data.map((a: Row) => ({ tenant_id: k.tenant_id, task_id: nid, employee_id: a.employee_id, is_owner: !!a.is_owner })));
    const cl = await sb.from('project_task_checklist').select('label,sort_order').eq('tenant_id', k.tenant_id).eq('task_id', k.id).is('deleted_at', null).order('sort_order');
    if (!cl.error && cl.data && cl.data.length) await sb.from('project_task_checklist').insert(cl.data.map((c: Row) => ({ tenant_id: k.tenant_id, task_id: nid, label: c.label, sort_order: c.sort_order })));
    out.made++;
  }
  return out;
}

/* open tasks due today or earlier for one tenant -> { userId: { today:[], late:[] } } */
async function buildFor(tenant: string, today: string): Promise<{ by: Record<string, { today: Row[]; late: Row[] }>; users: Row[] }> {
  const ks = await tasksQuery((c) => sb.from('project_tasks').select(c).eq('tenant_id', tenant).is('deleted_at', null).neq('column_key', 'done').not('due_date', 'is', null).lte('due_date', today).limit(3000));
  const pids = [...new Set(ks.map((k) => String(k.project_id)))];
  const pr = pids.length ? await sb.from('projects').select('id').eq('tenant_id', tenant).in('id', pids).is('deleted_at', null).is('archived_at', null) : { data: [] };
  const live = new Set(((pr.data || []) as Row[]).map((p) => String(p.id)));
  const tasks = ks.filter((k) => live.has(String(k.project_id)));
  const by: Record<string, { today: Row[]; late: Row[] }> = {};
  if (!tasks.length) return { by, users: [] };
  const emps: Record<string, string[]> = {};
  tasks.forEach((k) => { if (k.assignee_employee_id) emps[k.id] = [String(k.assignee_employee_id)]; else emps[k.id] = []; });
  for (let i = 0; i < tasks.length; i += 150) {
    const a = await sb.from('project_task_assignees').select('task_id,employee_id').eq('tenant_id', tenant).in('task_id', tasks.slice(i, i + 150).map((k) => k.id)).is('deleted_at', null);
    (a.data || []).forEach((x: Row) => { const l = emps[x.task_id] || (emps[x.task_id] = []); if (l.indexOf(String(x.employee_id)) < 0) l.push(String(x.employee_id)); });
  }
  const em = await sb.from('employees').select('id,name,email').eq('tenant_id', tenant).is('deleted_at', null);
  let up = await sb.from('user_profiles').select('id,email,full_name,language').eq('tenant_id', tenant);
  if (up.error) up = await sb.from('user_profiles').select('id,email,full_name').eq('tenant_id', tenant);
  const users: Row[] = up.data || [], uOf: Record<string, string> = {};
  (em.data || []).forEach((e: Row) => { const u = userForEmp(e, users); if (u) uOf[String(e.id)] = String(u.id); });
  tasks.forEach((k) => {
    const due = String(k.due_date).slice(0, 10), seen = new Set<string>();
    (emps[k.id] || []).forEach((e) => {
      const u = uOf[e]; if (!u || seen.has(u)) return; seen.add(u);
      const b = by[u] || (by[u] = { today: [], late: [] }); (due < today ? b.late : b.today).push(k);
    });
  });
  return { by, users };
}

async function send(tenant: string, uid: string, lang: string, lists: { today: Row[]; late: Row[] }, day: string): Promise<boolean> {
  const t = digestText(lang, lists.today, lists.late);
  const r = await sb.from('notifications').insert({
    tenant_id: tenant, user_id: uid, actor_id: null, title: 'M-Core · ' + t.title, body: t.body, category: 'assigned', kind: 'for_you', type: 'assigned.digest',
    priority: 0, link: { page: 'projects', icon: 'ti-calendar-due' }, group_key: 'pjd:' + uid + ':' + day,
  });
  if (r.error) console.warn(JSON.stringify({ diag: 'digest_insert', tenant, uid, error: r.error.message }));
  return !r.error;
}

async function digest(now: Date): Promise<Row> {
  const w = myt(now), out: Row = { tenants: 0, sent: 0 };
  const ps = await sb.from('push_settings').select('tenant_id,settings').is('deleted_at', null).limit(1000);
  for (const row of (ps.data || []) as Row[]) {
    const cfg = (row.settings && row.settings.pj_digest) || null;
    if (!cfg || !(cfg.on === 1 || cfg.on === true)) continue;
    const a = String(cfg.at || '09:00'), start = +a.slice(0, 2) * 60 + +a.slice(3, 5), cur = +w.hm.slice(0, 2) * 60 + +w.hm.slice(3, 5);
    if (!(cur >= start && cur < start + 60)) continue;
    out.tenants++;
    const { by, users } = await buildFor(String(row.tenant_id), w.day);
    for (const uid of Object.keys(by)) {
      const key = 'pjd:' + uid + ':' + w.day;
      const claim = await sb.from('pj_auto_log').insert({ dedupe_key: key, tenant_id: row.tenant_id, user_id: uid, kind: 'digest' }).select('id');
      if (claim.error || !claim.data || !claim.data.length) continue;
      const u = users.find((x) => same(x.id, uid)) || {};
      if (await send(String(row.tenant_id), uid, u.language === 'bm' ? 'bm' : 'en', by[uid], w.day)) out.sent++;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  try {
    const body = await req.json().catch(() => ({})) as Row;
    const a = String(body.action || ''), now = new Date();
    if (a === 'tick') {
      if (!secretOk(req.headers.get('x-push-secret'), env('PUSH_CRON_SECRET'))) return json({ ok: false, error: 'secret' }, 401);
      const out: Row = { ok: true };
      try { out.recur = await recur(now); } catch (e) { out.recur = { error: (e as Error).message }; }
      try { out.digest = await digest(now); } catch (e) { out.digest = { error: (e as Error).message }; }
      console.log(JSON.stringify({ diag: 'tick', out }));
      return json(out);
    }
    if (a === 'digest_me') {
      const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const { data } = jwt ? await sb.auth.getUser(jwt) : { data: null };
      const uid = data && data.user && data.user.id; if (!uid) return json({ ok: false, error: 'auth' }, 401);
      const prof = await sb.from('user_profiles').select('id,tenant_id').eq('id', uid).maybeSingle();
      if (!prof.data || !prof.data.tenant_id) return json({ ok: false, error: 'profile' }, 400);
      const w = myt(now), { by, users } = await buildFor(String(prof.data.tenant_id), w.day), mine = by[uid];
      if (!mine) return json({ ok: true, sent: false, reason: 'no_tasks_due' });
      const u = users.find((x) => same(x.id, uid)) || {};
      return json({ ok: true, sent: await send(String(prof.data.tenant_id), uid, u.language === 'bm' ? 'bm' : 'en', mine, w.day), today: mine.today.length, late: mine.late.length });
    }
    return json({ ok: false, error: 'action' }, 400);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message || 'error' }, 500);
  }
});
