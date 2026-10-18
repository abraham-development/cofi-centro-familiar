"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { activateCurrentDeviceAction, finishCurrentDeviceSetupAction } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { DeviceInfo } from "@/lib/auth/device";
import { clearSnapshot } from "@/lib/pwa/snapshot";
import { createClient, createDeviceClient } from "@/lib/supabase/client";

type Kid = { id: string; displayName: string };
class SetupError extends Error {}

export function CurrentDeviceSetup({ family, kids, initialDevice }: {
  family: { id: string; name: string };
  kids: Kid[];
  initialDevice: DeviceInfo | null;
}) {
  const [scope, setScope] = useState<"home" | "child">("home");
  const [memberId, setMemberId] = useState("");
  const [name, setName] = useState("Pantalla familiar");
  const editedName = useRef(false);
  const [deviceId, setDeviceId] = useState(initialDevice?.id ?? null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const linkedId = deviceId ?? initialDevice?.id;

  async function finish(id: string) {
    window.dispatchEvent(new CustomEvent("cofi:screen-finishing", { detail: true }));
    try {
      const result = await finishCurrentDeviceSetupAction(id);
      if (!result.ok) throw new SetupError(result.error.message);
      clearSnapshot("adult");
      // Also clear the browser client's memory and notify the other tabs.
      const { error: signOutError } = await createClient().auth.signOut({ scope: "local" });
      if (signOutError) throw new SetupError("La pantalla está vinculada. Conéctate y pulsa «Terminar activación» para completar el cierre de sesión.");
      // A full navigation discards cached adult React trees and client state.
      window.location.replace("/pantalla");
    } finally {
      window.dispatchEvent(new CustomEvent("cofi:screen-finishing", { detail: false }));
    }
  }

  async function activate(event: React.FormEvent) {
    event.preventDefault();
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      if (linkedId) { await finish(linkedId); return; }
      const device = createDeviceClient();
      // Bootstrap only; the Server Action validates the JWT independently.
      const { data: session, error: sessionError } = await device.auth.getSession();
      if (sessionError) throw new SetupError("No se pudo preparar la pantalla. Revisa la conexión e inténtalo de nuevo.");
      let needsIdentity = !session.session;
      if (session.session) {
        const { data: identity, error: identityError } = await device.auth.getClaims();
        if (identityError || identity?.claims?.is_anonymous !== true) throw new SetupError("No se pudo validar la sesión de esta pantalla.");
        const { data: status, error: statusError } = await device.rpc("get_device_status");
        if (statusError) throw new SetupError("No se pudo comprobar la pantalla. Revisa la conexión.");
        if (status?.[0]?.status === "revoked") {
          const { error: leaveError } = await device.auth.signOut({ scope: "local" });
          if (leaveError) throw new SetupError("No se pudo renovar la sesión de la pantalla. Inténtalo de nuevo.");
          clearSnapshot("device");
          needsIdentity = true;
        }
      }
      if (needsIdentity) {
        const { error: identityError } = await device.auth.signInAnonymously();
        if (identityError) throw new SetupError(identityError.status === 429
          ? "Se alcanzó el límite de vinculaciones desde esta red. Inténtalo más tarde."
          : "No se pudo preparar la pantalla. Revisa la conexión e inténtalo de nuevo.");
      }
      const result = await activateCurrentDeviceAction({ expectedFamilyId: family.id, name, scope, memberId: scope === "child" ? memberId || null : null });
      if (!result.ok) throw new SetupError(Object.values(result.error.fieldErrors ?? {})[0] ?? result.error.message);
      setDeviceId(result.data.deviceId);
      await finish(result.data.deviceId);
    } catch (problem) {
      setError(problem instanceof SetupError ? problem.message : "No se pudo completar la activación. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={activate} className="mx-auto flex w-full max-w-xl flex-col gap-6 rounded-2xl border bg-card p-5 sm:p-7">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{linkedId ? "Esta pantalla ya está vinculada" : "¿Cómo se usará este dispositivo?"}</h2>
        <p className="text-muted-foreground">Familia: <strong className="text-foreground">{initialDevice?.familyName ?? family.name}</strong></p>
        {initialDevice ? <p>{initialDevice.name} · {initialDevice.scope === "home" ? "Pantalla familiar" : "Pantalla de un hijo"}</p> : null}
      </div>
      {error ? <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {!linkedId ? <fieldset disabled={busy} className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Uso de la pantalla">
          {(["home", "child"] as const).map((mode) => <button
            key={mode} type="button" role="radio" aria-checked={scope === mode} disabled={mode === "child" && !kids.length}
            onClick={() => {
              setScope(mode);
              if (!editedName.current) setName(mode === "home" ? "Pantalla familiar" : `Pantalla de ${kids.find((k) => k.id === memberId)?.displayName ?? "mi hijo"}`);
            }}
            className={`min-h-14 rounded-lg border p-3 text-left font-semibold disabled:opacity-50 ${scope === mode ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >{mode === "home" ? "Pantalla familiar" : "Pantalla de un hijo"}</button>)}
        </div>
        <p className="text-sm text-muted-foreground">{scope === "home" ? "Agenda familiar y pendientes de la casa. Lo marcado «solo adultos» queda fuera de esta vista." : "Tareas, puntos y avisos del hijo que elijas."}</p>
        {!kids.length ? <p className="text-sm text-muted-foreground">Para configurar la pantalla de un hijo, <Link href="/configuracion#integrantes" className="font-semibold underline">añádelo en Ajustes</Link>.</p> : null}
        {scope === "child" ? <Field>
          <FieldLabel htmlFor="screen-child">¿Para qué hijo?</FieldLabel>
          <select id="screen-child" value={memberId} required onChange={(e) => {
            setMemberId(e.target.value);
            if (!editedName.current) setName(`Pantalla de ${kids.find((k) => k.id === e.target.value)?.displayName ?? "mi hijo"}`);
          }} className="h-12 rounded-lg border bg-background px-3 text-base">
            <option value="">Elige un hijo</option>
            {kids.map((kid) => <option key={kid.id} value={kid.id}>{kid.displayName}</option>)}
          </select>
        </Field> : null}
        <Field>
          <FieldLabel htmlFor="current-screen-name">Nombre de la pantalla</FieldLabel>
          <Input id="current-screen-name" value={name} required maxLength={40} onChange={(e) => { editedName.current = true; setName(e.target.value); }} />
        </Field>
      </fieldset> : null}
      <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Al activar, se cerrará tu sesión de adulto en este navegador y se limpiará su copia local de consulta. Quedará abierta la pantalla elegida. Para administrar tendrás que volver a iniciar sesión.</p>
      <Button type="submit" size="lg" className="h-auto min-h-14 whitespace-normal py-3" disabled={busy || (!linkedId && (!name.trim() || (scope === "child" && !memberId)))}>
        {busy ? "Activando…" : linkedId ? (initialDevice ? "Usar esta pantalla y cerrar sesión adulta" : "Terminar activación") : "Activar pantalla"}
      </Button>
      {!linkedId && !busy ? <Link href="/configuracion/dispositivos" className="text-center font-semibold underline">Cancelar y volver a Pantallas</Link> : null}
    </form>
  );
}
