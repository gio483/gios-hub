// Live recipe generator for the Kitchen dashboard.
// Takes the ingredients you have + a few filters, asks Claude for a handful of
// simple, doable recipes, and returns them as structured JSON.
//
// The Anthropic API key lives ONLY in Vercel's Environment Variables
// (Settings -> Environment Variables) under ANTHROPIC_API_KEY. It never reaches
// the browser — the page calls THIS endpoint, and this endpoint calls Claude.
//
// To change the model, edit MODEL below.

const MODEL = 'claude-haiku-4-5-20251001';
const FALLBACK_MODELS = ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'];

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  // Basic guard: block other websites from using this endpoint.
  const host = req.headers.host || '';
  const ref = req.headers.referer || req.headers.origin || '';
  if (ref && !ref.includes(host) && !ref.includes('.vercel.app')) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'forbidden' }));
  }

  const key =
    process.env.ANTHROPIC_API_KEY || process.env.anthropic || process.env.CLAUDE_API_KEY || '';
  if (!key) {
    res.statusCode = 500;
    return res.end(
      JSON.stringify({
        error:
          'No Claude API key configured. Add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables, then redeploy.',
      })
    );
  }

  // Read JSON body (works whether or not the runtime pre-parses it).
  let body = req.body;
  if (!body || typeof body === 'string') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString() || (typeof body === 'string' ? body : '');
    try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
  }

  const ingredients = Array.isArray(body.ingredients)
    ? body.ingredients.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const cuisine = String(body.cuisine || 'Any');
  const highProtein = !!body.highProtein;
  const quick = !!body.quick;

  if (ingredients.length === 0) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Add at least one ingredient.' }));
  }

  const filters = [];
  if (cuisine && cuisine !== 'Any') filters.push(`Lean toward ${cuisine} flavors.`);
  if (highProtein) filters.push('Prioritize high-protein results (aim 35g+ per serving) and show the protein estimate.');
  if (quick) filters.push('Every recipe must be doable in 20 minutes or less.');

  const system = `You are Gio's personal home cook. Gio is a confident beginner in San Diego cooking in a normal apartment kitchen. His equipment: stainless skillet, saucepan, Dutch oven, air fryer, blender, KitchenAid mixer. No smoker, no sous vide.

Given the ingredients he ALREADY HAS, suggest 3 simple, genuinely doable meals (sometimes scrappy is fine — eggs, cheese and white bread should still get a real answer). Rules:
- Build mostly around what he has. You may assume basic pantry staples are on hand (salt, pepper, oil, butter, garlic/onion powder, common spices, flour). Anything beyond his listed items + basic staples goes in "need".
- Keep steps short, numbered, and in cooking order. Beginner-friendly, plain English.
- Always include safe internal temps when relevant (chicken 165F, ground beef 160F, etc.).
- difficulty is 1 (easy) to 5 (hard). time_minutes is a realistic total.
${filters.length ? '- Extra constraints: ' + filters.join(' ') : ''}

Respond with ONLY a valid JSON object, no markdown, no commentary, in exactly this shape:
{"recipes":[{"name":"string","blurb":"one short appetizing sentence","cuisine":"string","time_minutes":number,"difficulty":number,"protein_g":number_or_null,"uses":["ingredients he has that this uses"],"need":["anything extra to grab, [] if none"],"steps":["step 1","step 2"]}]}`;

  const userMsg = `Ingredients I have: ${ingredients.join(', ')}.`;

  async function callClaude(model) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    return r;
  }

  try {
    let r = await callClaude(MODEL);
    // If the primary model name isn't available on this account, try fallbacks.
    if (!r.ok && (r.status === 404 || r.status === 400)) {
      for (const m of FALLBACK_MODELS) {
        const rr = await callClaude(m);
        if (rr.ok) { r = rr; break; }
      }
    }

    if (!r.ok) {
      const errText = await r.text();
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: 'Claude API error', detail: errText.slice(0, 600) }));
    }

    const data = await r.json();
    let text = (data.content || []).map((b) => b.text || '').join('').trim();

    // Strip code fences if the model added them.
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    // Grab the outermost JSON object if there's stray text.
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first > 0 || last < text.length - 1) text = text.slice(first, last + 1);

    let parsed;
    try { parsed = JSON.parse(text); }
    catch {
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: 'Could not parse recipes. Try again.', detail: text.slice(0, 400) }));
    }

    const recipes = Array.isArray(parsed.recipes) ? parsed.recipes : [];
    res.statusCode = 200;
    return res.end(JSON.stringify({ recipes }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'Server error', detail: String(e).slice(0, 300) }));
  }
}
