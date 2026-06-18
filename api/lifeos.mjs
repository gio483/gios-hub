import { put, list } from '@vercel/blob';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const PATH = 'lifeos/data.json';

export default async function handler(req, res) {
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
const json = JSON.stringify(body && body.data !== undefined ? body.data : (body || {}));
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
