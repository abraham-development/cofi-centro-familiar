import "server-only";

import type { HouseholdTask } from "./types";
import type { MemberSummary } from "@/features/calendar/types";
import { unwrap } from "@/lib/errors";
import type { DbClient } from "@/lib/supabase/types";
import type { IsoDate } from "@/lib/time/zoned";

const TASK_SELECT = `
  id, title, notes, due_date, due_time, due_at, priority, visibility, status, completed_at, version,
  family_members!task_occurrences_assignee_fk ( id, display_name, color, initials, kind, avatar_emoji )
`;

type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  due_at: string | null;
  priority: string;
  visibility: string;
  status: string;
  completed_at: string | null;
  version: number;
  family_members: {
    id: string;
    display_name: string;
    color: string;
    initials: string;
    kind: string;
    avatar_emoji: string | null;
  } | null;
};

function mapTask(row: TaskRow): HouseholdTask {
  const m = row.family_members;
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date,
    dueTime: row.due_time ? row.due_time.slice(0, 5) : null,
    dueAt: row.due_at,
    priority: row.priority as HouseholdTask["priority"],
    visibility: row.visibility as HouseholdTask["visibility"],
    status: row.status as HouseholdTask["status"],
    completedAt: row.completed_at,
    version: row.version,
    assignee: m
      ? {
          id: m.id,
          displayName: m.display_name,
          color: m.color,
          initials: m.initials,
          kind: m.kind as MemberSummary["kind"],
          avatarEmoji: m.avatar_emoji,
        }
      : null,
  };
}

/**
 * Pendientes abiertos (vencidos, de hoy, próximos y sin fecha) más los
 * completados desde `doneSince` para poder reabrirlos.
 */
export async function listHouseholdTasks(
  supabase: DbClient,
  familyId: string,
  options: { doneSince: string; upTo?: IsoDate },
): Promise<HouseholdTask[]> {
  let open = supabase
    .from("task_occurrences")
    .select(TASK_SELECT)
    .eq("family_id", familyId)
    .eq("kind", "household")
    .eq("status", "pending")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(300);
  if (options.upTo) open = open.or(`due_date.is.null,due_date.lte.${options.upTo}`);

  const done = supabase
    .from("task_occurrences")
    .select(TASK_SELECT)
    .eq("family_id", familyId)
    .eq("kind", "household")
    .eq("status", "done")
    .gte("completed_at", options.doneSince)
    .order("completed_at", { ascending: false })
    .limit(50);

  const [openRows, doneRows] = await Promise.all([open.then(unwrap), done.then(unwrap)]);
  return [...(openRows as unknown as TaskRow[]), ...(doneRows as unknown as TaskRow[])].map(mapTask);
}
