"use server";

import { refresh } from "next/cache";

import { findOverlaps } from "./queries";
import {
  cancelEventSchema,
  createEventSchema,
  createSeriesSchema,
  endSeriesSchema,
  eventFormSchema,
  splitSeriesSchema,
  updateEventSchema,
} from "./schemas";
import {
  cancelEvent,
  createEvent,
  createEventSeries,
  endEventSeries,
  splitEventSeries,
  toEventRpcFields,
  updateEvent,
} from "./use-cases";
import { getAdultContext } from "@/lib/auth/session";
import { type ActionResult, fail, failFromError, failFromZod, ok } from "@/lib/result";

export async function createEventAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const event = await createEvent(ctx.supabase, ctx.family, parsed.data.commandId, parsed.data.values);
    refresh();
    return ok({ id: event.id });
  } catch (error) {
    return failFromError(error);
  }
}

export async function updateEventAction(input: unknown): Promise<ActionResult<{ id: string; version: number }>> {
  const parsed = updateEventSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const event = await updateEvent(ctx.supabase, ctx.family, parsed.data);
    refresh();
    return ok({ id: event.id, version: event.version });
  } catch (error) {
    return failFromError(error);
  }
}

export async function cancelEventAction(input: unknown): Promise<ActionResult> {
  const parsed = cancelEventSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    await cancelEvent(ctx.supabase, parsed.data);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}

/** Aviso informativo de solapamientos: nunca bloquea el guardado. */
export async function checkOverlapsAction(
  input: unknown,
  excludeEventId?: string,
): Promise<ActionResult<{ titles: string[] }>> {
  const parsed = eventFormSchema.safeParse(input);
  if (!parsed.success || parsed.data.isAllDay || !parsed.data.startTime) return ok({ titles: [] });
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const fields = toEventRpcFields(parsed.data, ctx.family.timezone);
    const start = fields.p_starts_at as string;
    const end = (fields.p_ends_at as string | null) ?? new Date(Date.parse(start) + 60 * 60_000).toISOString();
    const overlaps = await findOverlaps(ctx.supabase, ctx.family.id, start, end, excludeEventId);
    const people = new Set(parsed.data.participantIds);
    const relevant = overlaps.filter(
      (e) => parsed.data.wholeFamily || e.wholeFamily || e.participants.some((p) => people.has(p.id)),
    );
    return ok({ titles: relevant.map((e) => e.title).slice(0, 5) });
  } catch (error) {
    return failFromError(error);
  }
}

export async function createEventSeriesAction(input: unknown): Promise<ActionResult<{ seriesId: string }>> {
  const parsed = createSeriesSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const seriesId = await createEventSeries(
      ctx.supabase,
      ctx.family,
      parsed.data.commandId,
      parsed.data.values,
      parsed.data.repeat,
    );
    refresh();
    return ok({ seriesId });
  } catch (error) {
    return failFromError(error);
  }
}

export async function splitEventSeriesAction(input: unknown): Promise<ActionResult<{ seriesId: string }>> {
  const parsed = splitSeriesSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const seriesId = await splitEventSeries(ctx.supabase, parsed.data);
    refresh();
    return ok({ seriesId });
  } catch (error) {
    return failFromError(error);
  }
}

export async function endEventSeriesAction(input: unknown): Promise<ActionResult> {
  const parsed = endSeriesSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    await endEventSeries(ctx.supabase, parsed.data.seriesId, parsed.data.from);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}
