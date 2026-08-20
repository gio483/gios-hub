import { put, list } from '@vercel/blob';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const PATHS = { lifeos: 'lifeos/data.json', bni: 'sdlr-bni/outreach.json' };
function nsOf(req) {
  try { return new URL(req.url, 'http://x').searchParams.get('ns') || 'lifeos'; }
  catch (e) { return 'lifeos'; }
}
async function readBlob(p) {
  const { blobs } = await list({ prefix: p, token: TOKEN });
  const b = blobs && blobs[0];
  if (!b) return {};
  const r = await fetch(b.url + (b.url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
  return await r.json().catch(() => ({}));
}

export default async function handler(req, res) {
  const NS = nsOf(req);
  const PATH = PATHS[NS] || PATHS.lifeos;
const host = req.headers.host || '';
const ref = req.headers.referer || req.headers.origin || '';
if (ref && !ref.includes(host) && !ref.includes('.vercel.app')) {
res.statusCode = 403;
res.setHeader('Content-Type', 'application/json');
return res.end(JSON.stringify({ error: 'forbidden' }));
}
if (req.method === 'GET') {
try {
const { blobs } = await list({ prefix: PATH, token: TOKEN });
const b = blobs && blobs[0];
res.setHeader('Content-Type', 'application/json');
res.setHeader('Cache-Control', 'no-store');
if (!b) return res.end(JSON.stringify({ data: {} }));
const r = await fetch(b.url + (b.url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
const data = await r.json().catch(() => ({}));
return res.end(JSON.stringify({ data }));
} catch (e) {
res.statusCode = 500;
res.setHeader('Content-Type', 'application/json');
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
try {
let payload = body && body.data !== undefined ? body.data : (body || {});
if (NS === 'bni') {
  const current = await readBlob(PATH);
  const merged = { ...current };
  for (const [k, v] of Object.entries(payload || {})) {
    if (!v || typeof v !== 'object') continue;
    if (Number(v.u || 0) >= Number((current[k] || {}).u || 0)) merged[k] = v;
  }
  payload = merged;
}
const json = JSON.stringify(payload);
await put(PATH, json, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token: TOKEN });
res.statusCode = 200;
res.setHeader('Content-Type', 'application/json');
return res.end(JSON.stringify({ ok: true }));
} catch (e) {
res.statusCode = 400;
res.setHeader('Content-Type', 'application/json');
return res.end(JSON.stringify({ error: e.message }));
}
}
res.statusCode = 405;
res.end('Method not allowed');
}
