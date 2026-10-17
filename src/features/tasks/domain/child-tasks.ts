import type { ChildTask } from "../child-types";
import { addDays, epochFromIso, type IsoDate } from "@/lib/time/zoned";

export type TaskTone = "neutral" | "warning" | "info" | "success" | "muted";

export type TaskState = {
  key:
    | "pending"
    | "overdue"
    | "in_review_on_time"
    | "in_review_late"
    | "needs_correction"
    | "done_on_time"
    | "done_late"
    | "exempt"
    | "cancelled";
  label: string;
  tone: TaskTone;
};

/** ¿Venció sin entrega? Usa la hora límite si existe; si no, el fin del día local. */
export function isOverdue(task: ChildTask, today: IsoDate, nowMs: number): boolean {
  if (task.status !== "pending" && task.status !== "needs_correction") return false;
  if (task.dueAt) return epochFromIso(task.dueAt) < nowMs;
  return task.dueDate < today;
}

/**
 * Estado comprensible para la interfaz. Distingue «pendiente vencida»,
 * «entregada tarde» y «en revisión entregada a tiempo»: la puntualidad se
 * mide por la entrega del hijo, no por cuándo aprobó el adulto.
 */
export function childTaskState(task: ChildTask, today: IsoDate, nowMs: number): TaskState {
  switch (task.status) {
    case "pending":
      return isOverdue(task, today, nowMs)
        ? { key: "overdue", label: "Vencida", tone: "warning" }
        : { key: "pending", label: "Pendiente", tone: "neutral" };
    case "needs_correction":
      return { key: "needs_correction", label: "Por corregir", tone: "warning" };
    case "in_review":
      return task.submittedLate
        ? { key: "in_review_late", label: "Entregada tarde · en revisión", tone: "info" }
        : { key: "in_review_on_time", label: "En revisión (a tiempo)", tone: "info" };
    case "done":
      return task.submittedLate
        ? { key: "done_late", label: "Cumplida tarde", tone: "success" }
        : { key: "done_on_time", label: "Cumplida", tone: "success" };
    case "exempt":
      return { key: "exempt", label: "Exenta", tone: "muted" };
    default:
      return { key: "cancelled", label: "Cancelada", tone: "muted" };
  }
}

/** Progreso de un día: las exentas y canceladas no cuentan como pendientes. */
export function dailyProgress(tasks: ChildTask[], date: IsoDate): { done: number; total: number } {
  const relevant = tasks.filter((t) => t.dueDate === date && t.status !== "exempt" && t.status !== "cancelled");
  return { done: relevant.filter((t) => t.status === "done").length, total: relevant.length };
}

/**
 * Racha de un hábito (días seguidos cumplidos hasta hoy).
 * Política documentada: un día exento PAUSA la racha (no suma ni la rompe);
 * hoy todavía pendiente tampoco la rompe; un día anterior sin cumplir, sí.
 */
export function habitStreak(occurrences: ChildTask[], today: IsoDate): number {
  const byDate = new Map(occurrences.map((o) => [o.dueDate, o]));
  let streak = 0;
  let date = today;
  for (let i = 0; i < 400; i += 1) {
    const occ = byDate.get(date);
    if (!occ) break;
    if (occ.status === "done") streak += 1;
    else if (occ.status === "exempt" || occ.status === "cancelled") {
      // pausa
    } else if (date === today) {
      // hoy aún puede cumplirse
    } else break;
    date = addDays(date, -1);
  }
  return streak;
}

export type ComplianceSummary = {
  onTime: number;
  late: number;
  overdue: number;
  inReview: number;
  exempt: number;
};

/** Resumen de los últimos días para un hijo (sin rankings ni castigos). */
export function complianceSummary(tasks: ChildTask[], today: IsoDate, nowMs: number): ComplianceSummary {
  const summary: ComplianceSummary = { onTime: 0, late: 0, overdue: 0, inReview: 0, exempt: 0 };
  for (const task of tasks) {
    const state = childTaskState(task, today, nowMs).key;
    if (state === "done_on_time") summary.onTime += 1;
    else if (state === "done_late") summary.late += 1;
    else if (state === "overdue" || (state === "needs_correction" && isOverdue(task, today, nowMs))) summary.overdue += 1;
    else if (state === "in_review_on_time" || state === "in_review_late") summary.inReview += 1;
    else if (state === "exempt") summary.exempt += 1;
  }
  return summary;
}
