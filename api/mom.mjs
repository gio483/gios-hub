// The Making of a Man: sync (journal, progress, verses) and push subscription
import webpush from 'web-push';
import { pathOf, validId, readJSON, writeJSON, merge, payloadFor, body, send, DATA_URL } from './_momlib.mjs';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const id = url.searchParams.get('id');
  const action = url.searchParams.get('action') || '';
  if (action === 'vapid') return send(res, 200, { key: process.env.VAPID_PUBLIC_KEY || '' });
  if (!validId(id)) return send(res, 400, { error: 'bad id' });
  const p = pathOf(id);
  try {
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
      const next = merge(cur, { push: { sub, on: true, tz: b.tz || '', ua: (req.headers['user-agent'] || '').slice(0, 120), u: Date.now() } });
      await writeJSON(p, next);
      return send(res, 200, { ok: true });
    }
    if (action === 'unsubscribe') {
      const next = merge(cur, { push: { on: false, u: Date.now() } });
      await writeJSON(p, next);
      return send(res, 200, { ok: true });
    }
    if (action === 'test') {
      if (!cur.push || !cur.push.sub || !cur.push.on) return send(res, 400, { error: 'notifications not enabled on any device yet' });
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:gio@shiftvisionmedia.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
      const slot = ['morning', 'evening'].includes(b.slot) ? b.slot : 'test';
      const data = await fetch(DATA_URL, { cache: 'no-store' }).then(r => r.json());
      await webpush.sendNotification(cur.push.sub, JSON.stringify(payloadFor(slot, cur, data)), { TTL: 3600 });
      return send(res, 200, { ok: true });
    }
    // default: sync merge
    const next = merge(cur, b.data || {});
    await writeJSON(p, next);
    const out = { ...next }; if (out.push) out.push = { on: !!out.push.on, u: out.push.u, has: !!out.push.sub };
    return send(res, 200, { ok: true, data: out });
  } catch (e) {
    return send(res, 500, { error: String(e && e.message || e) });
  }
}
