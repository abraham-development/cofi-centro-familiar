"use client";

import { Check, ChevronRight, ClipboardList, RotateCcw } from "lucide-react";
import Link from "next/link";
import { startTransition, useOptimistic } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { setHouseholdTaskStatusAction } from "../actions";
import { householdUrgency, sortHouseholdTasks } from "../domain/household";
import type { HouseholdTask } from "../types";
import { useClock } from "@/components/clock/clock-provider";
import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/member-chip";
import { formatLocalTime, formatShortDay, localDateOf, relativeDayLabel } from "@/lib/time/zoned";

type Optimistic = { id: string; status: HouseholdTask["status"] };

export function HouseholdList({
  tasks,
  variant = "home",
  emptyAction,
  actor = "adult",
}: {
  tasks: HouseholdTask[];
  variant?: "home" | "full";
  emptyAction?: React.ReactNode;
  actor?: "adult" | "device";
}) {
  const { now, timeZone, hourFormat } = useClock();
  const today = localDateOf(now, timeZone);
  const [optimisticTasks, applyOptimistic] = useOptimistic(tasks, (state, change: Optimistic) =>
    state.map((t) => (t.id === change.id ? { ...t, status: change.status } : t)),
  );

  const visible = sortHouseholdTasks(
    optimisticTasks.filter((t) =>
      variant === "full" ? true : t.status === "done" || householdUrgency(t, today, now) !== "upcoming",
    ),
    today,
    now,
  );

  function toggle(task: HouseholdTask) {
    const status = task.status === "done" ? "pending" : "done";
    startTransition(async () => {
      applyOptimistic({ id: task.id, status });
      const result = await setHouseholdTaskStatusAction({
        taskId: task.id,
        status,
        commandId: crypto.randomUUID(),
        as: actor,
      });
      if (!result.ok) {
        toast.error(result.error.message);
      } else if (status === "done") {
        toast.success(`Hecho: ${task.title}`, {
          action: {
            label: "Deshacer",
            onClick: () => {
              void setHouseholdTaskStatusAction({
                taskId: task.id,
                status: "pending",
                commandId: crypto.randomUUID(),
                as: actor,
              });
            },
          },
        });
      }
    });
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Sin pendientes"
        description="Cuando haya algo que hacer en casa aparecerá aquí."
        action={emptyAction}
      />
    );
  }

  // En la lista completa, lo de días posteriores queda plegado: el foco es hoy.
  const later = variant === "full" ? visible.filter((t) => householdUrgency(t, today, now) === "upcoming") : [];
  const current = later.length ? visible.filter((t) => !later.includes(t)) : visible;

  const renderList = (items: HouseholdTask[]) => (
    <ul className="flex flex-col gap-1">
      {items.map((task) => {
        const urgency = householdUrgency(task, today, now);
        const done = task.status === "done";
        return (
          <li key={task.id}>
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl px-2 py-2 transition-colors",
                urgency === "overdue" ? "bg-warning/10" : "hover:bg-muted/60",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(task)}
                aria-pressed={done}
                aria-label={done ? `Reabrir: ${task.title}` : `Marcar como hecho: ${task.title}`}
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-lg border-2 transition-colors pointer-coarse:size-11",
                  done ? "border-brand bg-brand text-brand-foreground" : "border-input bg-card hover:border-foreground/30",
                )}
              >
                {done ? <Check aria-hidden className="size-5" strokeWidth={2.5} /> : null}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("leading-tight font-semibold", done && "text-muted-foreground line-through")}>
                  {variant === "full" ? (
                    <Link href={`/pendientes/${task.id}`} className="underline-offset-4 hover:underline">
                      {task.title}
                    </Link>
                  ) : (
                    task.title
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <DueLabel task={task} urgency={urgency} today={today} hourFormat={hourFormat} />
                </p>
              </div>
              {task.assignee ? (
                <span className="flex items-center gap-1.5">
                  <MemberAvatar member={task.assignee} size="sm" />
                  <span className="sr-only">Responsable: {task.assignee.displayName}</span>
                </span>
              ) : null}
              {done ? <RotateCcw aria-hidden className="size-4 text-muted-foreground" /> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );

  if (later.length === 0) return renderList(current);
  return (
    <div className="flex flex-col gap-4">
      {current.length ? (
        renderList(current)
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Nada pendiente para hoy.
        </p>
      )}
      <details className="group rounded-xl bg-muted/60">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
          Más adelante ({later.length})
        </summary>
        <div className="px-1 pb-1">{renderList(later)}</div>
      </details>
    </div>
  );
}

function DueLabel({
  task,
  urgency,
  today,
  hourFormat,
}: {
  task: HouseholdTask;
  urgency: ReturnType<typeof householdUrgency>;
  today: string;
  hourFormat: "12h" | "24h";
}) {
  if (urgency === "done") return <>Hecho</>;
  if (!task.dueDate) return <>Cuando se pueda</>;
  const time = task.dueTime ? ` · ${formatLocalTime(task.dueTime, hourFormat)}` : "";
  if (urgency === "overdue") {
    const when = task.dueDate === today ? "hoy" : formatShortDay(task.dueDate);
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-warning" />
        Atrasado (era {when}
        {time})
      </span>
    );
  }
  if (task.dueDate === today) return <>{task.dueTime ? `Hoy${time}` : "Para hoy"}</>;
  return (
    <>
      {relativeDayLabel(task.dueDate, today)}
      {time}
    </>
  );
}
