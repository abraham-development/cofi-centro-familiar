"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import {
  adjustTaskSchema,
  reviewTaskSchema,
  saveTemplateSchema,
  submitTaskSchema,
} from "./template-schemas";
import { getActorClient } from "@/lib/auth/actor";
import { getAdultContext } from "@/lib/auth/session";
import { toDomainError } from "@/lib/errors";
import { type ActionResult, fail, failFromError, failFromZod, ok } from "@/lib/result";
import { uuidSchema } from "@/lib/validation/common";

export async function saveTemplateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = saveTemplateSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  const v = parsed.data.values;
  try {
    const { data, error } = await ctx.supabase.rpc("save_task_template", {
      p_family_id: ctx.family.id,
      p_template_id: parsed.data.templateId as string,
      p_expected_version: parsed.data.expectedVersion as number,
      p_command_id: parsed.data.commandId,
      p_kind: v.kind,
      p_title: v.title,
      p_description: v.description,
      p_points: v.points,
      p_requires_review: v.requiresReview,
      p_due_time: v.dueTime as string,
      p_assignee_ids: v.assigneeIds,
      p_freq: v.freq,
      p_interval: v.intervalCount,
      p_by_weekday: v.freq === "weekly" ? v.byWeekday : (null as unknown as number[]),
      p_month_day: v.freq === "monthly" ? (v.monthDay as number) : (null as unknown as number),
      p_missing: v.missingDayPolicy,
      p_starts_on: v.startsOn,
      p_until: (v.freq === "once" ? null : v.untilOn) as string,
    });
    if (error) throw toDomainError(error);
    refresh();
    return ok({ id: data });
  } catch (error) {
    return failFromError(error);
  }
}

const templateStatusSchema = z.object({ templateId: uuidSchema, status: z.enum(["active", "paused", "archived"]) });

export async function setTemplateStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = templateStatusSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const { error } = await ctx.supabase.rpc("set_task_template_status", {
      p_template_id: parsed.data.templateId,
      p_status: parsed.data.status,
    });
    if (error) throw toDomainError(error);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}

/** El hijo (desde su pantalla) o un adulto marca una tarea como terminada. */
export async function submitTaskAction(input: unknown): Promise<ActionResult<{ status: string; points: number }>> {
  const parsed = submitTaskSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const actor = await getActorClient(parsed.data.as);
  if (!actor) return fail("SESSION_REQUIRED");
  try {
    const { data, error } = await actor.supabase.rpc("submit_task", {
      p_task_id: parsed.data.taskId,
      p_command_id: parsed.data.commandId,
    });
    if (error) throw toDomainError(error);
    refresh();
    return ok({ status: data.status, points: data.points });
  } catch (error) {
    return failFromError(error);
  }
}

export async function reviewTaskAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  const parsed = reviewTaskSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const { data, error } = await ctx.supabase.rpc("review_task", {
      p_task_id: parsed.data.taskId,
      p_expected_version: parsed.data.expectedVersion,
      p_command_id: parsed.data.commandId,
      p_decision: parsed.data.decision,
      p_note: parsed.data.note,
    });
    if (error) throw toDomainError(error);
    refresh();
    return ok({ status: data.status });
  } catch (error) {
    return failFromError(error);
  }
}

export async function adjustTaskAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  const parsed = adjustTaskSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const { data, error } = await ctx.supabase.rpc("adjust_task", {
      p_task_id: parsed.data.taskId,
      p_command_id: parsed.data.commandId,
      p_action: parsed.data.action,
      p_reason: parsed.data.reason,
    });
    if (error) throw toDomainError(error);
    refresh();
    return ok({ status: data.status });
  } catch (error) {
    return failFromError(error);
  }
}
