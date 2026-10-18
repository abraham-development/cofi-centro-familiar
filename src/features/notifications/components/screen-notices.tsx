"use client";

import { Check } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { acknowledgeNotificationAction } from "../actions";
import type { FamilyNotification } from "../queries";
import { useClock } from "@/components/clock/clock-provider";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { epochFromIso, formatInstantTime } from "@/lib/time/zoned";

/**
 * Avisos destacados de una pantalla (cocina, cuarto o celular): permanecen
 * hasta que alguien toca «Entendido» o vencen. Reconocer aquí solo confirma
 * para ESTA pantalla, no por cada destinatario.
 */
export function ScreenNotices({
  notifications,
  recipient,
  actor,
  title = "Avisos",
}: {
  notifications: FamilyNotification[];
  recipient: string;
  actor: "adult" | "device";
  title?: string;
}) {
  const { now, timeZone, hourFormat } = useClock();
  const [pending, startTransition] = useTransition();
  const active = notifications.filter(
    (n) =>
      !n.receipts.some((r) => r.recipient === recipient && r.acknowledgedAt) &&
      (!n.expiresAt || epochFromIso(n.expiresAt) > now),
  );
  if (active.length === 0) return null;

  return (
    <Panel id="avisos-activos" title={title} caption="Toca «Entendido» cuando lo hayas visto" className="border-l-4 border-l-warning">
      <ul className="flex flex-col gap-3" aria-live="polite">
        {active.slice(0, 6).map((n) => (
          <li key={n.id} className={cn("flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center", n.importance === "high" ? "bg-warning/10" : "bg-muted/60")}>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground tabular-nums">{formatInstantTime(n.createdAt, timeZone, hourFormat)}</p>
              <p className="mt-0.5 text-lg font-semibold">{n.title}</p>
              {n.body ? <p className="text-base text-muted-foreground">{n.body}</p> : null}
            </div>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await acknowledgeNotificationAction({ notificationId: n.id, as: actor });
                  if (!result.ok) toast.error(result.error.message);
                })
              }
            >
              <Check aria-hidden /> Entendido
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
