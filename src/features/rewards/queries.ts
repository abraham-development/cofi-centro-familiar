import "server-only";

import { unwrap } from "@/lib/errors";
import type { DbClient } from "@/lib/supabase/types";

export type Reward = {
  id: string;
  title: string;
  description: string | null;
  cost: number;
  isAvailable: boolean;
  conditions: string | null;
  memberIds: string[];
  archivedAt: string | null;
  version: number;
};

export type Redemption = {
  id: string;
  rewardId: string;
  rewardTitle: string;
  memberId: string;
  cost: number;
  status: "requested" | "approved" | "delivered" | "rejected" | "cancelled";
  requestedAt: string;
  note: string | null;
};

export type LedgerEntry = {
  id: number;
  memberId: string;
  amount: number;
  kind: string;
  reason: string | null;
  createdAt: string;
};

export async function listRewards(supabase: DbClient, familyId: string, includeArchived = false): Promise<Reward[]> {
  let query = supabase
    .from("rewards")
    .select("id, title, description, cost, is_available, conditions, archived_at, version, reward_members ( member_id )")
    .eq("family_id", familyId)
    .order("cost");
  if (!includeArchived) query = query.is("archived_at", null);
  const rows = unwrap(await query);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    cost: r.cost,
    isAvailable: r.is_available,
    conditions: r.conditions,
    memberIds: r.reward_members.map((m) => m.member_id),
    archivedAt: r.archived_at,
    version: r.version,
  }));
}

/** Saldos visibles para el actor (adulto: todos; pantalla: según su alcance). */
export async function listBalances(supabase: DbClient, familyId: string): Promise<Map<string, number>> {
  const rows = unwrap(
    await supabase.from("member_point_accounts").select("member_id, balance").eq("family_id", familyId),
  );
  return new Map(rows.map((r) => [r.member_id, r.balance]));
}

export async function listRedemptions(
  supabase: DbClient,
  familyId: string,
  options: { memberId?: string; statuses?: Redemption["status"][]; limit?: number } = {},
): Promise<Redemption[]> {
  let query = supabase
    .from("reward_redemptions")
    .select("id, reward_id, reward_title, member_id, cost, status, requested_at, note")
    .eq("family_id", familyId)
    .order("requested_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.memberId) query = query.eq("member_id", options.memberId);
  if (options.statuses) query = query.in("status", options.statuses);
  const rows = unwrap(await query);
  return rows.map((r) => ({
    id: r.id,
    rewardId: r.reward_id,
    rewardTitle: r.reward_title,
    memberId: r.member_id,
    cost: r.cost,
    status: r.status as Redemption["status"],
    requestedAt: r.requested_at,
    note: r.note,
  }));
}

export async function listLedger(
  supabase: DbClient,
  familyId: string,
  options: { memberId?: string; limit?: number } = {},
): Promise<LedgerEntry[]> {
  let query = supabase
    .from("points_ledger")
    .select("id, member_id, amount, kind, reason, created_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 30);
  if (options.memberId) query = query.eq("member_id", options.memberId);
  const rows = unwrap(await query);
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    amount: r.amount,
    kind: r.kind,
    reason: r.reason,
    createdAt: r.created_at,
  }));
}
