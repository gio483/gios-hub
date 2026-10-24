// The Making of a Man backend. Routed through /api/lifeos?ns=mom to stay within the Hobby function limit.
import webpush from 'web-push';
import { pathOf, validId, readJSON, writeJSON, merge, payloadFor, body, send, DATA_URL, listUsers } from './_momlib.mjs';

function vapid() {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:gio@shiftvisionmedia.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}
export function isMomCron(req) {
  const ua = req.headers['user-agent'] || '';
  const secret = process.env.CRON_SECRET;
  return ua.startsWith('vercel-cron') && !!secret && req.headers.authorization === `Bearer ${secret}`;
}
async function cron(req, res, url) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return send(res, 401, { error: 'unauthorized' });
  const h = new Date().getUTCHours();
  const slot = url.searchParams.get('slot') || (h >= 10 && h < 22 ? 'morning' : 'evening');
  vapid();
  const data = await fetch(DATA_URL, { cache: 'no-store' }).then(r => r.json());
  const paths = await listUsers();
  let sent = 0, failed = 0, removed = 0;
  for (const p of paths) {
    const st = await readJSON(p);
    if (!st || !st.push || !st.push.on || !st.push.sub) continue;
    try { await webpush.sendNotification(st.push.sub, JSON.stringify(payloadFor(slot, st, data)), { TTL: 6 * 3600 }); sent++; }
    catch (e) { failed++; if (e && (e.statusCode === 404 || e.statusCode === 410)) { st.push = { on: false, u: Date.now() }; await writeJSON(p, st); removed++; } }
  }
  return send(res, 200, { slot, users: paths.length, sent, failed, removed });
}

export default async function momHandler(req, res) {
  const url = new URL(req.url, 'http://x');
  const id = url.searchParams.get('id');
  const action = url.searchParams.get('action') || '';
  try {
    if (action === 'cron' || isMomCron(req)) return await cron(req, res, url);
    if (action === 'vapid') return send(res, 200, { key: process.env.VAPID_PUBLIC_KEY || '' });
    if (!validId(id)) return send(res, 400, { error: 'bad id' });
    const p = pathOf(id);
    if (req.method === 'GET') {
      const data = (await readJSON(p)) || {};
      if (data.push) data.push = { on: !!data.push.on, u: data.push.u, has: !!data.push.sub };
      return send(res, 200, { data });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    const b = await body(req);
    const cur = (await readJSON(p)) || { created: Date.now() };
    if (action === 'subscribe') {
      const sub = b.subscription;
      if (!sub || !sub.endpoint) return send(res, 400, { error: 'no subscription' });
      await writeJSON(p, merge(cur, { push: { sub, on: true, tz: b.tz || '', u: Date.now() } }));
      return send(res, 200, { ok: true });
    }
    if (action === 'unsubscribe') { await writeJSON(p, merge(cur, { push: { on: false, u: Date.now() } })); return send(res, 200, { ok: true }); }
    if (action === 'test') {
      if (!cur.push || !cur.push.sub || !cur.push.on) return send(res, 400, { error: 'Notifications are not turned on for any device yet.' });
      if (!process.env.VAPID_PRIVATE_KEY) return send(res, 503, { error: 'Notification keys are not set on the server yet.' });
      vapid();
      const slot = ['morning', 'evening'].includes(b.slot) ? b.slot : 'test';
      const data = await fetch(DATA_URL, { cache: 'no-store' }).then(r => r.json());
      await webpush.sendNotification(cur.push.sub, JSON.stringify(payloadFor(slot, cur, data)), { TTL: 3600 });
      return send(res, 200, { ok: true });
    }
    const next = merge(cur, b.data || {});
    await writeJSON(p, next);
    const out = { ...next }; if (out.push) out.push = { on: !!out.push.on, u: out.push.u, has: !!out.push.sub };
    return send(res, 200, { ok: true, data: out });
  } catch (e) {
    return send(res, 500, { error: String(e && e.message || e) });
  }
}
