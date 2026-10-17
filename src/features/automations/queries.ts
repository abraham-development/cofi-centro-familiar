import "server-only";

import { unwrap } from "@/lib/errors";
import type { DbClient } from "@/lib/supabase/types";

export type AutomationRule = {
  id: string;
  kind: "visit_prep" | "school_prep";
  name: string;
  enabled: boolean;
  eveningTime: string;
  morningTime: string;
  prepMinutesBefore: number;
  taskTitle: string | null;
  taskMemberIds: string[];
  taskPoints: number;
  notifyAudience: "family" | "adults";
};

export async function listRules(supabase: DbClient, familyId: string): Promise<AutomationRule[]> {
  const rows = unwrap(
    await supabase
      .from("automation_rules")
      .select(
        "id, kind, name, enabled, evening_time, morning_time, prep_minutes_before, task_title, task_member_ids, task_points, notify_audience",
      )
      .eq("family_id", familyId)
      .order("created_at"),
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as AutomationRule["kind"],
    name: r.name,
    enabled: r.enabled,
    eveningTime: r.evening_time.slice(0, 5),
    morningTime: r.morning_time.slice(0, 5),
    prepMinutesBefore: r.prep_minutes_before,
    taskTitle: r.task_title,
    taskMemberIds: r.task_member_ids,
    taskPoints: r.task_points,
    notifyAudience: r.notify_audience as AutomationRule["notifyAudience"],
  }));
}
