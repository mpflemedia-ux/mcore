// M-Core push-send — scheduled jobs (called by action 'tick'): SLA reminders, urgent escalation, morning summary.
import { myt, quiet, Row, same, settingsFor, slaDue, tx } from './core.ts';
import { ago, Deps, iso, processOne } from './handler.ts';

const SLA_ACTIVE = ['submitted', 'triaged', 'in_progress', 'revision'];

/** SLA reminders (2h before due + overdue) to the assignee, as normal notifications (bell + phone).
 * Two cleanup passes keep stale reminders from lingering unread in the bell:
 * (1) any 'sla:<id>' reminder whose SR has left the SLA-active status set (paused via
 *     waiting_client, or finished) is marked read+acted -- it no longer applies.
 * (2) when the overdue ('slao:') reminder fires, the earlier 2h-warning ('sla2:') reminder for
 *     the same SR (same group_key) is marked read+acted -- superseded, not still-unread noise. */
export async function sla(d: Deps): Promise<number> {
  const now = d.now(); let c = 0;
  for (const n of await d.db.pendingSlaNotifications()) {
    const sr = n.ref_id ? await d.db.sr(String(n.ref_id)) : null;
    if (!sr || SLA_ACTIVE.indexOf(sr.status) < 0) await d.db.markActed(n.id);
  }
  for (const r of await d.db.openSrs()) {
    if (!r.assigned_to || SLA_ACTIVE.indexOf(r.status) < 0) continue;
    const due = slaDue(r, now); if (!due) continue;
    const left = due.getTime() - now.getTime(), over = left <= 0;
    if (!over && left > 2 * 3600000) continue;
    const key = (over ? 'slao:' : 'sla2:') + r.id + ':' + iso(due);
    if (!(await d.db.claim({ dedupe_key: key, channel: 'none', status: 'pending', reason: 'sla' }))) continue;
    const prof = await d.db.profile(r.assigned_to);
    if (!prof) { await d.db.updateLog(key, { status: 'skipped', reason: 'no_assignee' }); continue; }
    if (over) await d.db.markGroupActed('sla:' + r.id);
    const lang = ((await d.db.subs(prof.tenant_id, prof.id))[0] || {}).lang || 'en';
    const n = await d.db.insertNotification({ tenant_id: prof.tenant_id, user_id: prof.id, actor_id: null, title: (r.ref_no || 'SR') + ': ' + tx(lang, over ? 'slaO' : 'sla2'), body: String(r.title || '').slice(0, 300), category: 'service_desk', kind: 'action', type: 'sd.sla', priority: over ? 2 : 1, ref_table: 'service_requests', ref_id: String(r.id), group_key: 'sla:' + r.id });
    await d.db.updateLog(key, { status: n ? 'sent' : 'failed', reason: n ? 'notif:' + n.id : 'insert', tenant_id: prof.tenant_id, user_id: prof.id });
    if (n) { await processOne(n, d); c++; }
  }
  return c;
}

/** Urgent SR still 'submitted' + unassigned after X min (push_settings.escalate_min of the platform admin's tenant, default 30, 0 = off) -> Telegram. */
export async function escalate(d: Deps): Promise<number> {
  const now = d.now(); let c = 0;
  const srs = await d.db.urgentUnpicked(iso(ago(now, 24 * 3600000))); if (!srs.length) return 0;
  for (const pa of await d.db.paUsers()) {
    const ts = (await d.db.tenantSettings(pa.tenant_id))?.settings || {}, min = ts.escalate_min == null ? 30 : Number(ts.escalate_min);
    if (!(min > 0)) continue;
    for (const r of srs) {
      if (new Date(r.created_at).getTime() > now.getTime() - min * 60000) continue;
      const key = 'esc:' + r.id + ':' + pa.id;
      if (!(await d.db.claim({ dedupe_key: key, tenant_id: pa.tenant_id, user_id: pa.id, channel: 'telegram', status: 'pending', reason: 'escalate' }))) continue;
      const chat = await d.db.telegramChat(pa.tenant_id, pa.id);
      if (!chat) { await d.db.updateLog(key, { status: 'failed', reason: 'no_telegram' }); continue; }
      const lang = (await d.db.subs(pa.tenant_id, pa.id))[0]?.lang || 'en', who = await d.db.tenantName(r.tenant_id);
      const ok = await d.telegram(chat, 'M-Core · ' + (r.ref_no || 'SR') + ' ' + tx(lang, 'esc') + min + ' min\n' + String(r.title || '') + (who ? '\n' + who : ''));
      await d.db.updateLog(key, { status: ok ? 'sent' : 'failed' }); if (ok) c++;
    }
  }
  return c;
}

/** Morning summary push at settings.digest.at (default 08:00 MYT), once per day, only when there's something to report.
 * platform_admin gets a Service Desk ops summary (overdue/near-SLA/pending AI drafts/waiting-on-client counts,
 * deep-linked to the Service Desk board) instead of the generic unread-count digest everyone else gets. */
export async function morning(d: Deps): Promise<number> {
  const now = d.now(), t = myt(now), by: Record<string, Row[]> = {}; let c = 0;
  for (const s of await d.db.allActiveSubs()) (by[s.user_id] = by[s.user_id] || []).push(s);
  for (const uid of Object.keys(by)) {
    const prof = await d.db.profile(uid); if (!prof) continue;
    const subs = by[uid].filter((s) => same(s.tenant_id, prof.tenant_id)); if (!subs.length) continue;
    const st = settingsFor(prof.role, (await d.db.settings(prof.tenant_id, uid))?.settings);
    if (!st.digest.on) continue;
    const at = String(st.digest.at || '08:00'), h = +at.slice(0, 2), m = +at.slice(3, 5), cur = +t.hm.slice(0, 2) * 60 + +t.hm.slice(3, 5);
    if (cur < h * 60 + m || cur >= h * 60 + m + 60 || quiet(st, 0, now)) continue;
    const key = 'dg:' + uid + ':' + t.day;
    if (!(await d.db.claim({ dedupe_key: key, tenant_id: prof.tenant_id, user_id: uid, channel: 'push', status: 'pending', reason: 'digest' }))) continue;
    const isPA = String(prof.role || '').toLowerCase() === 'platform_admin';
    let cnt = 0, overdue = 0, soon = 0, drafts = 0, waiting = 0, url = '/app/?ntp=1';
    if (isPA) {
      for (const r of await d.db.paOpenSrsWithDue()) { const due = slaDue(r, now); if (!due) continue; const left = due.getTime() - now.getTime(); if (left <= 0) overdue++; else if (left <= 2 * 3600000) soon++; }
      drafts = await d.db.paPendingDraftCount(); waiting = await d.db.paWaitingClientCount();
      cnt = overdue + soon + drafts + waiting; url = '/app/?page=admin&view=sd_desk';
    } else cnt = await d.db.unreadCount(prof.tenant_id, uid);
    if (!cnt) { await d.db.updateLog(key, { status: 'skipped', reason: 'zero' }); continue; }
    let ok = 0;
    for (const sub of subs) {
      const lang = sub.lang || 'en';
      const body = isPA ? [overdue + tx(lang, 'paOverdue'), soon + tx(lang, 'paSoon'), drafts + tx(lang, 'paDrafts'), waiting + tx(lang, 'paWaiting')].join(' · ') : cnt + tx(lang, 'unread');
      try { const code = await d.push(sub, { title: 'M-Core · ' + tx(lang, 'morning'), body, tag: 'mcore-digest', url, prio: 0, vibrate: [120], actions: [{ action: 'open', title: tx(lang, 'open') }] }, 0); if (code >= 200 && code < 300) ok++; else if (code === 404 || code === 410) await d.db.touchSub(sub.id, { deleted_at: iso(now) }); } catch (_e) { /* next */ }
    }
    await d.db.updateLog(key, { status: ok ? 'sent' : 'failed', reason: isPA ? 'sd=' + cnt : 'unread=' + cnt }); if (ok) c++;
  }
  return c;
}

