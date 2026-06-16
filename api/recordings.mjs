import { list } from '@vercel/blob';

export default async function handler(req, res) {
const host = req.headers.host || '';
const ref = req.headers.referer || req.headers.origin || '';
if (ref && !ref.includes(host) && !ref.includes('.vercel.app')) {
res.statusCode = 403;
res.setHeader('Content-Type', 'application/json');
return res.end(JSON.stringify({ error: 'forbidden' }));
}
try {
const { blobs } = await list({ prefix: 'recordings/' });
const recordings = (blobs || [])
.map(b => ({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt }))
.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
res.statusCode = 200;
res.setHeader('Cache-Control', 'no-store');
res.setHeader('Content-Type', 'application/json');
res.end(JSON.stringify({ recordings }));
} catch (e) {
res.statusCode = 500;
res.setHeader('Content-Type', 'application/json');
res.end(JSON.stringify({ error: e.message }));
}
}
