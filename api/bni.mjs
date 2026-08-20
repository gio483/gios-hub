// SDLR BNI outreach sync: stores per-person outreach status as one JSON blob in
// Vercel Blob so Gio's phone, laptop and desktop all see the same list.
// GET returns the whole map. POST merges the records it is given.
//
// Merge is PER PERSON and last-write-wins on that person's own timestamp, so a
// stale device posting old data can never wipe out newer work done elsewhere.
import { put, list } from '@vercel/blob';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const PATH = 'sdlr-bni/outreach.json';

async function readAll() {
  const { blobs } = await list({ prefix: PATH, token: TOKEN });
  const b = blobs && blobs[0];
  if (!b) return {};
  const r = await fetch(b.url + (b.url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
  return await r.json().catch(() => ({}));
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const host = req.headers.host || '';
  const ref = req.headers.referer || req.headers.origin || '';
  if (ref && !ref.includes(host) && !ref.includes('.vercel.app')) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'forbidden' }));
  }

  if (!TOKEN) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'BLOB_READ_WRITE_TOKEN is not set in Vercel.' }));
  }

  if (req.method === 'GET') {
    try {
      return res.end(JSON.stringify({ data: await readAll() }));
    } catch (e) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (!body || typeof body === 'string') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }
    const incoming = (body && body.data) || {};
    try {
      const current = await readAll();
      const merged = { ...current };
      let changed = 0;
      for (const [k, v] of Object.entries(incoming)) {
        if (!v || typeof v !== 'object') continue;
        const mine = Number(v.u || 0);
        const theirs = Number((current[k] || {}).u || 0);
        if (mine >= theirs) { merged[k] = v; changed++; }
      }
      await put(PATH, JSON.stringify(merged), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        token: TOKEN,
      });
      return res.end(JSON.stringify({ ok: true, applied: changed, data: merged }));
    } catch (e) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ error: 'Method not allowed' }));
}
