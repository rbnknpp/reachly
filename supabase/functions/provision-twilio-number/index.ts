// POST /functions/v1/provision-twilio-number
// Body: { client_id }
// Kauft automatisch eine deutsche Twilio-Rufnummer fuer den Mandanten und
// konfiguriert sie so, dass eingehende Anrufe an twilio-voice-webhook gehen.
// Wird vom Dashboard NACH einer Kosten-Bestaetigung durch den Nutzer
// aufgerufen (siehe ClientSettingsForm) - kauft echte, kostenpflichtige
// Twilio-Ressourcen, daher striktes Idempotenz-Gate unten.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

interface ProvisionBody {
  client_id?: string;
}

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Nicht angemeldet" }, 401);

  let body: ProvisionBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Ungültiger Body" }, 400);
  }

  const clientId = body.client_id?.trim();
  if (!clientId) return jsonResponse({ error: "client_id ist erforderlich" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // User-scoped Client: RLS (clients_select) entscheidet, ob der Aufrufer
  // (Agentur oder der Mandant selbst) ueberhaupt Zugriff hat.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: client } = await userClient.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return jsonResponse({ error: "Kein Zugriff" }, 403);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: settings } = await adminClient
    .from("client_settings")
    .select("business_phone, sms_sender_number")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!settings?.business_phone) {
    return jsonResponse({ error: "Bitte zuerst Ihre eigene Telefonnummer speichern" }, 400);
  }
  // Idempotenz-Gate: echte Twilio-Kosten, niemals versehentlich doppelt kaufen.
  if (settings.sms_sender_number) {
    return jsonResponse({ error: "Rufnummer bereits eingerichtet" }, 409);
  }

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) {
    return jsonResponse({ error: "Twilio ist noch nicht konfiguriert (fehlende Agentur-Zugangsdaten)" }, 503);
  }
  const basicAuth = `Basic ${btoa(`${accountSid}:${authToken}`)}`;

  // 1) Freie deutsche Nummer suchen (Sprache + SMS, damit sowohl Weiterleitung
  // als auch die automatische Missed-Call-SMS darueber laufen koennen).
  const searchUrl = new URL(`${TWILIO_API_BASE}/Accounts/${accountSid}/AvailablePhoneNumbers/DE/Local.json`);
  searchUrl.searchParams.set("SmsEnabled", "true");
  searchUrl.searchParams.set("VoiceEnabled", "true");

  const searchRes = await fetch(searchUrl, { headers: { Authorization: basicAuth } });
  if (!searchRes.ok) {
    console.error("provision-twilio-number: Twilio-Suche fehlgeschlagen", await searchRes.text());
    return jsonResponse({ error: "Twilio-Nummernsuche fehlgeschlagen" }, 502);
  }
  const searchJson = await searchRes.json();
  const candidate = searchJson?.available_phone_numbers?.[0]?.phone_number as string | undefined;
  if (!candidate) {
    return jsonResponse({ error: "Aktuell keine freie deutsche Rufnummer bei Twilio verfügbar" }, 502);
  }

  // 2) Kaufen + Voice-Webhook im selben Request setzen.
  const purchaseParams = new URLSearchParams({
    PhoneNumber: candidate,
    VoiceUrl: `${supabaseUrl}/functions/v1/twilio-voice-webhook`,
    VoiceMethod: "POST",
  });
  const purchaseRes = await fetch(`${TWILIO_API_BASE}/Accounts/${accountSid}/IncomingPhoneNumbers.json`, {
    method: "POST",
    headers: {
      Authorization: basicAuth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: purchaseParams,
  });

  if (!purchaseRes.ok) {
    const errText = await purchaseRes.text();
    console.error("provision-twilio-number: Kauf fehlgeschlagen", errText);
    // Haeufige Ursache: fehlendes "Regulatory Bundle" (Identitaetsnachweis)
    // fuer deutsche Nummern - dem Nutzer eine verwertbare Meldung geben statt
    // nur "502".
    return jsonResponse(
      { error: "Rufnummer konnte nicht gekauft werden. Möglicherweise fehlt ein Twilio Regulatory Bundle für DE-Nummern." },
      502,
    );
  }

  const purchaseJson = await purchaseRes.json();
  const purchasedNumber = purchaseJson.phone_number as string;
  const phoneNumberSid = purchaseJson.sid as string;

  const { error: updateError } = await adminClient
    .from("client_settings")
    .update({ sms_sender_number: purchasedNumber, twilio_phone_number_sid: phoneNumberSid })
    .eq("client_id", clientId);

  if (updateError) {
    console.error("provision-twilio-number: Speichern fehlgeschlagen", updateError);
    return jsonResponse({ error: "Nummer gekauft, aber nicht gespeichert - bitte Support kontaktieren" }, 500);
  }

  return jsonResponse({ ok: true, phone_number: purchasedNumber });
});
