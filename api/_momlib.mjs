import { put, list } from '@vercel/blob';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
export const DATA_URL = 'https://gios-hub.vercel.app/vibe/mom-data.json';
export const pathOf = id => `mom/u/${id}.json`;
export const validId = id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id);

export async function readJSON(p) {
  const { blobs } = await list({ prefix: p, token: TOKEN });
  const b = (blobs || []).find(x => x.pathname === p);
  if (!b) return null;
  const r = await fetch(b.url + (b.url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
  return await r.json().catch(() => null);
}
export async function writeJSON(p, obj) {
  await put(p, JSON.stringify(obj), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', token: TOKEN });
}
export async function listUsers() {
  const out = []; let cursor;
  do {
    const r = await list({ prefix: 'mom/u/', token: TOKEN, cursor });
    for (const b of r.blobs || []) out.push(b.pathname);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

// Merge maps of {key: {..., u}} keeping the newest per key
function mergeMap(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    if (!v || typeof v !== 'object') continue;
    if (!out[k] || Number(v.u || 0) >= Number(out[k].u || 0)) out[k] = v;
  }
  return out;
}
export function merge(cur = {}, inc = {}) {
  const out = { ...cur };
  for (const key of ['done', 'j', 'vm']) out[key] = mergeMap(cur[key], inc[key]);
  if (inc.push && (!cur.push || Number(inc.push.u || 0) >= Number(cur.push.u || 0))) out.push = inc.push;
  if (inc.name && typeof inc.name === 'string') out.name = inc.name.slice(0, 40);
  out.u = Date.now();
  return out;
}

export function nextDay(state, total = 21) {
  for (let n = 1; n <= total; n++) { const d = (state.done || {})[n]; if (!d || !d.v) return n; }
  return 0; // all done
}
export function lastDoneDay(state, total = 21) {
  let best = 0, bu = 0;
  for (let n = 1; n <= total; n++) { const d = (state.done || {})[n]; if (d && d.v && Number(d.u || 0) >= bu) { best = n; bu = Number(d.u || 0); } }
  return best;
}

export function payloadFor(slot, state, data) {
  const R = data.R; const n = nextDay(state, R.length);
  if (slot === 'test') return { title: 'Notifications are on', body: 'Your morning reading will arrive here each day. Strong and gentle.', url: '/vibe/readings.html' };
  if (slot === 'morning') {
    if (!n) return { title: 'All 21 readings complete', body: 'Well done, brother. Begin again and see how much deeper it goes.', url: '/vibe/readings.html#day-1' };
    const r = R[n - 1];
    return { title: `Day ${n}: ${r.t}`, body: `“${r.m[0]}” ${r.m[1]}`, url: `/vibe/readings.html#day-${n}` };
  }
  // evening: memory verse from the latest completed day, else today's
  const d = lastDoneDay(state, R.length) || n || 1; const r = R[d - 1];
  return { title: 'Tonight’s memory verse', body: `${r.m[1]}. Can you say it from memory before you sleep?`, url: `/vibe/verses.html#d-${d}` };
}

export async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
}
export function send(res, code, obj) {
  res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
