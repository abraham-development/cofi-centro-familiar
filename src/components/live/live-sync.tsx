"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { RefreshCw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createClient, createDeviceClient } from "@/lib/supabase/client";

type Status = "connecting" | "live" | "reconnecting";

const REFRESH_DEBOUNCE_MS = 350;

/**
 * Sincronización en vivo: escucha invalidaciones en canales privados y vuelve
 * a pedir los datos al servidor (con los permisos vigentes). Los mensajes no
 * traen contenido; si se pierde alguno, la relectura al reconectar lo corrige.
 */
export function LiveSync({
  topics,
  session,
  onRevoked,
  showIndicator = true,
}: {
  topics: string[];
  session: "adult" | "device";
  onRevoked?: () => void;
  showIndicator?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const lastEventAt = useRef(0);
  const [status, setStatus] = useState<Status>("connecting");
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const onRevokedRef = useRef(onRevoked);
  useEffect(() => {
    onRevokedRef.current = onRevoked;
  }, [onRevoked]);

  const key = topics.join("|");

  // Si llegó un aviso mientras se navegaba, la página nueva pudo renderizarse
  // antes del cambio: se vuelve a leer al terminar la navegación.
  useEffect(() => {
    if (Date.now() - lastEventAt.current < 4000) router.refresh();
  }, [pathname, router]);

  useEffect(() => {
    const supabase = session === "device" ? createDeviceClient() : createClient();
    const channels: RealtimeChannel[] = [];
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let hadProblem = false;

    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (!disposed) router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, sessionData) => {
      if ((event === "TOKEN_REFRESHED" || event === "SIGNED_IN") && sessionData?.access_token) {
        void supabase.realtime.setAuth(sessionData.access_token);
      }
    });

    (async () => {
      // Los canales privados exigen el JWT vigente.
      await supabase.realtime.setAuth();
      if (disposed) return;
      for (const topic of key.split("|").filter(Boolean)) {
        const channel = supabase.channel(topic, { config: { private: true } });
        channel.on("broadcast", { event: "*" }, (message) => {
          const payload = (message.payload ?? {}) as { ts?: number };
          if (typeof payload.ts === "number") {
            const latency = Math.max(0, Date.now() - payload.ts);
            setLastLatency(latency);
            if (process.env.NODE_ENV !== "production") console.debug(`[cofi] aviso en ${latency} ms`, topic);
          }
          lastEventAt.current = Date.now();
          if (message.event === "revoked") {
            onRevokedRef.current?.();
            return;
          }
          scheduleRefresh();
        });
        channel.subscribe((state) => {
          if (disposed) return;
          if (state === "SUBSCRIBED") {
            setStatus("live");
            if (hadProblem) {
              hadProblem = false;
              scheduleRefresh(); // pudimos perder avisos: releer
            }
          } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
            hadProblem = true;
            setStatus("reconnecting");
          }
        });
        channels.push(channel);
      }
    })();

    return () => {
      disposed = true;
      clearTimeout(refreshTimer);
      authListener.subscription.unsubscribe();
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [key, session, router]);

  if (!showIndicator) return null;
  return (
    <span
      role="status"
      aria-live="polite"
      title={lastLatency !== null ? `Último aviso en ${lastLatency} ms` : undefined}
      data-live-status={status}
      className="inline-flex items-center gap-1.5 px-1 text-xs font-medium whitespace-nowrap text-muted-foreground"
    >
      {status === "live" ? (
        <span aria-hidden className="size-2 rounded-full bg-success shadow-[0_0_0_3px] shadow-success/20" />
      ) : (
        <RefreshCw aria-hidden className="size-3.5 text-warning motion-safe:animate-spin" />
      )}
      {status === "live" ? "En vivo" : status === "connecting" ? "Conectando…" : "Reconectando…"}
    </span>
  );
}
