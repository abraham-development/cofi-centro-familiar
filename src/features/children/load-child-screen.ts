import "server-only";

import { listEventsInRange } from "@/features/calendar/queries";
import { listNotifications } from "@/features/notifications/queries";
import type { AgendaEvent, MemberSummary } from "@/features/calendar/types";
import { listBalances, listRedemptions, listRewards } from "@/features/rewards/queries";
import { listChildTasks } from "@/features/tasks/child-queries";
import type { DbClient } from "@/lib/supabase/types";
import { addDays, localDateOf } from "@/lib/time/zoned";

/** Lo que el hijo puede ver de un evento (misma regla que la pantalla de su cuarto). */
function visibleToChild(event: AgendaEvent, memberId: string) {
  return (
    event.visibility === "family" ||
    (event.visibility === "participants" && (event.wholeFamily || event.participants.some((p) => p.id === memberId)))
  );
}

export async function loadChildScreen(
  supabase: DbClient,
  family: { id: string; timezone: string },
  member: MemberSummary,
  now: number,
) {
  const today = localDateOf(now, family.timezone);
  const [tasks, events, balances, rewards, redemptions, notifications] = await Promise.all([
    listChildTasks(supabase, family.id, { from: addDays(today, -30), to: today, memberId: member.id }),
    listEventsInRange(supabase, family.id, today, addDays(today, 7)),
    listBalances(supabase, family.id),
    listRewards(supabase, family.id),
    listRedemptions(supabase, family.id, { memberId: member.id, limit: 10 }),
    listNotifications(supabase, family.id, {
      since: new Date(now - 36 * 3600_000).toISOString(),
      memberId: member.id,
      limit: 20,
    }),
  ]);
  return {
    tasks,
    events: events.filter((e) => visibleToChild(e, member.id)),
    balance: balances.get(member.id) ?? 0,
    rewards,
    redemptions,
    notifications: notifications.filter((n) => n.audience === "family" || n.memberId === member.id),
  };
}
