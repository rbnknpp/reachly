// POST /functions/v1/send-review-requests — Bewertungs-Automation.
// Wird per pg_cron (Migration 20260724090000_review_cron.sql) alle 15 Minuten
// aufgerufen. Autorisierung ueber den Header x-cron-secret, NICHT ueber JWT
// (deshalb mit --no-verify-jwt deployen).
//
// Zwei Schritte, beide idempotent:
//   A) Fuer abgeschlossene Termine ohne review_request einen Eintrag mit
//      scheduled_for = ends_at + review_delay_hours anlegen
//   B) Faellige review_requests per SMS mit dem Google-Bewertungslink
//      verschicken (status sent/failed/skipped)
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "../_shared/cors.ts";
import { sendTwilioSms } from "../_shared/twilio.ts";

// Nur Termine der letzten 14 Tage betrachten - aeltere Bewertungsbitten
// wirken aufdringlich und bringen nichts mehr.
const LOOKBACK_DAYS = 14;

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("REVIEW_CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return jsonResponse({ error: "Nicht autorisiert" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const lookback = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();

  // --- Schritt A: faellige Termine einplanen -------------------------------
  // "Abgeschlossen" = Status completed ODER confirmed mit ends_at in der
  // Vergangenheit (im Dashboard wird der Status selten manuell umgestellt).
  const { data: appointments, error: apptError } = await admin
    .from("appointments")
    .select("id, client_id, ends_at, status")
    .in("status", ["confirmed", "completed"])
    .lt("ends_at", now.toISOString())
    .gte("ends_at", lookback);
  if (apptError) return jsonResponse({ error: apptError.message }, 500);

  let scheduled = 0;
  if (appointments?.length) {
    const { data: existing } = await admin
      .from("review_requests")
      .select("appointment_id")
      .in("appointment_id", appointments.map((a) => a.id));
    const alreadyScheduled = new Set((existing ?? []).map((r) => r.appointment_id));

    const clientIds = [...new Set(appointments.map((a) => a.client_id))];
    const { data: settingsRows } = await admin
      .from("client_settings")
      .select("client_id, review_delay_hours, google_review_url")
      .in("client_id", clientIds);
    const settingsByClient = new Map((settingsRows ?? []).map((s) => [s.client_id, s]));

    for (const appt of appointments) {
      if (alreadyScheduled.has(appt.id)) continue;
      const settings = settingsByClient.get(appt.client_id);
      const delayHours = settings?.review_delay_hours ?? 48;
      const scheduledFor = new Date(new Date(appt.ends_at).getTime() + delayHours * 3_600_000);
      const { error } = await admin.from("review_requests").insert({
        client_id: appt.client_id,
        appointment_id: appt.id,
        scheduled_for: scheduledFor.toISOString(),
        // Ohne Bewertungslink direkt als skipped markieren statt ewig zu warten
        status: settings?.google_review_url ? "scheduled" : "skipped",
      });
      if (!error) scheduled++;
    }
  }

  // --- Schritt B: faellige Anfragen verschicken ----------------------------
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

  const { data: due, error: dueError } = await admin
    .from("review_requests")
    .select("id, client_id, appointment_id")
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .limit(50);
  if (dueError) return jsonResponse({ error: dueError.message }, 500);

  let sent = 0;
  let failed = 0;
  for (const request of due ?? []) {
    const [{ data: settings }, { data: appt }] = await Promise.all([
      admin
        .from("client_settings")
        .select("google_review_url, sms_sender_number")
        .eq("client_id", request.client_id)
        .maybeSingle(),
      admin
        .from("appointments")
        .select("end_customer_id")
        .eq("id", request.appointment_id)
        .single(),
    ]);
    const { data: customer } = await admin
      .from("end_customers")
      .select("phone")
      .eq("id", appt?.end_customer_id ?? "")
      .maybeSingle();

    if (!settings?.google_review_url || !settings?.sms_sender_number || !customer?.phone || !accountSid || !authToken) {
      await admin
        .from("review_requests")
        .update({ status: "skipped" })
        .eq("id", request.id);
      continue;
    }

    const { data: client } = await admin
      .from("clients")
      .select("name")
      .eq("id", request.client_id)
      .single();

    const body =
      `Vielen Dank, dass Sie bei ${client?.name ?? "uns"} waren! ` +
      `Über eine kurze Google-Bewertung würden wir uns sehr freuen: ${settings.google_review_url}`;

    const ok = await sendTwilioSms({
      accountSid,
      authToken,
      from: settings.sms_sender_number,
      to: customer.phone,
      body,
    });

    await admin
      .from("review_requests")
      .update({ status: ok ? "sent" : "failed", sent_at: ok ? now.toISOString() : null })
      .eq("id", request.id);
    ok ? sent++ : failed++;
  }

  return jsonResponse({ ok: true, scheduled, sent, failed });
});
