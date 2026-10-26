-- =====================================================================
-- PEJMAN AI — accept any video format (run once in Supabase → SQL Editor)
-- The admin panel converts videos to MP4 before uploading; if a browser can't,
-- the original file (MKV, AVI, 3GP, …) is uploaded instead.
-- =====================================================================
update storage.buckets
set allowed_mime_types = array['video/*'],
    file_size_limit = 104857600
where id = 'videos';
