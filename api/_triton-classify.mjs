// AI-assisted exercise classification for Triton Pitching Lab.
// Reached through POST /api/lifeos?ns=triton with { action: 'classify', name, description, ... }.
// Claude returns a classification that must match CLASSIFICATION_SCHEMA (structured outputs),
// so the app always gets a usable record. The app treats it as an interpretation
// (confidence + explanation + questions), never as measured data.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';

function schema({ muscles, patterns, categories, equipment }) {
  const muscleList = { type: 'array', items: { type: 'string', enum: muscles } };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['pattern', 'category', 'primary', 'secondary', 'stabilizers', 'equipment', 'unilateral', 'axial', 'explosive',
      'compound', 'impact', 'contraction', 'rom', 'stability', 'bwLoad', 'loadComparable', 'confidence', 'explanation', 'questions'],
    properties: {
      pattern: { type: 'string', enum: patterns },
      category: { type: 'string', enum: categories },
      primary: muscleList,
      secondary: muscleList,
      stabilizers: muscleList,
      equipment: { type: 'string', enum: equipment },
      unilateral: { type: 'boolean' },
      axial: { type: 'boolean' },
      explosive: { type: 'boolean' },
      compound: { type: 'boolean' },
      impact: { type: 'string', enum: ['none', 'low', 'high'] },
      contraction: { type: 'string', enum: ['dynamic', 'concentric', 'eccentric', 'isometric', 'stretch-shortening'] },
      rom: { type: 'string', enum: ['full', 'partial'] },
      stability: { type: 'string', enum: ['stable', 'unstable'] },
      bwLoad: { type: 'number' },
      loadComparable: { type: 'boolean' },
      confidence: { type: 'number' },
      explanation: { type: 'string' },
      questions: { type: 'array', items: { type: 'string' } },
    },
  };
}

const SYSTEM = `You classify strength & conditioning exercises for a college baseball pitcher's training log.
The classification is used only to COUNT SETS per muscle group (direct = primary, indirect = secondary) and to flag exposures (axial loading, explosive intent, impact). It is not an activation measurement.

Rules:
- primary: muscles the exercise is chosen to train (usually 1-3). secondary: meaningful contributors. stabilizers: hold position but are not trained through range.
- Use only the muscle ids given. Do not invent numbers or percentages of activation.
- unilateral: true when one limb works at a time (single-leg, single-arm, split stance, alternating).
- axial: true when external load compresses/shears the spine (bar on back or front, loaded hip hinge, heavy carry).
- explosive: true only when the movement is done with maximal-velocity intent (jumps, throws, Olympic lifts, "explosive" in the name).
- impact: "high" for depth drops, depth jumps, bounds and broad jumps; "low" for low-amplitude hops, box jumps onto a box, jump rope; otherwise "none".
- bwLoad: fraction of bodyweight counted as external load for bodyweight exercises (pull-up/chin-up/dip 1.0, push-up 0.64, otherwise 0). 0 for loaded exercises.
- loadComparable: false for pneumatic (Keiser) or flywheel resistance whose displayed number is not comparable to free-weight pounds.
- confidence: 0 to 1, how sure you are about the movement itself. Below 0.6 when the name is ambiguous.
- explanation: 1-3 short sentences saying how you read the name.
- questions: 0-2 short clarifying questions for the athlete when the name is ambiguous; otherwise [].`;

export async function classify(body) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) return { status: 503, json: { error: 'AI classification is not configured' } };
  const name = String(body.name || '').slice(0, 120).trim();
  const description = String(body.description || '').slice(0, 400).trim();
  if (!name) return { status: 400, json: { error: 'name required' } };
  const lists = {
    muscles: (body.muscles || []).map(String).slice(0, 40),
    patterns: (body.patterns || []).map(String).slice(0, 40),
    categories: (body.categories || []).map(String).slice(0, 20),
    equipment: (body.equipment || []).map(String).slice(0, 30),
  };
  if (!lists.muscles.length || !lists.patterns.length) return { status: 400, json: { error: 'muscle and pattern lists required' } };

  const client = new Anthropic({ apiKey });
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4096,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: schema(lists) } },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Exercise name: ${name}${description ? `\nAthlete's description: ${description}` : ''}` }],
  });
  if (response.stop_reason === 'refusal') return { status: 422, json: { error: 'declined' } };
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  let classification;
  try { classification = JSON.parse(text); } catch { return { status: 502, json: { error: 'unreadable classification' } }; }
  return { status: 200, json: { classification, model: response.model } };
}
