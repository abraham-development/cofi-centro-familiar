"use client";

import { BellOff, BellRing } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { deletePushSubscriptionAction, savePushSubscriptionAction } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const noopSubscribe = () => () => {};

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Activación explícita de notificaciones Push en este dispositivo. El permiso
 * se pide solo tras pulsar el botón (nunca al cargar la página). Sin Push,
 * los avisos siguen apareciendo en las pantallas.
 */
export function PushOptIn({ actor, vapidPublicKey }: { actor: "adult" | "device"; vapidPublicKey: string | null }) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    () => false,
  );
  const permission = useSyncExternalStore(
    noopSubscribe,
    () => ("Notification" in window ? Notification.permission : "default"),
    () => "default",
  );
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!supported || !vapidPublicKey) return;
    let disposed = false;
    void navigator.serviceWorker.getRegistration("/").then(async (registration) => {
      const subscription = await registration?.pushManager.getSubscription();
      if (!disposed) setEnabled(Boolean(subscription));
    }).catch(() => { /* Registration may not have completed yet. */ });
    return () => { disposed = true; };
  }, [supported, vapidPublicKey]);

  async function readyRegistration() {
    // Do not leave the opt-in stuck if registration was blocked by the browser.
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration?.active) throw new Error("Service worker not ready");
    return registration;
  }

  if (!vapidPublicKey) {
    return (
      <Alert>
        <AlertDescription>
          Las notificaciones push aún no están configuradas en este entorno. Los avisos siguen apareciendo en las
          pantallas y en este historial.
        </AlertDescription>
      </Alert>
    );
  }
  if (!supported) {
    return (
      <p className="text-muted-foreground">
        Este navegador no admite notificaciones push. En iPhone o iPad, primero instala la app en la pantalla de
        inicio (Compartir → Agregar a inicio).
      </p>
    );
  }
  if (permission === "denied") {
    return (
      <p className="text-muted-foreground">
        Las notificaciones están bloqueadas para este sitio. Puedes permitirlas en la configuración del navegador.
      </p>
    );
  }

  async function enable() {
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      if (result !== "granted") return;
      const registration = await readyRegistration();
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
      });
      const json = subscription.toJSON();
      const saved = await savePushSubscriptionAction({
        as: actor,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        userAgent: navigator.userAgent.slice(0, 300),
      });
      if (!saved.ok) throw new Error(saved.error.message);
      setEnabled(true);
      toast.success("Notificaciones activadas en este dispositivo");
    } catch {
      toast.error("No se pudieron activar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await readyRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const removed = await deletePushSubscriptionAction({ as: actor, endpoint: subscription.endpoint });
        if (!removed.ok) throw new Error(removed.error.message);
        await subscription.unsubscribe();
      }
      setEnabled(false);
    } catch {
      toast.error("No se pudieron desactivar las notificaciones. Reintenta con conexión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground">
        Recibe los recordatorios aunque la app no esté abierta, si el sistema lo permite. No es una alarma garantizada
        con el teléfono apagado o sin conexión.
      </p>
      {enabled ? (
        <Button variant="outline" onClick={disable} disabled={busy}>
          <BellOff aria-hidden /> Desactivar en este dispositivo
        </Button>
      ) : (
        <Button onClick={enable} disabled={busy}>
          <BellRing aria-hidden /> Activar notificaciones
        </Button>
      )}
    </div>
  );
}
