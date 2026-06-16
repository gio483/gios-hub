// Serves API keys to the app from Vercel's private environment variables.
// Transcription key names accepted: ELEVENLABS_API_KEY, elevenlabs, ELEVENLABS.
// Optional summaries key: OPENAI_API_KEY or openai.

module.exports = (req, res) => {
  const host = req.headers.host || '';
  const ref = req.headers.referer || req.headers.origin || '';
  const allowed = !ref || ref.includes(host) || ref.includes('.vercel.app');
  if (!allowed) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'forbidden' }));
  }
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY || process.env.elevenlabs || process.env.ELEVENLABS || '';
  const openaiKey = process.env.OPENAI_API_KEY || process.env.openai || '';
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({ elevenLabsKey, openaiKey, serverManaged: true }));
};
