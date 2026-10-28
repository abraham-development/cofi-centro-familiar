"use client";

import { ArrowUpRight, CheckCheck, Coins, Hourglass } from "lucide-react";

import { useClock } from "@/components/clock/clock-provider";
import { Meter } from "@/components/meter";
import { Panel } from "@/components/panel";
import { WorldLink } from "@/features/devices/components/linked-world-shell";
import { dailyProgress } from "@/features/tasks/domain/child-tasks";
import type { ChildTask } from "@/features/tasks/child-types";
import { localDateOf } from "@/lib/time/zoned";

export function ChildDaySummary({ tasks, balance }: { tasks: ChildTask[]; balance: number }) {
  const { now, timeZone } = useClock();
  const today = localDateOf(now, timeZone);
  const progress = dailyProgress(tasks, today);
  const pending = tasks.filter((t) => t.dueDate <= today && (t.status === "pending" || t.status === "needs_correction")).length;
  const review = tasks.filter((t) => t.status === "in_review").length;
  return <Panel id="mi-dia" title="Mi día" variant="featured" size="lg" caption="Un paso a la vez">
    <div className="flex items-baseline gap-2"><span className="figure text-4xl">{progress.done}</span><span>de {progress.total} completadas hoy</span></div>
    <Meter value={progress.done} max={progress.total} size="lg" label="Mi progreso de hoy" />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <WorldLink view="tareas" className="flex flex-col gap-2 rounded-xl bg-background/80 p-4 text-foreground"><CheckCheck aria-hidden className="size-5" /><strong>{pending} por hacer</strong><span className="text-sm text-muted-foreground">Mis tareas y hábitos <ArrowUpRight aria-hidden className="inline size-4" /></span></WorldLink>
      <div className="flex flex-col gap-2 rounded-xl bg-background/80 p-4 text-foreground"><Hourglass aria-hidden className="size-5" /><strong>{review} en revisión</strong><span className="text-sm text-muted-foreground">Un adulto las revisará</span></div>
      <WorldLink view="premios" className="flex flex-col gap-2 rounded-xl bg-background/80 p-4 text-foreground"><Coins aria-hidden className="size-5" /><strong>{balance} puntos</strong><span className="text-sm text-muted-foreground">Mis premios <ArrowUpRight aria-hidden className="inline size-4" /></span></WorldLink>
    </div>
  </Panel>;
}
