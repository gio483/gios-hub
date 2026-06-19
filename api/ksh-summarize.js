// KSH Meeting Recorder — /api/ksh-summarize
// Vercel serverless function: generates KSH-formatted meeting summary via Claude

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript, meetingName, duration, date } = req.body || {};

  if (!transcript) {
    return res.status(400).json({ error: 'transcript is required' });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.anthropic || process.env.CLAUDE_API_KEY;
  if (!anthropicKey) {
    return res.status(500).json({ error: 'Server misconfigured — missing ANTHROPIC_API_KEY' });
  }

  const name = meetingName || 'Meeting';

  const prompt = `You are a professional construction project note-taker for KSH Construction, a high-end general contractor in San Diego.

Based on the meeting transcript below, generate a concise, professional meeting summary in Markdown. Follow this exact structure:

## Meeting Summary — ${name}
**Date:** ${date || 'N/A'}
**Duration:** ${duration || 'N/A'}

### Attendees
List each person mentioned by name. If unknown, write "See transcript."

### Key Discussion Points
Write 3–8 bullet points covering the main topics. Focus on construction-specific details: project scope, timelines, materials, site conditions, subcontractors.

### Decisions Made
List any decisions or agreements reached. If none were made, write "No formal decisions recorded."

### Action Items
- [ ] Task description — Owner (if mentioned) — Due date (if mentioned)

List every specific action item, task, or commitment mentioned.

### Follow-Up Items
Anything requiring follow-up, clarification, or a future meeting.

---
*Transcribed and summarized by KSH Construction AI Meeting System*

Guidelines:
- Keep language professional and direct
- Use construction industry terminology appropriately
- If the transcript is unclear or noisy, note that in the summary
- Do NOT invent details not present in the transcript
- Maximum 600 words for the summary body

---
TRANSCRIPT:
${transcript}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API error:', response.status, errText);
      return res.status(502).json({ error: 'AI summarization failed', detail: errText });
    }

    const data = await response.json();
    const summary = data.content?.[0]?.text || '';

    return res.status(200).json({ summary });

  } catch (err) {
    console.error('Summarize error:', err);
    return res.status(500).json({ error: err.message });
  }
};
