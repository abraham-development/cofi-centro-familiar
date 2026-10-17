"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useEffect, useRef, useState } from "react";

import { localDateOf, type HourFormat } from "@/lib/time/zoned";

type ClockValue = {
  now: number;
  timeZone: string;
  hourFormat: HourFormat;
};

const ClockContext = createContext<ClockValue | null>(null);

const RESYNC_EVERY_MS = 6 * 60 * 60_000;
const STALE_AFTER_HIDDEN_MS = 60_000;

async function measureOffset(): Promise<number | null> {
  try {
    const sent = Date.now();
    const res = await fetch("/api/time", { cache: "no-store" });
    const received = Date.now();
    if (!res.ok) return null;
    const { now } = (await res.json()) as { now: unknown };
    if (typeof now !== "number" || !Number.isFinite(now)) return null;
    // Milisegundos enteros: Temporal no acepta fracciones.
    return Math.round(now + (received - sent) / 2 - received);
  } catch {
    return null;
  }
}

/**
 * Reloj compartido de la pantalla. El primer render usa exactamente la hora
 * que envió el servidor (sin desajustes de hidratación); luego avanza en el
 * dispositivo, corregido con la diferencia medida contra el servidor.
 */
export function ClockProvider({
  serverNow,
  timeZone,
  hourFormat,
  children,
}: {
  serverNow: number;
  timeZone: string;
  hourFormat: HourFormat;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);
  /** Diferencia estimada servidor − dispositivo, en ms. */
  const offsetRef = useRef(0);
  const dayRef = useRef(localDateOf(serverNow, timeZone));
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    // Mientras no haya medición, se confía en el dispositivo salvo que esté
    // muy desfasado respecto de la hora del servidor.
    offsetRef.current = Math.abs(serverNow - Date.now()) > 5 * 60_000 ? serverNow - Date.now() : 0;

    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = Date.now() + offsetRef.current;
      setNow(current);
      const day = localDateOf(current, timeZone);
      if (day !== dayRef.current) {
        dayRef.current = day;
        router.refresh(); // nuevo día: recargar agenda y pendientes
      }
      timer = setTimeout(tick, 1000 - (current % 1000) + 5);
    };

    const resync = async () => {
      const measured = await measureOffset();
      if (measured !== null) offsetRef.current = measured;
      clearTimeout(timer);
      tick();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
      hiddenAtRef.current = null;
      void resync();
      if (hiddenFor > STALE_AFTER_HIDDEN_MS) router.refresh();
    };
    const onOnline = () => {
      void resync();
      router.refresh();
    };

    timer = setTimeout(tick, 0);
    void resync();
    const periodic = setInterval(() => void resync(), RESYNC_EVERY_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(timer);
      clearInterval(periodic);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [serverNow, timeZone, router]);

  return <ClockContext value={{ now, timeZone, hourFormat }}>{children}</ClockContext>;
}

export function useClock(): ClockValue {
  const value = use(ClockContext);
  if (!value) throw new Error("useClock debe usarse dentro de ClockProvider");
  return value;
}
