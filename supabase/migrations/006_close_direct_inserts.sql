-- =====================================================================
-- PEJMAN AI — close direct inserts (run once, AFTER the new website is live)
--
-- From now on contact messages arrive only through the "contact" Edge Function
-- (honeypot + Turnstile + server checks + rate limit) and newsletter sign-ups only through
-- subscribe_newsletter() (rate limited). Visitors can no longer write to these tables directly.
--
-- Deletes no data. Safe to run twice.
-- =====================================================================

drop policy if exists "messages: anyone can send" on public.messages;
drop policy if exists "subscribers: anyone can join" on public.subscribers;
revoke insert on public.messages, public.subscribers from anon, authenticated;
