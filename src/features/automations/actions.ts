"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { ruleFormSchema } from "./schemas";
import { getAdultContext } from "@/lib/auth/session";
import { toDomainError } from "@/lib/errors";
import { type ActionResult, fail, failFromError, failFromZod, ok } from "@/lib/result";
import { uuidSchema } from "@/lib/validation/common";

const saveSchema = z.object({ ruleId: uuidSchema.nullable(), values: ruleFormSchema });

export async function saveRuleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  const v = parsed.data.values;
  try {
    const { data, error } = await ctx.supabase.rpc("save_automation_rule", {
      p_family_id: ctx.family.id,
      p_rule_id: parsed.data.ruleId as string,
      p_kind: v.kind,
      p_name: v.name,
      p_enabled: v.enabled,
      p_evening_time: v.eveningTime,
      p_morning_time: v.morningTime,
      p_prep_minutes_before: v.prepMinutesBefore,
      p_task_title: v.taskTitle,
      p_task_member_ids: v.taskTitle ? v.taskMemberIds : [],
      p_task_points: v.taskPoints,
      p_notify_audience: v.notifyAudience,
    });
    if (error) throw toDomainError(error);
    refresh();
    return ok({ id: data });
  } catch (error) {
    return failFromError(error);
  }
}
