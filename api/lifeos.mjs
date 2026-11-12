import { put, list } from '@vercel/blob';
import { createHash } from 'crypto';
import momHandler, { isMomCron } from './_mom.mjs';
import tritonHandler from './_triton.mjs';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const PATHS = { lifeos: 'lifeos/data.json', bni: 'sdlr-bni/outreach.json', dock: 'dock/data.json' };
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


// --- SDLR Google Ads live dashboard (added 2026-11-12) -------------------
// Written hourly by a Google Ads Script inside the SDLR Ads account; read by
// sdlr-ads.html. Both directions need a key in the x-key header; only the
// SHA-256 hashes live here because this repo is public.
const SDLRADS_PATH = 'sdlr-ads/data.json';
const SDLRADS_VIEW_SHA = '2545aa8767e33116d248e8f9ae6eb6d61d767d2f5504e9f4175d620eea33e032';
const SDLRADS_WRITE_SHA = 'e05631f7bd18e86858bed6f7e5dbdfc485f5ef6a15f498ed120c9554e6551062';
function sha256(s) { return createHash('sha256').update(String(s || '')).digest('hex'); }
async function sdlrAdsHandler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const k = sha256(req.headers['x-key']);
  const canWrite = k === SDLRADS_WRITE_SHA;
  const canRead = canWrite || k === SDLRADS_VIEW_SHA;
  if (req.method === 'GET') {
    if (!canRead) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'passcode' })); }
    try {
      const { blobs } = await list({ prefix: SDLRADS_PATH.replace('.json', ''), token: TOKEN });
      const b = (blobs || []).sort((a, c) => new Date(c.uploadedAt) - new Date(a.uploadedAt))[0];
      if (!b) return res.end(JSON.stringify({ data: {} }));
      const r = await fetch(b.url + (b.url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
      return res.end(JSON.stringify({ data: await r.json().catch(() => ({})) }));
    }
    catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ error: e.message })); }
  }
  if (req.method === 'POST') {
    if (!canWrite) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'key' })); }
    let body = req.body;
    if (!body || typeof body === 'string') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    }
    const payload = body && body.data !== undefined ? body.data : (body || {});
    await put(SDLRADS_PATH, JSON.stringify(payload), { access: 'public', addRandomSuffix: true, contentType: 'application/json', token: TOKEN });
    // keep only the newest copy (random suffix keeps the public blob URL unguessable)
    try {
      const { blobs } = await list({ prefix: SDLRADS_PATH.replace('.json', ''), token: TOKEN });
      const sorted = (blobs || []).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const { del } = await import('@vercel/blob');
      for (const old of sorted.slice(1)) await del(old.url, { token: TOKEN });
    } catch (e) {}
    return res.end(JSON.stringify({ ok: true }));
  }
  res.statusCode = 405;
  return res.end(JSON.stringify({ error: 'method' }));
}

export default async function handler(req, res) {
  const NS = nsOf(req);
  if (NS === 'mom' || isMomCron(req)) return momHandler(req, res);
  if (NS === 'triton') return tritonHandler(req, res); // Triton Pitching Lab sync (see _triton.mjs)
  if (NS === 'sdlrads') return sdlrAdsHandler(req, res); // SDLR Google Ads dashboard (key-protected)
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
if (NS === 'bni' || NS === 'dock') {
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
