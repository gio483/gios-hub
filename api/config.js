// Serves API keys to the app from Vercel's private environment variables
// so users never have to paste a key. Keys live ONLY in Vercel project settings.
// Required env var: ELEVENLABS_API_KEY (transcription). Optional: OPENAI_API_KEY (summaries).

module.exports = (req, res) => {
  const host = req.headers.host || '';
const ref = req.headers.referer || req.headers.origin || '';
const allowed = !ref || ref.includes(host) || ref.includes('.vercel.app');
if (!allowed) {
res.statusCode = 403;
res.setHeader('Content-Type', 'application/json');
return res.end(JSON.stringify({ error: 'forbidden' }));
}
res.setHeader('Cache-Control', 'no-store');
res.setHeader('Content-Type', 'application/json');
res.statusCode = 200;
res.end(JSON.stringify({
elevenLabsKey: process.env.ELEVENLABS_API_KEY || '',
openaiKey: process.env.OPENAI_API_KEY || '',
serverManaged: true
}));
};
