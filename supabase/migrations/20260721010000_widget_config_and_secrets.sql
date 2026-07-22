-- ============================================================
-- Reachly - Widget-Konfiguration, Rate-Limiting, Integrations-Secrets
--
-- Ergaenzt das initiale Schema (20260721000000_init_schema.sql) um
-- Felder, die fuer die Widget-Backend-Endpoints noetig sind, aber im
-- urspruenglichen Datenmodell aus CLAUDE.md nicht enthalten waren.
-- ============================================================

-- ---------- Widget-Konfiguration pro Mandant ----------
alter table public.client_settings
  add column widget_accent_color text not null default '#059669',
  add column widget_position text not null default 'right' check (widget_position in ('left', 'right')),
  add column widget_greeting text not null default 'Wie können wir helfen?',
  add column widget_whatsapp_prefill_text text not null default 'Hallo, ich habe eine Frage.',
  add column widget_action_whatsapp boolean not null default true,
  add column widget_action_callback boolean not null default true,
  add column widget_action_booking boolean not null default true;

-- ---------- Rate-Limiting fuer die oeffentlichen Widget-Endpoints ----------
-- Kein direkter Tabellenzugriff von aussen noetig (RLS aktiv, keine
-- Policies -> nur service_role/Edge Functions koennen lesen/schreiben).
create table public.widget_rate_limits (
  client_key text not null,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (client_key, action, window_start)
);

alter table public.widget_rate_limits enable row level security;

create or replace function public.check_rate_limit(
  p_client_key text,
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.widget_rate_limits (client_key, action, window_start, request_count)
  values (p_client_key, p_action, v_window_start, 1)
  on conflict (client_key, action, window_start)
  do update set request_count = widget_rate_limits.request_count + 1
  returning request_count into v_count;

  return v_count <= p_max_requests;
end;
$$;

-- ---------- Integrations-Secrets (WhatsApp/Cal.com API-Zugangsdaten) ----------
-- WICHTIG: Diese Tabelle bekommt bewusst KEINE RLS-Policies. Damit ist sie
-- fuer alle Rollen (anon, authenticated) komplett gesperrt und nur per
-- service_role (Edge Functions) lesbar. client_settings darf diese Werte
-- NIE aufnehmen, weil das Dashboard client_settings direkt an den Browser
-- ausliefert (auch an Kunden-Logins) - ein API-Token darin wuerde leaken.
create table public.client_integration_secrets (
  client_id uuid primary key references public.clients(id) on delete cascade,
  wa_access_token text,
  calcom_api_key text
);

alter table public.client_integration_secrets enable row level security;
