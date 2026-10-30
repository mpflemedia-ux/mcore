// M-Core sd-agent — pure logic (no I/O). Mirrors app/sd-data.js SD.TR / SD.setStatus /
// SD.pausedSec exactly, and push-send/handler.ts's cleanSecret/secretOk tolerant compare.
export type Row = Record<string, any>;

// sd-data.js SD.TR — identical adjacency list (source of truth: app/sd-data.js line 14-15).
export const TR: Record<string, string[]> = {
  submitted: ['triaged', 'cancelled'],
  triaged: ['in_progress', 'out_of_scope'],
  in_progress: ['waiting_client', 'delivered'],
  waiting_client: ['in_progress'],
  delivered: ['closed', 'revision'],
  revision: ['in_progress'],
};
export function canMove(from: string, to: string): boolean {
  return (TR[from] || []).indexOf(to) >= 0;
}

/** Shortest TR hop sequence from `from` to `to` (BFS), excluding `from`. null if unreachable.
 * Used by ask_client to replicate what repeated SD.setStatus() calls in the UI would do
 * (e.g. submitted -> triaged -> in_progress -> waiting_client), one hop at a time, each its
 * own atomic optimistic-locked update + status event -- never a single illegal jump. */
export function pathTo(from: string, to: string): string[] | null {
  if (from === to) return [];
  const seen = new Set([from]);
  const q: { s: string; path: string[] }[] = [{ s: from, path: [] }];
  while (q.length) {
    const cur = q.shift()!;
    for (const next of TR[cur.s] || []) {
      if (next === to) return [...cur.path, next];
      if (!seen.has(next)) { seen.add(next); q.push({ s: next, path: [...cur.path, next] }); }
    }
  }
  return null;
}

/** sd-data.js SD.pausedSec(r): accumulated sla_paused_seconds + live elapsed if currently paused. */
export function pausedSec(r: Row, now: Date): number {
  const base = Number(r.sla_paused_seconds || 0);
  const live = r.paused_at ? Math.max(0, (now.getTime() - new Date(r.paused_at).getTime()) / 1000) : 0;
  return base + live;
}

/** One hop's DB patch, mirroring sd-data.js SD.setStatus's `p` object exactly (same three
 * pause/delivered/closed branches, same field names). Does NOT include status/updated_at --
 * caller adds those alongside the optimistic-lock .eq('status', from). */
export function statusPatch(from: string, to: string, r: Row, nowIso: string): Row {
  const p: Row = {};
  if (from === 'waiting_client' && r.paused_at) {
    p.sla_paused_seconds = Math.round(pausedSec(r, new Date(nowIso)));
    p.paused_at = null;
  }
  if (to === 'waiting_client') p.paused_at = nowIso;
  if (to === 'delivered') p.delivered_at = nowIso;
  if (to === 'closed') p.closed_at = nowIso;
  return p;
}

/** New-format SR ref prefix: SR-<TENANTCODE>-<YYYYMM>-. Old SR-YYYYMM-NNNN refs are left
 * untouched (never rewritten) -- this only shapes refs for requests created from now on. */
export function refPrefix(tenantCode: string, monthKey: string): string {
  return 'SR-' + String(tenantCode || '').toUpperCase() + '-' + monthKey + '-';
}

/* Tolerant compare: dashboard/Vault secret pastes often carry a trailing newline, spaces or
   wrapping quotes -- identical idiom to push-send/handler.ts cleanSecret/secretOk. */
export function cleanSecret(v: string | null | undefined): string {
  return String(v || '').trim().replace(/^(['"])(.*)\1$/, '$2').trim();
}
export function secretOk(hdr: string | null | undefined, primary: string, next: string): boolean {
  const a = cleanSecret(hdr);
  if (!a) return false;
  return (!!primary && a === cleanSecret(primary)) || (!!next && a === cleanSecret(next));
}

export function safeName(n: string): string {
  return String(n || 'file').replace(/[^\w.\-]+/g, '_').slice(-80);
}

/** request_id-scoped storage path check: agent may only read/write under its own tenant's
 * service-requests/<id>/ folder, or that tenant's _letterhead/ folder. Mirrors the shape
 * service_files_read/insert RLS already enforces for the authenticated app, applied here in
 * app code since the Edge Function uses the service-role key (which bypasses RLS entirely). */
export function pathAllowed(path: string, tenantId: string, requestId?: string): boolean {
  const parts = String(path || '').split('/');
  if (parts[0] !== tenantId) return false;
  if (parts[1] === '_letterhead') return true;
  if (requestId && parts[1] === 'service-requests' && parts[2] === requestId) return true;
  return false;
}
