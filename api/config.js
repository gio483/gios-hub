// Serves API keys to the app from Vercel's private environment variables.
// Transcription key names accepted: ELEVENLABS_API_KEY, elevenlabs, ELEVENLABS.
// Summaries key (Claude) names accepted: ANTHROPIC_API_KEY, anthropic, CLAUDE_API_KEY.

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
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.anthropic || process.env.CLAUDE_API_KEY || '';
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({ elevenLabsKey, anthropicKey, serverManaged: true }));
};
