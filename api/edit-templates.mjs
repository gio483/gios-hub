// Diagnostic: lists the ZapCap templates available on this account
// so we can pick and pin the right caption style.
export default async function handler(req, res) {
  const key = process.env.ZAPCAP_API_KEY;
  if (!key) return res.status(500).json({ error: 'missing_key' });
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
