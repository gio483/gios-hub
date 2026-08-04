// Polls ZapCap for a task's status; returns downloadUrl when the edit is done.
export default async function handler(req, res) {
  const key = process.env.ZAPCAP_API_KEY;
  if (!key) return res.status(500).json({ error: 'missing_key' });
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
