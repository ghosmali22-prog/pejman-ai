// Checks the LIVE site and database from the outside, exactly as an anonymous visitor (or an
// attacker) would. Runs after every deploy. Never writes anything that could succeed.
// Usage: node tests/live-smoke.mjs
const SITE = process.env.SITE_URL ?? 'https://pejiai.com'
const SB = process.env.VITE_SUPABASE_URL ?? 'https://icoiyuifywvtrlfagkdz.supabase.co'
const KEY = process.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_gFpwndMFKSylPYd5y-r6qA_25mm-uKq'
const H = { apikey: KEY, 'Content-Type': 'application/json', ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}) }

let pass = 0, fail = 0
const check = (good, label) => { good ? pass++ : fail++; console.log(`${good ? 'PASS' : 'FAIL'}  ${label}`) }
const denied = (r) => r.status === 401 || r.status === 403 || r.status === 404
const rest = (path, init = {}) => fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } })

// --- website
const home = await fetch(SITE + '/')
const html = await home.text()
check(home.ok, `site is up (${home.status})`)
const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? ''
check(csp.includes("default-src 'self'") && !csp.includes('unsafe-inline') && !csp.includes('unsafe-eval'), 'strict security policy is live')
check(!/sb_secret_|service_role|GOCSPX-/.test(html), 'no secret keys in the page')
const robots = await (await fetch(SITE + '/robots.txt')).text()
check(/Disallow: \/admin\//.test(robots), 'robots.txt hides /admin/')
const headers = home.headers
console.log(`info  headers: HSTS=${headers.has('strict-transport-security')} XCTO=${headers.get('x-content-type-options')} frame-ancestors=${/frame-ancestors/.test(headers.get('content-security-policy') ?? '')} (need Cloudflare)`)

// --- database: what a visitor can and can't reach
check(denied(await rest('code_items?select=code&limit=1')), 'visitor cannot read the code table')
for (const t of ['messages', 'subscribers', 'copy_events']) check(denied(await rest(`${t}?select=*&limit=1`)), `visitor cannot read ${t}`)
check(denied(await rest('rate_limits?select=*')), 'rate-limit table is not exposed')
const list = await rest('rpc/list_code_items', { method: 'POST', body: '{}' })
const items = list.ok ? await list.json() : []
check(list.ok, 'public code list works')
const premium = items.filter((i) => i.is_premium)
check(premium.every((i) => i.code === '' && JSON.stringify(i.files) === '[]' && !('demo_path' in i)), `premium items carry no code (${premium.length} checked)`)
check(denied(await rest('rpc/demo_request', { method: 'POST', body: JSON.stringify({ p_slug: 'x', p_client: 'x' }) })), 'visitor cannot call demo_request')
check(denied(await rest('rpc/submit_contact', { method: 'POST', body: JSON.stringify({ p_name: 'x', p_email: 'x', p_project_type: '', p_work_mode: '', p_budget: '', p_message: 'x', p_client: 'x' }) })), 'visitor cannot call submit_contact')
check(denied(await rest('rpc/admin_daily_copies', { method: 'POST', body: '{"p_days":7}' })), 'visitor cannot call the admin chart')
for (const t of ['prompts', 'categories', 'code_items', 'site_settings']) {
  const r = await rest(t, { method: 'PATCH', body: '{"slug":"x"}', headers: { Prefer: 'return=minimal' } })
  const r2 = await rest(`${t}?id=eq.00000000-0000-0000-0000-000000000000`, { method: 'DELETE' })
  check(denied(r) && denied(r2), `visitor cannot change or delete ${t}`)
}
if (process.env.AFTER_006 !== '0') {
  // Invalid email: even if inserting were allowed, the database would refuse the row.
  const r = await rest('messages', { method: 'POST', body: JSON.stringify({ name: 'smoke', email: 'not-an-email', message: 'x' }) })
  const err = r.ok ? {} : await r.json().catch(() => ({}))
  check(denied(r) && err.code === '42501', 'visitor cannot write messages directly')
}

// --- storage
for (const bucket of ['images', 'videos', 'code', 'code-videos', 'demos']) {
  const up = await fetch(`${SB}/storage/v1/object/${bucket}/smoke-${Date.now()}.txt`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'text/plain' }, body: 'x' })
  check(!up.ok, `visitor cannot upload to ${bucket} (${up.status})`)
}
const pub = await fetch(`${SB}/storage/v1/object/public/demos/d/anything.html`)
check(!pub.ok, 'demos bucket has no public links')

// --- demo links
const fn = (body, origin = SITE) => fetch(`${SB}/functions/v1/demo-url`, { method: 'POST', headers: { ...H, Origin: origin }, body: JSON.stringify(body) })
check((await fn({ slug: 'x' }, 'https://evil.example')).status === 403, 'demo-url refuses other websites')
check((await fn({ slug: 'does-not-exist-smoke' })).status === 404, 'demo-url: no link for unknown items')
check((await fn({ slug: '../../etc' })).status === 400, 'demo-url rejects bad input')
const withDemo = items.find((i) => i.has_demo)
if (withDemo) {
  const r = await fn({ slug: withDemo.slug })
  const { url, expiresIn } = r.ok ? await r.json() : {}
  check(r.ok && url && expiresIn <= 300, `signed demo link issued, valid ${expiresIn}s`)
  const token = new URL(url).searchParams.get('token') ?? ''
  const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString() || '{}')
  check(claims.exp && claims.exp - Math.floor(Date.now() / 1000) <= 300, `link expires within 5 minutes (exp in ${claims.exp - Math.floor(Date.now() / 1000)}s)`)
  const doc = await fetch(url)
  const body = await doc.text()
  check(doc.ok && body.includes('Preview · pejiai.com'), 'demo file is the watermarked build')
  const tampered = new URL(url)
  tampered.searchParams.set('token', token.slice(0, -4) + 'AAAA')
  check(!(await fetch(tampered)).ok, 'a tampered link does not work')
} else console.log('info  no premium item with a live demo yet — signed-link checks skipped')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
