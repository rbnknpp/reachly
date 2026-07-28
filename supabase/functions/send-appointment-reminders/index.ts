// POST /functions/v1/send-appointment-reminders — Terminerinnerung per
// E-Mail, 48h vor dem Termin. Wird per pg_cron (Migration
// 20260728010000_reminder_cron.sql) alle 15 Minuten aufgerufen.
// Autorisierung ueber den Header x-cron-secret, NICHT ueber JWT (deshalb
// mit --no-verify-jwt deployen). Spiegelt send-review-requests, nur
// zeitlich VOR statt NACH dem Termin und per E-Mail statt SMS.
//
// Zwei Schritte, beide idempotent:
//   A) Fuer anstehende Termine ohne appointment_reminder einen Eintrag mit
//      scheduled_for = starts_at - REMINDER_HOURS_BEFORE anlegen
//   B) Faellige appointment_reminders per E-Mail verschicken
//      (status sent/failed/skipped)
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/cors.ts";
import { sendResendEmail } from "../_shared/email.ts";

const REMINDER_HOURS_BEFORE = 48;
// Nur Termine der naechsten 60 Tage betrachten, um die Abfrage zu begrenzen -
// weiter in der Zukunft liegende Termine werden bei einem spaeteren Lauf
// erfasst, sobald sie in dieses Fenster fallen.
const LOOKAHEAD_DAYS = 60;

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("REMINDER_CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return jsonResponse({ error: "Nicht autorisiert" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const lookahead = new Date(now.getTime() + LOOKAHEAD_DAYS * 86_400_000).toISOString();

  // --- Schritt A: anstehende Termine einplanen -----------------------------
  const { data: appointments, error: apptError } = await admin
    .from("appointments")
    .select("id, client_id, starts_at, status")
    .in("status", ["pending", "confirmed"])
    .gt("starts_at", now.toISOString())
    .lte("starts_at", lookahead);
  if (apptError) return jsonResponse({ error: apptError.message }, 500);

  let scheduled = 0;
  if (appointments?.length) {
    const { data: existing } = await admin
      .from("appointment_reminders")
      .select("appointment_id")
      .in("appointment_id", appointments.map((a) => a.id));
    const alreadyScheduled = new Set((existing ?? []).map((r) => r.appointment_id));

    for (const appt of appointments) {
      if (alreadyScheduled.has(appt.id)) continue;
      const scheduledFor = new Date(new Date(appt.starts_at).getTime() - REMINDER_HOURS_BEFORE * 3_600_000);
      const { error } = await admin.from("appointment_reminders").insert({
        client_id: appt.client_id,
        appointment_id: appt.id,
        scheduled_for: scheduledFor.toISOString(),
        status: "scheduled",
      });
      if (!error) scheduled++;
    }
  }

  // --- Schritt B: faellige Erinnerungen verschicken -------------------------
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("REMINDER_FROM_EMAIL") ?? "Reachly <erinnerung@reachly.app>";

  const { data: due, error: dueError } = await admin
    .from("appointment_reminders")
    .select("id, client_id, appointment_id")
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .limit(50);
  if (dueError) return jsonResponse({ error: dueError.message }, 500);

  let sent = 0;
  let failed = 0;
  for (const reminder of due ?? []) {
    const [{ data: appt }, { data: client }] = await Promise.all([
      admin
        .from("appointments")
        .select("title, starts_at, end_customer_id, status")
        .eq("id", reminder.appointment_id)
        .single(),
      admin
        .from("clients")
        .select("name")
        .eq("id", reminder.client_id)
        .single(),
    ]);

    // Zwischenzeitlich abgesagt oder verpasst - Erinnerung ergibt keinen Sinn mehr.
    if (!appt || appt.status === "cancelled" || appt.status === "no_show") {
      await admin.from("appointment_reminders").update({ status: "skipped" }).eq("id", reminder.id);
      continue;
    }

    const { data: customer } = await admin
      .from("end_customers")
      .select("email, name")
      .eq("id", appt.end_customer_id)
      .maybeSingle();

    if (!customer?.email || !resendApiKey) {
      await admin.from("appointment_reminders").update({ status: "skipped" }).eq("id", reminder.id);
      continue;
    }

    const when = new Date(appt.starts_at).toLocaleString("de-DE", {
      timeZone: "Europe/Berlin",
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const businessName = client?.name ?? "Ihr Termin";
    const greeting = customer.name ? `Hallo ${customer.name},` : "Hallo,";

    const html = `
      <p>${greeting}</p>
      <p>kurze Erinnerung an Ihren Termin bei <strong>${businessName}</strong>:</p>
      <p style="font-size:16px;"><strong>${appt.title}</strong><br>${when} Uhr</p>
      <p>Falls Sie den Termin nicht wahrnehmen können, melden Sie sich bitte rechtzeitig bei uns.</p>
      <p>Bis bald!</p>
    `.trim();

    const ok = await sendResendEmail({
      apiKey: resendApiKey,
      from: fromAddress,
      to: customer.email,
      subject: `Erinnerung: Ihr Termin bei ${businessName}`,
      html,
    });

    await admin
      .from("appointment_reminders")
      .update({ status: ok ? "sent" : "failed", sent_at: ok ? now.toISOString() : null })
      .eq("id", reminder.id);
    ok ? sent++ : failed++;
  }

  return jsonResponse({ ok: true, scheduled, sent, failed });
});
