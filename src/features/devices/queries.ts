import "server-only";

import { unwrap } from "@/lib/errors";
import type { DbClient } from "@/lib/supabase/types";

export type DeviceRow = {
  id: string;
  name: string;
  scope: "home" | "child";
  memberId: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
};

export async function listDevices(supabase: DbClient, familyId: string): Promise<DeviceRow[]> {
  const rows = unwrap(
    await supabase
      .from("paired_devices")
      .select("id, name, scope, member_id, created_at, last_seen_at, revoked_at")
      .eq("family_id", familyId)
      .order("revoked_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false }),
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    scope: r.scope as DeviceRow["scope"],
    memberId: r.member_id,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    revokedAt: r.revoked_at,
  }));
}
