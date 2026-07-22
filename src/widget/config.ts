import type { WidgetConfig } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface RawWidgetConfigResponse {
  key: string;
  accent_color: string;
  position: "left" | "right";
  greeting: string;
  actions: { whatsapp: boolean; callback: boolean; booking: boolean };
  whatsapp_number: string | null;
  whatsapp_prefill_text: string | null;
  social?: { instagram: string | null; facebook: string | null; tiktok: string | null };
}

function cacheKey(key: string) {
  return `reachly:widget-config:${key}`;
}

function readCache(key: string): WidgetConfig | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(key));
    if (!raw) return null;
    const { value, storedAt } = JSON.parse(raw) as { value: WidgetConfig; storedAt: number };
    if (Date.now() - storedAt > CACHE_TTL_MS) return null;
    return value;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: WidgetConfig) {
  try {
    sessionStorage.setItem(cacheKey(key), JSON.stringify({ value, storedAt: Date.now() }));
  } catch {
    // sessionStorage evtl. blockiert (privater Modus etc.) - dann einfach nicht cachen.
  }
}

function normalize(raw: RawWidgetConfigResponse): WidgetConfig {
  return {
    key: raw.key,
    accentColor: raw.accent_color || "#059669",
    position: raw.position === "left" ? "left" : "right",
    greeting: raw.greeting || "Wie können wir helfen?",
    actions: raw.actions,
    whatsappNumber: raw.whatsapp_number,
    whatsappPrefillText: raw.whatsapp_prefill_text,
    // defensiv, falls der 5-Minuten-Cache waehrend eines Rollouts noch eine
    // Antwort ohne social-Feld liefert (aeltere Function-Version).
    social: raw.social ?? { instagram: null, facebook: null, tiktok: null },
  };
}

/**
 * Laedt die oeffentliche Widget-Config. Liefert bei jedem Fehler (Netzwerk,
 * ungueltiger Key, inaktiver Client, fehlende Build-Env) `null` zurueck –
 * der Aufrufer muss dann bewusst NICHTS rendern (Graceful Degradation).
 */
export async function fetchWidgetConfig(key: string): Promise<WidgetConfig | null> {
  const cached = readCache(key);
  if (cached) return cached;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  try {
    const url = `${SUPABASE_URL}/functions/v1/widget-config?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as RawWidgetConfigResponse;
    const config = normalize(raw);
    writeCache(key, config);
    return config;
  } catch {
    return null;
  }
}
