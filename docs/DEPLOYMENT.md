# Reachly Backend — Deployment & Einrichtung

Stand 2026-07-24. Gilt für das Supabase-Projekt `nwjalodrbalxxzrfmlir`.

## 1. Offene Migrationen anwenden

Im Supabase SQL-Editor (oder `supabase db push`), in dieser Reihenfolge:

1. `20260722180000_client_billing_and_email.sql` — Abrechnung + E-Mail-Feld
2. `20260724090000_review_cron.sql` — Bewertungs-Cron (erst NACH Schritt 3!)

## 2. Function-Secrets setzen

```bash
supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  WHATSAPP_VERIFY_TOKEN=<frei waehlbarer langer String> \
  META_APP_SECRET=<App-Secret aus dem Meta-Developer-Portal> \
  REVIEW_CRON_SECRET=<frei waehlbarer langer String>
```

Bereits vorhanden sein sollten: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`DASHBOARD_URL`. Optional: `REACHLY_AI_MODEL` (Default `claude-opus-4-8`;
Kostenhebel z. B. `claude-sonnet-5`).

Das `REVIEW_CRON_SECRET` zusätzlich in den Supabase-Vault legen, damit der
Cron-Job es lesen kann:

```sql
select vault.create_secret('<REVIEW_CRON_SECRET>', 'review_cron_secret');
```

## 3. Neue Edge Functions deployen

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy send-review-requests --no-verify-jwt
```

`--no-verify-jwt` ist Pflicht: Meta bzw. pg_cron schicken keinen Supabase-JWT.
Autorisierung läuft über Verify-Token/Signatur (WhatsApp) bzw. `x-cron-secret`
(Review-Cron).

## 4. Meta / WhatsApp Business API einrichten (einmalig, Firmenebene)

Das ist der externe Flaschenhals — früh anstoßen, dauert je nach
Verifizierung Tage bis Wochen:

1. **Meta Business Portfolio** anlegen/nutzen (business.facebook.com) und die
   **Business-Verifizierung** durchlaufen (Handelsregisterauszug o. ä.)
2. **Meta-App** anlegen (developers.facebook.com, Typ „Business") und das
   Produkt **WhatsApp** hinzufügen
3. In der App unter WhatsApp → Konfiguration den **Webhook** setzen:
   - Callback-URL: `https://nwjalodrbalxxzrfmlir.supabase.co/functions/v1/whatsapp-webhook`
   - Verify-Token: der Wert von `WHATSAPP_VERIFY_TOKEN`
   - Webhook-Feld **messages** abonnieren
4. **App-Secret** (App-Einstellungen → Allgemein) als `META_APP_SECRET` setzen

## 5. Pro Mandant: WhatsApp-Nummer anbinden

1. Im Meta-Portfolio des Mandanten (oder als Tech-Provider) eine
   **Telefonnummer** im WhatsApp-Account registrieren.
   Achtung: Eine Nummer, die auf der normalen WhatsApp/WhatsApp-Business-App
   läuft, muss dort erst abgemeldet werden.
2. **Phone-Number-ID** kopieren → im Dashboard beim Mandanten in
   `client_settings.wa_phone_number_id` eintragen (Feld „WhatsApp
   Phone-Number-ID" in den Einstellungen).
3. **Permanenten Access-Token** erzeugen (System-User im Business-Manager,
   Berechtigungen `whatsapp_business_messaging` + `whatsapp_business_management`)
   → in `client_integration_secrets.wa_access_token` des Mandanten speichern.
4. Testnachricht an die Nummer schicken → muss im Posteingang auftauchen und
   (bei aktivierter KI) automatisch beantwortet werden.

## 6. Pro Mandant: Kalender (Cal.com)

- Mandant legt einen Cal.com-Account an und verbindet dort seinen
  **Google- oder Outlook-Kalender** (deckt beide Welten ab, ohne dass wir
  eigene OAuth-Apps brauchen).
- Event-Typ anlegen (z. B. „Vor-Ort-Termin, 60 min") →
  `calcom_event_type_id` + `calcom_username` in den Mandanten-Einstellungen,
  API-Key in `client_integration_secrets.calcom_api_key`.
- Ohne Kalender-Konfiguration bietet der Bot keine Termine an, sondern
  übergibt an den Betrieb (bewusst so gebaut).

## 7. Bewertungs-Automation

Läuft automatisch, sobald Migration + Secrets + Deploy (Schritte 1-3) durch
sind. Pro Mandant nötig: `google_review_url` und eine SMS-Absendernummer
(`sms_sender_number`, Provisionierung über den Einstellungen-Button).
Wartezeit: `review_delay_hours` (Default 48h nach Terminende).

## Architektur-Kurzreferenz

```
Anruf verpasst ──▶ twilio-voice-webhook/-status ──▶ SMS mit wa.me-Link
Kunde schreibt WhatsApp ──▶ whatsapp-webhook ──▶ Claude (Tools: Slots,
   Buchung, Übergabe) ──▶ Antwort per Graph API, alles im Posteingang
Termin vorbei ──▶ pg_cron ──▶ send-review-requests ──▶ SMS mit Google-Link
```

KI-Verhalten pro Mandant steuerbar über `client_settings`: `ai_enabled`,
`ai_tone`, `business_description`. Übernahme durch Mensch: Konversation im
Dashboard auf „Übernommen" stellen (Status `human_handoff`) — die KI fasst
diese Konversation dann nicht mehr an.
