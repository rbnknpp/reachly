# Reachly — Repo-Landkarte

Damit sich niemand gegenseitig überschreibt: Reachly besteht aus drei Repos
mit klarer Zuständigkeit.

| Repo | Zuständigkeit | Deployment |
| --- | --- | --- |
| `rbnknpp/reachly` (dieses) | **Widget** (`src/widget`) + **Supabase-Backend** (`supabase/` — Schema-Migrationen & Edge Functions) | Widget-CDN / Supabase |
| `altovate-GmbH/reachly-hosting-shell` | **Dashboard** (Agentur + Kunden), TanStack Start | Lovable → https://reachly-dashboard.lovable.app |
| `altovate-GmbH/reachly` | **Marketing-Landingpage** | Lovable → https://reachly-erreichbarkeit.lovable.app |

## Wichtig

- `src/dashboard/` in diesem Repo ist der **alte Stand** (React-SPA). Die
  Weiterentwicklung passiert im TanStack-Repo `altovate-GmbH/reachly-hosting-shell`
  — dort liegen bereits: Abrechnungs-Tab (client_billing), Kunden-Seite
  „Verbindungen", Kanal-Status im Admin, Marken-Politur. Robins Fixes vom
  23.07. (Passwort-Reset, Login-Overlap) sind dorthin portiert.
- **Schema-Änderungen nur hier** unter `supabase/migrations/` — das Dashboard
  konsumiert das Schema nur (`src/types/database.ts` dort spiegelt es).
- Offen: Migration `20260722180000_client_billing_and_email.sql` auf der
  Supabase-DB anwenden.
- `altovate-GmbH/reachly-dashboard` und `altovate-GmbH/reachly-website` sind
  Alt-Stände (ersetzt durch reachly-hosting-shell bzw. reachly) — nicht mehr
  dort arbeiten. Robins Lovable-Projekt „lovelier-reach“ ist tot (GitHub-Sync
  gebrochen) und kann gelöscht werden.

## Workflow

Beide pushen direkt auf `main`, aber immer `git pull` vor Arbeitsbeginn.
