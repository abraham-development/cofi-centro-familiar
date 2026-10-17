"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { forgetDeviceAction } from "../actions";
import { LiveSync } from "@/components/live/live-sync";
import { createDeviceClient } from "@/lib/supabase/client";
import { clearSnapshot } from "@/lib/pwa/snapshot";

const HEARTBEAT_MS = 5 * 60_000;

/** Al revocarse: borrar la sesión de pantalla y los datos locales, y volver a /vincular. */
export async function forgetThisDevice() {
  clearSnapshot("device");
  try {
    await forgetDeviceAction();
    await createDeviceClient().auth.signOut({ scope: "local" });
    window.dispatchEvent(new Event("cofi:device-forgotten"));
  } finally {
    window.location.replace("/vincular?revocada=1");
  }
}

/** Sincronización en vivo, latido y detección de revocación de la pantalla. */
export function DeviceRuntime({ topics }: { topics: string[] }) {
  const onRevoked = useCallback(() => void forgetThisDevice(), []);

  useEffect(() => {
    const supabase = createDeviceClient();
    const beat = () => void supabase.rpc("device_heartbeat");
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, []);

  return <LiveSync topics={topics} session="device" onRevoked={onRevoked} />;
}

/** Se muestra si el servidor detecta que la pantalla ya fue revocada. */
export function RevokedDevice() {
  const router = useRouter();
  useEffect(() => {
    void forgetThisDevice();
  }, [router]);
  return (
    <main className="m-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Esta pantalla fue desvinculada</h1>
      <p className="text-muted-foreground">Borrando su información local…</p>
    </main>
  );
}
