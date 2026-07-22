import { mountWidget, type WidgetControls } from "./mount";

declare global {
  interface Window {
    Reachly?: {
      init: (key?: string) => void;
      open: () => void;
      close: () => void;
    };
  }
}

function readKeyFromScriptTag(): string | null {
  // document.currentScript ist bei type="module" IMMER null (Spec) und bei
  // async-Scripts ebenfalls unzuverlaessig - deshalb bevorzugt per Selektor
  // suchen. Erst spezifisch nach dem Produktions-Bundle, dann generisch nach
  // jedem Script-Tag mit data-key (deckt auch den Vite-Dev-Modus ab, wo die
  // Quelldatei statt widget.js referenziert wird).
  const specific = document.querySelector<HTMLScriptElement>(
    'script[data-key][src*="widget.js"]',
  );
  if (specific?.dataset.key) return specific.dataset.key;

  const current = document.currentScript as HTMLScriptElement | null;
  if (current?.dataset.key) return current.dataset.key;

  const anyTagged = document.querySelector<HTMLScriptElement>("script[data-key]");
  return anyTagged?.dataset.key ?? null;
}

let controls: WidgetControls | null = null;

async function boot(explicitKey?: string) {
  const key = explicitKey ?? readKeyFromScriptTag();
  if (!key) {
    console.warn("[Reachly] Kein data-key gefunden - Widget wird nicht geladen.");
    return;
  }
  controls = await mountWidget(key);
}

// Einziger globaler Namespace, den das Widget auf der Host-Seite anlegt.
window.Reachly = {
  init: (key?: string) => {
    void boot(key);
  },
  open: () => controls?.open(),
  close: () => controls?.close(),
};

function start() {
  void boot();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
