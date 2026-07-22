// GET /functions/v1/widget-slots?key=<slug>
// Liefert freie Termine der naechsten 7 Tage via Cal.com.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { fetchCalcomSlots } from "../_shared/calcom.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const key = new URL(req.url).searchParams.get("key");
  if (!key) return jsonResponse({ error: "key fehlt" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: allowed } = await supabase.rpc("check_rate_limit", {
    p_client_key: key,
    p_action: "widget-slots",
    p_max_requests: 30,
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

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const slots = await fetchCalcomSlots({
      apiKey: secrets.calcom_api_key,
      eventTypeId: settings.calcom_event_type_id,
      startIso: now.toISOString(),
      endIso: in7Days.toISOString(),
      timeZone: settings.timezone || "Europe/Berlin",
    });
    return jsonResponse({ slots: slots.slice(0, 6) });
  } catch (err) {
    console.error("widget-slots: Cal.com Fehler", err);
    return jsonResponse({ error: "Termine konnten nicht geladen werden" }, 502);
  }
});
