import { render } from "preact";
import { fetchWidgetConfig } from "./config";
import { widgetCss } from "./styles";
import { WidgetApp, type WidgetAppControls } from "./ui/App";

export interface WidgetControls {
  open: () => void;
  close: () => void;
}

const HOST_ID = "reachly-widget-host";

/**
 * Laedt die Config und mountet das Widget in einen isolierten Shadow Root.
 * Liefert bei fehlender/ungueltiger Config `null` - der Aufrufer rendert dann
 * bewusst gar nichts (Graceful Degradation, kein kaputter Button auf der
 * Kundenwebsite).
 */
export async function mountWidget(key: string): Promise<WidgetControls | null> {
  if (document.getElementById(HOST_ID)) {
    return null; // bereits gemountet
  }

  const config = await fetchWidgetConfig(key);
  if (!config) return null;

  const host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = widgetCss(config.accentColor);
  shadow.appendChild(style);

  const mountPoint = document.createElement("div");
  mountPoint.className = "reachly-root";
  shadow.appendChild(mountPoint);

  let controls: WidgetAppControls = { open: () => {}, close: () => {} };

  render(
    <WidgetApp
      config={config}
      exposeControls={(c) => {
        controls = c;
      }}
    />,
    mountPoint,
  );

  return {
    open: () => controls.open(),
    close: () => controls.close(),
  };
}
