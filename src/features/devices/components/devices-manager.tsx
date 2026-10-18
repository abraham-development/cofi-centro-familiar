"use client";

import { Baby, House, MonitorOff, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { approveDeviceAction, updateDeviceAction } from "../actions";
import type { DeviceRow } from "../queries";
import { ConfirmAction } from "@/components/confirm-action";
import { MemberAvatar } from "@/components/member-chip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MemberSummary } from "@/features/calendar/types";
import { formatShortDate } from "@/lib/time/zoned";

export function DevicesManager({
  devices,
  kids,
  initialCode,
}: {
  devices: DeviceRow[];
  kids: MemberSummary[];
  initialCode: string;
}) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"home" | "child">("home");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const byId = new Map(kids.map((c) => [c.id, c]));

  function approve(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await approveDeviceAction({ code, name, scope, memberId: scope === "child" ? memberId : null });
      if (!result.ok) {
        setError(
          result.error.fieldErrors ? Object.values(result.error.fieldErrors)[0] : result.error.message,
        );
        return;
      }
      toast.success("Pantalla vinculada. En unos segundos mostrará la información.");
      setCode("");
      setName("");
    });
  }

  async function update(device: DeviceRow, change: { name?: string; revoke?: boolean }) {
    const result = await updateDeviceAction({ deviceId: device.id, ...change });
    if (!result.ok) {
      toast.error(result.error.message);
      return false;
    }
    toast.success(change.revoke ? "Pantalla desvinculada" : "Nombre actualizado");
  }

  const active = devices.filter((d) => !d.revokedAt);
  const revoked = devices.filter((d) => d.revokedAt);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <form onSubmit={approve} className="flex flex-col gap-5 rounded-2xl border bg-card p-5">
        <h2 className="text-base font-semibold">Vincular otro equipo por código</h2>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            En la tablet o pantalla, abre <strong className="text-foreground">/vincular</strong> y toca «Generar código».
          </li>
          <li>Escribe aquí el código que aparece (vence en 10 minutos).</li>
        </ol>
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Field>
          <FieldLabel htmlFor="pair-code">Código de la pantalla</FieldLabel>
          <Input
            id="pair-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD-EFGH"
            autoComplete="off"
            className="h-14 font-mono text-2xl tracking-widest uppercase"
            maxLength={9}
          />
        </Field>
        <FieldSet>
          <FieldLegend>¿Dónde está?</FieldLegend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Modo de la pantalla">
            <button
              type="button"
              role="radio"
              aria-checked={scope === "home"}
              onClick={() => setScope("home")}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium pointer-coarse:min-h-11",
                scope === "home" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <House aria-hidden className="size-5" /> Zona común (cocina, sala)
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={scope === "child"}
              onClick={() => setScope("child")}
              disabled={kids.length === 0}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium pointer-coarse:min-h-11 disabled:opacity-50",
                scope === "child" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <Baby aria-hidden className="size-5" /> Cuarto de un hijo
            </button>
          </div>
          <FieldDescription>
            {scope === "home"
              ? "Muestra la agenda familiar y los pendientes de la casa. Nunca lo marcado «solo adultos»."
              : "Muestra solo las tareas, puntos y avisos de ese hijo."}
          </FieldDescription>
        </FieldSet>
        {scope === "child" ? (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Hijo">
            {kids.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={memberId === c.id}
                onClick={() => {
                  setMemberId(c.id);
                  if (!name) setName(`Cuarto de ${c.displayName}`);
                }}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-lg border py-1 pr-3 pl-1 text-sm font-medium pointer-coarse:min-h-11",
                  memberId !== c.id && "hover:bg-muted",
                )}
                style={memberId === c.id ? { borderColor: c.color, backgroundColor: `${c.color}1f` } : undefined}
              >
                <MemberAvatar member={c} size="sm" />
                {c.displayName}
              </button>
            ))}
          </div>
        ) : null}
        <Field>
          <FieldLabel htmlFor="device-name">Nombre</FieldLabel>
          <Input
            id="device-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={scope === "home" ? "Cocina" : "Cuarto de…"}
            maxLength={40}
          />
        </Field>
        <Button type="submit" size="lg" disabled={pending || code.replace(/[^A-Za-z0-9]/g, "").length !== 8 || !name}>
          {pending ? "Vinculando…" : "Vincular pantalla"}
        </Button>
      </form>

      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5" aria-labelledby="pantallas-activas">
        <h2 id="pantallas-activas" className="text-base font-semibold">
          Pantallas vinculadas
        </h2>
        {active.length === 0 ? <p className="text-muted-foreground">Aún no hay pantallas vinculadas.</p> : null}
        <ul className="flex flex-col gap-2">
          {active.map((d) => {
            const child = d.memberId ? byId.get(d.memberId) : undefined;
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                {child ? <MemberAvatar member={child} size="lg" /> : <House aria-hidden className="size-10 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {d.scope === "home" ? "Zona común" : `Cuarto de ${child?.displayName ?? "un hijo"}`} ·{" "}
                    {d.lastSeenAt ? `activa ${formatShortDate(d.lastSeenAt.slice(0, 10))}` : "sin actividad aún"}
                  </p>
                </div>
                <RenameDevice device={d} onSave={(newName) => update(d, { name: newName })} />
                <ConfirmAction
                  trigger={
                    <Button variant="destructive" size="sm">
                      <MonitorOff aria-hidden /> Desvincular
                    </Button>
                  }
                  title={`¿Desvincular «${d.name}»?`}
                  description="Dejará de recibir información de inmediato y borrará lo que tenga guardado al detectarlo. Si está sin conexión, conservará lo ya descargado hasta que vuelva la red."
                  confirmLabel="Desvincular"
                  onConfirm={() => update(d, { revoke: true })}
                />
              </li>
            );
          })}
        </ul>
        {revoked.length > 0 ? (
          <details className="rounded-xl border p-3">
            <summary className="cursor-pointer font-semibold">Desvinculadas ({revoked.length})</summary>
            <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
              {revoked.map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  {d.name} <Badge variant="outline">desvinculada {formatShortDate(d.revokedAt!.slice(0, 10))}</Badge>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </div>
  );
}

function RenameDevice({ device, onSave }: { device: DeviceRow; onSave: (name: string) => Promise<boolean | void> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(device.name);
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Renombrar ${device.name}`}>
            <Pencil aria-hidden />
          </Button>
        }
      />
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!value.trim()) return;
            setSaving(true);
            const result = await onSave(value.trim());
            setSaving(false);
            if (result !== false) setOpen(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Renombrar pantalla</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`rename-${device.id}`}>Nombre</FieldLabel>
            <Input id={`rename-${device.id}`} value={value} maxLength={40} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !value.trim()}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
