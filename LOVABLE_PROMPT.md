Ich habe ein bestehendes Projekt "Reachly" per GitHub-Repo verbunden. Bitte lies dir diesen Kontext genau durch, bevor du irgendetwas änderst.

## Was ist Reachly?

KI-Erreichbarkeits-Assistent für Selbstständige (Handwerker, KFZ, Dienstleister). Flow: Verpasster Anruf → automatische SMS mit WhatsApp-Link → KI-Chat qualifiziert das Anliegen und bucht Termine → 48h nach Termin automatische Google-Bewertungsanfrage.

## Sehr wichtig: Dieses Repo hat mehrere Teile – du darfst NUR einen davon bearbeiten

```
src/
├── widget/          # NICHT ANFASSEN. Eigenständiges Preact-Widget (Shadow DOM),
│                     eigener Vite-Build (vite.config.widget.ts), läuft auf
│                     fremden Kundenwebsites. Kein React, kein Tailwind.
├── dashboard/        # HIER ARBEITEST DU. Interne Verwaltung für Agentur + Kunden.
├── lib/              # Geteilt (Supabase-Client) - nur lesen, i.d.R. nicht ändern.
└── types/            # Geteilt (TypeScript-Typen fürs Datenmodell) - nur lesen.

supabase/
├── migrations/       # NICHT ANFASSEN. Datenbank-Schema, bereits deployt.
└── functions/        # NICHT ANFASSEN. Deno Edge Functions (Backend-Logik).

marketing/            # NICHT ANFASSEN. Statische Landingpage, kein Teil des Dashboards.
```

Bitte bearbeite ausschließlich Dateien unter `src/dashboard/`. Wenn eine Aufgabe eine Änderung außerhalb davon zu erfordern scheint (z. B. neue Datenbank-Spalte, neue Edge Function), sag mir das explizit, statt es selbst anzulegen – das mache ich separat über die Supabase CLI.

## Tech-Stack im Dashboard (bitte einhalten)

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui-artige Komponenten (liegen unter `src/dashboard/components/ui/`)
- `@supabase/supabase-js` als einziger Backend-Zugriff (Singleton in `src/lib/supabase.ts`)
- react-router-dom für Routing, @tanstack/react-query für Datenzugriff (ein Hook pro Datentyp in `src/dashboard/hooks/`)
- Env-Variablen ausschließlich über `import.meta.env.VITE_*` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)

## Datenmodell ist bereits fertig und deployt

Die komplette Datenbank (Tabellen, Zugriffsregeln/RLS, Trigger) existiert schon in Supabase. Das Frontend nutzt nur den anon-Key – **RLS regelt alle Zugriffsrechte serverseitig**, du musst dich im Frontend nicht um Berechtigungen kümmern, nur um UI/UX. Typen dafür liegen in `src/types/database.ts` (nicht verändern, nur importieren).

Zwei Rollen: `agency` (Agentur, sieht alle Mandanten) und `client` (einzelner Handwerksbetrieb, sieht nur sich selbst). Rolle kommt aus `profiles.role`.

## Design-Richtlinien

- B2B-Tool: neutrales Slate/Zinc als Basis, EIN Akzent (Emerald, `#0b7a55` / HSL `160 84% 26%`) für Primäraktionen
- Schrift: IBM Plex Sans (Fließtext/UI), IBM Plex Mono (Zahlen/KPIs/Codes) – beide bereits über Google Fonts in `index.html` eingebunden
- Deutsch, Datumsformate de-DE, Zeitzone Europe/Berlin, kein Dark Mode (noch nicht geplant)
- Keine Platzhalter-Implementierungen, keine TODO-Kommentare als Ersatz für echte Logik

## Git-Workflow

- Commits: deutsch, imperativ, kurz (z. B. "Termin-Filter ergänzt")
- Niemals force-pushen
- Vor größeren Umbauten lieber einen Feature-Branch statt direkt auf main

Bitte bestätige kurz, dass du diese Grenzen verstanden hast, bevor wir loslegen.
