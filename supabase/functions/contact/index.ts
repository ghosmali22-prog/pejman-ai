// Supabase Edge Function: contact
// Receives the website's contact form and saves it to public.messages.
//
// Security:
//  • Honeypot: a hidden "company" field people never see. Bots fill it → we answer "ok" and drop it.
//  • Cloudflare Turnstile: checked here whenever the TURNSTILE_SECRET_KEY secret is set.
//  • Every field is checked again on the server (length, email format), whatever the browser sent.
//  • public.submit_contact() (service role only) rate-limits: 5 messages per visitor per hour,
//    200 per day in total. The visitor's IP is stored only as a hash.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   TURNSTILE_SECRET_KEY  (optional until you set up Turnstile)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET_KEY') ?? ''
const ALLOWED_ORIGINS = ['https://pejiai.com', 'https://www.pejiai.com', 'http://localhost:5173', 'http://localhost:4173']

const LIMITS = { name: 120, email: 200, project_type: 60, work_mode: 60, budget: 60, message: 4000 } as const
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const cors = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: 'Forbidden' }, 403)
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Not configured' }, 500)
  if (Number(req.headers.get('content-length') ?? 0) > 20_000) return json({ error: 'Too large' }, 413)

  let input: Record<string, unknown>
  try {
    input = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  // Honeypot filled → pretend it worked, save nothing.
  if (String(input.company ?? '').trim()) return json({ ok: true })

  const field = (k: keyof typeof LIMITS) => String(input[k] ?? '').trim()
  const data = Object.fromEntries((Object.keys(LIMITS) as (keyof typeof LIMITS)[]).map((k) => [k, field(k)])) as Record<
    keyof typeof LIMITS,
    string
  >
  for (const [k, max] of Object.entries(LIMITS)) {
    if (data[k as keyof typeof LIMITS].length > max) return json({ error: `${k} is too long` }, 400)
  }
  if (!data.name || !data.message) return json({ error: 'Name and message are required' }, 400)
  if (!EMAIL.test(data.email)) return json({ error: 'Invalid email' }, 400)

  const ip = clientIp(req)
  if (TURNSTILE_SECRET) {
    const form = new FormData()
    form.append('secret', TURNSTILE_SECRET)
    form.append('response', String(input.turnstileToken ?? ''))
    if (ip !== 'unknown') form.append('remoteip', ip)
    const verdict = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
      .then((r) => r.json() as Promise<{ success?: boolean }>)
      .catch(() => ({ success: false }))
    if (!verdict.success) return json({ error: 'Human check failed' }, 403)
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_contact`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_name: data.name,
      p_email: data.email,
      p_project_type: data.project_type,
      p_work_mode: data.work_mode,
      p_budget: data.budget,
      p_message: data.message,
      p_client: await sha256(ip),
    }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { code?: string }
    if (err.code === 'P0429') return json({ error: 'Too many messages, please try again later' }, 429)
    if (err.code === '23514') return json({ error: 'Please check the form' }, 400)
    return json({ error: 'Could not send' }, 502)
  }
  return json({ ok: true })
})
