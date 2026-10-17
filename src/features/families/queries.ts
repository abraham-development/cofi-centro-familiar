import "server-only";

import type { CategorySummary, MemberSummary } from "@/features/calendar/types";
import { unwrap } from "@/lib/errors";
import type { DbClient } from "@/lib/supabase/types";

export type FamilyMemberRow = MemberSummary & {
  sortOrder: number;
  archivedAt: string | null;
  version: number;
  hasAccount: boolean;
};

export async function listMembers(
  supabase: DbClient,
  familyId: string,
  options: { includeArchived?: boolean } = {},
): Promise<FamilyMemberRow[]> {
  let query = supabase
    .from("family_members")
    .select("id, display_name, color, initials, kind, avatar_emoji, sort_order, archived_at, version")
    .eq("family_id", familyId)
    .order("sort_order")
    .order("created_at");
  if (!options.includeArchived) query = query.is("archived_at", null);

  const [members, memberships] = await Promise.all([
    query.then(unwrap),
    supabase
      .from("adult_memberships")
      .select("member_id")
      .eq("family_id", familyId)
      .eq("status", "active")
      .then(unwrap),
  ]);
  const withAccount = new Set(memberships.map((m) => m.member_id));

  return members.map((m) => ({
    id: m.id,
    displayName: m.display_name,
    color: m.color,
    initials: m.initials,
    kind: m.kind as MemberSummary["kind"],
    avatarEmoji: m.avatar_emoji,
    sortOrder: m.sort_order,
    archivedAt: m.archived_at,
    version: m.version,
    hasAccount: withAccount.has(m.id),
  }));
}

export async function listCategories(supabase: DbClient, familyId: string): Promise<CategorySummary[]> {
  const rows = unwrap(
    await supabase
      .from("event_categories")
      .select("id, key, label, icon")
      .eq("family_id", familyId)
      .is("archived_at", null)
      .order("sort_order"),
  );
  return rows;
}

export type AdultRow = {
  membershipId: string;
  userId: string;
  role: "owner" | "admin";
  memberId: string;
  displayName: string;
  color: string;
  initials: string;
  isMe: boolean;
};

export async function listAdults(supabase: DbClient, familyId: string, myUserId: string): Promise<AdultRow[]> {
  const rows = unwrap(
    await supabase
      .from("adult_memberships")
      .select("id, role, member_id, user_id, family_members!adult_memberships_member_fk(display_name, color, initials)")
      .eq("family_id", familyId)
      .eq("status", "active")
      .order("created_at"),
  );
  return rows.map((r) => ({
    membershipId: r.id,
    userId: r.user_id,
    role: r.role as AdultRow["role"],
    memberId: r.member_id,
    displayName: r.family_members.display_name,
    color: r.family_members.color,
    initials: r.family_members.initials,
    isMe: r.user_id === myUserId,
  }));
}

export type InvitationRow = {
  id: string;
  email: string;
  role: "owner" | "admin";
  expiresAt: string;
  createdAt: string;
};

export async function listPendingInvitations(supabase: DbClient, familyId: string): Promise<InvitationRow[]> {
  const rows = unwrap(
    await supabase
      .from("family_invitations")
      .select("id, email, role, expires_at, created_at")
      .eq("family_id", familyId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role as InvitationRow["role"],
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }));
}
