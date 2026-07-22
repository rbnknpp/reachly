// POST /functions/v1/twilio-voice-webhook
// Wird von Twilio DIREKT aufgerufen (nicht vom Dashboard/Widget), sobald ein
// Anruf bei einer bereitgestellten Reachly-Rufnummer eingeht. Antwort ist
// TwiML, kein JSON. Leitet den Anruf an die echte Nummer des Mandanten
// weiter; das Dial-Ergebnis geht an twilio-voice-status (action-Attribut).
import { createClient } from "npm:@supabase/supabase-js@2";
import { formDataToParams, logTwilioSignatureCheck } from "../_shared/twilio.ts";

function twiml(xml: string): Response {
  return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const params = formDataToParams(await req.formData());

  // Log-only Signaturpruefung waehrend der Rollout-Phase - siehe
  // _shared/twilio.ts fuer die Begruendung.
  await logTwilioSignatureCheck(
    Deno.env.get("TWILIO_AUTH_TOKEN"),
    req.url,
    params,
    req.headers.get("X-Twilio-Signature"),
  );

  const to = params.To;
  if (!to) return twiml(`<Response><Reject/></Response>`);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: settings } = await supabase
    .from("client_settings")
    .select("business_phone")
    .eq("sms_sender_number", to)
    .maybeSingle();

  if (!settings?.business_phone) {
    return twiml(`<Response><Say language="de-DE">Diese Nummer ist derzeit nicht erreichbar.</Say></Response>`);
  }

  const statusUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twilio-voice-status`;
  return twiml(
    `<Response><Dial timeout="20" action="${statusUrl}"><Number>${settings.business_phone}</Number></Dial></Response>`,
  );
});
