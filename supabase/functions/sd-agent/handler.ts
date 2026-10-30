// M-Core sd-agent — request handler with injected I/O (index.ts wires Supabase; a future test
// file can wire fakes, same shape as push-send/handler.ts).
import { pathAllowed, pathTo, safeName, secretOk, statusPatch } from './core.ts';
import type { Repo, Row } from './repo.ts';

export interface Deps {
  now(): Date;
  db: Repo;
  secretPrimary: string;
  secretNext: string;
}

const iso = (d: Date) => d.toISOString();
const PA_ROLES = ['owner', 'admin'];

async function logRun(d: Deps, tenantId: string | null, requestId: string | null, action: string, status: 'ok' | 'error' | 'skipped', detail: Row) {
  try { await d.db.insertRun({ tenant_id: tenantId, request_id: requestId, action, status, detail }); } catch (_e) { /* logging must never break the action */ }
}

/** Master (platform admin's own tenant) + per-tenant enabled + service in services[]. Both
 * gates must pass, mirroring the brief's "master enabled + tenant enabled + service_code dalam
 * services" exactly. */
async function agentAllowed(d: Deps, tenantId: string, serviceCode: string): Promise<boolean> {
  const pa = await d.db.firstPlatformAdmin();
  if (!pa) return false;
  const master = await d.db.agentSettings(pa.tenant_id);
  if (!master || !master.enabled) return false;
  if (tenantId === pa.tenant_id) return (master.services || []).indexOf(serviceCode) >= 0;
  const ts = await d.db.agentSettings(tenantId);
  if (!ts || !ts.enabled) return false;
  return (ts.services || []).indexOf(serviceCode) >= 0;
}

function condensedEvents(ev: Row[]): Row[] {
  return ev.slice(0, 30).map((e) => ({
    id: e.id, type: e.type, from_status: e.from_status, to_status: e.to_status, body: e.body,
    file_path: e.file_path, file_name: e.file_name, meta: e.meta || {}, actor_id: e.actor_id,
    by_agent: !!(e.meta && e.meta.by_agent), created_at: e.created_at,
  }));
}

/** Walk the TR path hop-by-hop (mirrors what repeated SD.setStatus() UI calls would do),
 * each hop its own atomic optimistic-locked update + status event. Throws (and the caller logs
 * 'error') if a hop's lock is lost mid-walk -- never silently partial. */
async function walkStatus(d: Deps, r: Row, targetStatus: string, actorId: string, note: string | null): Promise<Row> {
  const hops = pathTo(r.status, targetStatus);
  if (hops === null) throw new Error('No path from ' + r.status + ' to ' + targetStatus);
  let cur = r;
  for (const to of hops) {
    const now = iso(d.now());
    const patch = Object.assign({ status: to, updated_at: now }, statusPatch(cur.status, to, cur, now));
    const updated = await d.db.updateStatus(cur.id, cur.status, patch);
    if (!updated) throw new Error('Optimistic lock lost moving ' + cur.status + ' -> ' + to);
    await d.db.insertEvent({ tenant_id: updated.tenant_id, request_id: updated.id, type: 'status', from_status: cur.status, to_status: to, body: to === targetStatus ? note : null, actor_id: actorId, meta: { by_agent: true } });
    cur = updated;
  }
  return cur;
}

const NT_TITLE = {
  en: { waiting: (ref: string) => ref + ': waiting on your reply', aiDraft: (ref: string) => ref + ': AI draft ready for review' },
  bm: { waiting: (ref: string) => ref + ': menunggu balasan anda', aiDraft: (ref: string) => ref + ': draf AI sedia untuk disemak' },
};
function notifTitle(lang: string, key: 'waiting' | 'aiDraft', ref: string): string {
  const l = lang === 'bm' ? 'bm' : 'en';
  return NT_TITLE[l][key](ref);
}

async function notifyRoles(d: Deps, tenantId: string, roles: string[], excludeUid: string | null, opts: { title: (lang: string) => string; body: string; type: string; priority: number; groupKey: string }) {
  const staff = await d.db.tenantStaff(tenantId, roles);
  for (const u of staff) {
    if (excludeUid && String(u.id) === String(excludeUid)) continue;
    await d.db.insertNotification({
      tenant_id: tenantId, user_id: u.id, actor_id: null, category: 'service_desk', kind: 'action', type: opts.type,
      title: opts.title(u.language || 'en').slice(0, 200), body: opts.body.slice(0, 500), priority: opts.priority,
      ref_table: 'service_requests', ref_id: opts.groupKey.split(':')[1] || null, group_key: opts.groupKey,
    });
  }
}

export async function handleQueue(d: Deps, body: Row): Promise<Row> {
  const pa = await d.db.firstPlatformAdmin();
  if (!pa) return { ok: true, items: [] };
  const master = await d.db.agentSettings(pa.tenant_id);
  if (!master || !master.enabled) return { ok: true, items: [], reason: 'master_disabled' };
  // Candidate pool: every tenant whose own sd_agent_settings is enabled (agentAllowed() below
  // still re-checks master + per-tenant + service_code per SR -- this is just a narrowing filter).
  const tenantIds = await d.db.listEnabledTenantIds();
  const allCandidates = await d.db.queueCandidates(tenantIds);
  const out: Row[] = [];
  for (const r of allCandidates) {
    if (!(await agentAllowed(d, r.tenant_id, r.service_code))) continue;
    const ev = await d.db.events(r.id, 50);
    const lastAiDraft = ev.find((e) => e.type === 'internal_note' && e.meta && e.meta.ai_draft);
    const lastAgentEvent = ev.find((e) => e.meta && e.meta.by_agent);
    const lastClientComment = ev.find((e) => e.type === 'comment' && (!e.actor_id || String(e.actor_id) !== String(pa.id)));
    const clientRepliedSince = !!(lastClientComment && (!lastAgentEvent || new Date(lastClientComment.created_at) > new Date(lastAgentEvent.created_at)));
    const needsDraft = !lastAiDraft || clientRepliedSince || r.status === 'revision';
    if (!needsDraft) continue;
    const tenant = await d.db.tenant(r.tenant_id);
    out.push({
      id: r.id, tenant_id: r.tenant_id, tenant_name: tenant?.name || '', tenant_code: tenant?.code || '',
      ref_no: r.ref_no, title: r.title, description: r.description, form_data: r.form_data || {},
      service_code: r.service_code, priority: r.priority, status: r.status, due_at: r.due_at,
      events: condensedEvents(ev),
      attachments: ev.filter((e) => e.type === 'attachment' && e.file_path).map((e) => ({ event_id: e.id, name: e.file_name || e.body || (e.file_path || '').split('/').pop(), path: e.file_path, deliverable: !!(e.meta && e.meta.deliverable) })),
    });
  }
  await logRun(d, null, null, 'queue', 'ok', { count: out.length });
  return { ok: true, items: out };
}

export async function handleFileUrl(d: Deps, body: Row): Promise<Row> {
  const requestId = String(body.request_id || ''), path = String(body.path || '');
  const r = await d.db.sr(requestId);
  if (!r) return { ok: false, error: 'not_found' };
  if (!pathAllowed(path, r.tenant_id, r.id)) { await logRun(d, r.tenant_id, r.id, 'file_url', 'error', { path, reason: 'path_not_allowed' }); return { ok: false, error: 'path_not_allowed' }; }
  const url = await d.db.signedUrl(path, 600);
  await logRun(d, r.tenant_id, r.id, 'file_url', url ? 'ok' : 'error', { path });
  return url ? { ok: true, url } : { ok: false, error: 'sign_failed' };
}

export async function handleLetterheadUrl(d: Deps, body: Row): Promise<Row> {
  const tenantId = String(body.tenant_id || '');
  const tenant = await d.db.tenant(tenantId);
  const lh = tenant && tenant.config && tenant.config.letterhead;
  if (!lh || !lh.path) return { ok: true, missing: true };
  if (!pathAllowed(lh.path, tenantId)) { await logRun(d, tenantId, null, 'letterhead_url', 'error', { reason: 'path_not_allowed' }); return { ok: false, error: 'path_not_allowed' }; }
  const url = await d.db.signedUrl(lh.path, 600);
  await logRun(d, tenantId, null, 'letterhead_url', url ? 'ok' : 'error', {});
  return url ? { ok: true, url } : { ok: true, missing: true };
}

export async function handleAskClient(d: Deps, body: Row): Promise<Row> {
  const requestId = String(body.request_id || ''), text = String(body.body || '').trim();
  if (!text) return { ok: false, error: 'body_required' };
  const r = await d.db.sr(requestId);
  if (!r) return { ok: false, error: 'not_found' };
  if (!(await agentAllowed(d, r.tenant_id, r.service_code))) { await logRun(d, r.tenant_id, r.id, 'ask_client', 'skipped', { reason: 'disabled' }); return { ok: false, error: 'disabled' }; }
  const pa = await d.db.firstPlatformAdmin();
  if (!pa) return { ok: false, error: 'no_platform_admin' };
  // One outstanding question at a time: reject if the agent already asked and the client
  // hasn't replied since.
  const ev = await d.db.events(requestId, 20);
  const lastAgentComment = ev.find((e) => e.type === 'comment' && e.meta && e.meta.by_agent);
  const lastClientComment = ev.find((e) => e.type === 'comment' && (!e.actor_id || String(e.actor_id) !== String(pa.id)));
  if (lastAgentComment && (!lastClientComment || new Date(lastAgentComment.created_at) >= new Date(lastClientComment.created_at))) {
    await logRun(d, r.tenant_id, r.id, 'ask_client', 'skipped', { reason: 'awaiting_reply' });
    return { ok: false, error: 'awaiting_reply' };
  }
  if (pathTo(r.status, 'waiting_client') === null) {
    await logRun(d, r.tenant_id, r.id, 'ask_client', 'error', { reason: 'no_path', from: r.status });
    return { ok: false, error: 'no_path_to_waiting_client' };
  }
  let moved: Row;
  try { moved = await walkStatus(d, r, 'waiting_client', pa.id, null); }
  catch (e) { await logRun(d, r.tenant_id, r.id, 'ask_client', 'error', { message: (e as Error).message }); return { ok: false, error: 'status_walk_failed' }; }
  await d.db.insertEvent({ tenant_id: moved.tenant_id, request_id: moved.id, type: 'comment', body: text, actor_id: pa.id, meta: { by_agent: true } });
  await notifyRoles(d, moved.tenant_id, PA_ROLES, null, {
    title: (lang) => notifTitle(lang, 'waiting', moved.ref_no), body: text, type: 'sd.waiting', priority: 1, groupKey: 'sdw:' + moved.id,
  });
  await logRun(d, moved.tenant_id, moved.id, 'ask_client', 'ok', {});
  return { ok: true, status: moved.status };
}

export async function handleResume(d: Deps, body: Row): Promise<Row> {
  const requestId = String(body.request_id || '');
  const r = await d.db.sr(requestId);
  if (!r) return { ok: false, error: 'not_found' };
  if (!(await agentAllowed(d, r.tenant_id, r.service_code))) { await logRun(d, r.tenant_id, r.id, 'resume', 'skipped', { reason: 'disabled' }); return { ok: false, error: 'disabled' }; }
  if (r.status !== 'waiting_client') { await logRun(d, r.tenant_id, r.id, 'resume', 'skipped', { reason: 'not_waiting', status: r.status }); return { ok: false, error: 'not_waiting_client' }; }
  const pa = await d.db.firstPlatformAdmin();
  if (!pa) return { ok: false, error: 'no_platform_admin' };
  const now = iso(d.now());
  const patch = Object.assign({ status: 'in_progress', updated_at: now }, statusPatch('waiting_client', 'in_progress', r, now));
  const updated = await d.db.updateStatus(r.id, 'waiting_client', patch);
  if (!updated) { await logRun(d, r.tenant_id, r.id, 'resume', 'error', { reason: 'lock_lost' }); return { ok: false, error: 'lock_lost' }; }
  await d.db.insertEvent({ tenant_id: updated.tenant_id, request_id: updated.id, type: 'status', from_status: 'waiting_client', to_status: 'in_progress', actor_id: pa.id, meta: { by_agent: true } });
  await logRun(d, updated.tenant_id, updated.id, 'resume', 'ok', {});
  return { ok: true, status: updated.status };
}

export async function handleUploadDraft(d: Deps, body: Row): Promise<Row> {
  const requestId = String(body.request_id || ''), filename = String(body.filename || 'draft.pdf'), b64 = String(body.base64 || ''), summary = body.summary ? String(body.summary).slice(0, 2000) : null;
  if (!b64) return { ok: false, error: 'base64_required' };
  const r = await d.db.sr(requestId);
  if (!r) return { ok: false, error: 'not_found' };
  if (!(await agentAllowed(d, r.tenant_id, r.service_code))) { await logRun(d, r.tenant_id, r.id, 'upload_draft', 'skipped', { reason: 'disabled' }); return { ok: false, error: 'disabled' }; }
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); } catch (_e) { return { ok: false, error: 'bad_base64' }; }
  if (bytes.length > 26214400) { await logRun(d, r.tenant_id, r.id, 'upload_draft', 'error', { reason: 'too_large', size: bytes.length }); return { ok: false, error: 'too_large' }; }
  const head = String.fromCharCode(...bytes.slice(0, 5));
  if (head !== '%PDF-') { await logRun(d, r.tenant_id, r.id, 'upload_draft', 'error', { reason: 'not_pdf' }); return { ok: false, error: 'not_pdf' }; }
  const pa = await d.db.firstPlatformAdmin();
  if (!pa) return { ok: false, error: 'no_platform_admin' };
  // Version = count of prior ai_draft internal_note events + 1.
  const ev = await d.db.events(requestId, 50);
  const version = ev.filter((e) => e.type === 'internal_note' && e.meta && e.meta.ai_draft).length + 1;
  const path = r.tenant_id + '/service-requests/' + r.id + '/' + Date.now() + '-' + safeName(filename);
  const up = await d.db.uploadFile(path, bytes, 'application/pdf');
  if (!up) { await logRun(d, r.tenant_id, r.id, 'upload_draft', 'error', { reason: 'upload_failed' }); return { ok: false, error: 'upload_failed' }; }
  // Ensure status is in_progress (mirrors "pastikan status in_progress, move kalau perlu").
  let working = r;
  if (r.status !== 'in_progress') {
    try { working = await walkStatus(d, r, 'in_progress', pa.id, null); }
    catch (e) { await logRun(d, r.tenant_id, r.id, 'upload_draft', 'error', { message: (e as Error).message }); return { ok: false, error: 'status_walk_failed' }; }
  }
  await d.db.insertEvent({ tenant_id: working.tenant_id, request_id: working.id, type: 'internal_note', body: summary, file_path: path, file_name: filename.slice(-200), actor_id: pa.id, meta: { ai_draft: true, version, by_agent: true } });
  // group_key replaces the previous ai_draft notification for this SR -- one row kept "live" per SR.
  await notifyRoles(d, working.tenant_id, ['platform_admin'], null, {
    title: (lang) => notifTitle(lang, 'aiDraft', working.ref_no), body: summary || working.title, type: 'sd.ai_draft', priority: 1, groupKey: 'aid:' + working.id,
  });
  await logRun(d, working.tenant_id, working.id, 'upload_draft', 'ok', { version, path });
  return { ok: true, version, path };
}

export async function handleNextRef(d: Deps, body: Row): Promise<Row> {
  const tenantId = String(body.tenant_id || ''), key = String(body.key || '').trim();
  if (!tenantId || !key) return { ok: false, error: 'tenant_id_and_key_required' };
  const now = d.now(), yyyy = String(now.getUTCFullYear());
  const counterKey = key.toLowerCase() + ':' + yyyy; // per-year sequence, consistent with a 3-digit NNN
  let seq: number;
  try { seq = await d.db.incrCounter(tenantId, counterKey); }
  catch (e) { await logRun(d, tenantId, null, 'next_ref', 'error', { message: (e as Error).message }); return { ok: false, error: 'counter_failed' }; }
  const formatted = key.toUpperCase() + '/' + yyyy + '/' + String(seq).padStart(3, '0');
  await logRun(d, tenantId, null, 'next_ref', 'ok', { key, seq });
  return { ok: true, seq, ref: formatted };
}

export async function handleNote(d: Deps, body: Row): Promise<Row> {
  const requestId = String(body.request_id || ''), text = String(body.body || '').trim();
  if (!text) return { ok: false, error: 'body_required' };
  const r = await d.db.sr(requestId);
  if (!r) return { ok: false, error: 'not_found' };
  const pa = await d.db.firstPlatformAdmin();
  if (!pa) return { ok: false, error: 'no_platform_admin' };
  await d.db.insertEvent({ tenant_id: r.tenant_id, request_id: r.id, type: 'internal_note', body: text, actor_id: pa.id, meta: { by_agent: true } });
  await logRun(d, r.tenant_id, r.id, 'note', 'ok', {});
  return { ok: true };
}

export async function handleLog(d: Deps, body: Row): Promise<Row> {
  await logRun(d, null, body.request_id ? String(body.request_id) : null, String(body.action || 'log'), (body.status === 'error' || body.status === 'skipped') ? body.status : 'ok', body.detail || {});
  return { ok: true };
}

export async function handle(body: Row, headers: Headers, d: Deps): Promise<{ status: number; body: Row }> {
  if (!secretOk(headers.get('x-agent-secret'), d.secretPrimary, d.secretNext)) {
    await logRun(d, null, null, 'auth', 'error', { reason: 'secret_mismatch' });
    return { status: 401, body: { ok: false, error: 'secret' } };
  }
  const action = String(body.action || '');
  try {
    if (action === 'queue') return { status: 200, body: await handleQueue(d, body) };
    if (action === 'file_url') return { status: 200, body: await handleFileUrl(d, body) };
    if (action === 'letterhead_url') return { status: 200, body: await handleLetterheadUrl(d, body) };
    if (action === 'ask_client') return { status: 200, body: await handleAskClient(d, body) };
    if (action === 'resume') return { status: 200, body: await handleResume(d, body) };
    if (action === 'upload_draft') return { status: 200, body: await handleUploadDraft(d, body) };
    if (action === 'next_ref') return { status: 200, body: await handleNextRef(d, body) };
    if (action === 'note') return { status: 200, body: await handleNote(d, body) };
    if (action === 'log') return { status: 200, body: await handleLog(d, body) };
    return { status: 400, body: { ok: false, error: 'unknown_action' } };
  } catch (e) {
    await logRun(d, body.tenant_id ? String(body.tenant_id) : null, body.request_id ? String(body.request_id) : null, action || 'unknown', 'error', { message: (e as Error).message });
    return { status: 500, body: { ok: false, error: (e as Error).message || 'error' } };
  }
}
