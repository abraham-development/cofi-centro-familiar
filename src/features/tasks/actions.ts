"use server";

import { refresh } from "next/cache";

import {
  createHouseholdTaskSchema,
  setHouseholdStatusSchema,
  updateHouseholdTaskSchema,
} from "./schemas";
import { createHouseholdTask, setHouseholdTaskStatus, updateHouseholdTask } from "./use-cases";
import { getActorClient } from "@/lib/auth/actor";
import { getAdultContext } from "@/lib/auth/session";
import { type ActionResult, fail, failFromError, failFromZod, ok } from "@/lib/result";

export async function createHouseholdTaskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createHouseholdTaskSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const task = await createHouseholdTask(ctx.supabase, ctx.family.id, parsed.data.commandId, parsed.data.values);
    refresh();
    return ok({ id: task.id });
  } catch (error) {
    return failFromError(error);
  }
}

export async function updateHouseholdTaskAction(input: unknown): Promise<ActionResult> {
  const parsed = updateHouseholdTaskSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    await updateHouseholdTask(ctx.supabase, parsed.data);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}

export async function setHouseholdTaskStatusAction(input: unknown): Promise<ActionResult<{ status: string }>> {
  const parsed = setHouseholdStatusSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const actor = await getActorClient(parsed.data.as);
  if (!actor) return fail("SESSION_REQUIRED");
  try {
    const task = await setHouseholdTaskStatus(actor.supabase, parsed.data);
    refresh();
    return ok({ status: task.status });
  } catch (error) {
    return failFromError(error);
  }
}
