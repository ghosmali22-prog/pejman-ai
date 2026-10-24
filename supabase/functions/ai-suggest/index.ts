// Supabase Edge Function: ai-suggest
// Looks at a prompt image (+ the prompt text) with Google Gemini and suggests
// a title, a category and tags for the admin panel.
//
// Security:
//  • The Gemini key lives only in Supabase secrets (GEMINI_API_KEY) — never in the website.
//  • Only a signed-in admin Gmail can call it; everyone else gets 401/403.
//  • Requests are size-limited and answers are cleaned before they are returned.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY  (required)
//   GEMINI_MODEL    (optional, default "gemini-flash-latest")
//   ADMIN_EMAILS    (optional, comma-separated, default "ghosmali22@gmail.com")

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest'
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') ?? 'ghosmali22@gmail.com')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ALLOWED_ORIGINS = ['https://ghosmali22-prog.github.io', 'http://localhost:5173', 'http://localhost:4173']

const MAX_IMAGE_BASE64 = 1_500_000 // ~1.1 MB image
const MAX_PROMPT = 8_000

interface Category {
  slug: string
  name: string
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const cors = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // --- who is calling? -------------------------------------------------------
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const apikey = Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey') ?? ''
  if (!token) return json({ error: 'Not signed in' }, 401)
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey, Authorization: `Bearer ${token}` },
  })
  if (!userRes.ok) return json({ error: 'Not signed in' }, 401)
  const user = (await userRes.json()) as { email?: string }
  if (!ADMIN_EMAILS.includes(String(user.email ?? '').toLowerCase())) return json({ error: 'Forbidden' }, 403)
  if (!GEMINI_KEY) return json({ error: 'GEMINI_API_KEY secret is not set' }, 500)

  // --- input -----------------------------------------------------------------
  let input: { prompt?: string; image?: string; mimeType?: string; categories?: Category[] }
  try {
    input = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const prompt = String(input.prompt ?? '').slice(0, MAX_PROMPT)
  const image = typeof input.image === 'string' ? input.image : ''
  const mimeType = ['image/jpeg', 'image/png', 'image/webp'].includes(String(input.mimeType)) ? input.mimeType! : 'image/jpeg'
  const categories = (Array.isArray(input.categories) ? input.categories : [])
    .slice(0, 50)
    .map((c) => ({ slug: String(c.slug).slice(0, 60), name: String(c.name).slice(0, 60) }))
  if (!prompt && !image) return json({ error: 'Send an image or a prompt' }, 400)
  if (image.length > MAX_IMAGE_BASE64) return json({ error: 'Image too large' }, 413)

  const instruction = [
    'You name AI-generated images for a public prompt-library website (PEJMAN AI).',
    'Look at the image and the prompt that created it, then return JSON with:',
    '- "title": a short, catchy English title in Title Case, 2–5 words, no quotes, no emojis, no model names.',
    `- "category": exactly one slug from this list that fits best: ${categories.map((c) => `${c.slug} (${c.name})`).join(', ') || 'none'}. Use "" if nothing fits.`,
    '- "tags": 4–7 lowercase English tags (1–2 words each) describing subject, style, mood and lighting.',
  ].join('\n')

  const parts: Record<string, unknown>[] = [{ text: instruction }]
  if (image) parts.push({ inline_data: { mime_type: mimeType, data: image } })
  if (prompt) parts.push({ text: `Prompt used to create the image:\n${prompt}` })

  const gemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.6,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            category: { type: 'STRING' },
            tags: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['title', 'category', 'tags'],
        },
      },
    }),
  })
  if (!gemini.ok) {
    console.error('Gemini error', gemini.status, await gemini.text())
    return json({ error: `Gemini error ${gemini.status}` }, 502)
  }

  const data = await gemini.json()
  const text: string = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
  let out: { title?: unknown; category?: unknown; tags?: unknown }
  try {
    out = JSON.parse(text)
  } catch {
    return json({ error: 'Could not read the AI answer' }, 502)
  }

  // --- clean the answer before it reaches the panel ---------------------------
  const title = String(out.title ?? '')
    .replace(/["“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  const slugs = new Set(categories.map((c) => c.slug))
  const category = slugs.has(String(out.category)) ? String(out.category) : ''
  const tags = [
    ...new Set(
      (Array.isArray(out.tags) ? out.tags : [])
        .map((t) => String(t).toLowerCase().replace(/^#/, '').trim())
        .filter((t) => t && t.length <= 24),
    ),
  ].slice(0, 8)

  return json({ title, category, tags })
})
