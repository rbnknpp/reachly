import { useState } from "preact/hooks";
import { submitLead } from "../api";
import { CheckIcon, ErrorIcon } from "../icons";

type Status = "idle" | "submitting" | "success" | "error";

interface Props {
  widgetKey: string;
}

export function CallbackForm({ widgetKey }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [concern, setConcern] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const canSubmit = name.trim().length > 1 && phone.trim().length > 5;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!canSubmit || status === "submitting") return;
    setStatus("submitting");
    try {
      await submitLead({ key: widgetKey, name: name.trim(), phone: phone.trim(), concern: concern.trim() || undefined });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div class="reachly-state reachly-state-success">
        <CheckIcon />
        <p>Danke! Wir melden uns so schnell wie möglich bei Ihnen.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div class="reachly-state reachly-state-error">
        <ErrorIcon />
        <p>Das hat leider nicht geklappt. Bitte versuchen Sie es erneut.</p>
        <button class="reachly-btn-primary" onClick={() => setStatus("idle")}>
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <form class="reachly-form" onSubmit={handleSubmit}>
      <div class="reachly-field">
        <label for="reachly-cb-name">Name</label>
        <input
          id="reachly-cb-name"
          type="text"
          value={name}
          required
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="reachly-field">
        <label for="reachly-cb-phone">Telefonnummer</label>
        <input
          id="reachly-cb-phone"
          type="tel"
          value={phone}
          required
          onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="reachly-field">
        <label for="reachly-cb-concern">Anliegen (optional)</label>
        <textarea
          id="reachly-cb-concern"
          rows={3}
          value={concern}
          onInput={(e) => setConcern((e.target as HTMLTextAreaElement).value)}
        />
      </div>
      <button class="reachly-btn-primary" type="submit" disabled={!canSubmit || status === "submitting"}>
        {status === "submitting" ? <span class="reachly-spinner" /> : "Rückruf anfordern"}
      </button>
    </form>
  );
}
