import "server-only";

import { unwrap } from "@/lib/errors";
import type { DbClient } from "@/lib/supabase/types";

export type FamilyNotification = {
  id: string;
  audience: "adults" | "family" | "member";
  memberId: string | null;
  kind: string;
  title: string;
  body: string | null;
  importance: "normal" | "high";
  createdAt: string;
  expiresAt: string | null;
  receipts: { recipient: string; acknowledgedAt: string | null }[];
};

/** Avisos visibles para el actor (RLS decide: adulto, pantalla de casa o del hijo). */
export async function listNotifications(
  supabase: DbClient,
  familyId: string,
  options: { since?: string; limit?: number; memberId?: string } = {},
): Promise<FamilyNotification[]> {
  let query = supabase
    .from("notifications")
    .select(
      "id, audience, member_id, kind, title, body, importance, created_at, expires_at, notification_receipts ( recipient, acknowledged_at )",
    )
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);
  if (options.since) query = query.gte("created_at", options.since);
  if (options.memberId) query = query.or(`audience.eq.family,member_id.eq.${options.memberId}`);
  const rows = unwrap(await query);
  return rows.map((r) => ({
    id: r.id,
    audience: r.audience as FamilyNotification["audience"],
    memberId: r.member_id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    importance: r.importance as FamilyNotification["importance"],
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    receipts: r.notification_receipts.map((x) => ({ recipient: x.recipient, acknowledgedAt: x.acknowledged_at })),
  }));
}

export type RemindersHealth = {
  lastCompletedAt: string | null;
  overduePending: number;
  failed7d: number;
  pushFailed7d: number;
  pushSent7d: number;
  subscriptions: number;
};

export async function getRemindersHealth(supabase: DbClient, familyId: string): Promise<RemindersHealth | null> {
  const { data, error } = await supabase.rpc("reminders_health", { p_family_id: familyId });
  if (error) throw error;
  const r = data?.[0];
  if (!r) return null;
  return {
    lastCompletedAt: r.last_completed_at,
    overduePending: r.overdue_pending,
    failed7d: r.failed_7d,
    pushFailed7d: r.push_failed_7d,
    pushSent7d: r.push_sent_7d,
    subscriptions: r.subscriptions,
  };
}
