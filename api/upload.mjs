import { handleUpload } from '@vercel/blob/client';

export default async function handler(req, res) {
if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method not allowed'); }
const host = req.headers.host || '';
const ref = req.headers.referer || req.headers.origin || '';
if (ref && !ref.includes(host) && !ref.includes('.vercel.app')) {
res.statusCode = 403;
res.setHeader('Content-Type', 'application/json');
return res.end(JSON.stringify({ error: 'forbidden' }));
}
let body = req.body;
if (!body || typeof body === 'string') {
const chunks = [];
for await (const c of req) chunks.push(c);
const raw = Buffer.concat(chunks).toString() || (typeof body === 'string' ? body : '');
try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
}
try {
const jsonResponse = await handleUpload({
body,
request: req,
  token: process.env.BLOB_READ_WRITE_TOKEN,
onBeforeGenerateToken: async () => ({
allowedContentTypes: ['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-m4a','audio/m4a','application/octet-stream'],
addRandomSuffix: true,
maximumSizeInBytes: 1024 * 1024 * 1024
}),
onUploadCompleted: async () => {}
});
res.statusCode = 200;
res.setHeader('Content-Type', 'application/json');
res.end(JSON.stringify(jsonResponse));
} catch (e) {
res.statusCode = 400;
res.setHeader('Content-Type', 'application/json');
res.end(JSON.stringify({ error: e.message }));
}
}
