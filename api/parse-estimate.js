// KSH Estimate Builder — AI parse endpoint
// Takes a pasted/uploaded "ugly" estimate and returns clean structured JSON
// (buckets + allowances + project hints) for the proposal builder.
// Uses the hub's existing ANTHROPIC_API_KEY (Vercel env var).

const MODEL = "claude-sonnet-4-6";

const SYSTEM = `You convert a contractor's construction estimate into clean structured JSON for KSH Construction, a luxury residential GC. KSH estimates are cost-plus, organized by trade DIVISION.
Return ONLY a JSON object, no prose, matching exactly:
{
  "project": { "client": "", "project": "", "type": "", "sqft": null },
  "buckets": [ { "name": "Trade division name", "amount": 0 } ],
  "allowances": [ { "name": "Selection name", "amount": 0 } ],
  "markupPct": null,
  "statedTotal": null,
  "contingencyPct": null,
  "notes": ""
}
CRITICAL RULES — getting the total right matters most:
- "buckets" = EVERY priced trade-division line that adds up to the contract total (Demolition, Project Management, Rough Carpentry, Plumbing, Electrical, Drywall, Cabinetry & Hardware, etc.). Keep the document's own division names. The SUM of all bucket amounts must equal the document's printed grand total.
- Use the division's TOTAL amount for each bucket. If a division shows sub-allowances or cost detail inside it (e.g. "$64,380 cabinetry material" shown within the Cabinetry & Hardware division), that detail is ALREADY INCLUDED in the division amount — do NOT also list it under "allowances" and do NOT add it again. This double-counting is the #1 error to avoid.
- "allowances" = ONLY items the document adds ON TOP of the division subtotal as a separate additive allowance. This is rare. Do NOT put owner-provided/$0 selection items here (plumbing fixtures, electrical fixtures, tile/slab, appliances provided by homeowner/designer) — instead note them in "notes". When unsure, put a line in "buckets", never "allowances".
- "markupPct" = the cost-plus markup percent if stated (e.g. 23 or 25). This is INFORMATIONAL ONLY — the bucket amounts already include it; never instruct adding it again.
- "statedTotal" = the document's printed grand/contract total as a whole-dollar number (no $ or commas). This is the source of truth.
- amount = whole-dollar number. Unknown values = null (or omit the item). Never invent numbers; echo what's in the source, cleaned up.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const key = process.env.ANTHROPIC_API_KEY || process.env.anthropic;
  if (!key) { res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { text, fileBase64, mimeType, mode } = body || {};
  const transcribe = mode === "transcribe";

  // build the user content: text and/or a document (PDF/image)
  const content = [];
  if (fileBase64 && mimeType) {
    if (mimeType === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } });
    } else if (mimeType.startsWith("image/")) {
      content.push({ type: "image", source: { type: "base64", media_type: mimeType, data: fileBase64 } });
    }
  }
  content.push({ type: "text", text: transcribe
    ? `Transcribe this entire document to clean Markdown, verbatim. Preserve EVERY heading and paragraph in order — especially all narrative, scope-of-work, terms, exclusions, payment, warranty, and contract language that comes after the pricing/number tables. Do not summarize, shorten, or skip anything. For pricing tables you may write "[pricing table]" in place of the numbers, but reproduce ALL prose word-for-word. Output only the Markdown.`
    : (text && text.trim() ? `Here is the raw estimate to convert:\n\n${text}` : `Convert the attached estimate document into the JSON structure.`) });

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
        max_tokens: transcribe ? 16000 : 4096,
        system: transcribe ? "You are a precise document transcriber. Output the requested Markdown only, with no preamble." : SYSTEM,
        messages: [{ role: "user", content }]
      })
    });
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: "Claude API error", detail: data }); return; }
    const out = (data.content || []).map(c => c.text || "").join("").trim();
    if (transcribe) { res.status(200).json({ markdown: out }); return; }
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
