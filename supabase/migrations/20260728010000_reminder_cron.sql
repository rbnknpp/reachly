-- ============================================================
-- Terminerinnerung: alle 15 Minuten die Edge Function
-- send-appointment-reminders aufrufen (Einplanen + Versand).
--
-- Voraussetzungen (einmalig):
--   1. Edge Function send-appointment-reminders deployen (--no-verify-jwt)
--   2. Function-Secret setzen:  supabase secrets set REMINDER_CRON_SECRET=...
--   3. Dasselbe Secret in den Supabase-Vault legen:
--      select vault.create_secret('<SECRET>', 'reminder_cron_secret');
-- ============================================================

select cron.schedule(
  'send-appointment-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://nwjalodrbalxxzrfmlir.supabase.co/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
