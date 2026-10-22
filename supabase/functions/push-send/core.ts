// M-Core push-send — pure logic (no I/O). Mirrors app/notif-core.js classify/defaults/quiet so phone rules match the bell.
export type Row = Record<string, any>;
export const TYPES = ['approval', 'sd', 'assigned', 'overdue', 'contract', 'activity'];
const ACT_RE = /^(Kehadiran direkod|Entri jurnal baru|Produk baru ditambah|Invois baru|Pekerja baru ditambah|Bayaran diterima|Baucar bayaran baru|Jualan POS baru|PO baru|Tuntutan perbelanjaan baru|GRN direkod)/;
export const same = (a: unknown, b: unknown) => String(a) === String(b);

/** notif-core.js NT.classify (kind + category) */
export function classify(n: Row): { kind: string; cat: string; prio: number } {
  let k = n.kind as string | null, prio = Number(n.priority || 0);
  const c = String(n.category || '');
  if (!k) {
    if (/^(sales|finance|inventory|purchasing)$/.test(c) || (c === 'hr' && n.ref_table && !n.type) || ACT_RE.test(n.title || '')) k = 'activity';
    else if (c === 'service_desk' && /pindaan|revision/i.test(n.title || '')) { k = 'action'; prio = Math.max(prio, 1); }
    else k = 'for_you';
  }
  let cat = k === 'activity' ? 'activity' : (n.type && String(n.type).split('.')[0]) || (c === 'service_desk' ? 'sd' : (c === 'hr' ? 'approval' : 'assigned'));
  if (TYPES.indexOf(cat) < 0) cat = k === 'activity' ? 'activity' : 'assigned';
  return { kind: k, cat, prio };
}

/** notif-core.js NT.defaults + NT.merge (adm = owner/admin/platform_admin) */
export function settingsFor(role: string, saved?: Row | null): Row {
  const r = String(role || '').toLowerCase(), adm = r === 'owner' || r === 'admin' || r === 'platform_admin';
  const d: Row = {
    m: { approval: { b: 1, p: 1, t: adm ? 1 : 0 }, sd: { b: 1, p: 1, t: 0 }, assigned: { b: 1, p: 1, t: 0 }, overdue: { b: adm ? 1 : 0, p: 0, t: 0 }, contract: { b: 1, p: 0, t: adm ? 1 : 0 }, activity: { b: adm ? 1 : 0, p: 0, t: 0 } },
    q: { on: 0, from: '22:00', to: '07:00', days: [1, 2, 3, 4, 5], hi: 1 }, digest: { on: 1, at: '08:00' },
  };
  const s = saved || {};
  TYPES.forEach((k) => { if (s.m && s.m[k]) d.m[k] = Object.assign(d.m[k], s.m[k]); });
  if (s.q) d.q = Object.assign(d.q, s.q);
  if (s.digest) d.digest = Object.assign(d.digest, s.digest);
  return d;
}
export const ch = (s: Row, cat: string, c: string) => { const m = s.m[cat] || s.m.activity; return !!(m && m[c]); };

/** Wall clock in Asia/Kuala_Lumpur (UTC+8, no DST). */
export function myt(now: Date) { const d = new Date(now.getTime() + 8 * 3600000); return { wd: d.getUTCDay() || 7, hm: ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2), day: d.toISOString().slice(0, 10) }; }

/** notif-core.js NT.quiet, but in MYT and with the high-priority bypass (prio >= 1 && q.hi). */
export function quiet(s: Row, prio: number, now: Date): boolean {
  const q = s.q; if (!q || !q.on) return false; if (prio && q.hi) return false;
  const { wd, hm } = myt(now), f = q.from || '22:00', t = q.to || '07:00';
  const inR = f <= t ? (hm >= f && hm < t) : (hm >= f || hm < t);
  const day = f > t && hm < t ? ((wd + 5) % 7) + 1 : wd;
  const dayOk = !q.days || !q.days.length || q.days.indexOf(day) >= 0;
  return inR && dayOk;
}

/** Role routing (push_settings.settings.roles). No entry for the role = everything allowed (current behaviour). */
export function roleAllows(ts: Row | null | undefined, role: string, cat: string): boolean {
  const roles = ts && ts.roles; if (!roles || typeof roles !== 'object') return true;
  const list = roles[String(role || '').toLowerCase()]; if (!Array.isArray(list)) return true;
  return list.indexOf(cat) >= 0;
}

/** sd-data.js SD.addBH: add business hours (Mon-Fri, MYT). */
export function addBH(from: string | Date, hours: number): Date {
  let ms = new Date(from).getTime(), left = Math.max(0, hours || 0) * 3600000, g = 0; const step = 900000;
  const wk = (x: number) => { const d = new Date(x + 8 * 3600000).getUTCDay(); return d !== 0 && d !== 6; };
  while (left > 0 && g++ < 20000) { if (wk(ms)) left -= step; ms += step; }
  return new Date(ms);
}
export function slaDue(r: Row, now: Date): Date | null {
  if (!r.due_at) return null;
  const paused = (r.sla_paused_seconds || 0) + (r.paused_at ? Math.max(0, (now.getTime() - new Date(r.paused_at).getTime()) / 1000) : 0);
  return addBH(r.due_at, paused / 3600);
}

const TX: Record<string, Record<string, string>> = {
  en: { open: 'Open', openSr: 'Open SR', read: 'Mark read', view: 'View', many: ' new alerts', test: 'Test alert', testB: 'Push works on this device.', morning: 'Good morning', unread: ' unread alerts in M-Core', sla2: 'SLA due in 2h', slaO: 'SLA overdue', esc: 'URGENT not picked up for ' },
  bm: { open: 'Buka', openSr: 'Buka SR', read: 'Tanda dibaca', view: 'Lihat', many: ' amaran baharu', test: 'Amaran ujian', testB: 'Push berfungsi pada peranti ini.', morning: 'Selamat pagi', unread: ' amaran belum dibaca dalam M-Core', sla2: 'SLA tamat dalam 2j', slaO: 'SLA lewat', esc: 'SEGERA belum diambil selama ' },
};
export const tx = (lang: string, k: string) => (TX[lang === 'bm' ? 'bm' : 'en'][k]) || TX.en[k] || k;

/** Payload for sw.js 'push'. prio 2 = stays until tapped. */
export function payload(n: Row, info: { cat: string; prio: number }, lang: string, extra: Row = {}): Row {
  const sr = n.ref_table === 'service_requests' || info.cat === 'sd';
  const actions = sr ? [{ action: 'open', title: tx(lang, 'openSr') }, { action: 'read', title: tx(lang, 'read') }]
    : info.cat === 'approval' ? [{ action: 'open', title: tx(lang, 'view') }] : [{ action: 'open', title: tx(lang, 'open') }, { action: 'read', title: tx(lang, 'read') }];
  return Object.assign({
    title: String(n.title || 'M-Core').slice(0, 80), body: String(n.body || '').slice(0, 180), tag: 'mcore-n-' + n.id, nid: n.id, uid: n.user_id,
    url: '/app/?nt=' + encodeURIComponent(n.id), prio: info.prio, actions, requireInteraction: info.prio >= 2,
    vibrate: info.prio >= 2 ? [300, 120, 300, 120, 300] : info.prio === 1 ? [200, 100, 200] : [120],
  }, extra);
}
export function summary(items: Row[], lang: string, uid: string): Row {
  const n = items.length;
  return { title: 'M-Core · ' + n + tx(lang, 'many'), body: items.slice(0, 3).map((x) => '• ' + String(x.title || '').slice(0, 60)).join('\n'), tag: 'mcore-sum-' + uid, uid, url: '/app/?ntp=1', prio: 0, actions: [{ action: 'open', title: tx(lang, 'open') }], vibrate: [120] };
}
