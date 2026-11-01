-- =====================================================================
-- PEJMAN AI — security hardening + premium previews (run once, after 004)
--
--   • Admin = the owner Gmail AND signed in with Google (an email/password account
--     with the same address can never become admin).
--   • Least privilege: visitors keep only the table rights the site really uses;
--     everything else (TRUNCATE, UPDATE, DELETE, …) is revoked as a second wall behind RLS.
--   • Rate limits (per visitor IP, stored only as a hash) on copy counters, newsletter,
--     contact form and live-demo links.
--   • Contact form and newsletter go through checked functions instead of direct inserts.
--   • Premium previews: a short video (public "code-videos" bucket) and a protected live demo
--     (private "demos" bucket, reachable only through short-lived signed links made by
--     the demo-url Edge Function).
--   • Fixes the Supabase advisor warnings (search_path, duplicate policies, FK indexes).
--
-- Deletes no data. Safe to run twice.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Admin check: owner email + Google sign-in (app_metadata is set by Supabase, not the user)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') in ('ghosmali22@gmail.com')
    and (auth.jwt() -> 'app_metadata' -> 'providers') ? 'google',
    false)
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Admin chart: returns nothing unless the caller is the admin.
create or replace function public.admin_daily_copies(p_days integer default 30)
returns table (day date, copies bigint)
language sql
stable
set search_path = ''
as $$
  select d::date as day, count(e.id) as copies
  from generate_series(current_date - (least(greatest(p_days, 1), 366) - 1), current_date, interval '1 day') as d
  left join public.copy_events e on e.created_at::date = d::date
  where public.is_admin()
  group by d
  order by d
$$;

revoke all on function public.admin_daily_copies(integer) from public, anon;
grant execute on function public.admin_daily_copies(integer) to authenticated;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Rate limiting (private schema: not reachable through the API)
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.rate_limits (
  bucket       text not null,
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, key, window_start)
);

-- The visitor's IP as sent by Supabase's proxy, hashed (the raw IP is never stored).
create or replace function private.client_key()
returns text
language sql
stable
set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(
    nullif(h ->> 'cf-connecting-ip', ''),
    nullif(trim(split_part(h ->> 'x-forwarded-for', ',', 1)), ''),
    nullif(h ->> 'x-real-ip', ''),
    'unknown'), 'UTF8')), 'hex')
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb as h) s
$$;

-- +1 hit; true while the key is still under p_max hits in the current window.
create or replace function private.rate_ok(p_bucket text, p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into private.rate_limits as r (bucket, key, window_start, hits)
  values (p_bucket, p_key, w, 1)
  on conflict (bucket, key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  if random() < 0.02 then
    delete from private.rate_limits where window_start < now() - interval '2 days';
  end if;
  return n <= p_max;
end;
$$;

-- ---------------------------------------------------------------------
-- Copy counters: still +1 only on published items, now at most 60 per visitor per hour
-- ---------------------------------------------------------------------
create or replace function public.increment_copy_count(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.rate_ok('copy', private.client_key(), 60, 3600) then return; end if;
  update public.prompts set copy_count = copy_count + 1 where id = p_id and published;
  if found then
    insert into public.copy_events (prompt_id) values (p_id);
  end if;
end;
$$;

create or replace function public.increment_code_copy(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.rate_ok('copy', private.client_key(), 60, 3600) then return; end if;
  update public.code_items set copy_count = copy_count + 1 where id = p_id and is_published and not is_premium;
end;
$$;

revoke all on function public.increment_copy_count(uuid) from public;
revoke all on function public.increment_code_copy(uuid) from public;
grant execute on function public.increment_copy_count(uuid) to anon, authenticated;
grant execute on function public.increment_code_copy(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Newsletter: checked function (5 sign-ups per visitor per hour), duplicates are fine
-- ---------------------------------------------------------------------
create or replace function public.subscribe_newsletter(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
begin
  if char_length(e) > 200 or e !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if not private.rate_ok('subscribe', private.client_key(), 5, 3600) then
    raise exception 'too many requests' using errcode = 'P0429';
  end if;
  insert into public.subscribers (email) values (e) on conflict (email) do nothing;
end;
$$;

revoke all on function public.subscribe_newsletter(text) from public;
grant execute on function public.subscribe_newsletter(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Contact form: only the "contact" Edge Function (service role) may call this.
-- It checks the honeypot and Cloudflare Turnstile first, then passes the visitor's IP hash.
-- ---------------------------------------------------------------------
create or replace function public.submit_contact(
  p_name text, p_email text, p_project_type text, p_work_mode text, p_budget text, p_message text, p_client text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.rate_ok('contact', coalesce(p_client, 'unknown'), 5, 3600)
     or not private.rate_ok('contact-all', 'all', 200, 86400) then
    raise exception 'too many requests' using errcode = 'P0429';
  end if;
  insert into public.messages (name, email, project_type, work_mode, budget, message)
  values (trim(p_name), trim(p_email), nullif(trim(p_project_type), ''), nullif(trim(p_work_mode), ''),
          nullif(trim(p_budget), ''), trim(p_message));
end;
$$;

revoke all on function public.submit_contact(text, text, text, text, text, text, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.submit_contact(text, text, text, text, text, text, text) to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Premium previews: video + protected live demo
-- ---------------------------------------------------------------------
alter table public.code_items add column if not exists preview_video_url  text;
alter table public.code_items add column if not exists preview_video_path text;  -- path inside "code-videos"
alter table public.code_items add column if not exists demo_enabled       boolean not null default false;
alter table public.code_items add column if not exists demo_path          text;  -- path inside the private "demos" bucket
alter table public.code_items add column if not exists demo_updated_at    timestamptz;

-- What the public website reads. Premium rows: no code, no files, no demo path —
-- only "has_demo", and the demo itself is fetched through the demo-url Edge Function.
drop function if exists public.list_code_items();
create function public.list_code_items()
returns table (
  id uuid, slug text, title text, short_description text, category text, language text,
  code text, files jsonb, preview_image_url text, preview_video_url text, live_preview_enabled boolean,
  has_demo boolean, is_featured boolean, is_premium boolean, sort_order integer, copy_count integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.slug, c.title, c.short_description, c.category, c.language,
         case when c.is_premium then '' else c.code end,
         case when c.is_premium then '[]'::jsonb else c.files end,
         c.preview_image_url, c.preview_video_url,
         c.live_preview_enabled and not c.is_premium,
         c.is_premium and c.demo_enabled and c.demo_path is not null,
         c.is_featured, c.is_premium, c.sort_order, c.copy_count, c.created_at
  from public.code_items c
  where c.is_published
  order by c.is_featured desc, c.sort_order asc, c.created_at desc
$$;

revoke all on function public.list_code_items() from public;
grant execute on function public.list_code_items() to anon, authenticated;

-- Demo link check, called only by the demo-url Edge Function (service role):
-- 30 demo links per visitor per hour; returns the private file path or null.
create or replace function public.demo_request(p_slug text, p_client text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p text;
begin
  if not private.rate_ok('demo', coalesce(p_client, 'unknown'), 30, 3600) then
    raise exception 'too many requests' using errcode = 'P0429';
  end if;
  select c.demo_path into p from public.code_items c
  where c.slug = p_slug and c.is_published and c.is_premium and c.demo_enabled and c.demo_path is not null;
  return p;
end;
$$;

revoke all on function public.demo_request(text, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.demo_request(text, text) to service_role;
  end if;
end $$;

-- Private bucket for demo builds (single HTML file, max 3 MB). No public URL exists.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('demos', 'demos', false, 3145728, array['text/html'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket for premium preview videos (MP4 / WebM, max 15 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('code-videos', 'code-videos', true, 15728640, array['video/mp4', 'video/webm'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies: one admin-only policy per bucket and action.
do $$
declare
  b text;
begin
  foreach b in array array['demos', 'code-videos'] loop
    execute format('drop policy if exists %I on storage.objects', b || ': admin read');
    execute format('drop policy if exists %I on storage.objects', b || ': admin upload');
    execute format('drop policy if exists %I on storage.objects', b || ': admin update');
    execute format('drop policy if exists %I on storage.objects', b || ': admin delete');
    execute format('create policy %I on storage.objects for select to authenticated using (bucket_id = %L and (select public.is_admin()))', b || ': admin read', b);
    execute format('create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and (select public.is_admin()))', b || ': admin upload', b);
    execute format('create policy %I on storage.objects for update to authenticated using (bucket_id = %L and (select public.is_admin())) with check (bucket_id = %L and (select public.is_admin()))', b || ': admin update', b, b);
    execute format('create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and (select public.is_admin()))', b || ': admin delete', b);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Policies: one policy per role + action (fixes "multiple permissive policies"),
-- and is_admin() evaluated once per query instead of once per row.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['categories', 'prompts', 'code_items', 'site_settings', 'messages', 'subscribers'] loop
    execute format('drop policy if exists %I on public.%I', t || ': admin write', t);
    execute format('drop policy if exists %I on public.%I', t || ': admin manage', t);
    execute format('drop policy if exists %I on public.%I', t || ': admin insert', t);
    execute format('drop policy if exists %I on public.%I', t || ': admin update', t);
    execute format('drop policy if exists %I on public.%I', t || ': admin delete', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))', t || ': admin insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t || ': admin update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))', t || ': admin delete', t);
  end loop;
end $$;

drop policy if exists "prompts: read published" on public.prompts;
create policy "prompts: read published" on public.prompts
  for select to anon, authenticated using (published or (select public.is_admin()));

drop policy if exists "code_items: read published" on public.code_items;
create policy "code_items: read published" on public.code_items
  for select to anon, authenticated using ((is_published and not is_premium) or (select public.is_admin()));

-- Messages and subscribers: the new site writes them only through the contact function /
-- subscribe_newsletter(). The old direct-insert rules stay until 006 removes them (after the
-- new site is live), so the contact form never stops working during the switch.
drop policy if exists "messages: admin read" on public.messages;
drop policy if exists "subscribers: admin read" on public.subscribers;
create policy "messages: admin read" on public.messages
  for select to authenticated using ((select public.is_admin()));
create policy "subscribers: admin read" on public.subscribers
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "copy_events: admin read" on public.copy_events;
create policy "copy_events: admin read" on public.copy_events
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Table privileges: start from nothing, give back only what is used
-- ---------------------------------------------------------------------
revoke all on public.categories, public.prompts, public.copy_events, public.messages,
  public.subscribers, public.site_settings, public.code_items from anon, authenticated;

grant select on public.categories, public.prompts, public.site_settings to anon, authenticated;
-- Visitors read code only through list_code_items(); the table itself is for the admin panel.
grant select on public.code_items to authenticated;
grant insert, update, delete on public.categories, public.prompts, public.site_settings, public.code_items to authenticated;
grant select, update, delete on public.messages, public.subscribers to authenticated;
grant select on public.copy_events to authenticated;
-- Temporary, only while the old direct-insert rules still exist (006 drops them for good).
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'messages' and policyname = 'messages: anyone can send') then
    grant insert on public.messages to anon, authenticated;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'subscribers' and policyname = 'subscribers: anyone can join') then
    grant insert on public.subscribers to anon, authenticated;
  end if;
end $$;
-- Identity sequence for copy_events is used only by increment_copy_count (runs as owner).

-- Tables created later must be granted on purpose, never by default.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Performance advisor: index the foreign keys
-- ---------------------------------------------------------------------
create index if not exists copy_events_prompt_idx on public.copy_events (prompt_id);
create index if not exists prompts_category_idx on public.prompts (category);
