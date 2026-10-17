"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getActorClient } from "@/lib/auth/actor";
import { toDomainError } from "@/lib/errors";
import { type ActionResult, fail, failFromError, failFromZod, ok } from "@/lib/result";
import { uuidSchema } from "@/lib/validation/common";

const ackSchema = z.object({ notificationId: uuidSchema, as: z.enum(["adult", "device"]) });

/** Reconoce un aviso para ESTE destinatario (un adulto o una pantalla). */
export async function acknowledgeNotificationAction(input: unknown): Promise<ActionResult> {
  const parsed = ackSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const actor = await getActorClient(parsed.data.as);
  if (!actor) return fail("SESSION_REQUIRED");
  try {
    const { error } = await actor.supabase.rpc("acknowledge_notification", { p_notification_id: parsed.data.notificationId });
    if (error) throw toDomainError(error);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}

const subscriptionSchema = z.object({
  as: z.enum(["adult", "device"]),
  endpoint: z.url().startsWith("https://"),
  p256dh: z.string().min(20).max(200),
  auth: z.string().min(8).max(100),
  userAgent: z.string().max(300),
});

export async function savePushSubscriptionAction(input: unknown): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const actor = await getActorClient(parsed.data.as);
  if (!actor) return fail("SESSION_REQUIRED");
  try {
    const { error } = await actor.supabase.rpc("save_push_subscription", {
      p_family_id: actor.familyId,
      p_endpoint: parsed.data.endpoint,
      p_p256dh: parsed.data.p256dh,
      p_auth: parsed.data.auth,
      p_user_agent: parsed.data.userAgent,
    });
    if (error) throw toDomainError(error);
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}

export async function deletePushSubscriptionAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ as: z.enum(["adult", "device"]), endpoint: z.url() }).safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const actor = await getActorClient(parsed.data.as);
  if (!actor) return fail("SESSION_REQUIRED");
  try {
    const { error } = await actor.supabase.rpc("delete_push_subscription", { p_endpoint: parsed.data.endpoint });
    if (error) throw toDomainError(error);
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}
