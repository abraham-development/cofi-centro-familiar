"use client";

import { Coins, Gift, Hourglass } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { decideRedemptionAction, requestRedemptionAction } from "../actions";
import type { Redemption, Reward } from "../queries";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";

const STATUS_LABEL: Record<Redemption["status"], string> = {
  requested: "Esperando a un adulto",
  approved: "¡Aprobado! Pronto lo tendrás",
  delivered: "Entregado",
  rejected: "No aprobado",
  cancelled: "Cancelado",
};

/** Puntos y premios del hijo: lo que puede pedir y en qué van sus pedidos. */
export function ChildRewards({
  memberId,
  balance,
  rewards,
  redemptions,
  actor,
}: {
  memberId: string;
  balance: number;
  rewards: Reward[];
  redemptions: Redemption[];
  actor: "adult" | "device";
}) {
  const online = useOnlineStatus();
  const [pending, startTransition] = useTransition();
  const available = rewards.filter(
    (r) => r.isAvailable && !r.archivedAt && (r.memberIds.length === 0 || r.memberIds.includes(memberId)),
  );

  function request(reward: Reward) {
    startTransition(async () => {
      const result = await requestRedemptionAction({
        rewardId: reward.id,
        memberId,
        commandId: crypto.randomUUID(),
        as: actor,
      });
      if (result.ok) toast.success(`Pediste: ${reward.title}. Un adulto lo revisará.`);
      else toast.error(result.error.message);
    });
  }

  function cancel(r: Redemption) {
    startTransition(async () => {
      const result = await decideRedemptionAction({ redemptionId: r.id, action: "cancel", note: "", as: actor });
      if (!result.ok) toast.error(result.error.message);
    });
  }

  return (
    <section aria-labelledby="premios-titulo" className="flex flex-col gap-4 rounded-3xl border bg-card/60 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="premios-titulo" className="text-3xl font-bold">
          Mis puntos
        </h2>
        <p className="flex items-center gap-2 text-4xl font-extrabold tabular-nums">
          <Coins aria-hidden className="size-9 text-warning" /> {balance}
        </p>
      </div>
      {available.length === 0 ? (
        <p className="text-lg text-muted-foreground">Todavía no hay premios en el catálogo.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {available.map((r) => {
            const enough = balance >= r.cost;
            return (
              <li key={r.id} className="flex flex-col gap-2 rounded-2xl border-2 bg-card p-4">
                <p className="flex items-center gap-2 text-xl font-bold">
                  <Gift aria-hidden className="size-6" /> {r.title}
                </p>
                <p className="text-lg">
                  {r.cost} puntos{r.conditions ? ` · ${r.conditions}` : ""}
                </p>
                {enough ? (
                  <Button size="lg" onClick={() => request(r)} disabled={pending || !online}>
                    Pedir este premio
                  </Button>
                ) : (
                  <p className="text-base text-muted-foreground">Te faltan {r.cost - balance} puntos</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {redemptions.length > 0 ? (
        <>
          <h3 className="text-xl font-bold">Mis pedidos</h3>
          <ul className="flex flex-col gap-2">
            {redemptions.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-lg">
                {r.status === "requested" ? <Hourglass aria-hidden className="size-5" /> : <Gift aria-hidden className="size-5" />}
                <span className="font-semibold">{r.rewardTitle}</span>
                <span className="text-muted-foreground">· {STATUS_LABEL[r.status]}</span>
                {r.status === "requested" ? (
                  <Button variant="ghost" size="sm" className="ml-auto" onClick={() => cancel(r)} disabled={pending}>
                    Cancelar pedido
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
