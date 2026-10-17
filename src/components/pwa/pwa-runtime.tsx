"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { clearSnapshot, readSnapshot, snapshotKey } from "@/lib/pwa/snapshot";
import { createClient, createDeviceClient } from "@/lib/supabase/client";

export function PwaRuntime() {
  const pathname = usePathname();
  const online = useOnlineStatus();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let disposed = false;
    const reload = () => window.location.reload();
    // Only reload after the explicit update button, never while editing.
    let requested = false;
    const onController = () => { if (requested) reload(); };
    const onUpdate = () => { requested = true; };
    navigator.serviceWorker.addEventListener("controllerchange", onController);
    window.addEventListener("cofi:apply-update", onUpdate);
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => {
      const report = () => { if (!disposed && registration.waiting) setWaiting(registration.waiting); };
      report();
      registration.addEventListener("updatefound", () => {
        registration.installing?.addEventListener("statechange", report);
      });
    }).catch(() => { /* Offline or unsupported configuration: keep the app usable. */ });
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onController);
      window.removeEventListener("cofi:apply-update", onUpdate);
    };
  }, []);

  useEffect(() => {
    let finishingScreen = false;
    const onScreenFinish = (event: Event) => { finishingScreen = (event as CustomEvent<boolean>).detail === true; };
    window.addEventListener("cofi:screen-finishing", onScreenFinish);
    const subscriptions = (["adult", "device"] as const).map((actor) => {
      const client = actor === "adult" ? createClient() : createDeviceClient();
      return client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          clearSnapshot(actor);
          // Signing out in the setup tab must also discard adult UI in other tabs.
          if (actor === "adult" && !finishingScreen && /^\/(casa|agenda|pendientes|responsabilidades|premios|avisos|configuracion|hijos|onboarding)(\/|$)/.test(window.location.pathname)) {
            window.location.replace("/");
          }
        }
        if (session) {
          try {
            const saved = readSnapshot(localStorage.getItem(snapshotKey(actor)), Date.now());
            // Device snapshots use the validated auth identity, not the pairing id.
            if (saved && saved.identity !== session.user.id) clearSnapshot(actor);
          } catch { /* Storage unavailable. */ }
        }
      }).data.subscription;
    });
    const expire = () => {
      for (const actor of ["adult", "device"] as const) {
        try { if (!readSnapshot(localStorage.getItem(snapshotKey(actor)), Date.now())) clearSnapshot(actor); } catch { /* Unavailable. */ }
      }
    };
    expire();
    const timer = setInterval(expire, 60_000);
    return () => {
      subscriptions.forEach((s) => s.unsubscribe()); clearInterval(timer);
      window.removeEventListener("cofi:screen-finishing", onScreenFinish);
    };
  }, []);

  useEffect(() => {
    if (["/acceso", "/registro", "/recuperar", "/onboarding"].includes(pathname)) clearSnapshot("adult");
    if (pathname === "/vincular") clearSnapshot("device");
  }, [pathname]);

  useEffect(() => {
    // Covers forms and action buttons, including menus and dialogs.
    const guard = (event: Event) => {
      if (navigator.onLine) return;
      const target = event.target instanceof Element ? event.target : null;
      if (event.type === "submit" || target?.closest("button:not([data-offline-safe]), [role='menuitem']")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener("click", guard, true);
    document.addEventListener("submit", guard, true);
    return () => { document.removeEventListener("click", guard, true); document.removeEventListener("submit", guard, true); };
  }, []);

  return (
    <>
      {!online ? <aside role="status" className="sticky top-0 z-50 bg-warning p-3 text-center text-warning-foreground">
        Sin conexión. Los datos pueden haber cambiado. Las acciones están deshabilitadas. {" "}
        <a className="font-bold underline" href={`/offline.html?mode=${pathname === "/pantalla" ? "device" : "adult"}`}>Consultar copia descargada</a>
      </aside> : null}
      {waiting ? <aside className="flex flex-wrap items-center justify-center gap-3 border-b bg-card p-3">
        Hay una nueva versión. Guarda tus cambios antes de actualizar.
        <Button variant="outline" onClick={() => {
          if (waiting.state === "activated") { window.location.reload(); return; }
          window.dispatchEvent(new Event("cofi:apply-update"));
          waiting.postMessage("ACTIVATE_UPDATE");
        }}>Actualizar aplicación</Button>
      </aside> : null}
    </>
  );
}
