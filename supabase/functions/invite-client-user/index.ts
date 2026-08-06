// POST /functions/v1/invite-client-user
// Body: { client_id, email, display_name? }
// Nur die Agentur darf das aufrufen. Legt keinen Login direkt an, sondern
// generiert einen Supabase-Einladungslink und verschickt ihn selbst per
// Resend in einer Reachly-gebrandeten E-Mail - Supabases eigene
// Einladungs-Mail ist generisch (kein Branding, Absender
// noreply@mail.app.supabase.io, wirkt auf Kunden wie Phishing).
// handle_new_user() (siehe init_schema Migration) erstellt aus der
// eingeloggten Session automatisch die passende profiles-Zeile
// (role='client', client_id), weil beides in raw_user_meta_data mitgegeben
// wird.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { sendResendEmail } from "../_shared/email.ts";

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
  const dashboardUrl = Deno.env.get("DASHBOARD_URL") ?? "http://localhost:5176";
  const finalDisplayName = displayName || client.name;

  // generateLink erstellt den Einladungs-User + Link, verschickt aber KEINE
  // E-Mail (anders als inviteUserByEmail) - das Verschicken uebernehmen wir
  // selbst weiter unten, mit eigenem Branding.
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: {
        role: "client",
        client_id: clientId,
        display_name: finalDisplayName,
      },
      redirectTo: `${dashboardUrl}/accept-invite`,
    },
  });

  if (error) {
    console.error("invite-client-user: Einladung fehlgeschlagen", error);
    return jsonResponse({ error: error.message }, 409);
  }

  const actionLink = data.properties?.action_link;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("INVITE_FROM_EMAIL") ?? "Reachly <einladung@verora.app>";

  if (actionLink && resendApiKey) {
    const sent = await sendResendEmail({
      apiKey: resendApiKey,
      from: fromAddress,
      to: email,
      subject: `Ihr Reachly-Zugang für ${client.name}`,
      html: buildInviteEmailHtml({ clientName: client.name, actionLink }),
    });
    if (!sent) {
      console.error("invite-client-user: Resend-Versand fehlgeschlagen, Link wurde dennoch erzeugt");
    }
  } else if (!resendApiKey) {
    console.warn("invite-client-user: RESEND_API_KEY nicht gesetzt - Einladungslink wurde nur erzeugt, nicht verschickt");
  }

  return jsonResponse({ ok: true, user_id: data.user?.id });
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildInviteEmailHtml(params: { clientName: string; actionLink: string }): string {
  const clientName = escapeHtml(params.clientName);
  const step = (n: string, text: string, last = false) => `
    <tr>
      <td style="width:22px;height:22px;background:#0f3d2e;border-radius:50%;text-align:center;vertical-align:middle;font-size:12px;font-weight:bold;color:#f3ede0;">${n}</td>
      <td style="padding-left:10px;${last ? "" : "padding-bottom:10px;"}font-size:13.5px;color:#1c1912;">${text}</td>
    </tr>`;

  return `
    <div style="background:#e5e0d3;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#f3ede0;border-radius:12px;overflow:hidden;border-collapse:collapse;">
        <tr>
          <td style="background:#0f3d2e;padding:22px 28px;">
            <table role="presentation" style="border-collapse:collapse;">
              <tr>
                <td style="width:32px;height:32px;background:#1f9d6e;border-radius:7px;text-align:center;vertical-align:middle;font-weight:bold;font-size:16px;color:#f3ede0;">R</td>
                <td style="padding-left:10px;font-size:18px;font-weight:bold;color:#f3ede0;">Reachly</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 28px 8px;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1c1912;">Hallo,</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1c1912;">
              <strong>${clientName}</strong> hat für Sie einen eigenen Zugang zum Reachly-Dashboard eingerichtet.
            </p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4a4436;">
              Reachly ist der KI-Assistent, der für den Betrieb verpasste Anrufe und Website-Anfragen automatisch
              per SMS und WhatsApp beantwortet, Anliegen klärt und Termine bucht. Als Zugangsberechtigte:r sehen
              Sie im Dashboard alles, was dabei passiert.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px;">
            <table role="presentation" width="100%" style="border-collapse:collapse;background:#ece3d2;border-radius:10px;">
              <tr>
                <td style="padding:18px 20px;">
                  <p style="margin:0 0 12px;font-size:12px;font-weight:bold;letter-spacing:0.04em;text-transform:uppercase;color:#0f3d2e;">So geht's weiter</p>
                  <table role="presentation" style="border-collapse:collapse;width:100%;">
                    ${step("1", "Auf &bdquo;Zugang einrichten&ldquo; klicken")}
                    ${step("2", "Eigenes Passwort festlegen")}
                    ${step("3", "Direkt im Dashboard: Posteingang, Termine und Einstellungen einsehen", true)}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 28px 8px;text-align:center;">
            <table role="presentation" style="margin:0 auto;border-collapse:collapse;">
              <tr>
                <td style="background:#0f3d2e;border-radius:8px;">
                  <a href="${params.actionLink}" style="display:inline-block;padding:13px 26px;font-size:14.5px;font-weight:bold;color:#f3ede0;text-decoration:none;">Zugang einrichten</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8578;">
              Der Link ist aus Sicherheitsgründen zeitlich begrenzt gültig. Falls Sie diese Einladung nicht
              erwartet haben, können Sie diese E-Mail einfach ignorieren.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `.trim();
}
