-- =====================================================================
-- PEJMAN AI — ready-made UI code (run once in Supabase → SQL Editor, after 003)
--
--   • code_items: copy-and-paste UI code (single file, or several files for a project).
--   • Everyone can READ published free items; only the admin Gmail (public.is_admin()) can write.
--   • Premium items (is_premium): visitors see title, description and screenshot, never the code.
--     The table hides premium rows from visitors entirely; list_code_items() returns them
--     with code and files blanked out.
--   • Public "code" bucket for preview screenshots, admin-only writes.
--   • increment_code_copy(): +1 on a published item's copy counter, like prompts.
--
-- Only ADDS things: no DROP, DELETE or TRUNCATE, and nothing that already exists is changed.
-- Safe to run twice: every step is skipped if it was already done.
-- =====================================================================

create table if not exists public.code_items (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title                text not null check (char_length(title) between 1 and 140),
  short_description    text not null default '' check (char_length(short_description) <= 400),
  category             text not null default '' check (char_length(category) <= 60),  -- e.g. "Dashboard", "Glass UI"
  language             text not null default 'html' check (language ~ '^[a-z0-9+#-]{1,20}$'),
  code                 text not null default '' check (octet_length(code) <= 1048576),   -- main file, max 1 MB
  -- Multi-file items: [{ "name": "index.html", "language": "html", "content": "…" }, …]
  files                jsonb not null default '[]'::jsonb
                         check (jsonb_typeof(files) = 'array' and octet_length(files::text) <= 3145728),
  preview_image_url    text,
  preview_image_path   text,             -- path inside the "code" bucket (used to delete old files)
  live_preview_enabled boolean not null default true,
  is_featured          boolean not null default false,
  is_published         boolean not null default false,
  is_premium           boolean not null default false,  -- sold on request: code is never sent to visitors
  sort_order           integer not null default 0,
  copy_count           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists code_items_published_order_idx
  on public.code_items (is_published, is_featured desc, sort_order);

create or replace trigger code_items_touch before update on public.code_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Copy counter (callable by anyone, but it can only add +1 to a published item)
-- ---------------------------------------------------------------------
create or replace function public.increment_code_copy(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.code_items set copy_count = copy_count + 1 where id = p_id and is_published and not is_premium;
$$;

revoke all on function public.increment_code_copy(uuid) from public;
grant execute on function public.increment_code_copy(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.code_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'code_items'
                 and policyname = 'code_items: read published') then
    create policy "code_items: read published" on public.code_items
      for select to anon, authenticated using ((is_published and not is_premium) or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'code_items'
                 and policyname = 'code_items: admin write') then
    create policy "code_items: admin write" on public.code_items
      for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

grant select on public.code_items to anon, authenticated;
grant insert, update, delete on public.code_items to authenticated;

-- What the public website reads: every published item, featured first, with the code of
-- premium items removed. Runs as the table owner so premium rows can be listed without their code.
create or replace function public.list_code_items()
returns table (
  id uuid, slug text, title text, short_description text, category text, language text,
  code text, files jsonb, preview_image_url text, live_preview_enabled boolean,
  is_featured boolean, is_premium boolean, sort_order integer, copy_count integer, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.slug, c.title, c.short_description, c.category, c.language,
         case when c.is_premium then '' else c.code end,
         case when c.is_premium then '[]'::jsonb else c.files end,
         c.preview_image_url,
         c.live_preview_enabled and not c.is_premium,
         c.is_featured, c.is_premium, c.sort_order, c.copy_count, c.created_at
  from public.code_items c
  where c.is_published
  order by c.is_featured desc, c.sort_order asc, c.created_at desc
$$;

revoke all on function public.list_code_items() from public;
grant execute on function public.list_code_items() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage: public bucket for code preview screenshots (max 5 MB)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('code', 'code', true, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'code: admin read') then
    create policy "code: admin read" on storage.objects
      for select to authenticated using (bucket_id = 'code' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'code: admin upload') then
    create policy "code: admin upload" on storage.objects
      for insert to authenticated with check (bucket_id = 'code' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'code: admin update') then
    create policy "code: admin update" on storage.objects
      for update to authenticated using (bucket_id = 'code' and public.is_admin())
      with check (bucket_id = 'code' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'code: admin delete') then
    create policy "code: admin delete" on storage.objects
      for delete to authenticated using (bucket_id = 'code' and public.is_admin());
  end if;
end $$;
-- No public SELECT policy: files are served by their public URL, and visitors can't list the bucket.
