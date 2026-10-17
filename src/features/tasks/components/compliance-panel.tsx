"use client";

import type { ChildTask } from "../child-types";
import { complianceSummary } from "../domain/child-tasks";
import { useClock } from "@/components/clock/clock-provider";
import { MemberAvatar } from "@/components/member-chip";
import type { MemberSummary } from "@/features/calendar/types";
import { localDateOf } from "@/lib/time/zoned";

/** Resumen privado de los últimos 7 días por hijo: sin rankings ni comparaciones públicas. */
export function CompliancePanel({ kids, tasks }: { kids: MemberSummary[]; tasks: ChildTask[] }) {
  const { now, timeZone } = useClock();
  const today = localDateOf(now, timeZone);
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {kids.map((kid) => {
        const s = complianceSummary(tasks.filter((t) => t.assigneeId === kid.id), today, now);
        return (
          <li key={kid.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
            <MemberAvatar member={kid} size="lg" />
            <div>
              <p className="text-lg font-semibold">{kid.displayName}</p>
              <p className="text-sm text-muted-foreground">
                {s.onTime} a tiempo · {s.late} tarde · {s.overdue} vencidas · {s.inReview} en revisión
                {s.exempt ? ` · ${s.exempt} exentas` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
