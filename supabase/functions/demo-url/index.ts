// Supabase Edge Function: demo-url
// Gives the website a short-lived link to a premium item's protected live demo.
//
// Security:
//  • Demo files live in the PRIVATE "demos" bucket: they have no public URL at all.
//  • public.demo_request() (callable only with the service role, i.e. from here) checks that the
//    item is published, premium and has its demo switched on, and rate-limits each visitor
//    (30 links per hour per IP, stored only as a hash).
//  • The link is signed by Supabase Storage and stops working after LINK_SECONDS.
//  • The original source code is never touched here: only the separate, obfuscated demo build.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const LINK_SECONDS = 120
const ALLOWED_ORIGINS = ['https://pejiai.com', 'https://www.pejiai.com', 'http://localhost:5173', 'http://localhost:4173']

async function clientKey(req: Request): Promise<string> {
  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
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
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: 'Forbidden' }, 403)
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Not configured' }, 500)

  let slug = ''
  try {
    slug = String((await req.json())?.slug ?? '')
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 140) return json({ error: 'Bad slug' }, 400)

  const auth = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
  const check = await fetch(`${SUPABASE_URL}/rest/v1/rpc/demo_request`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ p_slug: slug, p_client: await clientKey(req) }),
  })
  if (!check.ok) {
    const err = (await check.json().catch(() => ({}))) as { code?: string }
    return err.code === 'P0429' ? json({ error: 'Too many requests' }, 429) : json({ error: 'Unavailable' }, 502)
  }
  const path = (await check.json()) as string | null
  if (!path) return json({ error: 'No demo' }, 404)

  const signed = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/demos/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ expiresIn: LINK_SECONDS }),
  })
  if (!signed.ok) return json({ error: 'No demo' }, 404)
  const { signedURL } = (await signed.json()) as { signedURL: string }
  return json({ url: `${SUPABASE_URL}/storage/v1${signedURL}`, expiresIn: LINK_SECONDS })
})
