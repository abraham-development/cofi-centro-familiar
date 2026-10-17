"use client";

import { Coins, Inbox } from "lucide-react";
import Link from "next/link";

import { useClock } from "@/components/clock/clock-provider";
import { MemberAvatar } from "@/components/member-chip";
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
    <section aria-labelledby="hijos-titulo" className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
      <h2 id="hijos-titulo" className="text-2xl font-bold">
        Hijos hoy
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {kids.map((kid) => {
          const own = tasks.filter((t) => t.assigneeId === kid.id);
          const progress = dailyProgress(own, today);
          const toReview = own.filter((t) => t.status === "in_review").length;
          const content = (
            <>
              <MemberAvatar member={kid} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between gap-2 text-lg font-semibold">
                  {kid.displayName}
                  <span className="flex items-center gap-1 text-base tabular-nums">
                    <Coins aria-hidden className="size-4 text-warning" /> {balances[kid.id] ?? 0}
                  </span>
                </p>
                <div
                  className="mt-1 h-3 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label={`Progreso de ${kid.displayName}`}
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-valuenow={progress.done}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: progress.total ? `${(progress.done / progress.total) * 100}%` : "0%",
                      backgroundColor: kid.color,
                    }}
                  />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {progress.total ? `${progress.done} de ${progress.total} tareas` : "Sin tareas hoy"}
                  {toReview ? (
                    <span className="ml-2 inline-flex items-center gap-1 font-semibold text-foreground">
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
                <Link href={`/hijos/${kid.id}`} className="flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:bg-muted/50">
                  {content}
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border p-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
