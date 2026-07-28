-- ============================================================
-- Terminerinnerung per E-Mail, 48h vor dem Termin
--
-- end_customers.email: wurde bisher nur transient an Cal.com
-- weitergereicht (siehe widget-book), nie gespeichert. Jetzt
-- persistiert, damit Erinnerungsmails ueberhaupt ein Ziel haben.
--
-- appointment_reminders spiegelt review_requests fast 1:1 - nur
-- zeitlich VOR statt NACH dem Termin und per E-Mail statt SMS.
-- Eigene Tabelle statt Spalte auf appointments, aus denselben
-- Gruenden wie review_requests: Automatisierungs-Status sauber
-- getrennt vom fachlichen Termin-Datensatz.
-- ============================================================

alter table public.end_customers
  add column email text;

create table public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'failed', 'skipped')),
  sent_at timestamptz,
  unique (appointment_id)
);

create index appointment_reminders_client_id_idx on public.appointment_reminders (client_id);

alter table public.appointment_reminders enable row level security;

create policy "appointment_reminders_select" on public.appointment_reminders
  for select using (public.is_agency() or client_id = public.my_client_id());
