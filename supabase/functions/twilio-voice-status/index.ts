// POST /functions/v1/twilio-voice-status
// Wird von Twilio als "action"-Callback des <Dial> aus twilio-voice-webhook
// aufgerufen, sobald der Weiterleitungsversuch beendet ist. Bei
// no-answer/busy/failed: missed_calls-Zeile anlegen + automatische SMS mit
// wa.me-Link verschicken.
import { createClient } from "npm:@supabase/supabase-js@2";
import { formDataToParams, logTwilioSignatureCheck, sendTwilioSms } from "../_shared/twilio.ts";

function twiml(xml = "<Response></Response>"): Response {
  return new Response(xml, { headers: { "Content-Type": "text/xml" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const params = formDataToParams(await req.formData());

  await logTwilioSignatureCheck(
    Deno.env.get("TWILIO_AUTH_TOKEN"),
    req.url,
    params,
    req.headers.get("X-Twilio-Signature"),
  );

  const to = params.To;
  const from = params.From;
  const callSid = params.CallSid;
  const dialCallStatus = params.DialCallStatus;

  if (!to || !from || !callSid) return twiml();
  if (dialCallStatus === "completed") return twiml();

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Idempotenz: Twilio kann denselben Status-Callback erneut senden.
  const { data: existing } = await supabase
    .from("missed_calls")
    .select("id")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();
  if (existing) return twiml();

  const { data: settings } = await supabase
    .from("client_settings")
    .select("client_id, missed_call_sms_text, wa_business_number")
    .eq("sms_sender_number", to)
    .maybeSingle();
  if (!settings) return twiml();

  const { data: missedCall, error: insertError } = await supabase
    .from("missed_calls")
    .insert({ client_id: settings.client_id, caller_phone: from, status: "detected", twilio_call_sid: callSid })
    .select("id")
    .single();
  if (insertError || !missedCall) {
    console.error("twilio-voice-status: missed_calls Insert fehlgeschlagen", insertError);
    return twiml();
  }

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) {
    console.error("twilio-voice-status: Twilio-Zugangsdaten fehlen fuer SMS-Versand");
    await supabase.from("missed_calls").update({ status: "sms_failed" }).eq("id", missedCall.id);
    return twiml();
  }

  const waLink = settings.wa_business_number ? ` https://wa.me/${settings.wa_business_number}` : "";
  const smsText = `${settings.missed_call_sms_text || "Wir haben Ihren Anruf leider verpasst. Wie können wir helfen?"}${waLink}`;

  const smsOk = await sendTwilioSms({ accountSid, authToken, from: to, to: from, body: smsText });

  await supabase.from("missed_calls").update({ status: smsOk ? "sms_sent" : "sms_failed" }).eq("id", missedCall.id);

  return twiml();
});
