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
      <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
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
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Resumen del periodo">
          {[
            { value: summary.onTime, label: "a tiempo", dot: "bg-success" },
            { value: summary.late, label: "tarde", dot: "bg-brand" },
            { value: summary.overdue, label: "vencidas", dot: "bg-warning" },
            { value: summary.inReview, label: "en revisión", dot: "bg-muted-foreground" },
            ...(summary.exempt ? [{ value: summary.exempt, label: "exentas", dot: "bg-muted-foreground/50" }] : []),
          ].map((item) => (
            <li key={item.label} className="rounded-xl bg-muted/60 px-3 py-2.5">
              <p className="figure text-xl">{item.value}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden className={cn("size-1.5 rounded-full", item.dot)} />
                {item.label}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {days.map((day) => (
        <section key={day} aria-label={formatLongDate(day)} className="flex flex-col gap-2">
          {mode === "history" ? (
            <h3 className="text-sm font-semibold text-muted-foreground">
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
                      "flex flex-wrap items-center gap-3 rounded-xl border bg-card px-3 py-2.5",
                      state.key === "overdue" && "border-warning/50 bg-warning/5",
                    )}
                  >
                    <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {task.title}
                        <span className="sr-only"> ({task.kind === "habit" ? "hábito" : "responsabilidad"})</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
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
