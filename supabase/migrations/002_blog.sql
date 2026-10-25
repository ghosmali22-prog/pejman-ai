-- =====================================================================
-- PEJMAN AI — blog (run once in Supabase → SQL Editor, after 001_init.sql)
--
-- Same security model as prompts:
--   • Everyone can READ published posts.
--   • Only the admin Gmail (public.is_admin()) can create / update / delete.
-- Safe to run more than once.
-- =====================================================================

create table if not exists public.posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title            text not null check (char_length(title) between 1 and 160),
  excerpt          text not null default '' check (char_length(excerpt) <= 320),
  content          text not null default '' check (char_length(content) <= 200000),  -- Markdown, as written
  content_html     text not null default '' check (char_length(content_html) <= 400000), -- rendered by the admin panel
  lang             text not null default 'en' check (lang in ('en', 'fa')),
  cover_url        text not null default '',
  cover_path       text,             -- path inside the storage bucket (used to delete old files)
  cover_width      integer,
  cover_height     integer,
  cover_alt        text not null default '' check (char_length(cover_alt) <= 200),
  tags             text[] not null default '{}',
  seo_title        text check (char_length(seo_title) <= 120),
  seo_description  text check (char_length(seo_description) <= 320),
  reading_minutes  integer not null default 1 check (reading_minutes between 1 and 600),
  published        boolean not null default false,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists posts_published_date_idx on public.posts (published, published_at desc);

drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

-- The publish date is set the first time a post goes live (and kept if it is unpublished later).
create or replace function public.posts_stamp_published()
returns trigger
language plpgsql
as $$
begin
  if new.published and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists posts_stamp_published on public.posts;
create trigger posts_stamp_published before insert or update on public.posts
  for each row execute function public.posts_stamp_published();

alter table public.posts enable row level security;

drop policy if exists "posts: read published" on public.posts;
drop policy if exists "posts: admin write"    on public.posts;
create policy "posts: read published" on public.posts
  for select to anon, authenticated using (published or public.is_admin());
create policy "posts: admin write" on public.posts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.posts to anon, authenticated;
grant select, insert, update, delete on public.posts to authenticated;

-- Blog images go in the existing public "images" bucket (folder blog/); its admin-only
-- upload/delete policies from 001_init.sql already cover them.
