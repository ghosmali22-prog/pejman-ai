-- =====================================================================
-- PEJMAN AI — video prompts (run once in Supabase → SQL Editor, after 001_init.sql)
--
--   • A prompt can carry a video. image_url stays as its poster (cover frame),
--     so pages load the light image first and the video only when it is on screen.
--   • Public "videos" bucket (MP4 / WebM / MOV, max 100 MB), admin-only writes.
--   • Adds the "Motion Graphics" category.
-- =====================================================================

alter table public.prompts add column if not exists video_url  text;
alter table public.prompts add column if not exists video_path text; -- path inside the "videos" bucket

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 104857600, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "videos: admin read"   on storage.objects;
drop policy if exists "videos: admin upload" on storage.objects;
drop policy if exists "videos: admin update" on storage.objects;
drop policy if exists "videos: admin delete" on storage.objects;
create policy "videos: admin read" on storage.objects
  for select to authenticated using (bucket_id = 'videos' and public.is_admin());
create policy "videos: admin upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'videos' and public.is_admin());
create policy "videos: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'videos' and public.is_admin())
  with check (bucket_id = 'videos' and public.is_admin());
create policy "videos: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'videos' and public.is_admin());

insert into public.categories (name, slug, position)
values ('Motion Graphics', 'motion-graphics', 0)
on conflict (slug) do nothing;
