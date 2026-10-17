import type { HouseholdTask } from "../types";
import { epochFromIso, type IsoDate } from "@/lib/time/zoned";

export type HouseholdUrgency = "overdue" | "today" | "upcoming" | "someday" | "done";

/**
 * Clasifica un pendiente. Uno sin hora vence al terminar su día; uno sin fecha
 * es «cuando se pueda» y nunca se le inventa una cita.
 */
export function householdUrgency(task: HouseholdTask, today: IsoDate, nowMs: number): HouseholdUrgency {
  if (task.status === "done") return "done";
  if (!task.dueDate) return "someday";
  if (task.dueAt) {
    if (epochFromIso(task.dueAt) < nowMs) return "overdue";
    return task.dueDate === today ? "today" : "upcoming";
  }
  if (task.dueDate < today) return "overdue";
  if (task.dueDate === today) return "today";
  return "upcoming";
}

const URGENCY_ORDER: Record<HouseholdUrgency, number> = {
  overdue: 0,
  today: 1,
  upcoming: 2,
  someday: 3,
  done: 4,
};

const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 } as const;

export function sortHouseholdTasks(tasks: HouseholdTask[], today: IsoDate, nowMs: number): HouseholdTask[] {
  return [...tasks].sort((a, b) => {
    const ua = URGENCY_ORDER[householdUrgency(a, today, nowMs)];
    const ub = URGENCY_ORDER[householdUrgency(b, today, nowMs)];
    if (ua !== ub) return ua - ub;
    const da = a.dueAt ?? (a.dueDate ? `${a.dueDate}T23:59` : "9999");
    const db = b.dueAt ?? (b.dueDate ? `${b.dueDate}T23:59` : "9999");
    if (da !== db) return da < db ? -1 : 1;
    if (a.priority !== b.priority) return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    return a.title.localeCompare(b.title, "es");
  });
}
