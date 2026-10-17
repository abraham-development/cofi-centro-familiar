import "server-only";

import type { FamilySettingsValues, MemberFormValues } from "./schemas";
import { toDomainError } from "@/lib/errors";
import type { DbClient } from "@/lib/supabase/types";

export async function createFamily(
  supabase: DbClient,
  input: { commandId: string; name: string; timezone: string; ownerDisplayName: string; ownerColor: string },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_family", {
    p_command_id: input.commandId,
    p_name: input.name,
    p_timezone: input.timezone,
    p_owner_display_name: input.ownerDisplayName,
    p_owner_color: input.ownerColor,
  });
  if (error) throw toDomainError(error);
  return data;
}

export async function addMember(supabase: DbClient, familyId: string, values: MemberFormValues) {
  const { data, error } = await supabase
    .from("family_members")
    .insert({
      family_id: familyId,
      display_name: values.displayName,
      kind: values.kind,
      color: values.color,
      initials: values.initials,
      avatar_emoji: values.avatarEmoji || null,
    })
    .select("id")
    .single();
  if (error) throw toDomainError(error);
  return data.id;
}

export async function updateMember(supabase: DbClient, familyId: string, memberId: string, values: MemberFormValues) {
  const { data, error } = await supabase
    .from("family_members")
    .update({
      display_name: values.displayName,
      kind: values.kind,
      color: values.color,
      initials: values.initials,
      avatar_emoji: values.avatarEmoji || null,
    })
    .eq("family_id", familyId)
    .eq("id", memberId)
    .select("id");
  if (error) throw toDomainError(error);
  if (!data.length) throw toDomainError({ code: "PGRST116" });
}

export async function setMemberArchived(supabase: DbClient, familyId: string, memberId: string, archived: boolean) {
  const { data, error } = await supabase
    .from("family_members")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("family_id", familyId)
    .eq("id", memberId)
    .select("id");
  if (error) throw toDomainError(error);
  if (!data.length) throw toDomainError({ code: "PGRST116" });
}

export async function updateFamilySettings(supabase: DbClient, familyId: string, values: FamilySettingsValues) {
  const { data, error } = await supabase
    .from("families")
    .update({
      name: values.name,
      timezone: values.timezone,
      time_format: values.hourFormat,
      morning_ends: values.morningEnds,
      afternoon_ends: values.afternoonEnds,
      home_color: values.homeColor,
      quiet_start: values.quietStart,
      quiet_end: values.quietEnd,
    })
    .eq("id", familyId)
    .select("id");
  if (error) throw toDomainError(error);
  if (!data.length) throw toDomainError({ code: "42501" });
}

export async function createInvitation(
  supabase: DbClient,
  familyId: string,
  input: { email: string; role: "owner" | "admin"; memberId: string | null },
) {
  const { data, error } = await supabase.rpc("create_invitation", {
    p_family_id: familyId,
    p_email: input.email,
    p_role: input.role,
    ...(input.memberId ? { p_member_id: input.memberId } : {}),
  });
  if (error) throw toDomainError(error);
  const row = data[0];
  return { id: row.invitation_id, token: row.token, expiresAt: row.expires_at };
}

export async function revokeInvitation(supabase: DbClient, invitationId: string) {
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  if (error) throw toDomainError(error);
}

export async function acceptInvitation(supabase: DbClient, token: string, displayName: string) {
  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
    ...(displayName ? { p_display_name: displayName } : {}),
  });
  if (error) throw toDomainError(error);
  return data;
}

export async function updateAdultMembership(
  supabase: DbClient,
  membershipId: string,
  change: { role?: "owner" | "admin"; remove?: boolean },
) {
  const { error } = await supabase.rpc("update_adult_membership", {
    p_membership_id: membershipId,
    ...(change.role ? { p_role: change.role } : {}),
    ...(change.remove ? { p_remove: true } : {}),
  });
  if (error) throw toDomainError(error);
}
