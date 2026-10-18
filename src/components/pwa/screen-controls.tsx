"use client";

import { Monitor, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { isQuietTime } from "@/lib/pwa/quiet-time";
import { formatLocalTime } from "@/lib/time/zoned";

const subscribe = (callback: () => void) => {
  window.addEventListener("cofi:screen-preferences", callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener("cofi:screen-preferences", callback); window.removeEventListener("storage", callback); };
};
const noop = () => () => {};

export function ScreenControls({ preferenceId, timezone, quietStart, quietEnd, hourFormat, serverNow }: {
  preferenceId: string; timezone: string; quietStart: string; quietEnd: string;
  hourFormat: "12h" | "24h"; serverNow: number;
}) {
  const { setTheme } = useTheme();
  const previousTheme = useRef<string | null>(null);
  const [now, setNow] = useState(serverNow);
  const [wakeStatus, setWakeStatus] = useState("Desactivado");
  const supported = useSyncExternalStore(noop, () => "wakeLock" in navigator, () => false);
  const key = `cofi-screen:${preferenceId}`;
  const preferences = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
  }, () => "");
  const keepAwake = preferences.includes("awake");
  const autoNight = preferences.includes("night");
  const night = autoNight && isQuietTime(now, timezone, quietStart, quietEnd);

  function toggle(flag: "awake" | "night") {
    const selected = new Set(preferences.split(",").filter(Boolean));
    if (selected.has(flag)) selected.delete(flag); else selected.add(flag);
    try { localStorage.setItem(key, [...selected].join(",")); } catch { return; }
    window.dispatchEvent(new Event("cofi:screen-preferences"));
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!autoNight) return;
    try { previousTheme.current = localStorage.getItem("theme") || "system"; } catch { previousTheme.current = "system"; }
    return () => { if (previousTheme.current) setTheme(previousTheme.current); };
  }, [autoNight, setTheme]);

  useEffect(() => {
    if (autoNight) setTheme(night ? "dark" : "light");
  }, [autoNight, night, setTheme]);

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
    <section aria-label="Opciones de pantalla" className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-sm">
      <Button data-offline-safe variant="outline" aria-pressed={keepAwake} disabled={!supported} onClick={() => toggle("awake")}>
        <Monitor aria-hidden /> {keepAwake ? "Desactivar pantalla encendida" : "Mantener pantalla encendida"}
      </Button>
      <span role="status">{!supported ? "Este navegador no permite controlar el encendido" : keepAwake ? wakeStatus : "Encendido según el dispositivo"}</span>
      <Button data-offline-safe variant="outline" aria-pressed={autoNight} onClick={() => toggle("night")}>
        <Moon aria-hidden /> Noche automática
      </Button>
      <span>{autoNight ? `Tema ${night ? "nocturno" : "claro"}; noche de ${formatLocalTime(quietStart, hourFormat)} a ${formatLocalTime(quietEnd, hourFormat)}` : "Usa el tema elegido"}. Sin sonidos.</span>
    </section>
  );
}
