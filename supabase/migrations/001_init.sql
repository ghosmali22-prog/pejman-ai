-- =====================================================================
-- PEJMAN AI — database setup (run once in Supabase → SQL Editor)
--
-- Security model (enforced by Row Level Security, not just the frontend):
--   • Everyone can READ published prompts, categories and site settings.
--   • Everyone can SEND a contact message and SUBSCRIBE to the newsletter.
--   • Only the admin Gmail below can create / update / delete anything.
--
-- To change the admin account later, edit the email in public.is_admin()
-- and run that function again.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Admin check
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(lower(auth.jwt() ->> 'email') in ('ghosmali22@gmail.com'), false)
$$;

-- Keeps updated_at fresh on every update.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Prompts
-- ---------------------------------------------------------------------
create table if not exists public.prompts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title           text not null check (char_length(title) between 1 and 140),
  category        text references public.categories (slug) on update cascade on delete set null,
  model           text not null default '',
  prompt          text not null default '',
  negative_prompt text,
  settings        jsonb not null default '{}'::jsonb,
  tags            text[] not null default '{}',
  image_url       text not null default '',
  image_path      text,             -- path inside the storage bucket (used to delete old files)
  image_width     integer,
  image_height    integer,
  featured        boolean not null default false,
  published       boolean not null default false,
  position        integer not null default 0,
  copy_count      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists prompts_published_position_idx on public.prompts (published, position);

drop trigger if exists prompts_touch on public.prompts;
create trigger prompts_touch before update on public.prompts
  for each row execute function public.touch_updated_at();

-- One row per copy, so the admin dashboard can chart copies over time.
create table if not exists public.copy_events (
  id         bigint generated always as identity primary key,
  prompt_id  uuid not null references public.prompts (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists copy_events_created_idx on public.copy_events (created_at);

-- ---------------------------------------------------------------------
-- Contact messages
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 120),
  email        text not null check (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  project_type text check (char_length(project_type) <= 60),
  work_mode    text check (char_length(work_mode) <= 60),
  budget       text check (char_length(budget) <= 60),
  message      text not null check (char_length(message) between 1 and 4000),
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists messages_created_idx on public.messages (created_at desc);

-- ---------------------------------------------------------------------
-- Newsletter subscribers
-- ---------------------------------------------------------------------
create table if not exists public.subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Site settings (one row; JSON overrides the defaults in src/config/site.ts)
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  id         integer primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Copy counter (callable by anyone, but it can only add +1 to a published prompt)
-- ---------------------------------------------------------------------
create or replace function public.increment_copy_count(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.prompts set copy_count = copy_count + 1 where id = p_id and published;
  if found then
    insert into public.copy_events (prompt_id) values (p_id);
  end if;
end;
$$;

revoke all on function public.increment_copy_count(uuid) from public;
grant execute on function public.increment_copy_count(uuid) to anon, authenticated;

-- Daily copy totals for the admin chart (RLS on copy_events limits it to the admin).
create or replace function public.admin_daily_copies(p_days integer default 30)
returns table (day date, copies bigint)
language sql
stable
as $$
  select d::date as day, count(e.id) as copies
  from generate_series(current_date - (p_days - 1), current_date, interval '1 day') as d
  left join public.copy_events e on e.created_at::date = d::date
  group by d
  order by d
$$;

grant execute on function public.admin_daily_copies(integer) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.categories    enable row level security;
alter table public.prompts       enable row level security;
alter table public.copy_events   enable row level security;
alter table public.messages      enable row level security;
alter table public.subscribers   enable row level security;
alter table public.site_settings enable row level security;

-- categories
drop policy if exists "categories: public read"  on public.categories;
drop policy if exists "categories: admin write"  on public.categories;
create policy "categories: public read" on public.categories
  for select to anon, authenticated using (true);
create policy "categories: admin write" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- prompts
drop policy if exists "prompts: read published" on public.prompts;
drop policy if exists "prompts: admin write"    on public.prompts;
create policy "prompts: read published" on public.prompts
  for select to anon, authenticated using (published or public.is_admin());
create policy "prompts: admin write" on public.prompts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- copy_events (written only by increment_copy_count)
drop policy if exists "copy_events: admin read" on public.copy_events;
create policy "copy_events: admin read" on public.copy_events
  for select to authenticated using (public.is_admin());

-- messages
drop policy if exists "messages: anyone can send" on public.messages;
drop policy if exists "messages: admin manage"    on public.messages;
create policy "messages: anyone can send" on public.messages
  for insert to anon, authenticated with check (is_read = false);
create policy "messages: admin manage" on public.messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- subscribers
drop policy if exists "subscribers: anyone can join" on public.subscribers;
drop policy if exists "subscribers: admin manage"    on public.subscribers;
create policy "subscribers: anyone can join" on public.subscribers
  for insert to anon, authenticated with check (true);
create policy "subscribers: admin manage" on public.subscribers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- site_settings
drop policy if exists "site_settings: public read" on public.site_settings;
drop policy if exists "site_settings: admin write" on public.site_settings;
create policy "site_settings: public read" on public.site_settings
  for select to anon, authenticated using (true);
create policy "site_settings: admin write" on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Table privileges (RLS above decides which rows)
grant select on public.categories, public.prompts, public.site_settings to anon, authenticated;
grant insert on public.messages, public.subscribers to anon, authenticated;
grant select, insert, update, delete on
  public.categories, public.prompts, public.messages, public.subscribers, public.site_settings
  to authenticated;
grant select on public.copy_events to authenticated;

-- ---------------------------------------------------------------------
-- Storage: public bucket for prompt images (WebP, max 5 MB)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images: admin read"   on storage.objects;
drop policy if exists "images: admin upload" on storage.objects;
drop policy if exists "images: admin update" on storage.objects;
drop policy if exists "images: admin delete" on storage.objects;
create policy "images: admin read" on storage.objects
  for select to authenticated using (bucket_id = 'images' and public.is_admin());
create policy "images: admin upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'images' and public.is_admin());
create policy "images: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'images' and public.is_admin())
  with check (bucket_id = 'images' and public.is_admin());
create policy "images: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'images' and public.is_admin());
-- Visitors need no SELECT policy: files in a public bucket are served by their public URL,
-- and leaving it out stops them from listing every file in the bucket.

-- ---------------------------------------------------------------------
-- Starter data
-- ---------------------------------------------------------------------
insert into public.categories (name, slug, position) values
  ('Portrait', 'portrait', 1),
  ('Product', 'product', 2),
  ('Interior', 'interior', 3),
  ('Fashion', 'fashion', 4),
  ('3D', '3d', 5),
  ('Food', 'food', 6),
  ('Architecture', 'architecture', 7),
  ('Abstract', 'abstract', 8)
on conflict (slug) do nothing;

insert into public.site_settings (id, data) values (1, '{}'::jsonb)
on conflict (id) do nothing;
