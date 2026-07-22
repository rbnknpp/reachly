-- ============================================================
-- Phase 0: Kunden-Logins duerfen ihre EIGENEN client_settings
-- schreiben (bisher nur Agentur). Sicher, weil client_settings
-- bewusst nie Secrets enthaelt (die liegen in
-- client_integration_secrets, das komplett ohne Policies gesperrt
-- ist und nur von Edge Functions per service_role gelesen wird).
-- ============================================================

create policy "client_settings_client_update" on public.client_settings
  for update
  using (client_id = public.my_client_id())
  with check (client_id = public.my_client_id());
