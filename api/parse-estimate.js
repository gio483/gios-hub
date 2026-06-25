// KSH Estimate Builder — AI parse endpoint
// Takes a pasted/uploaded "ugly" estimate and returns clean structured JSON
// (buckets + allowances + project hints) for the proposal builder.
// Uses the hub's existing ANTHROPIC_API_KEY (Vercel env var).

const MODEL = "claude-sonnet-4-6";

const SYSTEM = `You convert a contractor's raw construction estimate into clean structured JSON for KSH Construction, a luxury residential GC.
Return ONLY a JSON object, no prose, matching exactly:
{
  "project": { "client": "", "project": "", "type": "", "sqft": null },
  "buckets": [ { "name": "Trade or scope name", "amount": 0 } ],
  "allowances": [ { "name": "Selection name", "amount": 0 } ],
  "contingencyPct": null,
  "notes": ""
}
Rules:
- "buckets" are construction/trade line items (demolition, framing, plumbing, electrical, drywall, etc.). Group sensibly; keep the contractor's own labels when clear.
- "allowances" are client finish selections carried as allowances (cabinetry, countertops, tile material, plumbing fixtures, appliances, lighting, flooring material, hardware). Only put items here if the source clearly marks them as allowances or finishes; otherwise treat as a bucket.
- amount = a whole-dollar number (no $ or commas).
- If a value is unknown, use null (for project fields/contingency) or omit the item.
- Do not invent line items or numbers that aren't in the source. Echo what's there, cleaned up.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const key = process.env.ANTHROPIC_API_KEY || process.env.anthropic;
  if (!key) { res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { text, fileBase64, mimeType } = body || {};

  // build the user content: text and/or a document (PDF/image)
  const content = [];
  if (fileBase64 && mimeType) {
    if (mimeType === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } });
    } else if (mimeType.startsWith("image/")) {
      content.push({ type: "image", source: { type: "base64", media_type: mimeType, data: fileBase64 } });
    }
  }
  content.push({ type: "text", text: (text && text.trim())
    ? `Here is the raw estimate to convert:\n\n${text}`
    : `Convert the attached estimate document into the JSON structure.` });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM,
        messages: [{ role: "user", content }]
      })
    });
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: "Claude API error", detail: data }); return; }
    const out = (data.content || []).map(c => c.text || "").join("").trim();
    // pull the JSON object out of the response
    const m = out.match(/\{[\s\S]*\}/);
    let parsed;
    try { parsed = JSON.parse(m ? m[0] : out); }
    catch (e) { res.status(502).json({ error: "Could not parse model output", raw: out }); return; }
    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
