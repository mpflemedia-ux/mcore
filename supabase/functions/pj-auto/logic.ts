// M-Core pj-auto — pure logic (no I/O): Malaysia wall clock, next due date for repeating tasks, daily summary text.
export type Row = Record<string, any>;
export const same = (a: unknown, b: unknown) => String(a) === String(b);

/** Wall clock in Asia/Kuala_Lumpur (UTC+8, no DST). */
export function myt(now: Date) {
  const d = new Date(now.getTime() + 8 * 3600000);
  return { day: d.toISOString().slice(0, 10), hm: ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2) };
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const at = (s: string) => new Date(s + 'T00:00:00Z');
export function addDays(s: string, n: number): string { const d = at(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); }
export function daysBetween(a: string, b: string): number { return Math.round((at(b).getTime() - at(a).getTime()) / 86400000); }

export const RULES = ['daily', 'weekdays', 'weekly', 'monthly'];

/** One step of a repeat rule. Monthly keeps the anchor day of month, clamped to the month length (31 -> 30/28). */
export function step(s: string, rule: string, anchorDay: number): string {
  if (rule === 'daily') return addDays(s, 1);
  if (rule === 'weekly') return addDays(s, 7);
  if (rule === 'weekdays') { let x = addDays(s, 1); while ([0, 6].indexOf(at(x).getUTCDay()) >= 0) x = addDays(x, 1); return x; }
  if (rule === 'monthly') {
    const d = at(s), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    return ny + '-' + String(nm).padStart(2, '0') + '-' + String(Math.min(anchorDay, last)).padStart(2, '0');
  }
  return s;
}

/** Next due date after `due` that is not before `today` (missed periods are skipped, never back-filled). */
export function nextDue(due: string, rule: string, today: string): string | null {
  if (!due || RULES.indexOf(rule) < 0) return null;
  const anchor = at(due).getUTCDate();
  let x = step(due, rule, anchor), n = 0;
  while (x < today && n++ < 1000) x = step(x, rule, anchor);
  return x;
}

/** New start date keeps the original start -> due gap (none when the original had no start). */
export function nextStart(start: string | null, due: string, next: string): string | null {
  if (!start) return null;
  const gap = daysBetween(start, due);
  return gap >= 0 ? addDays(next, -gap) : next;
}

const TX: Record<string, Record<string, string>> = {
  en: { title: 'Tasks today', today: 'Today', late: 'Overdue', more: ' more', due: 'due ' },
  bm: { title: 'Task hari ini', today: 'Hari ini', late: 'Lewat', more: ' lagi', due: 'due ' },
};
export const tx = (lang: string, k: string) => TX[lang === 'bm' ? 'bm' : 'en'][k] || TX.en[k] || k;
const dm = (s: string) => String(s).slice(8, 10) + '/' + String(s).slice(5, 7);

/** Bell + phone text for one person: counts in the title, up to 5 task lines (overdue first, oldest first). */
export function digestText(lang: string, todayList: Row[], lateList: Row[]): { title: string; body: string } {
  const title = tx(lang, 'title') + ': ' + todayList.length + ' · ' + tx(lang, 'late') + ': ' + lateList.length;
  const late = lateList.slice().sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  const lines = late.map((k) => '• ' + String(k.title || '').slice(0, 70) + ' (' + tx(lang, 'late').toLowerCase() + ', ' + tx(lang, 'due') + dm(k.due_date) + ')')
    .concat(todayList.map((k) => '• ' + String(k.title || '').slice(0, 70) + (k.due_time ? ' (' + String(k.due_time).slice(0, 5) + ')' : '')));
  const extra = lines.length > 5 ? '\n+' + (lines.length - 5) + tx(lang, 'more') : '';
  return { title, body: lines.slice(0, 5).join('\n') + extra };
}

/** employee -> user_profiles id: email first, then exact full name (same rule as app/pj-multi-remind.js usersFor). */
export function userForEmp(e: Row, users: Row[]): Row | null {
  const em = String(e.email || '').trim().toLowerCase(), n = String(e.name || '').trim().toLowerCase();
  return users.find((u) => em && String(u.email || '').trim().toLowerCase() === em) || users.find((u) => n && String(u.full_name || '').trim().toLowerCase() === n) || null;
}

/* tolerant compare: Vault/dashboard pastes often carry a trailing newline, spaces or wrapping quotes (same as push-send) */
export function cleanSecret(v: string | null | undefined): string { return String(v || '').trim().replace(/^(['"])(.*)\1$/, '$2').trim(); }
export function secretOk(hdr: string | null | undefined, env: string | null | undefined): boolean { const a = cleanSecret(hdr), b = cleanSecret(env); return !!b && a === b; }
