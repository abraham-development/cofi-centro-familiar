"use client";

import { BellRing, Check } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { acknowledgeNotificationAction } from "../actions";
import type { FamilyNotification } from "../queries";
import { useClock } from "@/components/clock/clock-provider";
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
    <section aria-labelledby="avisos-activos" className="flex flex-col gap-3 rounded-3xl border-2 border-highlight bg-card p-5 shadow-sm sm:p-6">
      <h2 id="avisos-activos" className="flex items-center gap-2 text-2xl font-bold">
        <BellRing aria-hidden className="size-6" /> {title}
      </h2>
      <ul className="flex flex-col gap-3" aria-live="polite">
        {active.slice(0, 6).map((n) => (
          <li key={n.id} className={cn("flex flex-col gap-2 rounded-2xl p-4 sm:flex-row sm:items-center", n.importance === "high" ? "bg-highlight/40" : "bg-muted")}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-muted-foreground">{formatInstantTime(n.createdAt, timeZone, hourFormat)}</p>
              <p className="text-xl font-bold">{n.title}</p>
              {n.body ? <p className="text-lg">{n.body}</p> : null}
            </div>
            <Button
              size="lg"
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
    </section>
  );
}
