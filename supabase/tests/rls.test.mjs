import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

// Runs the migration in an in-memory Postgres (PGlite) with small stand-ins for Supabase's
// auth and storage schemas, then checks every Row Level Security rule as visitor / stranger / admin.
// Usage: npm run test:db
const MIGRATION = new URL('../migrations/001_init.sql', import.meta.url)
const db = new PGlite()
const stub = `
create role anon nologin; create role authenticated nologin;
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
console.log('migration ran twice OK')

let pass = 0, fail = 0
async function as(who, sql, expectOk, label) {
  const claims = who === 'anon' ? '{}' : JSON.stringify({ email: who === 'admin' ? 'GhosMali22@gmail.com' : 'stranger@gmail.com' })
  const role = who === 'anon' ? 'anon' : 'authenticated'
  let ok = true, out
  try {
    await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); set role ${role};`)
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
await as('anon', `insert into messages (name,email,message,project_type,work_mode) values ('Ann','ann@x.com','hi','Websites','Remote')`, true, 'visitor can send a message')
await as('anon', `insert into messages (name,email,message,is_read) values ('Ann','ann@x.com','hi',true)`, false, 'visitor cannot mark own message read')
await as('anon', `insert into messages (name,email,message) values ('Ann','not-an-email','hi')`, false, 'invalid email rejected')
const msgs = await as('anon', `select * from messages`, false, 'visitor cannot read messages')
await as('stranger', `select count(*) from messages`, true, 'stranger sees 0 messages')
await as('admin', `update messages set is_read = true returning name, is_read`, true, 'admin can mark messages read')
await as('anon', `insert into subscribers (email) values ('fan@x.com')`, true, 'visitor can subscribe')
await as('anon', `insert into subscribers (email) values ('fan@x.com')`, false, 'duplicate subscribe → unique error (handled in app)')
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
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
