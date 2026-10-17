import "server-only";

import type { ChildTask } from "./child-types";
import { unwrap } from "@/lib/errors";
import type { DbClient } from "@/lib/supabase/types";
import type { IsoDate } from "@/lib/time/zoned";

const CHILD_TASK_SELECT = `
  id, template_id, kind, title, notes, assignee_member_id, due_date, due_time, due_at, status, points,
  requires_review, submitted_at, submitted_late, review_note, version
`;

type Row = {
  id: string;
  template_id: string | null;
  kind: string;
  title: string;
  notes: string | null;
  assignee_member_id: string;
  due_date: string;
  due_time: string | null;
  due_at: string | null;
  status: string;
  points: number;
  requires_review: boolean;
  submitted_at: string | null;
  submitted_late: boolean | null;
  review_note: string | null;
  version: number;
};

function map(r: Row): ChildTask {
  return {
    id: r.id,
    templateId: r.template_id,
    kind: r.kind as ChildTask["kind"],
    title: r.title,
    notes: r.notes,
    assigneeId: r.assignee_member_id,
    dueDate: r.due_date,
    dueTime: r.due_time ? r.due_time.slice(0, 5) : null,
    dueAt: r.due_at,
    status: r.status as ChildTask["status"],
    points: r.points,
    requiresReview: r.requires_review,
    submittedAt: r.submitted_at,
    submittedLate: r.submitted_late,
    reviewNote: r.review_note,
    version: r.version,
  };
}

/** Tareas y hábitos de hijos en un rango de fechas (opcionalmente de un hijo). */
export async function listChildTasks(
  supabase: DbClient,
  familyId: string,
  options: { from: IsoDate; to: IsoDate; memberId?: string },
): Promise<ChildTask[]> {
  let query = supabase
    .from("task_occurrences")
    .select(CHILD_TASK_SELECT)
    .eq("family_id", familyId)
    .in("kind", ["chore", "habit"])
    .neq("status", "cancelled")
    .gte("due_date", options.from)
    .lte("due_date", options.to)
    .order("due_date")
    .order("due_time", { ascending: true, nullsFirst: false })
    .limit(1000);
  if (options.memberId) query = query.eq("assignee_member_id", options.memberId);
  return (unwrap(await query) as unknown as Row[]).map(map);
}

/** Entregas por revisar (de cualquier fecha) para los adultos. */
export async function listReviewQueue(supabase: DbClient, familyId: string): Promise<ChildTask[]> {
  const rows = unwrap(
    await supabase
      .from("task_occurrences")
      .select(CHILD_TASK_SELECT)
      .eq("family_id", familyId)
      .in("kind", ["chore", "habit"])
      .eq("status", "in_review")
      .order("submitted_at")
      .limit(200),
  ) as unknown as Row[];
  return rows.map(map);
}

export type TaskTemplate = {
  id: string;
  kind: "chore" | "habit";
  title: string;
  description: string | null;
  points: number;
  requiresReview: boolean;
  dueTime: string | null;
  freq: "once" | "daily" | "weekdays" | "weekly" | "monthly";
  intervalCount: number;
  byWeekday: number[];
  monthDay: number | null;
  missingDayPolicy: "skip" | "last_day";
  startsOn: IsoDate;
  untilOn: IsoDate | null;
  status: "active" | "paused" | "archived";
  assigneeIds: string[];
  version: number;
};

const TEMPLATE_SELECT = `
  id, kind, title, description, points, requires_review, due_time, freq, interval_count, by_weekday, month_day,
  missing_day_policy, starts_on, until_on, status, version, task_template_assignees ( member_id )
`;

type TemplateRow = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  points: number;
  requires_review: boolean;
  due_time: string | null;
  freq: string;
  interval_count: number;
  by_weekday: number[] | null;
  month_day: number | null;
  missing_day_policy: string;
  starts_on: string;
  until_on: string | null;
  status: string;
  version: number;
  task_template_assignees: { member_id: string }[];
};

function mapTemplate(r: TemplateRow): TaskTemplate {
  return {
    id: r.id,
    kind: r.kind as TaskTemplate["kind"],
    title: r.title,
    description: r.description,
    points: r.points,
    requiresReview: r.requires_review,
    dueTime: r.due_time ? r.due_time.slice(0, 5) : null,
    freq: r.freq as TaskTemplate["freq"],
    intervalCount: r.interval_count,
    byWeekday: r.by_weekday ?? [],
    monthDay: r.month_day,
    missingDayPolicy: r.missing_day_policy as TaskTemplate["missingDayPolicy"],
    startsOn: r.starts_on,
    untilOn: r.until_on,
    status: r.status as TaskTemplate["status"],
    assigneeIds: r.task_template_assignees.map((a) => a.member_id),
    version: r.version,
  };
}

export async function listTemplates(supabase: DbClient, familyId: string): Promise<TaskTemplate[]> {
  const rows = unwrap(
    await supabase
      .from("task_templates")
      .select(TEMPLATE_SELECT)
      .eq("family_id", familyId)
      .neq("status", "archived")
      .order("kind")
      .order("title"),
  ) as unknown as TemplateRow[];
  return rows.map(mapTemplate);
}

export async function getTemplate(supabase: DbClient, familyId: string, id: string): Promise<TaskTemplate | null> {
  const { data, error } = await supabase
    .from("task_templates")
    .select(TEMPLATE_SELECT)
    .eq("family_id", familyId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTemplate(data as unknown as TemplateRow) : null;
}
