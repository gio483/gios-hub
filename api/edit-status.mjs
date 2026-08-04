// Polls ZapCap for a task's status; returns downloadUrl when the edit is done.
// Also serves a template list at /api/edit-status?templates=1 (folded in here to
// stay under the Hobby plan's 12-serverless-function limit).
export default async function handler(req, res) {
  const key = process.env.ZAPCAP_API_KEY;
  if (!key) return res.status(500).json({ error: 'missing_key' });

  // Diagnostic mode: list available caption templates
  if (req.query && req.query.templates) {
    try {
      const r = await fetch('https://api.zapcap.ai/templates', { headers: { 'x-api-key': key } });
      const text = await r.text();
      let j;
      try { j = JSON.parse(text); } catch (e) { j = { raw: text.slice(0, 2000) }; }
      return res.status(200).json({ ok: r.ok, status: r.status, templates: j });
    } catch (e) {
      return res.status(500).json({ error: String(e && e.message || e) });
    }
  }

  const { videoId, taskId } = req.query || {};
  if (!videoId || !taskId) return res.status(400).json({ error: 'videoId and taskId required' });
  try {
    const r = await fetch(`https://api.zapcap.ai/videos/${encodeURIComponent(videoId)}/task/${encodeURIComponent(taskId)}`, {
      headers: { 'x-api-key': key },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ error: 'zapcap_status_failed', detail: JSON.stringify(j).slice(0, 300) });
    return res.status(200).json({
      status: j.status || 'unknown',
      downloadUrl: j.downloadUrl || j.download_url || null,
      error: j.error || null,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
}
