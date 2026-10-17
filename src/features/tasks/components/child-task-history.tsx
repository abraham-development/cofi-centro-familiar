"use client";

import { ListChecks, Repeat } from "lucide-react";
import { cn } from "cn";

import type { ChildTask } from "../child-types";
import { childTaskState, complianceSummary } from "../domain/child-tasks";
import { TaskStateBadge } from "./task-state-badge";
import { useClock } from "@/components/clock/clock-provider";
import {
  epochFromIso,
  formatInstantTime,
  formatLocalTime,
  formatLongDate,
  formatShortDay,
  localDateOf,
  relativeDayLabel,
} from "@/lib/time/zoned";

/**
 * Lo que un hijo tiene hoy (`mode="today"`) o lo que hizo en días anteriores
 * (`mode="history"`), agrupado por día. La puntualidad se mide por su entrega.
 */
export function ChildTaskHistory({ tasks, mode }: { tasks: ChildTask[]; mode: "today" | "history" }) {
  const { now, timeZone, hourFormat } = useClock();
  const today = localDateOf(now, timeZone);
  const relevant = tasks.filter((t) => (mode === "today" ? t.dueDate === today : t.dueDate < today));

  if (relevant.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-muted-foreground">
        {mode === "today" ? "Hoy no tiene tareas ni hábitos." : "No hay registros en este periodo."}
      </p>
    );
  }

  const days = [...new Set(relevant.map((t) => t.dueDate))].sort().reverse();
  // Si entregó otro día (p. ej., tarde), se indica el día además de la hora.
  const submittedLabel = (instant: string, day: string) => {
    const submittedDay = localDateOf(epochFromIso(instant), timeZone);
    const time = formatInstantTime(instant, timeZone, hourFormat);
    return submittedDay === day ? time : `${formatShortDay(submittedDay)} ${time}`;
  };
  const summary = mode === "history" ? complianceSummary(relevant, today, now) : null;

  return (
    <div className="flex flex-col gap-4">
      {summary ? (
        <ul className="flex flex-wrap gap-2 text-sm font-semibold" aria-label="Resumen del periodo">
          <li className="rounded-full bg-success/15 px-3 py-1">{summary.onTime} a tiempo</li>
          <li className="rounded-full bg-success/10 px-3 py-1">{summary.late} tarde</li>
          <li className="rounded-full bg-warning/20 px-3 py-1">{summary.overdue} vencidas</li>
          <li className="rounded-full bg-ring/15 px-3 py-1">{summary.inReview} en revisión</li>
          {summary.exempt ? <li className="rounded-full bg-muted px-3 py-1">{summary.exempt} exentas</li> : null}
        </ul>
      ) : null}
      {days.map((day) => (
        <section key={day} aria-label={formatLongDate(day)} className="flex flex-col gap-2">
          {mode === "history" ? (
            <h3 className="font-bold">
              {relativeDayLabel(day, today) === "Ayer" ? `Ayer · ${formatLongDate(day)}` : formatLongDate(day)}
            </h3>
          ) : null}
          <ul className="flex flex-col gap-2">
            {relevant
              .filter((t) => t.dueDate === day)
              .sort((a, b) => (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99") || a.title.localeCompare(b.title, "es"))
              .map((task) => {
                const state = childTaskState(task, today, now);
                const Icon = task.kind === "habit" ? Repeat : ListChecks;
                return (
                  <li
                    key={task.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-3 py-2",
                      state.key === "overdue" && "border-warning",
                    )}
                  >
                    <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {task.title}
                        <span className="sr-only"> ({task.kind === "habit" ? "hábito" : "responsabilidad"})</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {task.dueTime ? `Límite ${formatLocalTime(task.dueTime, hourFormat)}` : "Durante el día"}
                        {task.submittedAt ? ` · entregó ${submittedLabel(task.submittedAt, day)}` : ""}
                        {task.points ? ` · ${task.points} pts` : ""}
                      </p>
                    </div>
                    <TaskStateBadge state={state} />
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
