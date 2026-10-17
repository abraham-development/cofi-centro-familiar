"use client";

import { Activity, Bell, Check, CircleAlert } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { acknowledgeNotificationAction } from "../actions";
import type { FamilyNotification, RemindersHealth } from "../queries";
import { useClock } from "@/components/clock/clock-provider";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { epochFromIso, formatInstantTime, formatShortDate, localDateOf } from "@/lib/time/zoned";

const AUDIENCE: Record<FamilyNotification["audience"], string> = {
  adults: "Solo adultos",
  family: "Toda la familia",
  member: "Un hijo",
};

export function NotificationsCenter({
  notifications,
  recipient,
  names,
}: {
  notifications: FamilyNotification[];
  recipient: string;
  names: Record<string, string>;
}) {
  const { timeZone, hourFormat, now } = useClock();
  const today = localDateOf(now, timeZone);
  const [pending, startTransition] = useTransition();
  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Sin avisos todavía"
        description="Aparecerán los recordatorios de eventos y los avisos de preparativos."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {notifications.map((n) => {
        const mine = n.receipts.find((r) => r.recipient === recipient && r.acknowledgedAt);
        const seenBy = n.receipts.filter((r) => r.acknowledgedAt).map((r) => names[r.recipient] ?? "Otro dispositivo");
        const day = localDateOf(epochFromIso(n.createdAt), timeZone);
        return (
          <li key={n.id} className={cn("flex flex-wrap items-start gap-3 rounded-2xl border p-3", !mine && "border-2 border-ring")}>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {day === today ? "Hoy" : formatShortDate(day)} · {formatInstantTime(n.createdAt, timeZone, hourFormat)}
                <Badge variant="outline">{AUDIENCE[n.audience]}{n.audience === "member" && n.memberId ? `: ${names[`member:${n.memberId}`] ?? ""}` : ""}</Badge>
                {n.importance === "high" ? <Badge>Importante</Badge> : null}
              </p>
              <p className="text-lg font-bold">{n.title}</p>
              {n.body ? <p>{n.body}</p> : null}
              {seenBy.length ? <p className="mt-1 text-sm text-muted-foreground">Visto por: {seenBy.join(", ")}</p> : null}
            </div>
            {!mine ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await acknowledgeNotificationAction({ notificationId: n.id, as: "adult" });
                    if (!result.ok) toast.error(result.error.message);
                  })
                }
              >
                <Check aria-hidden /> Entendido
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function HealthPanel({ health }: { health: RemindersHealth | null }) {
  const { timeZone, hourFormat } = useClock();
  if (!health) return null;
  const problems = health.overduePending > 0 || health.failed7d > 0;
  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl p-4", problems ? "bg-warning/15" : "bg-success/10")}>
      <p className="flex items-center gap-2 font-semibold">
        {problems ? <CircleAlert aria-hidden className="size-5" /> : <Activity aria-hidden className="size-5" />}
        {problems ? "Hay avisos que no se procesaron a tiempo" : "Los avisos se procesan con normalidad"}
      </p>
      <ul className="text-sm text-muted-foreground">
        <li>
          Último aviso procesado:{" "}
          {health.lastCompletedAt ? `${formatShortDate(localDateOf(epochFromIso(health.lastCompletedAt), timeZone))} ${formatInstantTime(health.lastCompletedAt, timeZone, hourFormat)}` : "aún ninguno"}
        </li>
        <li>Pendientes atrasados: {health.overduePending} · Fallidos (7 días): {health.failed7d}</li>
        <li>
          Notificaciones push (7 días): {health.pushSent7d} enviadas · {health.pushFailed7d} con error ·{" "}
          {health.subscriptions} dispositivos suscritos
        </li>
      </ul>
    </div>
  );
}
