// Das Widget laeuft auf beliebigen Kunden-Websites (unbekannte Domains vorab) -
// daher muss Access-Control-Allow-Origin offen sein. Schutz kommt stattdessen
// ueber den public/rate-limited key-Check in jeder Function selbst.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}
