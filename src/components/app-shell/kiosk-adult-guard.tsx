"use client";

import { LogOut, MonitorSmartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { clearSnapshot } from "@/lib/pwa/snapshot";

const IDLE_MS = 5 * 60_000;

async function leave() {
  clearSnapshot("adult");
  await createClient().auth.signOut({ scope: "local" });
  window.location.replace("/pantalla");
}

/**
 * En una pantalla vinculada (cocina), la sesión de adulto es temporal: se
 * cierra tras 5 minutos sin uso y se vuelve al modo pantalla. La sesión de
 * la pantalla no se toca.
 */
export function KioskAdultGuard() {
  const [secondsLeft, setSecondsLeft] = useState(IDLE_MS / 1000);
  const lastActivity = useRef(0);

  useEffect(() => {
    lastActivity.current = Date.now();
    const bump = () => {
      lastActivity.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => {
      const left = Math.max(0, Math.round((IDLE_MS - (Date.now() - lastActivity.current)) / 1000));
      setSecondsLeft(left);
      if (left === 0) void leave();
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(timer);
    };
  }, []);

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b bg-highlight/30 px-4 py-2 text-sm">
      <span className="flex items-center gap-2 font-medium">
        <MonitorSmartphone aria-hidden className="size-4" />
        Sesión de adulto en una pantalla compartida: se cerrará tras 5 min sin uso
        {secondsLeft < 60 ? ` (${secondsLeft} s)` : ""}.
      </span>
      <Button size="sm" variant="outline" onClick={() => void leave()}>
        <LogOut aria-hidden /> Salir y volver a la pantalla
      </Button>
    </div>
  );
}
