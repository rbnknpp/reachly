-- ============================================================
-- Reachly - initiales Schema
-- Tabellen, RLS-Policies und Trigger gemaess dem Datenmodell aus
-- CLAUDE.md ("Marcels KI Idee.md"). Schemaaenderungen kuenftig
-- ausschliesslich per neuer Migration, nie hier nachtraeglich
-- editieren.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- Tabellen
-- ============================================================

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.client_settings (
  client_id uuid primary key references public.clients(id) on delete cascade,
  business_phone text,
  sms_sender_number text,
  wa_phone_number_id text,
  wa_business_number text,
  calcom_event_type_id text,
  calcom_username text,
  timezone text not null default 'Europe/Berlin',
  google_review_url text,
  review_delay_hours integer not null default 48 check (review_delay_hours between 1 and 336),
  business_description text,
  ai_tone text,
  ai_enabled boolean not null default true,
  missed_call_sms_text text
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('agency', 'client')),
  client_id uuid references public.clients(id) on delete set null,
  display_name text
);

create table public.end_customers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  phone text not null,
  wa_id text,
  name text,
  created_at timestamptz not null default now(),
  unique (client_id, phone)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  end_customer_id uuid not null references public.end_customers(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'sms', 'email')),
  status text not null default 'ai_active' check (status in ('ai_active', 'human_handoff', 'closed')),
  last_inbound_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender text not null check (sender in ('customer', 'ai', 'human', 'system')),
  body text not null,
  wa_message_id text,
  created_at timestamptz not null default now()
);

create table public.missed_calls (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  caller_phone text not null,
  status text not null default 'detected' check (status in ('detected', 'sms_sent', 'sms_failed', 'converted')),
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  end_customer_id uuid not null references public.end_customers(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'))
);

create table public.review_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'failed', 'skipped')),
  sent_at timestamptz
);

-- ============================================================
-- Indizes
-- ============================================================

create index end_customers_client_id_idx on public.end_customers (client_id);
create index conversations_client_id_idx on public.conversations (client_id);
create index conversations_end_customer_id_idx on public.conversations (end_customer_id);
create index messages_conversation_id_idx on public.messages (conversation_id);
create index missed_calls_client_id_idx on public.missed_calls (client_id);
create index appointments_client_id_idx on public.appointments (client_id);
create index appointments_end_customer_id_idx on public.appointments (end_customer_id);
create index review_requests_client_id_idx on public.review_requests (client_id);
create index review_requests_appointment_id_idx on public.review_requests (appointment_id);
create index profiles_client_id_idx on public.profiles (client_id);

-- ============================================================
-- Trigger: conversations.updated_at automatisch pflegen
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ============================================================
-- Trigger: bei neuem auth.users-Eintrag automatisch ein Profil anlegen.
-- role/client_id/display_name kommen aus raw_user_meta_data, die die
-- Agentur beim Anlegen eines Kunden-Logins per Admin-API mitgibt
-- (role='client', client_id=<uuid>). Ohne Metadaten: role='client'.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, client_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    nullif(new.raw_user_meta_data->>'client_id', '')::uuid,
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Helper-Funktionen fuer RLS. SECURITY DEFINER + fester search_path,
-- damit sie RLS auf profiles selbst umgehen (sonst rekursive Policy-
-- Auswertung) und nicht per search_path-Manipulation angreifbar sind.
-- ============================================================

create or replace function public.is_agency()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'agency'
  );
$$;

create or replace function public.my_client_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select client_id from public.profiles where id = auth.uid();
$$;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.clients enable row level security;
alter table public.client_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.end_customers enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.missed_calls enable row level security;
alter table public.appointments enable row level security;
alter table public.review_requests enable row level security;

-- ---------- profiles ----------
-- Jede:r sieht das eigene Profil, Agentur sieht alle.
-- Schreiben (Rolle zuweisen, Mandant anlegen) nur durch Agentur;
-- das Anlegen beim Signup uebernimmt der Trigger oben (SECURITY DEFINER,
-- umgeht RLS ohnehin).
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.is_agency());

create policy "profiles_agency_insert" on public.profiles
  for insert with check (public.is_agency());

create policy "profiles_agency_update" on public.profiles
  for update using (public.is_agency()) with check (public.is_agency());

create policy "profiles_agency_delete" on public.profiles
  for delete using (public.is_agency());

-- ---------- clients ----------
-- Agentur verwaltet alle Mandanten voll, ein Kunde sieht nur seinen eigenen.
create policy "clients_select" on public.clients
  for select using (public.is_agency() or id = public.my_client_id());

create policy "clients_agency_insert" on public.clients
  for insert with check (public.is_agency());

create policy "clients_agency_update" on public.clients
  for update using (public.is_agency()) with check (public.is_agency());

create policy "clients_agency_delete" on public.clients
  for delete using (public.is_agency());

-- ---------- client_settings ----------
create policy "client_settings_select" on public.client_settings
  for select using (public.is_agency() or client_id = public.my_client_id());

create policy "client_settings_agency_insert" on public.client_settings
  for insert with check (public.is_agency());

create policy "client_settings_agency_update" on public.client_settings
  for update using (public.is_agency()) with check (public.is_agency());

create policy "client_settings_agency_delete" on public.client_settings
  for delete using (public.is_agency());

-- ---------- end_customers ----------
-- Nur lesen im Dashboard. Angelegt werden Endkunden ausschliesslich
-- durch Backend Edge Functions (service_role, umgeht RLS).
create policy "end_customers_select" on public.end_customers
  for select using (public.is_agency() or client_id = public.my_client_id());

-- ---------- conversations ----------
-- Lesen im eigenen Scope, Status darf im Dashboard umgeschaltet werden
-- (Uebernahme durch Mensch / zurueck an KI / schliessen).
create policy "conversations_select" on public.conversations
  for select using (public.is_agency() or client_id = public.my_client_id());

create policy "conversations_status_update" on public.conversations
  for update
  using (public.is_agency() or client_id = public.my_client_id())
  with check (public.is_agency() or client_id = public.my_client_id());

-- ---------- messages ----------
-- Nur lesen im Dashboard; eingehende/ausgehende Nachrichten werden
-- durch Backend Edge Functions / Webhooks geschrieben.
create policy "messages_select" on public.messages
  for select using (
    public.is_agency()
    or exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.client_id = public.my_client_id()
    )
  );

-- ---------- missed_calls ----------
create policy "missed_calls_select" on public.missed_calls
  for select using (public.is_agency() or client_id = public.my_client_id());

-- ---------- appointments ----------
create policy "appointments_select" on public.appointments
  for select using (public.is_agency() or client_id = public.my_client_id());

create policy "appointments_status_update" on public.appointments
  for update
  using (public.is_agency() or client_id = public.my_client_id())
  with check (public.is_agency() or client_id = public.my_client_id());

-- ---------- review_requests ----------
create policy "review_requests_select" on public.review_requests
  for select using (public.is_agency() or client_id = public.my_client_id());

-- ============================================================
-- Grants (Supabase setzt das i.d.R. schon per Default, hier explizit
-- fuer Portabilitaet). RLS-Policies oben bleiben die eigentliche Grenze.
-- ============================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
