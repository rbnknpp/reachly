// POST /functions/v1/widget-book
// Body: { key, slot_start, name, phone, email }
// Bucht den Slot via Cal.com und legt den Termin in `appointments` an.
// email ist erforderlich, weil Cal.com pro Buchung eine gueltige,
// empfangsfaehige Adresse verlangt (getestet, sonst Fehler
// "email_domain_cannot_receive_mail").
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createCalcomBooking } from "../_shared/calcom.ts";

interface BookBody {
  key?: string;
  slot_start?: string;
  name?: string;
  phone?: string;
  email?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let body: BookBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Ungültiger Body" }, 400);
  }

  const key = body.key?.trim();
  const slotStart = body.slot_start?.trim();
  const name = body.name?.trim();
  const phone = body.phone?.trim();
  const email = body.email?.trim();

  if (!key || !slotStart || !name || !phone || !email) {
    return jsonResponse({ error: "key, slot_start, name, phone und email sind erforderlich" }, 400);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: allowed } = await supabase.rpc("check_rate_limit", {
    p_client_key: key,
    p_action: "widget-book",
    p_max_requests: 10,
    p_window_seconds: 300,
  });
  if (!allowed) return jsonResponse({ error: "Rate limit erreicht" }, 429);

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", key)
    .eq("active", true)
    .maybeSingle();
  if (!client) return jsonResponse({ error: "Unbekannter oder inaktiver Mandant" }, 404);

  const { data: settings } = await supabase
    .from("client_settings")
    .select("calcom_event_type_id, timezone")
    .eq("client_id", client.id)
    .maybeSingle();
  if (!settings?.calcom_event_type_id) {
    return jsonResponse({ error: "Terminbuchung für diesen Mandanten nicht konfiguriert" }, 404);
  }

  const { data: secrets } = await supabase
    .from("client_integration_secrets")
    .select("calcom_api_key")
    .eq("client_id", client.id)
    .maybeSingle();
  if (!secrets?.calcom_api_key) {
    return jsonResponse({ error: "Cal.com nicht verbunden" }, 404);
  }

  let booking: { start: string; end: string };
  try {
    booking = await createCalcomBooking({
      apiKey: secrets.calcom_api_key,
      eventTypeId: settings.calcom_event_type_id,
      startIso: slotStart,
      name,
      phone,
      email,
      timeZone: settings.timezone || "Europe/Berlin",
    });
  } catch (err) {
    console.error("widget-book: Cal.com Fehler", err);
    return jsonResponse({ error: "Termin konnte nicht gebucht werden" }, 502);
  }

  const { data: endCustomer, error: ecError } = await supabase
    .from("end_customers")
    .upsert({ client_id: client.id, phone, name, email }, { onConflict: "client_id,phone" })
    .select("id")
    .single();
  if (ecError || !endCustomer) {
    return jsonResponse({ error: "Kunde konnte nicht angelegt werden" }, 500);
  }

  const { error: apptError } = await supabase.from("appointments").insert({
    client_id: client.id,
    end_customer_id: endCustomer.id,
    title: "Termin über Widget gebucht",
    starts_at: booking.start,
    ends_at: booking.end,
    status: "confirmed",
  });
  if (apptError) {
    console.error("widget-book: Termin konnte nicht gespeichert werden", apptError);
    // Cal.com-Buchung ist bereits erfolgt - dem Kunden trotzdem Erfolg melden,
    // der Termin existiert im Kalender, auch wenn der Dashboard-Datensatz fehlt.
  }

  return jsonResponse({ ok: true });
});
