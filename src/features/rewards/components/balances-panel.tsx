"use client";

import { Coins, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { adjustPointsAction } from "../actions";
import { MemberAvatar } from "@/components/member-chip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { MemberSummary } from "@/features/calendar/types";

export function BalancesPanel({ kids, balances }: { kids: MemberSummary[]; balances: Record<string, number> }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {kids.map((kid) => (
        <li key={kid.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
          <MemberAvatar member={kid} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{kid.displayName}</p>
            <p className="flex items-center gap-1 text-2xl font-bold tabular-nums">
              <Coins aria-hidden className="size-5 text-warning" /> {balances[kid.id] ?? 0}
              <span className="text-base font-normal text-muted-foreground">puntos</span>
            </p>
          </div>
          <AdjustDialog kid={kid} />
        </li>
      ))}
    </ul>
  );
}

function AdjustDialog({ kid }: { kid: MemberSummary }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [commandId, setCommandId] = useState(() => crypto.randomUUID());
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Ajustar puntos de ${kid.displayName}`}>
            <SlidersHorizontal aria-hidden />
          </Button>
        }
      />
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            const result = await adjustPointsAction({ memberId: kid.id, amount: Number(amount), reason, commandId });
            setSaving(false);
            if (!result.ok) {
              toast.error(result.error.fieldErrors ? Object.values(result.error.fieldErrors)[0] : result.error.message);
              return;
            }
            toast.success("Ajuste registrado");
            setCommandId(crypto.randomUUID());
            setAmount("");
            setReason("");
            setOpen(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Ajustar puntos de {kid.displayName}</DialogTitle>
            <DialogDescription>Queda en el historial con tu nombre y el motivo. No reemplaza movimientos anteriores.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`amount-${kid.id}`}>Cantidad</FieldLabel>
            <Input id={`amount-${kid.id}`} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <FieldDescription>Positivo para sumar, negativo para restar.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`reason-${kid.id}`}>Motivo</FieldLabel>
            <Input id={`reason-${kid.id}`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} required />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button type="submit" disabled={saving || !amount || Number(amount) === 0 || !reason.trim()}>
              {saving ? "Guardando…" : "Registrar ajuste"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
