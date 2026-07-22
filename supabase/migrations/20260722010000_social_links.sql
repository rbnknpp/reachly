-- ============================================================
-- Phase 2: Social-Links (einfache Klick-Buttons im Widget).
-- Gleiches Muster wie wa_business_number + widget_action_whatsapp:
-- eine URL-Spalte + eine unabhaengige Sichtbarkeits-Flag pro Kanal.
-- Facebook speichert die volle m.me-URL, damit keine URL-Konstruktion
-- in mehreren Schichten (DB/Function/Widget) dupliziert werden muss.
-- ============================================================

alter table public.client_settings
  add column widget_social_instagram_url text,
  add column widget_action_instagram boolean not null default true,
  add column widget_social_facebook_url text,
  add column widget_action_facebook boolean not null default true,
  add column widget_social_tiktok_url text,
  add column widget_action_tiktok boolean not null default true;
