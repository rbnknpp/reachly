-- ============================================================
-- Phase 3: Bereitstellung fuer die automatische Twilio-Rufnummer
-- pro Mandant. Die eigentlichen Twilio-Zugangsdaten (Account SID +
-- Auth Token) sind agentur-weit und leben NIE in der Datenbank,
-- sondern als Function-Secrets (supabase secrets set).
-- ============================================================

alter table public.client_settings
  add column twilio_phone_number_sid text;

alter table public.missed_calls
  add column twilio_call_sid text unique;
