// Daily pushes for The Making of a Man. Morning reading (14:00 UTC) and evening memory verse (03:00 UTC).
import webpush from 'web-push';
import { listUsers, readJSON, writeJSON, payloadFor, send, DATA_URL } from './_momlib.mjs';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return send(res, 401, { error: 'unauthorized' });
  const url = new URL(req.url, 'http://x');
  const h = new Date().getUTCHours();
  const slot = url.searchParams.get('slot') || (h >= 10 && h < 22 ? 'morning' : 'evening');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:gio@shiftvisionmedia.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const data = await fetch(DATA_URL, { cache: 'no-store' }).then(r => r.json());
  const paths = await listUsers();
  let sent = 0, failed = 0, removed = 0;
  for (const p of paths) {
    const st = await readJSON(p);
    if (!st || !st.push || !st.push.on || !st.push.sub) continue;
    try {
      await webpush.sendNotification(st.push.sub, JSON.stringify(payloadFor(slot, st, data)), { TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      failed++;
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { st.push = { on: false, u: Date.now() }; await writeJSON(p, st); removed++; }
    }
  }
  return send(res, 200, { slot, users: paths.length, sent, failed, removed });
}
