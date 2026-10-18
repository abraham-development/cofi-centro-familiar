"use client";

import { Coins, Inbox } from "lucide-react";
import Link from "next/link";

import { useClock } from "@/components/clock/clock-provider";
import { MemberAvatar } from "@/components/member-chip";
import { Meter } from "@/components/meter";
import { Panel } from "@/components/panel";
import type { MemberSummary } from "@/features/calendar/types";
import type { ChildTask } from "@/features/tasks/child-types";
import { dailyProgress } from "@/features/tasks/domain/child-tasks";
import { localDateOf } from "@/lib/time/zoned";

/** Resumen de hijos en la pantalla de casa: progreso de hoy, sin comparaciones. */
export function ChildrenSummary({
  kids,
  tasks,
  balances,
  linkToDetail,
}: {
  kids: MemberSummary[];
  tasks: ChildTask[];
  balances: Record<string, number>;
  linkToDetail: boolean;
}) {
  const { now, timeZone } = useClock();
  const today = localDateOf(now, timeZone);
  if (kids.length === 0) return null;
  return (
    <Panel id="hijos-titulo" title="Hijos hoy" caption="Avance de sus tareas, sin comparaciones">
      <ul className="flex flex-col gap-2">
        {kids.map((kid) => {
          const own = tasks.filter((t) => t.assigneeId === kid.id);
          const progress = dailyProgress(own, today);
          const toReview = own.filter((t) => t.status === "in_review").length;
          const content = (
            <>
              <MemberAvatar member={kid} size="md" className="ring-0" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{kid.displayName}</span>
                  <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                    <Coins aria-hidden className="size-3.5 text-muted-foreground" /> {balances[kid.id] ?? 0}
                    <span className="sr-only">puntos</span>
                  </span>
                </p>
                <Meter
                  className="mt-2"
                  value={progress.done}
                  max={progress.total}
                  color={kid.color}
                  label={`Progreso de ${kid.displayName}`}
                />
                <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {progress.total ? `${progress.done} de ${progress.total} tareas` : "Sin tareas hoy"}
                  {toReview ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      <Inbox aria-hidden className="size-3.5" /> {toReview} por revisar
                    </span>
                  ) : null}
                </p>
              </div>
            </>
          );
          return (
            <li key={kid.id}>
              {linkToDetail ? (
                <Link href={`/hijos/${kid.id}`} className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/70">
                  {content}
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-xl p-2.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
