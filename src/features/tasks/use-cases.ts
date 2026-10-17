import "server-only";

import type { HouseholdTaskFormValues } from "./schemas";
import { toDomainError } from "@/lib/errors";
import type { Database } from "@/lib/supabase/database.types";
import type { DbClient } from "@/lib/supabase/types";

type HouseholdFields = Omit<
  Database["public"]["Functions"]["create_household_task"]["Args"],
  "p_family_id" | "p_command_id"
>;

function toFields(values: HouseholdTaskFormValues): HouseholdFields {
  return {
    p_title: values.title,
    p_notes: values.notes,
    p_assignee_member_id: values.assigneeMemberId,
    p_due_date: values.dueDate,
    p_due_time: values.dueDate ? values.dueTime : null,
    p_priority: values.priority,
    p_visibility: values.visibility,
  } as unknown as HouseholdFields; // el RPC acepta NULL en los opcionales
}

export async function createHouseholdTask(
  supabase: DbClient,
  familyId: string,
  commandId: string,
  values: HouseholdTaskFormValues,
) {
  const { data, error } = await supabase.rpc("create_household_task", {
    p_family_id: familyId,
    p_command_id: commandId,
    ...toFields(values),
  });
  if (error) throw toDomainError(error);
  return data;
}

export async function updateHouseholdTask(
  supabase: DbClient,
  input: { taskId: string; expectedVersion: number; commandId: string; values: HouseholdTaskFormValues },
) {
  const { data, error } = await supabase.rpc("update_household_task", {
    p_task_id: input.taskId,
    p_expected_version: input.expectedVersion,
    p_command_id: input.commandId,
    ...toFields(input.values),
  });
  if (error) throw toDomainError(error);
  return data;
}

export async function setHouseholdTaskStatus(
  supabase: DbClient,
  input: { taskId: string; status: "pending" | "done" | "cancelled"; commandId: string },
) {
  const { data, error } = await supabase.rpc("set_household_task_status", {
    p_task_id: input.taskId,
    p_status: input.status,
    p_command_id: input.commandId,
  });
  if (error) throw toDomainError(error);
  return data;
}
