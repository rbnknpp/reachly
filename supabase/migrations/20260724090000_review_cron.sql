-- ============================================================
-- Bewertungs-Automation: alle 15 Minuten die Edge Function
-- send-review-requests aufrufen (Einplanen + Versand).
--
-- Voraussetzungen (einmalig, siehe docs/DEPLOYMENT.md):
--   1. Edge Function send-review-requests deployen (--no-verify-jwt)
--   2. Function-Secret setzen:  supabase secrets set REVIEW_CRON_SECRET=...
--   3. Dasselbe Secret in den Supabase-Vault legen:
--      select vault.create_secret('<SECRET>', 'review_cron_secret');
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-review-requests',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://nwjalodrbalxxzrfmlir.supabase.co/functions/v1/send-review-requests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'review_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
