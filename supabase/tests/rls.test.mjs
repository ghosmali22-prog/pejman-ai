import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

// Runs the migration in an in-memory Postgres (PGlite) with small stand-ins for Supabase's
// auth and storage schemas, then checks every Row Level Security rule as visitor / stranger / admin.
// Usage: npm run test:db
const MIGRATION = new URL('../migrations/001_init.sql', import.meta.url)
const LATER = ['002_videos.sql', '003_any_video_format.sql', '004_code_items.sql', '005_security_and_demos.sql', '006_close_direct_inserts.sql'].map((f) => new URL(`../migrations/${f}`, import.meta.url))
const db = new PGlite()
const stub = `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create publication supabase_realtime;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.jwt() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated; grant all on storage.objects to anon, authenticated;
grant usage on schema public to anon, authenticated;
`
await db.exec(stub)
await db.exec(readFileSync(MIGRATION, 'utf8'))
await db.exec(readFileSync(MIGRATION, 'utf8')) // must be safe to run twice
for (const m of LATER) {
  await db.exec(readFileSync(m, 'utf8'))
  await db.exec(readFileSync(m, 'utf8'))
}
// Re-running 005 after 006 must not reopen direct inserts.
await db.exec(readFileSync(LATER[3], 'utf8'))
console.log('migration ran twice OK')

let pass = 0, fail = 0
const google = { provider: 'google', providers: ['google'] }
const CLAIMS = {
  anon: {},
  service: {},
  admin: { email: 'GhosMali22@gmail.com', app_metadata: google },
  // Same address, but signed up with a password: must NOT be admin.
  fakeadmin: { email: 'ghosmali22@gmail.com', app_metadata: { provider: 'email', providers: ['email'] } },
  stranger: { email: 'stranger@gmail.com', app_metadata: google },
}
let ip = '203.0.113.1' // visitor IP for the rate limits; tests change it
const check = (good, label) => { good ? pass++ : fail++; console.log(`${good ? 'PASS' : 'FAIL'}  ${label}`) }
async function as(who, sql, expectOk, label) {
  const claims = JSON.stringify(CLAIMS[who] ?? {})
  const role = who === 'anon' ? 'anon' : who === 'service' ? 'service_role' : 'authenticated'
  let ok = true, out
  try {
    await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); select set_config('request.headers', '${JSON.stringify({ 'x-forwarded-for': ip })}', false); set role ${role};`)
    out = await db.query(sql)
  } catch (e) { ok = false; out = e.message }
  await db.exec('reset role;')
  const good = ok === expectOk
  good ? pass++ : fail++
  console.log(`${good ? 'PASS' : 'FAIL'}  [${who}] ${label}${ok ? ' → rows: ' + JSON.stringify(out.rows).slice(0, 120) : ' → error: ' + String(out).slice(0, 90)}`)
  return out
}
const n = async (who, sql) => (await as(who, sql, true, sql)).rows

await as('admin', `insert into prompts (slug,title,category,model,prompt,published) values ('pub-one','Published','portrait','MJ','p1',true),('draft-one','Draft','product','MJ','p2',false) returning slug`, true, 'admin can insert prompts')
await as('stranger', `insert into prompts (slug,title,prompt) values ('x','X','x')`, false, 'other Google account cannot insert prompts')
await as('anon', `insert into prompts (slug,title,prompt) values ('y','Y','y')`, false, 'visitor cannot insert prompts')
const vis = await as('anon', `select slug from prompts order by slug`, true, 'visitor sees only published prompts')
if (vis.rows.length !== 1) { fail++; console.log('FAIL  draft visible to visitor!') }
await as('stranger', `update prompts set title='hacked' where slug='pub-one' returning slug`, true, 'stranger update (should affect 0 rows)')
const t = await db.query(`select title from prompts where slug='pub-one'`)
console.log(t.rows[0].title === 'Published' ? 'PASS  title unchanged after stranger update' : 'FAIL  stranger changed a prompt'); t.rows[0].title === 'Published' ? pass++ : fail++
await as('anon', `delete from categories where slug='3d' returning slug`, false, 'visitor cannot delete categories')
await as('anon', `insert into messages (name,email,message,project_type,work_mode) values ('Ann','ann@x.com','hi','Websites','Remote')`, false, 'visitor cannot write messages directly (only via the contact function)')
await as('anon', `select submit_contact('Ann','ann@x.com','Websites','Remote','','hi','k1')`, false, 'visitor cannot call submit_contact directly')
await as('service', `select submit_contact('Ann','ann@x.com','Websites','Remote','','hi','k1')`, true, 'contact function can save a message')
await as('service', `select submit_contact('Ann','not-an-email','','','','hi','k1')`, false, 'invalid email rejected')
const msgs = await as('anon', `select * from messages`, false, 'visitor cannot read messages')
await as('stranger', `select count(*) from messages`, true, 'stranger sees 0 messages')
await as('admin', `update messages set is_read = true returning name, is_read`, true, 'admin can mark messages read')
await as('anon', `insert into subscribers (email) values ('fan@x.com')`, false, 'visitor cannot insert subscribers directly')
await as('anon', `select subscribe_newsletter('Fan@X.com ')`, true, 'visitor can subscribe through the function')
await as('anon', `select subscribe_newsletter('fan@x.com')`, true, 'duplicate subscribe is accepted quietly')
await as('anon', `select subscribe_newsletter('nope')`, false, 'subscribe rejects a bad email')
await as('anon', `select * from subscribers`, false, 'visitor cannot read subscribers')
await as('anon', `select data from site_settings`, true, 'visitor can read site settings')
await as('anon', `update site_settings set data='{"x":1}' returning id`, false, 'visitor cannot change settings')
await as('admin', `update site_settings set data='{"hero":{"headline":"Hi"}}' returning data`, true, 'admin can change settings')
const ids = (await db.query(`select id, slug from prompts`)).rows
const pub = ids.find((r) => r.slug === 'pub-one').id, draft = ids.find((r) => r.slug === 'draft-one').id
await as('anon', `select increment_copy_count('${pub}')`, true, 'visitor copy +1 on published')
await as('anon', `select increment_copy_count('${draft}')`, true, 'visitor copy on draft (no effect)')
const cc = (await db.query(`select slug, copy_count from prompts order by slug`)).rows
console.log(JSON.stringify(cc))
const okc = cc.find((r) => r.slug === 'pub-one').copy_count === 1 && cc.find((r) => r.slug === 'draft-one').copy_count === 0
console.log(okc ? 'PASS  copy counts correct' : 'FAIL  copy counts wrong'); okc ? pass++ : fail++
await as('anon', `update prompts set copy_count = 9999 where slug='pub-one' returning slug`, false, 'visitor cannot set copy_count directly')
await as('anon', `select * from copy_events`, false, 'visitor cannot read copy events')
const daily = await as('admin', `select * from admin_daily_copies(7)`, true, 'admin daily copies chart')
await as('stranger', `select sum(copies) from admin_daily_copies(7)`, true, 'stranger daily copies (should be 0)')
await as('anon', `insert into storage.objects (bucket_id,name) values ('images','a.webp')`, false, 'visitor cannot upload images')
await as('stranger', `insert into storage.objects (bucket_id,name) values ('images','a.webp')`, false, 'stranger cannot upload images')
await as('admin', `insert into storage.objects (bucket_id,name) values ('images','a.webp') returning name`, true, 'admin can upload images')
await as('anon', `select name from storage.objects`, true, 'visitor lists bucket (should be 0 rows)')
await as('admin', `update categories set slug='portraits' where slug='portrait' returning slug`, true, 'admin renames category slug')
console.log('cascade →', JSON.stringify((await db.query(`select slug, category from prompts where slug='pub-one'`)).rows))
await as('admin', `delete from categories where slug='product' returning slug`, true, 'admin deletes category')
console.log('set null →', JSON.stringify((await db.query(`select slug, category from prompts where slug='draft-one'`)).rows))
// ---- code_items
await as('admin', `insert into code_items (slug,title,language,code,files,is_published,is_premium) values
  ('free-one','Free','html','<h1>free</h1>','[{"name":"index.html","language":"html","content":"<h1>free</h1>"}]',true,false),
  ('paid-one','Paid','tsx','SECRET_CODE','[{"name":"App.tsx","language":"tsx","content":"SECRET_FILE"}]',true,true),
  ('draft-code','Draft','css','a{}','[]',false,false) returning slug`, true, 'admin can insert code items')
await as('stranger', `insert into code_items (slug,title) values ('x','X')`, false, 'other Google account cannot insert code')
await as('anon', `insert into code_items (slug,title) values ('y','Y')`, false, 'visitor cannot insert code')
await as('anon', `select slug from code_items`, false, 'visitor cannot read the code table directly')
const codeVis = await as('stranger', `select slug from code_items order by slug`, true, 'stranger reads code table directly')
const visSlugs = codeVis.rows.map((r) => r.slug).join(',')
console.log(visSlugs === 'free-one' ? 'PASS  table shows visitor only the free published item' : `FAIL  visitor saw: ${visSlugs}`); visSlugs === 'free-one' ? pass++ : fail++
const list = await as('anon', `select slug, code, files::text as files, is_premium, live_preview_enabled from list_code_items()`, true, 'visitor lists code items')
const paid = list.rows.find((r) => r.slug === 'paid-one'), free = list.rows.find((r) => r.slug === 'free-one')
const hidden = paid && paid.code === '' && paid.files === '[]' && !paid.live_preview_enabled && !JSON.stringify(list.rows).includes('SECRET')
console.log(hidden ? 'PASS  premium item listed without its code' : 'FAIL  premium code leaked'); hidden ? pass++ : fail++
const okFree = free && free.code === '<h1>free</h1>' && !list.rows.some((r) => r.slug === 'draft-code')
console.log(okFree ? 'PASS  free item has code, draft hidden' : 'FAIL  list wrong'); okFree ? pass++ : fail++
await as('stranger', `update code_items set title='hacked' returning slug`, true, 'stranger update code (should affect 0 rows)')
const ct = (await db.query(`select count(*)::int as n from code_items where title='hacked'`)).rows[0].n
console.log(ct === 0 ? 'PASS  stranger changed no code items' : 'FAIL  stranger changed code'); ct === 0 ? pass++ : fail++
await as('anon', `delete from code_items returning slug`, false, 'visitor cannot delete code')
const cids = Object.fromEntries((await db.query(`select slug, id from code_items`)).rows.map((r) => [r.slug, r.id]))
await as('anon', `select increment_code_copy('${cids['free-one']}')`, true, 'visitor code copy +1')
await as('anon', `select increment_code_copy('${cids['paid-one']}')`, true, 'visitor copy on premium (no effect)')
await as('anon', `select increment_code_copy('${cids['draft-code']}')`, true, 'visitor copy on draft (no effect)')
const cc2 = Object.fromEntries((await db.query(`select slug, copy_count from code_items`)).rows.map((r) => [r.slug, r.copy_count]))
const okcc = cc2['free-one'] === 1 && cc2['paid-one'] === 0 && cc2['draft-code'] === 0
console.log(okcc ? 'PASS  code copy counts correct' : `FAIL  code copy counts ${JSON.stringify(cc2)}`); okcc ? pass++ : fail++
await as('anon', `update code_items set copy_count = 999 returning slug`, false, 'visitor cannot set code copy_count')
await as('admin', `update code_items set is_premium=false where slug='paid-one' returning slug`, true, 'admin can edit code items')
await as('admin', `insert into code_items (slug,title,code) values ('big','Big',repeat('x', 1048577))`, false, 'code over 1 MB rejected')
await as('anon', `insert into storage.objects (bucket_id,name) values ('code','a.webp')`, false, 'visitor cannot upload to code bucket')
await as('stranger', `insert into storage.objects (bucket_id,name) values ('code','a.webp')`, false, 'stranger cannot upload to code bucket')
await as('admin', `insert into storage.objects (bucket_id,name) values ('code','a.webp') returning name`, true, 'admin can upload to code bucket')
await as('admin', `delete from code_items where slug='draft-code' returning slug`, true, 'admin can delete code items')

// ---- 005: admin identity
await as('fakeadmin', `insert into code_items (slug,title) values ('fake','Fake') returning slug`, false, 'owner email signed up with a password is NOT admin')
check(Number((await as('fakeadmin', `select count(*)::int n from messages`, true, 'password account with owner email reads messages')).rows[0].n) === 0, 'password account with owner email sees 0 messages')
check(!(await db.query(`select 1 from code_items where slug='fake'`)).rows.length, 'fake admin created nothing')

// ---- 005: premium source never reaches a non-admin, by any route
await as('admin', `insert into code_items (slug,title,language,code,files,is_published,is_premium,demo_enabled,demo_path,preview_video_url) values
  ('secret-one','Secret','html','TOP_SECRET_SOURCE','[{"name":"index.html","language":"html","content":"TOP_SECRET_FILE"}]',true,true,true,'d/abc.html','https://x/v.mp4'),
  ('secret-off','Secret off','html','TOP_SECRET_SOURCE','[]',true,true,false,'d/off.html',null),
  ('secret-draft','Secret draft','html','TOP_SECRET_SOURCE','[]',false,true,true,'d/draft.html',null) returning slug`, true, 'admin adds premium items with demos')

// Tries a query as `who`; returns the rows, or null when refused. Never counts as pass/fail itself.
async function probe(who, sql) {
  const role = who === 'anon' ? 'anon' : who === 'service' ? 'service_role' : 'authenticated'
  try {
    await db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify(CLAIMS[who] ?? {})}', false); select set_config('request.headers', '{"x-forwarded-for":"192.0.2.50"}', false); set role ${role};`)
    return (await db.query(sql)).rows
  } catch {
    return null
  } finally {
    await db.exec('reset role;')
  }
}

const rels = (await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v','m')`)).rows.map((r) => r.relname)
const fns = (await db.query(`select p.proname, pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prorettype <> 'trigger'::regtype`)).rows
for (const who of ['anon', 'stranger', 'fakeadmin']) {
  const leaks = []
  for (const rel of rels) {
    const rows = await probe(who, `select t::text as row from public."${rel}" t`)
    const txt = JSON.stringify(rows ?? '')
    if (txt.includes('TOP_SECRET') || txt.includes('d/abc.html')) leaks.push(rel)
  }
  for (const f of fns) {
    const args = f.args
      ? f.args.split(',').map((a) => (a.includes('uuid') ? 'gen_random_uuid()' : a.includes('integer') ? '7' : "'secret-one'")).join(',')
      : ''
    const txt = JSON.stringify((await probe(who, `select * from public.${f.proname}(${args})`)) ?? '')
    if (txt.includes('TOP_SECRET') || txt.includes('d/abc.html')) leaks.push(f.proname + '()')
  }
  // storage: a visitor can never read a demo file's row (signed links are made only by the server)
  const objs = await probe(who, `select name from storage.objects where bucket_id='demos'`)
  if (objs && objs.length) leaks.push('storage demos')
  check(leaks.length === 0, `${who}: premium source and demo path unreachable from every table, view, function and bucket ${leaks.join(', ')}`)
}

const anonFns = (await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prorettype <> 'trigger'::regtype and has_function_privilege('anon', p.oid, 'execute') order by 1`)).rows.map((r) => r.proname).join(',')
check(anonFns === 'increment_code_copy,increment_copy_count,is_admin,list_code_items,subscribe_newsletter', `visitors can call only the public functions (${anonFns})`)
const anonGrants = (await db.query(`select table_name || ':' || string_agg(privilege_type, '+' order by privilege_type) g from information_schema.role_table_grants where grantee='anon' and table_schema='public' group by table_name order by 1`)).rows.map((r) => r.g).join(',')
check(anonGrants === 'categories:SELECT,prompts:SELECT,site_settings:SELECT', `visitors have only read rights on public tables (${anonGrants})`)
const noRls = (await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`)).rows
check(noRls.length === 0, `RLS is on for every table ${JSON.stringify(noRls)}`)
check((await db.query(`select table_name from information_schema.views where table_schema='public'`)).rows.length === 0, 'no public views that could bypass RLS')
check((await db.query(`select tablename from pg_publication_tables where pubname='supabase_realtime'`)).rows.length === 0, 'no table is broadcast over Realtime')
check((await probe('anon', `select * from private.rate_limits`)) === null, 'private schema closed to visitors')
check((await probe('anon', `select private.rate_ok('x','y',1,60)`)) === null, 'visitors cannot touch the rate limiter')

const listed = (await as('anon', `select slug, code, files::text f, has_demo, preview_video_url from list_code_items()`, true, 'visitor lists premium items')).rows
const s1 = listed.find((r) => r.slug === 'secret-one'), s2 = listed.find((r) => r.slug === 'secret-off')
check(s1 && s1.has_demo === true && s1.code === '' && s1.f === '[]' && s1.preview_video_url === 'https://x/v.mp4', 'premium item shows video + "has demo", no code')
check(s2 && s2.has_demo === false, 'demo switched off → has_demo false')
check(!listed.some((r) => r.slug === 'secret-draft'), 'unpublished premium item not listed')

// ---- 005: demo links
await as('anon', `select demo_request('secret-one','v1')`, false, 'visitor cannot call demo_request directly')
await as('stranger', `select demo_request('secret-one','v1')`, false, 'stranger cannot call demo_request directly')
const dr = async (slug, key) => (await probe('service', `select demo_request('${slug}','${key}') p`))?.[0]?.p
check((await dr('secret-one', 'v1')) === 'd/abc.html', 'demo function gets the private path of an enabled demo')
check((await dr('secret-off', 'v1')) === null, 'no path when the demo is switched off')
check((await dr('secret-draft', 'v1')) === null, 'no path for an unpublished item')
check((await dr('free-one', 'v1')) === null, 'no path for a free item')
let limited = false
for (let i = 0; i < 31 && !limited; i++) limited = (await probe('service', `select demo_request('secret-one','bulk')`)) === null
check(limited, 'demo links are rate-limited per visitor (30/hour)')

// ---- 005: storage — nothing can be written by non-admins
for (const bucket of ['demos', 'code-videos', 'images', 'videos', 'code']) {
  for (const who of ['anon', 'stranger', 'fakeadmin']) {
    check((await probe(who, `insert into storage.objects (bucket_id,name) values ('${bucket}','x') returning name`)) === null, `${who} cannot upload to ${bucket}`)
  }
}
await as('admin', `insert into storage.objects (bucket_id,name) values ('demos','d/abc.html') returning name`, true, 'admin can upload a demo')
for (const who of ['anon', 'stranger']) {
  check(((await probe(who, `select name from storage.objects where bucket_id='demos'`)) ?? []).length === 0, `${who} sees no demo files`)
  check(((await probe(who, `update storage.objects set name='y' returning name`)) ?? []).length === 0, `${who} cannot change files`)
  check(((await probe(who, `delete from storage.objects returning name`)) ?? []).length === 0, `${who} cannot delete files`)
}
const buckets = Object.fromEntries((await db.query(`select id, public, file_size_limit from storage.buckets`)).rows.map((b) => [b.id, b]))
check(buckets.demos.public === false, 'demos bucket is private')
check(Number(buckets['code-videos'].file_size_limit) === 15728640, 'preview videos capped at 15 MB by the server')

// ---- 005: rate limits
const copyId = (await db.query(`select id from code_items where slug='free-one'`)).rows[0].id
const before = (await db.query(`select copy_count from code_items where slug='free-one'`)).rows[0].copy_count
for (let i = 0; i < 65; i++) {
  await db.exec(`select set_config('request.headers', '{"x-forwarded-for":"198.51.100.7"}', false); set role anon; select increment_code_copy('${copyId}'); reset role;`)
}
const after = (await db.query(`select copy_count from code_items where slug='free-one'`)).rows[0].copy_count
check(after - before === 60, `copy counter stops at 60 per visitor per hour (got +${after - before})`)
let subLimited = false
for (let i = 0; i < 7 && !subLimited; i++) {
  try {
    await db.exec(`select set_config('request.headers', '{"x-forwarded-for":"198.51.100.8"}', false); set role anon; select subscribe_newsletter('fan${i}@x.com')`)
  } catch { subLimited = true } finally { await db.exec('reset role') }
}
check(subLimited, 'newsletter is rate-limited per visitor (5/hour)')
let contactLimited = false
for (let i = 0; i < 7 && !contactLimited; i++) contactLimited = (await probe('service', `select submit_contact('A','a@x.com','','','','hi','spammer')`)) === null
check(contactLimited, 'contact form is rate-limited per visitor (5/hour)')
const keys = (await db.query(`select key from private.rate_limits`)).rows.map((r) => r.key)
check(!keys.some((k) => k.includes('198.51') || k.includes('203.0') || k.includes('192.0')), 'raw visitor IPs are never stored (hashed)')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
