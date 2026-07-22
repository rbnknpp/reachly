// Duenner Client fuer die Cal.com v2 API (https://cal.com/docs/api-reference/v2).
//
// Gegen einen echten Cal.com-Account getestet (2026-07-21). Cal.com versioniert
// jeden Endpoint EINZELN per cal-api-version-Header - die Werte unterscheiden
// sich zwischen /slots und /bookings und sind nicht austauschbar. Ein falscher
// Wert liefert kein aussagekraeftiges Fehlerformat, sondern ein generisches
// "Cannot GET/POST ..." (404), da Cal.com die Route fuer die angefragte
// Version schlicht nicht kennt.
const CALCOM_BASE_URL = "https://api.cal.com/v2";
const CALCOM_SLOTS_API_VERSION = "2024-09-04";
const CALCOM_BOOKINGS_API_VERSION = "2026-02-25";

export interface CalcomSlot {
  start: string; // ISO-Zeitstempel
}

export async function fetchCalcomSlots(params: {
  apiKey: string;
  eventTypeId: string;
  startIso: string;
  endIso: string;
  timeZone: string;
}): Promise<string[]> {
  const url = new URL(`${CALCOM_BASE_URL}/slots`);
  url.searchParams.set("eventTypeId", params.eventTypeId);
  url.searchParams.set("start", params.startIso);
  url.searchParams.set("end", params.endIso);
  url.searchParams.set("timeZone", params.timeZone);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "cal-api-version": CALCOM_SLOTS_API_VERSION,
    },
  });

  if (!res.ok) {
    throw new Error(`Cal.com Slots-Abfrage fehlgeschlagen (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  // Antwort ist nach Datum gruppiert: { data: { "2024-08-13": [{ start }, ...] } }
  const byDate = (json?.data ?? {}) as Record<string, CalcomSlot[]>;
  return Object.values(byDate)
    .flat()
    .map((slot) => slot.start)
    .sort();
}

export async function createCalcomBooking(params: {
  apiKey: string;
  eventTypeId: string;
  startIso: string;
  name: string;
  phone: string;
  email: string;
  timeZone: string;
}): Promise<{ start: string; end: string }> {
  const res = await fetch(`${CALCOM_BASE_URL}/bookings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "cal-api-version": CALCOM_BOOKINGS_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start: params.startIso,
      eventTypeId: Number(params.eventTypeId),
      attendee: {
        name: params.name,
        email: params.email,
        phoneNumber: params.phone,
        timeZone: params.timeZone,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Cal.com Buchung fehlgeschlagen (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  const data = json?.data ?? {};
  return { start: data.start, end: data.end };
}
