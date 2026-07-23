// GET /functions/v1/widget-config?key=<slug>
// Oeffentlicher, gecachter Endpoint. Liefert NUR unbedenkliche Daten (Farbe,
// Texte, wa.me-Nummer, aktive Aktionen) - niemals interne IDs oder Settings im
// Volltext.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const key = new URL(req.url).searchParams.get("key");
  if (!key) return jsonResponse({ error: "key fehlt" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: allowed } = await supabase.rpc("check_rate_limit", {
    p_client_key: key,
    p_action: "widget-config",
    p_max_requests: 60,
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
    .select(
      "widget_accent_color, widget_position, widget_greeting, widget_whatsapp_prefill_text, widget_action_whatsapp, widget_action_callback, widget_action_booking, wa_business_number, business_phone, calcom_event_type_id, widget_social_instagram_url, widget_action_instagram, widget_social_facebook_url, widget_action_facebook, widget_social_tiktok_url, widget_action_tiktok",
    )
    .eq("client_id", client.id)
    .maybeSingle();
  if (!settings) return jsonResponse({ error: "Konfiguration fehlt" }, 404);

  // Cal.com-Zugangsdaten liegen separat in client_integration_secrets (keine
  // RLS-Policies, nur per service_role lesbar) - hier nur die Existenz
  // pruefen, der Key selbst verlaesst die Function nie.
  const { data: secrets } = await supabase
    .from("client_integration_secrets")
    .select("calcom_api_key")
    .eq("client_id", client.id)
    .maybeSingle();

  return jsonResponse(
    {
      key,
      accent_color: settings.widget_accent_color,
      position: settings.widget_position,
      greeting: settings.widget_greeting,
      actions: {
        whatsapp: settings.widget_action_whatsapp && !!settings.wa_business_number,
        // Rueckruf nur anbieten, wenn ueberhaupt eine erreichbare Nummer
        // hinterlegt ist - sonst verspricht der Button einen Rueckruf, den
        // niemand ausfuehren kann.
        callback: settings.widget_action_callback && !!settings.business_phone,
        // Terminbuchung braucht zwingend Event-Type UND verbundenen
        // Cal.com-API-Key (siehe widget-slots), sonst laeuft der Flow direkt
        // in einen Fehlerzustand.
        booking: settings.widget_action_booking && !!settings.calcom_event_type_id && !!secrets?.calcom_api_key,
      },
      whatsapp_number: settings.wa_business_number ?? null,
      whatsapp_prefill_text: settings.widget_whatsapp_prefill_text,
      social: {
        instagram: settings.widget_action_instagram ? (settings.widget_social_instagram_url || null) : null,
        facebook: settings.widget_action_facebook ? (settings.widget_social_facebook_url || null) : null,
        tiktok: settings.widget_action_tiktok ? (settings.widget_social_tiktok_url || null) : null,
      },
    },
    200,
    { "Cache-Control": "public, max-age=300" },
  );
});
