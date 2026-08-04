// Sends an uploaded raw clip to ZapCap for automated editing:
// word-by-word captions with SDLR-colored keyword emphasis, b-roll, auto-approve.
const ZAP = 'https://api.zapcap.ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.ZAPCAP_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: 'missing_key',
      message: 'Add ZAPCAP_API_KEY in Vercel → Settings → Environment Variables, then redeploy.',
    });
  }
  const { blobUrl, templateId: chosenTemplate } = req.body || {};
  if (!blobUrl) return res.status(400).json({ error: 'blobUrl required' });

  try {
    // 1. Register the video with ZapCap by URL
    const vr = await fetch(ZAP + '/videos/url', {
      method: 'POST',
      headers: { 'x-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ url: blobUrl }),
    });
    if (!vr.ok) return res.status(502).json({ error: 'zapcap_upload_failed', detail: (await vr.text()).slice(0, 300) });
    const vj = await vr.json();
    const videoId = vj.id || vj.videoId;
    if (!videoId) return res.status(502).json({ error: 'zapcap_no_video_id', detail: JSON.stringify(vj).slice(0, 300) });

    // 2. Template: user's chosen style → env override → "Hormozi 1" default
    const templateId =
      chosenTemplate ||
      process.env.ZAPCAP_TEMPLATE_ID ||
      'a51c5222-47a7-4c37-b052-7b9853d66bf6'; // Hormozi 1 (animated + highlighted)

    // 3. Create the editing task — SDLR house style
    const styled = {
      templateId,
      autoApprove: true,
      language: 'en',
      transcribeSettings: { broll: { brollPercent: 30 } },
      renderOptions: {
        subsOptions: {
          emoji: false,
          emojiAnimation: false,
          emphasizeKeywords: true, // the highlighted-keyword look
          animation: true,
          punctuation: false,
          displayWords: 3,
        },
        styleOptions: {
          top: 65,
          fontUppercase: true,
          fontSize: 46,
          fontWeight: 900,
          fontColor: '#ffffff',
        },
        highlightOptions: {
          randomColourOne: '#c8a869', // SDLR gold
          randomColourTwo: '#9fb56a', // SDLR green
          randomColourThree: '#ffdf9e', // warm cream
        },
      },
    };

    let cr = await fetch(`${ZAP}/videos/${videoId}/task`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify(styled),
    });
    if (!cr.ok) {
      // Fallback: minimal task in case any styled field is rejected
      cr = await fetch(`${ZAP}/videos/${videoId}/task`, {
        method: 'POST',
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ templateId, autoApprove: true, language: 'en' }),
      });
    }
    if (!cr.ok) return res.status(502).json({ error: 'zapcap_task_failed', detail: (await cr.text()).slice(0, 300) });
    const tj = await cr.json();
    const taskId = tj.taskId || tj.id;
    if (!taskId) return res.status(502).json({ error: 'zapcap_no_task_id', detail: JSON.stringify(tj).slice(0, 300) });

    return res.status(200).json({ videoId, taskId });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
}
