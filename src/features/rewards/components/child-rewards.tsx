"use client";

import { Coins, Gift, Hourglass } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { decideRedemptionAction, requestRedemptionAction } from "../actions";
import type { Redemption, Reward } from "../queries";
import { Meter } from "@/components/meter";
import { Panel } from "@/components/panel";
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
    <Panel
      id="premios-titulo"
      size="lg"
      title="Mis puntos"
      caption="Junta puntos con tus tareas y pide un premio"
      actions={
        <p className="flex items-center gap-2">
          <Coins aria-hidden className="size-6 text-muted-foreground" />
          <span className="figure text-4xl">{balance}</span>
        </p>
      }
    >
      {available.length === 0 ? (
        <p className="text-lg text-muted-foreground">Todavía no hay premios en el catálogo.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {available.map((r) => {
            const enough = balance >= r.cost;
            return (
              <li key={r.id} className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4">
                <p className="flex items-center gap-2 text-xl font-semibold">
                  <Gift aria-hidden className="size-5 text-muted-foreground" /> {r.title}
                </p>
                <p className="text-base text-muted-foreground">
                  {r.cost} puntos{r.conditions ? ` · ${r.conditions}` : ""}
                </p>
                <Meter value={balance} max={r.cost} size="md" tone={enough ? "brand" : "warning"} label={`Puntos para «${r.title}»`} />
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
          <h3 className="text-lg font-semibold text-muted-foreground">Mis pedidos</h3>
          <ul className="flex flex-col gap-2">
            {redemptions.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 text-lg">
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
    </Panel>
  );
}
