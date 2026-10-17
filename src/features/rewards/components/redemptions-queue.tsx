"use client";

import { Check, Gift, PackageCheck, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { decideRedemptionAction } from "../actions";
import type { Redemption } from "../queries";
import { ConfirmAction } from "@/components/confirm-action";
import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/member-chip";
import { Button } from "@/components/ui/button";
import type { MemberSummary } from "@/features/calendar/types";

const STATUS_LABEL: Record<Redemption["status"], string> = {
  requested: "Solicitado",
  approved: "Aprobado · por entregar",
  delivered: "Entregado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

export function RedemptionsQueue({
  redemptions,
  members,
  balances,
}: {
  redemptions: Redemption[];
  members: Map<string, MemberSummary>;
  balances: Record<string, number>;
}) {
  const [pending, startTransition] = useTransition();
  const run = (r: Redemption, action: "approve" | "reject" | "deliver" | "cancel", note = "") =>
    new Promise<boolean>((resolve) =>
      startTransition(async () => {
        const result = await decideRedemptionAction({ redemptionId: r.id, action, note, as: "adult" });
        if (result.ok) {
          toast.success(
            action === "approve" ? "Canje aprobado: se descontaron los puntos" : action === "deliver" ? "Marcado como entregado" : "Listo",
          );
          resolve(true);
        } else {
          toast.error(result.error.message);
          resolve(false);
        }
      }),
    );

  const open = redemptions.filter((r) => r.status === "requested" || r.status === "approved");
  if (open.length === 0) {
    return <EmptyState icon={Gift} title="Sin canjes pendientes" description="Cuando un hijo pida un premio aparecerá aquí." />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {open.map((r) => {
        const member = members.get(r.memberId);
        const enough = (balances[r.memberId] ?? 0) >= r.cost;
        return (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3">
            {member ? <MemberAvatar member={member} size="lg" /> : null}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">{r.rewardTitle}</p>
              <p className="text-sm text-muted-foreground">
                {member?.displayName} · {r.cost} pts · {STATUS_LABEL[r.status]}
                {r.status === "requested" && !enough ? " · saldo insuficiente ahora" : ""}
              </p>
            </div>
            {r.status === "requested" ? (
              <>
                <Button onClick={() => void run(r, "approve")} disabled={pending || !enough}>
                  <Check aria-hidden /> Aprobar
                </Button>
                <Button variant="outline" onClick={() => void run(r, "reject")} disabled={pending}>
                  <X aria-hidden /> Rechazar
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => void run(r, "deliver")} disabled={pending}>
                  <PackageCheck aria-hidden /> Entregado
                </Button>
                <ConfirmAction
                  trigger={
                    <Button variant="ghost" disabled={pending}>
                      Cancelar
                    </Button>
                  }
                  title="¿Cancelar este canje?"
                  description={`Se devolverán ${r.cost} puntos a ${member?.displayName ?? "su saldo"} con un movimiento de reembolso.`}
                  confirmLabel="Cancelar y reembolsar"
                  onConfirm={() => run(r, "cancel", "Cancelado por un adulto")}
                />
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
