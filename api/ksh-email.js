// KSH Meeting Recorder — /api/ksh-email
// Vercel serverless function: sends KSH-branded review email via Resend
//
// NOTE on FROM address:
// Until shiftvisionmedia.com is verified in Resend (Settings → Domains),
// FROM is set to onboarding@resend.dev (Resend's shared test domain).
// Once DNS records are added, set EMAIL_FROM env var to:
//   KSH Meeting Recorder <meetings@shiftvisionmedia.com>

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { meetingName, duration, date, filename, transcript, summary } = req.body || {};

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return res.status(500).json({ error: 'Server misconfigured — missing RESEND_API_KEY' });
  }

  const reviewTo = (process.env.EMAIL_REVIEW_TO || 'gio@shiftvisionmedia.com,media@kshconstruction.com')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  const fromAddress = process.env.EMAIL_FROM || 'KSH Meetings <onboarding@resend.dev>';

  const name = meetingName || 'Meeting';

  function mdToHtml(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/## (.+)/g, '<h2 style="color:#1B5E8A;font-size:17px;font-weight:700;margin:24px 0 8px;">$1</h2>')
      .replace(/### (.+)/g, '<h3 style="color:#1B5E8A;font-size:14px;font-weight:600;margin:18px 0 6px;text-transform:uppercase;letter-spacing:0.5px;">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/- \[ \] (.+)/g, '<div style="margin:4px 0;">☐ $1</div>')
      .replace(/- (.+)/g, '<div style="margin:4px 0 4px 12px;">• $1</div>')
      .replace(/---/g, '<hr style="border:none;border-top:1px solid #eee;margin:20px 0;">')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p style="margin:0 0 8px;">')
      .replace(/\n/g, '<br>');
  }

  const summaryHtml = mdToHtml(summary);

  const transcriptPreview = (transcript || '').length > 3000
    ? transcript.slice(0, 3000) + '\n\n[Transcript truncated — full version in recording file]'
    : (transcript || 'No transcript available.');

  const transcriptHtml = transcriptPreview
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#1B5E8A 0%,#134567 100%);padding:28px 36px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#3493CF;margin-bottom:6px;">KSH Construction</div>
      <div style="font-size:20px;font-weight:700;color:white;margin-bottom:4px;">Meeting Summary Ready for Review</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.55);">Review before forwarding to meeting attendees</div>
    </div>

    <div style="padding:20px 36px;border-bottom:1px solid #eef2f7;background:#fafbfd;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:6px 0;color:#888;width:90px;">Meeting</td>
          <td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${name}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#888;">Date</td>
          <td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${date || '—'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#888;">Duration</td>
          <td style="padding:6px 0;font-weight:600;color:#1a1a1a;">${duration || '—'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#888;">File</td>
          <td style="padding:6px 0;font-weight:600;color:#1a1a1a;font-size:12px;">${filename || '—'}</td>
        </tr>
      </table>
    </div>

    <div style="margin:20px 36px 0;padding:14px 18px;background:#fff8e1;border:1px solid #ffe082;border-radius:10px;font-size:13px;color:#5d4037;line-height:1.6;">
      📋 <strong>Action required:</strong> Review this auto-generated summary for accuracy, then forward to meeting attendees. Correct any names, figures, or technical details as needed.
    </div>

    <div style="padding:24px 36px 0;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#3493CF;margin-bottom:12px;">AI-Generated Summary</div>
      <div style="font-size:14px;line-height:1.8;color:#333;">${summaryHtml}</div>
    </div>

    <div style="padding:20px 36px 28px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#3493CF;margin-bottom:12px;">Full Transcript</div>
      <div style="background:#f8fafb;border:1px solid #e4eaf0;border-radius:10px;padding:18px;font-size:13px;line-height:1.8;color:#444;white-space:pre-wrap;font-family:'Courier New',monospace;max-height:320px;overflow:hidden;">
${transcriptHtml}
      </div>
    </div>

    <div style="background:#f0f4f8;padding:18px 36px;border-top:1px solid #e4eaf0;text-align:center;">
      <div style="font-size:11px;color:#aaa;line-height:1.7;">
        Automatically generated by <strong style="color:#1B5E8A;">KSH Meeting Recorder</strong><br>
        Transcription: ElevenLabs Scribe · Summary: Claude AI · Delivery: Resend
      </div>
    </div>

  </div>
</body>
</html>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: reviewTo,
        subject: `📋 KSH Meeting Summary — ${name} (${date || 'Today'})`,
        html,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Resend error:', response.status, errText);
      return res.status(502).json({ error: 'Email delivery failed', detail: errText });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, id: data.id });

  } catch (err) {
    console.error('Email error:', err);
    return res.status(500).json({ error: err.message });
  }
};
