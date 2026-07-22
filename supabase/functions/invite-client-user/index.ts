// POST /functions/v1/invite-client-user
// Body: { client_id, email, display_name? }
// Nur die Agentur darf das aufrufen. Legt keinen Login direkt an, sondern
// verschickt eine Supabase-Einladungs-E-Mail - der Kunde setzt sein Passwort
// selbst ueber /accept-invite. handle_new_user() (siehe init_schema Migration)
// erstellt daraus automatisch die passende profiles-Zeile (role='client',
// client_id), weil beides in raw_user_meta_data mitgegeben wird.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

interface InviteBody {
  client_id?: string;
  email?: string;
  display_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Nicht angemeldet" }, 401);

  let body: InviteBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Ungültiger Body" }, 400);
  }

  const clientId = body.client_id?.trim();
  const email = body.email?.trim();
  const displayName = body.display_name?.trim();
  if (!clientId || !email) {
    return jsonResponse({ error: "client_id und email sind erforderlich" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // User-scoped Client: bestaetigt per RLS gleichzeitig, dass der Aufrufer
  // eingeloggt ist UND dass der Mandant fuer ihn sichtbar ist.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: "Nicht angemeldet" }, 401);

  const { data: profile } = await userClient.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (!profile || profile.role !== "agency") {
    return jsonResponse({ error: "Nur die Agentur darf Zugänge anlegen" }, 403);
  }

  const { data: client } = await userClient.from("clients").select("id, name").eq("id", clientId).maybeSingle();
  if (!client) return jsonResponse({ error: "Mandant nicht gefunden" }, 404);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const dashboardUrl = Deno.env.get("DASHBOARD_URL") ?? "http://localhost:5173";

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      role: "client",
      client_id: clientId,
      display_name: displayName || client.name,
    },
    redirectTo: `${dashboardUrl}/accept-invite`,
  });

  if (error) {
    console.error("invite-client-user: Einladung fehlgeschlagen", error);
    return jsonResponse({ error: error.message }, 409);
  }

  return jsonResponse({ ok: true, user_id: data.user?.id });
});
