"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { rewardFormSchema } from "./schemas";
import { getActorClient } from "@/lib/auth/actor";
import { getAdultContext } from "@/lib/auth/session";
import { toDomainError } from "@/lib/errors";
import { type ActionResult, fail, failFromError, failFromZod, ok } from "@/lib/result";
import { commandIdSchema, uuidSchema } from "@/lib/validation/common";

const saveRewardSchema = z.object({
  commandId: commandIdSchema,
  rewardId: uuidSchema.nullable(),
  values: rewardFormSchema,
});

export async function saveRewardAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = saveRewardSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  const v = parsed.data.values;
  try {
    const { data, error } = await ctx.supabase.rpc("save_reward", {
      p_family_id: ctx.family.id,
      p_reward_id: parsed.data.rewardId as string,
      p_command_id: parsed.data.commandId,
      p_title: v.title,
      p_description: v.description,
      p_cost: v.cost,
      p_is_available: v.isAvailable,
      p_conditions: v.conditions,
      p_member_ids: v.memberIds,
    });
    if (error) throw toDomainError(error);
    refresh();
    return ok({ id: data });
  } catch (error) {
    return failFromError(error);
  }
}

export async function archiveRewardAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ rewardId: uuidSchema, archived: z.boolean() }).safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const { error } = await ctx.supabase.rpc("archive_reward", {
      p_reward_id: parsed.data.rewardId,
      p_archived: parsed.data.archived,
    });
    if (error) throw toDomainError(error);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}

const requestSchema = z.object({
  rewardId: uuidSchema,
  memberId: uuidSchema,
  commandId: commandIdSchema,
  as: z.enum(["adult", "device"]),
});

export async function requestRedemptionAction(input: unknown): Promise<ActionResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const actor = await getActorClient(parsed.data.as);
  if (!actor) return fail("SESSION_REQUIRED");
  try {
    const { error } = await actor.supabase.rpc("request_redemption", {
      p_reward_id: parsed.data.rewardId,
      p_member_id: parsed.data.memberId,
      p_command_id: parsed.data.commandId,
    });
    if (error) throw toDomainError(error);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}

const decideSchema = z.object({
  redemptionId: uuidSchema,
  action: z.enum(["approve", "reject", "deliver", "cancel"]),
  note: z.string().trim().max(300),
  as: z.enum(["adult", "device"]),
});

export async function decideRedemptionAction(input: unknown): Promise<ActionResult> {
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const actor = await getActorClient(parsed.data.as);
  if (!actor) return fail("SESSION_REQUIRED");
  try {
    const { error } = await actor.supabase.rpc("decide_redemption", {
      p_redemption_id: parsed.data.redemptionId,
      p_action: parsed.data.action,
      p_note: parsed.data.note,
    });
    if (error) throw toDomainError(error);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}

const adjustSchema = z.object({
  memberId: uuidSchema,
  amount: z
    .number()
    .int()
    .min(-10000)
    .max(10000)
    .refine((v) => v !== 0, "El ajuste no puede ser 0"),
  reason: z.string().trim().min(1, "Indica el motivo").max(300),
  commandId: commandIdSchema,
});

export async function adjustPointsAction(input: unknown): Promise<ActionResult> {
  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const { error } = await ctx.supabase.rpc("adjust_points", {
      p_family_id: ctx.family.id,
      p_member_id: parsed.data.memberId,
      p_amount: parsed.data.amount,
      p_reason: parsed.data.reason,
      p_command_id: parsed.data.commandId,
    });
    if (error) throw toDomainError(error);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}
