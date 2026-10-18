"use client";

import type { ChildTask } from "../child-types";
import { complianceSummary } from "../domain/child-tasks";
import { useClock } from "@/components/clock/clock-provider";
import { MemberAvatar } from "@/components/member-chip";
import { Meter } from "@/components/meter";
import type { MemberSummary } from "@/features/calendar/types";
import { localDateOf } from "@/lib/time/zoned";

/** Resumen privado de los últimos 7 días por hijo: sin rankings ni comparaciones públicas. */
export function CompliancePanel({ kids, tasks }: { kids: MemberSummary[]; tasks: ChildTask[] }) {
  const { now, timeZone } = useClock();
  const today = localDateOf(now, timeZone);
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {kids.map((kid) => {
        const s = complianceSummary(tasks.filter((t) => t.assigneeId === kid.id), today, now);
        const done = s.onTime + s.late;
        const due = done + s.overdue;
        return (
          <li key={kid.id} className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4">
            <div className="flex items-center gap-3">
              <MemberAvatar member={kid} size="md" className="ring-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{kid.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {s.inReview} en revisión{s.exempt ? ` · ${s.exempt} exentas` : ""}
                </p>
              </div>
              <p className="text-right">
                <span className="figure text-2xl">{done}</span>
                <span className="text-sm text-muted-foreground"> / {due}</span>
              </p>
            </div>
            <Meter value={done} max={due} color={kid.color} label={`${kid.displayName}: ${done} de ${due} cumplidas`} />
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{s.onTime} a tiempo</span>
              <span>{s.late} tarde</span>
              <span className={s.overdue ? "font-semibold text-foreground" : undefined}>{s.overdue} vencidas</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
