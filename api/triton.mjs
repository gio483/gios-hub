// Cloud sync for Triton Pitching Lab (triton-pitching-lab.html).
//
// Data: { "<YYYY-MM-DD>": { u: <ms timestamp>, rec: {...} | null } }
// Newest `u` wins per day, so devices editing different days never clash.
//
// Why snapshots: an overwritten blob can be served stale from the CDN for up
// to a minute, which loses writes that happen close together. Here every save
// writes a NEW file (never overwritten, so never stale) and reads pick the
// newest file via list(), which is not CDN-cached. Old snapshots are pruned.
import { put, list, del } from '@vercel/blob';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const PREFIX = 'triton-lab/snap/';
const KEEP = 15;

async function snapshots() {
  const all = [];
  let cursor;
  do {
    const r = await list({ prefix: PREFIX, token: TOKEN, cursor, limit: 1000 });
    all.push(...(r.blobs || []));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return all.sort((a, b) => (a.pathname < b.pathname ? -1 : 1));
}
async function latest(snaps) {
  const b = snaps[snaps.length - 1];
  if (!b) return {};
  const r = await fetch(b.url, { cache: 'no-store' });
  return await r.json().catch(() => ({}));
}
function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  const host = req.headers.host || '';
  const ref = req.headers.referer || req.headers.origin || '';
  if (ref && !ref.includes(host) && !ref.includes('.vercel.app')) return send(res, 403, { error: 'forbidden' });

  try {
    if (req.method === 'GET') {
      return send(res, 200, { data: await latest(await snapshots()) });
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (!body || typeof body === 'string') {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
      }
      const incoming = (body && body.data) || {};
      const snaps = await snapshots();
      const merged = { ...(await latest(snaps)) };
      let changed = 0;
      for (const [d, v] of Object.entries(incoming)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !v || typeof v !== 'object') continue;
        if (Number(v.u || 0) > Number((merged[d] || {}).u || 0)) { merged[d] = { u: Number(v.u), rec: v.rec || null }; changed++; }
      }
      if (changed) {
        const name = PREFIX + String(Date.now()).padStart(15, '0') + '-' + Math.random().toString(36).slice(2, 8) + '.json';
        await put(name, JSON.stringify(merged), { access: 'public', addRandomSuffix: false, contentType: 'application/json', token: TOKEN });
        const old = snaps.slice(0, Math.max(0, snaps.length + 1 - KEEP)).map(b => b.url);
        if (old.length) await del(old, { token: TOKEN }).catch(() => {});
      }
      return send(res, 200, { ok: true, changed });
    }
    return send(res, 405, { error: 'method not allowed' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
