"use client";

import { Ban, Check, Inbox, RotateCcw, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { adjustTaskAction, reviewTaskAction } from "../child-actions";
import type { ChildTask } from "../child-types";
import { childTaskState } from "../domain/child-tasks";
import { TaskStateBadge } from "./task-state-badge";
import { useClock } from "@/components/clock/clock-provider";
import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/member-chip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { MemberSummary } from "@/features/calendar/types";
import { formatInstantTime, formatShortDay, localDateOf } from "@/lib/time/zoned";

/** Entregas por revisar y acciones de corrección para los adultos. */
export function ReviewQueue({
  tasks,
  recent,
  members,
}: {
  tasks: ChildTask[];
  recent: ChildTask[];
  members: Map<string, MemberSummary>;
}) {
  const { now, timeZone, hourFormat } = useClock();
  const today = localDateOf(now, timeZone);
  const [pending, startTransition] = useTransition();

  function approve(task: ChildTask) {
    startTransition(async () => {
      const result = await reviewTaskAction({
        taskId: task.id,
        expectedVersion: task.version,
        commandId: crypto.randomUUID(),
        decision: "approve",
        note: "",
      });
      if (result.ok) toast.success(`Aprobada: ${task.title}${task.points ? ` (+${task.points})` : ""}`);
      else toast.error(result.error.message);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {tasks.length === 0 ? (
        <EmptyState icon={Inbox} title="Nada por revisar" description="Las entregas de los hijos aparecerán aquí." />
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => {
            const member = members.get(task.assigneeId);
            return (
              <li key={task.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
                {member ? <MemberAvatar member={member} size="lg" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{task.title}</p>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {member?.displayName} · entregó {task.submittedAt ? formatInstantTime(task.submittedAt, timeZone, hourFormat) : ""}
                    {task.dueDate !== today ? ` (${formatShortDay(task.dueDate)})` : ""}
                    <TaskStateBadge state={childTaskState(task, today, now)} />
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => approve(task)} disabled={pending}>
                    <Check aria-hidden /> Aprobar{task.points ? ` (+${task.points})` : ""}
                  </Button>
                  <ReasonDialog
                    task={task}
                    title="Pedir corrección"
                    description="Explica qué falta. La tarea vuelve al hijo para que la corrija."
                    label="Qué falta"
                    confirm="Pedir corrección"
                    trigger={
                      <Button variant="outline">
                        <RotateCcw aria-hidden /> Corregir
                      </Button>
                    }
                    run={(note) =>
                      reviewTaskAction({
                        taskId: task.id,
                        expectedVersion: task.version,
                        commandId: crypto.randomUUID(),
                        decision: "needs_correction",
                        note,
                      })
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {recent.length > 0 ? (
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer font-semibold">Corregir registros recientes ({recent.length})</summary>
          <ul className="mt-3 flex flex-col gap-2">
            {recent.map((task) => {
              const member = members.get(task.assigneeId);
              const state = childTaskState(task, today, now);
              return (
                <li key={task.id} className="flex flex-wrap items-center gap-2">
                  {member ? <MemberAvatar member={member} size="sm" /> : null}
                  <span className="min-w-0 flex-1 truncate">
                    {task.title} · {formatShortDay(task.dueDate)}
                  </span>
                  <TaskStateBadge state={state} />
                  {task.status === "done" || task.status === "exempt" ? (
                    <ReasonDialog
                      task={task}
                      title="Reabrir registro"
                      description="La tarea vuelve a quedar pendiente. Si dio puntos, se descuentan con un movimiento compensatorio."
                      label="Motivo"
                      confirm="Reabrir"
                      trigger={
                        <Button size="sm" variant="ghost">
                          <Undo2 aria-hidden /> Reabrir
                        </Button>
                      }
                      run={(reason) =>
                        adjustTaskAction({ taskId: task.id, commandId: crypto.randomUUID(), action: "reopen", reason })
                      }
                    />
                  ) : (
                    <ReasonDialog
                      task={task}
                      title="Eximir esta vez"
                      description="No cuenta como incumplimiento ni da puntos. Útil si estuvo enfermo o de viaje."
                      label="Motivo"
                      confirm="Eximir"
                      trigger={
                        <Button size="sm" variant="ghost">
                          <Ban aria-hidden /> Eximir
                        </Button>
                      }
                      run={(reason) =>
                        adjustTaskAction({ taskId: task.id, commandId: crypto.randomUUID(), action: "exempt", reason })
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ReasonDialog({
  task,
  title,
  description,
  label,
  confirm,
  trigger,
  run,
}: {
  task: ChildTask;
  title: string;
  description: string;
  label: string;
  confirm: string;
  trigger: React.ReactElement;
  run: (text: string) => Promise<{ ok: boolean; error?: { message: string } }>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            const result = await run(text);
            setSaving(false);
            if (result.ok) {
              toast.success(`${confirm}: ${task.title}`);
              setOpen(false);
              setText("");
            } else toast.error(result.error?.message ?? "No se pudo guardar");
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`reason-${task.id}`}>{label}</FieldLabel>
            <Textarea id={`reason-${task.id}`} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} required />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button type="submit" disabled={saving || !text.trim()}>
              {saving ? "Guardando…" : confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
