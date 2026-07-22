const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Reachly Widget: fehlende Build-Env (VITE_SUPABASE_URL/ANON_KEY)");
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Reachly Widget: ${path} fehlgeschlagen (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface LeadPayload {
  key: string;
  name: string;
  phone: string;
  concern?: string;
}

// Edge Function `widget-lead` (Backend ergaenzt sie noch) - legt end_customer +
// Konversation Kanal 'sms' + Lead-Nachricht an.
export function submitLead(payload: LeadPayload) {
  return call<{ ok: true }>("widget-lead", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface SlotsResponse {
  slots: string[]; // ISO-Zeitstempel, max. 7 Tage voraus
}

// Edge Function `widget-slots` (Backend ergaenzt sie noch) - fragt intern Cal.com ab.
export function fetchSlots(key: string) {
  return call<SlotsResponse>(`widget-slots?key=${encodeURIComponent(key)}`);
}

export interface BookPayload {
  key: string;
  slotStart: string;
  name: string;
  phone: string;
  email: string;
}

// Edge Function `widget-book` - bucht via Cal.com. Cal.com verlangt zwingend
// eine gueltige, empfangsfaehige E-Mail pro Buchung (auch wenn das Widget
// primaer telefonzentriert ist) - daher zusaetzlich zu Name/Telefon erhoben.
export function bookSlot(payload: BookPayload) {
  return call<{ ok: true }>("widget-book", {
    method: "POST",
    body: JSON.stringify({
      key: payload.key,
      slot_start: payload.slotStart,
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
    }),
  });
}
