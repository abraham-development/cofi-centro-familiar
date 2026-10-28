"use client";

import { Monitor, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { isQuietTime } from "@/lib/pwa/quiet-time";
import { formatLocalTime } from "@/lib/time/zoned";

const subscribe = (callback: () => void) => {
  window.addEventListener("cofi:screen-preferences", callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener("cofi:screen-preferences", callback); window.removeEventListener("storage", callback); };
};
const noop = () => () => {};

type Preferences = {
  keepAwake: boolean; autoNight: boolean; night: boolean; supported: boolean; wakeStatus: string;
  selectedTheme: string; changeTheme: (value: string) => void; toggle: (flag: "awake" | "night") => void;
  quietLabel: string; storageError: string;
};
const PreferencesContext = createContext<Preferences | null>(null);

export function ScreenPreferencesProvider({ preferenceId, timezone, quietStart, quietEnd, hourFormat, serverNow, children }: {
  preferenceId: string; timezone: string; quietStart: string; quietEnd: string;
  hourFormat: "12h" | "24h"; serverNow: number; children: React.ReactNode;
}) {
  const { setTheme } = useTheme();
  const [storageError, setStorageError] = useState("");
  const [now, setNow] = useState(serverNow);
  const [wakeStatus, setWakeStatus] = useState("Desactivado");
  const supported = useSyncExternalStore(noop, () => "wakeLock" in navigator, () => false);
  const key = `cofi-screen:${preferenceId}`;
  const preferences = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
  }, () => "");
  const themeKey = `cofi-screen-theme:${preferenceId}`;
  const selectedTheme = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(themeKey) ?? ""; } catch { return "system"; }
  }, () => "");
  const keepAwake = preferences.split(",").includes("awake");
  const autoNight = preferences.split(",").includes("night");
  const night = autoNight && isQuietTime(now, timezone, quietStart, quietEnd);

  function toggle(flag: "awake" | "night") {
    const selected = new Set(preferences.split(",").filter(Boolean));
    if (selected.has(flag)) selected.delete(flag); else selected.add(flag);
    try { localStorage.setItem(key, [...selected].join(",")); } catch { setStorageError("Este navegador no permite guardar las preferencias de pantalla."); return; }
    window.dispatchEvent(new Event("cofi:screen-preferences"));
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  function changeTheme(value: string) {
    if (!["light", "dark", "system"].includes(value)) return;
    try { localStorage.setItem(themeKey, value); } catch { setStorageError("Este navegador no permite guardar el tema."); return; }
    window.dispatchEvent(new Event("cofi:screen-preferences"));
  }

  useEffect(() => {
    let original = "system";
    try {
      const stored = localStorage.getItem("theme");
      if (stored && ["light", "dark", "system"].includes(stored)) original = stored;
      if (!localStorage.getItem(themeKey)) localStorage.setItem(themeKey, original);
      window.dispatchEvent(new Event("cofi:screen-preferences"));
    } catch { /* El tema del sistema sigue disponible sin almacenamiento. */ }
    return () => setTheme(original);
  }, [themeKey, setTheme]);

  useEffect(() => {
    if (selectedTheme) setTheme(night ? "dark" : selectedTheme);
  }, [night, selectedTheme, setTheme]);

  useEffect(() => {
    if (!keepAwake || !supported) return;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    let requesting = false;
    const acquire = async () => {
      if (disposed || requesting || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      requesting = true;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (disposed) { await next.release(); return; }
        lock = next;
        setWakeStatus("Pantalla encendida");
        next.addEventListener("release", () => { if (!disposed) setWakeStatus("Liberado por el sistema; se reintentará al volver"); });
      } catch {
        if (!disposed) setWakeStatus("El sistema no permitió mantenerla encendida");
      } finally { requesting = false; }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => { disposed = true; document.removeEventListener("visibilitychange", acquire); void lock?.release(); };
  }, [keepAwake, supported]);

  return (
    <PreferencesContext value={{ keepAwake, autoNight, night, supported, wakeStatus, selectedTheme,
      changeTheme, toggle, storageError,
      quietLabel: `${formatLocalTime(quietStart, hourFormat)} a ${formatLocalTime(quietEnd, hourFormat)}` }}>
      {children}
    </PreferencesContext>
  );
}

/** Solo la interfaz se desmonta al navegar; los efectos viven en el proveedor. */
export function ScreenControls() {
  const prefs = useContext(PreferencesContext);
  if (!prefs) throw new Error("Falta el proveedor de preferencias de pantalla");
  const { keepAwake, autoNight, night, supported, wakeStatus, selectedTheme, changeTheme, toggle, quietLabel, storageError } = prefs;
  return (
    <Panel id="opciones-pantalla" title="En este equipo" caption="Estas opciones solo cambian esta tablet o celular">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Tema</legend>
        <div className="flex flex-wrap gap-2">
          {[["light", "Claro"], ["dark", "Oscuro"], ["system", "Según el equipo"]].map(([value, label]) => (
            <Button key={value} data-offline-safe variant={selectedTheme === value ? "default" : "outline"}
              aria-pressed={selectedTheme === value} onClick={() => changeTheme(value)}>{label}</Button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button data-offline-safe variant="outline" aria-pressed={keepAwake} disabled={!supported} onClick={() => toggle("awake")}>
          <Monitor aria-hidden /> {keepAwake ? "Desactivar pantalla encendida" : "Mantener pantalla encendida"}
        </Button>
        <span role="status" className="text-sm text-muted-foreground">{!supported ? "Este navegador no permite controlar el encendido" : keepAwake ? wakeStatus : "Encendido según el dispositivo"}</span>
      </div>
      <div className="flex flex-col items-start gap-2">
        <Button data-offline-safe variant="outline" aria-pressed={autoNight} onClick={() => toggle("night")}>
          <Moon aria-hidden /> Noche automática
        </Button>
        <p className="text-sm text-muted-foreground">{autoNight ? `${night ? "Tema nocturno activo" : "Usa el tema elegido"}; noche de ${quietLabel}. Fuera de ese horario se respeta tu tema.` : "Usa el tema elegido. Puedes activar la noche en el horario familiar."} Sin sonidos.</p>
      </div>
      {storageError ? <p role="alert">{storageError}</p> : null}
    </Panel>
  );
}
