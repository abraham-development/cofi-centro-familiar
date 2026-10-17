import { z } from "zod";

import type { AgendaEvent, MemberSummary } from "@/features/calendar/types";
import type { ChildTask } from "@/features/tasks/child-types";
import type { HouseholdTask } from "@/features/tasks/types";
import { localDateOf } from "@/lib/time/zoned";

export const SNAPSHOT_TTL = 24 * 3600_000;
export const snapshotKey = (actor: "adult" | "device") => `cofi-snapshot-v1:${actor}`;

// Explicit projection: no notes, descriptions, email addresses or credentials.
export const snapshotSchema = z.object({
  version: z.literal(1),
  actor: z.enum(["adult", "device"]),
  identity: z.string().min(1),
  familyId: z.string().min(1),
  familyName: z.string(),
  label: z.string(),
  savedAt: z.number().int(),
  expiresAt: z.number().int(),
  timezone: z.string(),
  hourFormat: z.enum(["12h", "24h"]),
  events: z.array(z.object({
    title: z.string(), start: z.string().nullable(), end: z.string().nullable(),
    firstDay: z.string(), lastDay: z.string(), allDay: z.boolean(),
    participants: z.array(z.string()),
  })),
  tasks: z.array(z.object({ title: z.string(), day: z.string().nullable(), status: z.string(), assignee: z.string().nullable() })),
});
export type OfflineSnapshot = z.infer<typeof snapshotSchema>;

export function makeSnapshot(input: {
  actor: "adult" | "device";
  identity: string;
  family: { id: string; name: string; timezone: string; hourFormat: "12h" | "24h" };
  label: string;
  now: number;
  events: AgendaEvent[];
  tasks: (HouseholdTask | ChildTask)[];
  members?: MemberSummary[];
}): OfflineSnapshot {
  const today = localDateOf(input.now, input.family.timezone);
  return {
    version: 1, actor: input.actor, identity: input.identity, familyId: input.family.id,
    familyName: input.family.name, label: input.label, savedAt: input.now,
    expiresAt: input.now + SNAPSHOT_TTL, timezone: input.family.timezone, hourFormat: input.family.hourFormat,
    events: input.events.filter((e) => e.status === "scheduled").map((e) => ({
      title: e.title, start: e.startsAt, end: e.endsAt, firstDay: e.localStartDate,
      lastDay: e.localEndDate, allDay: e.isAllDay, participants: e.participants.map((p) => p.displayName),
    })),
    tasks: input.tasks.filter((t) => t.status !== "cancelled" && (!t.dueDate || t.dueDate <= today)).map((t) => ({
      title: t.title, day: t.dueDate, status: t.status,
      assignee: "assigneeId" in t ? input.members?.find((m) => m.id === t.assigneeId)?.displayName ?? null : t.assignee?.displayName ?? null,
    })),
  };
}

export function readSnapshot(raw: string | null, now: number): OfflineSnapshot | null {
  try {
    const result = snapshotSchema.safeParse(JSON.parse(raw ?? "null"));
    if (!result.success) return null;
    const s = result.data;
    return s.savedAt <= now && s.expiresAt > now && s.expiresAt - s.savedAt === SNAPSHOT_TTL ? s : null;
  } catch { return null; }
}

export function clearSnapshot(actor: "adult" | "device") {
  try { localStorage.removeItem(snapshotKey(actor)); } catch { /* Storage can be disabled. */ }
}
