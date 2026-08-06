import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

/**
 * supabase-js wirft bei einem non-2xx Edge-Function-Aufruf nur einen
 * generischen FunctionsHttpError ("Edge Function returned a non-2xx status
 * code") - die eigentliche, hilfreiche Fehlermeldung steckt im JSON-Body der
 * Response unter error.context. Hier ausgepackt, damit Nutzer:innen sehen,
 * was wirklich schiefging (z. B. "Twilio ist noch nicht konfiguriert").
 */
export async function functionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as { error?: string };
        if (body?.error) return body.error;
      } catch {
        // Body war kein JSON - Fallback unten.
      }
    }
  }
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}
