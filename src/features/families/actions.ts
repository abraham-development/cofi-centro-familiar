"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";

import {
  acceptInvitationSchema,
  addMemberSchema,
  archiveMemberSchema,
  createFamilySchema,
  createInvitationSchema,
  familySettingsSchema,
  updateMemberSchema,
} from "./schemas";
import {
  acceptInvitation,
  addMember,
  createFamily,
  createInvitation,
  revokeInvitation,
  setMemberArchived,
  updateAdultMembership,
  updateFamilySettings,
  updateMember,
} from "./use-cases";
import { ACTIVE_FAMILY_COOKIE, getAdultContext } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { type ActionResult, fail, failFromError, failFromZod, ok } from "@/lib/result";
import { uuidSchema } from "@/lib/validation/common";

const familyCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export async function createFamilyAction(input: unknown): Promise<ActionResult<{ familyId: string }>> {
  const parsed = createFamilySchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx) return fail("SESSION_REQUIRED");
  try {
    const familyId = await createFamily(ctx.supabase, parsed.data);
    (await cookies()).set(ACTIVE_FAMILY_COOKIE, familyId, familyCookieOptions);
    return ok({ familyId });
  } catch (error) {
    return failFromError(error);
  }
}

export async function switchFamilyAction(familyId: unknown): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(familyId);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx) return fail("SESSION_REQUIRED");
  if (!ctx.memberships.some((m) => m.familyId === parsed.data)) return fail("FORBIDDEN");
  (await cookies()).set(ACTIVE_FAMILY_COOKIE, parsed.data, familyCookieOptions);
  refresh();
  return ok(undefined);
}

export async function addMemberAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const id = await addMember(ctx.supabase, ctx.family.id, parsed.data.values);
    refresh();
    return ok({ id });
  } catch (error) {
    return failFromError(error);
  }
}

export async function updateMemberAction(input: unknown): Promise<ActionResult> {
  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    await updateMember(ctx.supabase, ctx.family.id, parsed.data.memberId, parsed.data.values);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}

export async function archiveMemberAction(input: unknown): Promise<ActionResult> {
  const parsed = archiveMemberSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    await setMemberArchived(ctx.supabase, ctx.family.id, parsed.data.memberId, parsed.data.archived);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}

export async function updateFamilySettingsAction(input: unknown): Promise<ActionResult> {
  const parsed = familySettingsSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    await updateFamilySettings(ctx.supabase, ctx.family.id, parsed.data);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}

export async function createInvitationAction(
  input: unknown,
): Promise<ActionResult<{ link: string; expiresAt: string }>> {
  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const inv = await createInvitation(ctx.supabase, ctx.family.id, parsed.data);
    refresh();
    // El token solo viaja una vez, en esta respuesta, al adulto que invita.
    return ok({ link: `${publicEnv.siteUrl}/invitacion/${inv.token}`, expiresAt: inv.expiresAt });
  } catch (error) {
    return failFromError(error);
  }
}

export async function revokeInvitationAction(invitationId: unknown): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(invitationId);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx) return fail("SESSION_REQUIRED");
  try {
    await revokeInvitation(ctx.supabase, parsed.data);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}

export async function acceptInvitationAction(input: unknown): Promise<ActionResult<{ familyId: string }>> {
  const parsed = acceptInvitationSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx) return fail("SESSION_REQUIRED");
  try {
    const familyId = await acceptInvitation(ctx.supabase, parsed.data.token, parsed.data.displayName);
    (await cookies()).set(ACTIVE_FAMILY_COOKIE, familyId, familyCookieOptions);
    return ok({ familyId });
  } catch (error) {
    return failFromError(error);
  }
}

const membershipChangeSchema = z.object({
  membershipId: uuidSchema,
  role: z.enum(["owner", "admin"]).optional(),
  remove: z.boolean().optional(),
});

export async function updateAdultMembershipAction(input: unknown): Promise<ActionResult> {
  const parsed = membershipChangeSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx) return fail("SESSION_REQUIRED");
  try {
    await updateAdultMembership(ctx.supabase, parsed.data.membershipId, parsed.data);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}
