-- ============================================================
-- Abrechnung pro Mandant + E-Mail-Kanal-Feld
--
-- client_billing: Preis, Intervall, Vertragsdaten. Bewusst eigene
-- Tabelle statt Spalten auf clients, damit RLS die Zahlen komplett
-- vor Kunden-Logins verbergen kann (clients ist fuer Kunden lesbar).
--
-- ACHTUNG: Diese Datei liegt hier nur zur Dokumentation/Anwendung —
-- die Datenbank laeuft in einem separaten Supabase-Projekt.
-- ============================================================

create table public.client_billing (
  client_id uuid primary key references public.clients(id) on delete cascade,
  -- Preis in Cent je Abrechnungsintervall, kein Float wegen Rundungsfehlern
  price_cents integer check (price_cents >= 0),
  billing_interval text not null default 'monthly'
    check (billing_interval in ('monthly', 'yearly')),
  contract_start date,
  renewal_date date,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.client_billing enable row level security;

-- Nur die Agentur sieht und pflegt Abrechnungsdaten.
create policy "client_billing_agency_select" on public.client_billing
  for select using (public.is_agency());

create policy "client_billing_agency_insert" on public.client_billing
  for insert with check (public.is_agency());

create policy "client_billing_agency_update" on public.client_billing
  for update using (public.is_agency()) with check (public.is_agency());

create policy "client_billing_agency_delete" on public.client_billing
  for delete using (public.is_agency());

-- E-Mail-Kanal: Postfach- bzw. Weiterleitungsadresse des Mandanten.
-- Gesetzt = Kanal "Mail" gilt als verbunden.
alter table public.client_settings
  add column inbound_email_address text;
