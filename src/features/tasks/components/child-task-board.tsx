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
          "flex flex-col gap-3 rounded-3xl border-2 bg-card p-4 sm:flex-row sm:items-center",
          state.key === "overdue" && "border-warning",
          task.status === "done" && "border-success/60 bg-success/5",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className={cn("text-2xl font-bold leading-tight", task.status === "done" && "text-muted-foreground")}>{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-base text-muted-foreground">
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
            <p className="mt-2 rounded-xl bg-warning/15 px-3 py-2 text-base">Para corregir: {task.reviewNote}</p>
          ) : null}
        </div>
        {canSubmit ? (
          <Button size="lg" className="min-w-40 text-xl" onClick={() => submit(task)} disabled={!online}>
            <Check aria-hidden className="size-6" /> ¡Listo!
          </Button>
        ) : task.status === "in_review" ? (
          <span className="flex items-center gap-2 text-lg font-semibold text-muted-foreground">
            <Hourglass aria-hidden className="size-6" /> Esperando revisión
          </span>
        ) : task.status === "done" ? (
          <span className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles aria-hidden className="size-6" /> ¡Hecho!
          </span>
        ) : null}
      </li>
    );
  };

  return (
    <section aria-labelledby="tareas-titulo" className="flex flex-col gap-4 rounded-3xl border bg-card/60 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="tareas-titulo" className="text-3xl font-bold">
          Mis tareas de hoy
        </h2>
        <p className="text-xl font-semibold" aria-live="polite">
          {progress.done} de {progress.total}
        </p>
      </div>
      <div
        className="h-4 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.done}
        aria-label="Progreso de hoy"
      >
        <div
          className="h-full rounded-full bg-success transition-all"
          style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : "0%" }}
        />
      </div>
      {celebrate ? (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-highlight/40 px-4 py-3 text-xl font-bold">
          <PartyPopper aria-hidden className="size-6" /> {celebrate}
        </p>
      ) : null}
      {chores.length === 0 && habits.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-xl text-muted-foreground">
          Hoy no tienes tareas. ¡Disfruta!
        </p>
      ) : null}
      {chores.length > 0 ? <ul className="flex flex-col gap-3">{chores.map(renderTask)}</ul> : null}
      {habits.length > 0 ? (
        <>
          <h3 className="mt-2 text-2xl font-bold">Hábitos</h3>
          <ul className="flex flex-col gap-3">{habits.map(renderTask)}</ul>
        </>
      ) : null}
      {!online ? <p role="status" className="text-muted-foreground">Sin conexión: podrás marcar tus tareas cuando vuelva la red.</p> : null}
    </section>
  );
}
