"use client";

import { Check, Hourglass, PartyPopper, Repeat, Sparkles } from "lucide-react";
import { startTransition, useOptimistic, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { submitTaskAction } from "../child-actions";
import type { ChildTask } from "../child-types";
import { childTaskState, dailyProgress, habitStreak } from "../domain/child-tasks";
import { TaskStateBadge } from "./task-state-badge";
import { useClock } from "@/components/clock/clock-provider";
import { Meter } from "@/components/meter";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { formatLocalTime, formatShortDay, localDateOf } from "@/lib/time/zoned";

type Change = { id: string; status: ChildTask["status"] };

/**
 * Tablero del hijo: qué le toca hoy, con una acción clara por tarea. Una
 * entrega nunca «desaparece»: queda visible como «esperando revisión» o
 * «¡hecho!» para que el hijo entienda qué pasó.
 */
export function ChildTaskBoard({
  tasks,
  habitHistory,
  actor,
}: {
  tasks: ChildTask[];
  habitHistory: ChildTask[];
  actor: "adult" | "device";
}) {
  const { now, timeZone, hourFormat } = useClock();
  const online = useOnlineStatus();
  const today = localDateOf(now, timeZone);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [optimistic, apply] = useOptimistic(tasks, (state, change: Change) =>
    state.map((t) => (t.id === change.id ? { ...t, status: change.status } : t)),
  );

  const visible = optimistic.filter((t) => t.dueDate === today || (t.dueDate < today && (t.status === "pending" || t.status === "needs_correction")));
  const chores = visible.filter((t) => t.kind === "chore");
  const habits = visible.filter((t) => t.kind === "habit");
  const progress = dailyProgress(optimistic, today);

  function submit(task: ChildTask) {
    startTransition(async () => {
      apply({ id: task.id, status: task.requiresReview ? "in_review" : "done" });
      const result = await submitTaskAction({ taskId: task.id, commandId: crypto.randomUUID(), as: actor });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      if (result.data.status === "done") {
        setCelebrate(result.data.points > 0 ? `¡Hecho! +${result.data.points} puntos` : "¡Hecho!");
      } else {
        setCelebrate("¡Bien! Un adulto lo revisará");
      }
      setTimeout(() => setCelebrate(null), 6000);
    });
  }

  const renderTask = (task: ChildTask) => {
    const state = childTaskState(task, today, now);
    const canSubmit = task.status === "pending" || task.status === "needs_correction";
    const streak = task.kind === "habit" ? habitStreak(habitHistory.filter((h) => h.templateId === task.templateId), today) : 0;
    return (
      <li
        key={task.id}
        className={cn(
          "flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:p-5",
          state.key === "overdue" && "border-warning/60 bg-warning/5",
          task.status === "done" && "bg-muted/50",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className={cn("text-xl leading-tight font-semibold sm:text-2xl", task.status === "done" && "text-muted-foreground line-through decoration-2")}>{task.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-base text-muted-foreground">
            <TaskStateBadge state={state} />
            {task.dueDate < today ? <span>era para el {formatShortDay(task.dueDate)}</span> : null}
            {task.dueTime ? <span>antes de las {formatLocalTime(task.dueTime, hourFormat)}</span> : null}
            {task.points > 0 ? <span className="font-semibold text-foreground">{task.points} pts</span> : null}
            {streak > 1 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Repeat aria-hidden className="size-4" /> {streak} días seguidos
              </span>
            ) : null}
          </div>
          {task.status === "needs_correction" && task.reviewNote ? (
            <p className="mt-2 rounded-lg bg-warning/15 px-3 py-2 text-base">Para corregir: {task.reviewNote}</p>
          ) : null}
        </div>
        {canSubmit ? (
          <Button size="lg" className="h-14 min-w-40 text-lg pointer-coarse:h-14" onClick={() => submit(task)} disabled={!online}>
            <Check aria-hidden className="size-5" strokeWidth={2.5} /> ¡Listo!
          </Button>
        ) : task.status === "in_review" ? (
          <span className="flex items-center gap-2 text-lg font-semibold text-muted-foreground">
            <Hourglass aria-hidden className="size-6" /> Esperando revisión
          </span>
        ) : task.status === "done" ? (
          <span className="flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-2 text-lg font-semibold text-brand-strong">
            <Sparkles aria-hidden className="size-5" /> ¡Hecho!
          </span>
        ) : null}
      </li>
    );
  };

  return (
    <Panel
      id="tareas-titulo"
      size="lg"
      title="Mis tareas de hoy"
      caption="Toca «¡Listo!» cuando termines"
      actions={
        <p aria-live="polite" className="flex items-baseline gap-1">
          <span className="figure text-3xl">{progress.done}</span>
          <span className="text-lg text-muted-foreground">de {progress.total}</span>
        </p>
      }
    >
      <Meter value={progress.done} max={progress.total} size="lg" label="Progreso de hoy" />
      {celebrate ? (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-brand-soft px-4 py-3 text-xl font-semibold">
          <PartyPopper aria-hidden className="size-6" /> {celebrate}
        </p>
      ) : null}
      {chores.length === 0 && habits.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-xl text-muted-foreground">
          Hoy no tienes tareas. ¡Disfruta!
        </p>
      ) : null}
      {chores.length > 0 ? <ul className="flex flex-col gap-3">{chores.map(renderTask)}</ul> : null}
      {habits.length > 0 ? (
        <>
          <h3 className="mt-2 text-lg font-semibold text-muted-foreground">Hábitos</h3>
          <ul className="flex flex-col gap-3">{habits.map(renderTask)}</ul>
        </>
      ) : null}
      {!online ? <p role="status" className="text-muted-foreground">Sin conexión: podrás marcar tus tareas cuando vuelva la red.</p> : null}
    </Panel>
  );
}
