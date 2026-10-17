import "server-only";

import type { AgendaEvent, MemberSummary } from "./types";
import { unwrap } from "@/lib/errors";
import type { DbClient } from "@/lib/supabase/types";
import { addDays, type IsoDate } from "@/lib/time/zoned";

/** Un evento abarca como máximo 62 días (restricción en base de datos). */
const MAX_EVENT_SPAN_DAYS = 62;

const EVENT_SELECT = `
  id, title, status, is_all_day, starts_at, ends_at, start_date, end_date,
  local_start_date, local_end_date, timezone, importance, visibility, whole_family,
  location, description, version, series_id, occurrence_date,
  event_categories!calendar_events_category_fk ( id, key, label, icon ),
  event_participants ( family_members!event_participants_member_fk ( id, display_name, color, initials, kind, avatar_emoji ) )
`;

type EventRow = {
  id: string;
  title: string;
  status: string;
  is_all_day: boolean;
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date: string | null;
  local_start_date: string;
  local_end_date: string;
  timezone: string;
  importance: string;
  visibility: string;
  whole_family: boolean;
  location: string | null;
  description: string | null;
  version: number;
  series_id: string | null;
  occurrence_date: string | null;
  event_categories: { id: string; key: string; label: string; icon: string } | null;
  event_participants: {
    family_members: {
      id: string;
      display_name: string;
      color: string;
      initials: string;
      kind: string;
      avatar_emoji: string | null;
    };
  }[];
};

export function mapEventRow(row: EventRow): AgendaEvent {
  return {
    id: row.id,
    title: row.title,
    status: row.status as AgendaEvent["status"],
    isAllDay: row.is_all_day,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    startDate: row.start_date,
    endDate: row.end_date,
    localStartDate: row.local_start_date,
    localEndDate: row.local_end_date,
    timezone: row.timezone,
    category: row.event_categories,
    importance: row.importance as AgendaEvent["importance"],
    visibility: row.visibility as AgendaEvent["visibility"],
    wholeFamily: row.whole_family,
    location: row.location,
    description: row.description,
    version: row.version,
    seriesId: row.series_id,
    occurrenceDate: row.occurrence_date,
    participants: row.event_participants
      .map((p) => ({
        id: p.family_members.id,
        displayName: p.family_members.display_name,
        color: p.family_members.color,
        initials: p.family_members.initials,
        kind: p.family_members.kind as MemberSummary["kind"],
        avatarEmoji: p.family_members.avatar_emoji,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "es")),
  };
}

export type EventRangeFilter = {
  memberId?: string | null;
  categoryId?: string | null;
  includeCancelled?: boolean;
};

/**
 * Eventos que tocan el rango de fechas locales [from, to] (inclusive).
 * Consulta acotada por índice: nunca descarga todo el historial.
 */
export async function listEventsInRange(
  supabase: DbClient,
  familyId: string,
  from: IsoDate,
  to: IsoDate,
  filter: EventRangeFilter = {},
): Promise<AgendaEvent[]> {
  let query = supabase
    .from("calendar_events")
    .select(EVENT_SELECT)
    .eq("family_id", familyId)
    .gte("local_start_date", addDays(from, -MAX_EVENT_SPAN_DAYS))
    .lte("local_start_date", to)
    .gte("local_end_date", from)
    .order("local_start_date")
    .order("starts_at", { ascending: true, nullsFirst: true })
    .limit(500);
  if (!filter.includeCancelled) query = query.eq("status", "scheduled");
  if (filter.categoryId) query = query.eq("category_id", filter.categoryId);

  const rows = unwrap(await query) as unknown as EventRow[];
  let events = rows.map(mapEventRow);
  if (filter.memberId) {
    events = events.filter((e) => e.wholeFamily || e.participants.some((p) => p.id === filter.memberId));
  }
  return events;
}

export type EventDetail = AgendaEvent & {
  privateNotes: string | null;
  cancelReason: string | null;
  updatedAt: string;
  reminderOffsets: number[];
  ruleIds: string[];
};

export async function getEvent(supabase: DbClient, familyId: string, eventId: string): Promise<EventDetail | null> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select(
      `${EVENT_SELECT}, cancel_reason, updated_at, reminder_offsets, calendar_event_private_notes ( notes ), event_automations ( rule_id )`,
    )
    .eq("family_id", familyId)
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as EventRow & {
    cancel_reason: string | null;
    updated_at: string;
    reminder_offsets: number[];
    calendar_event_private_notes: { notes: string } | null;
    event_automations: { rule_id: string }[];
  };
  return {
    ...mapEventRow(row),
    privateNotes: row.calendar_event_private_notes?.notes ?? null,
    cancelReason: row.cancel_reason,
    updatedAt: row.updated_at,
    reminderOffsets: row.reminder_offsets ?? [],
    ruleIds: row.event_automations.map((a) => a.rule_id),
  };
}

/** Eventos con hora que se solapan con [startsAt, endsAt) para avisar (sin bloquear). */
export async function findOverlaps(
  supabase: DbClient,
  familyId: string,
  startsAt: string,
  endsAt: string,
  excludeEventId?: string,
): Promise<AgendaEvent[]> {
  let query = supabase
    .from("calendar_events")
    .select(EVENT_SELECT)
    .eq("family_id", familyId)
    .eq("status", "scheduled")
    .eq("is_all_day", false)
    .lt("starts_at", endsAt)
    .gte("starts_at", new Date(Date.parse(startsAt) - 24 * 3600_000).toISOString())
    .limit(50);
  if (excludeEventId) query = query.neq("id", excludeEventId);
  const rows = unwrap(await query) as unknown as EventRow[];
  const start = Date.parse(startsAt);
  return rows
    .map(mapEventRow)
    .filter((e) => {
      const s = Date.parse(e.startsAt!);
      const end = e.endsAt ? Date.parse(e.endsAt) : s + 15 * 60_000;
      return end > start;
    });
}

export type EventSeriesDetail = {
  id: string;
  freq: "daily" | "weekdays" | "weekly" | "monthly";
  byWeekday: number[];
  monthDay: number | null;
  missingDayPolicy: "skip" | "last_day";
  startsOn: IsoDate;
  untilOn: IsoDate | null;
  startTime: string | null;
  durationMinutes: number | null;
  isAllDay: boolean;
  title: string;
  categoryId: string | null;
  location: string | null;
  description: string | null;
  visibility: AgendaEvent["visibility"];
  importance: AgendaEvent["importance"];
  wholeFamily: boolean;
  participantIds: string[];
};

export async function getEventSeries(
  supabase: DbClient,
  familyId: string,
  seriesId: string,
): Promise<EventSeriesDetail | null> {
  const { data, error } = await supabase
    .from("event_series")
    .select(
      "id, freq, by_weekday, month_day, missing_day_policy, starts_on, until_on, start_time, duration_minutes, is_all_day, title, category_id, location, description, visibility, importance, whole_family, event_series_participants ( member_id )",
    )
    .eq("family_id", familyId)
    .eq("id", seriesId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    freq: data.freq as EventSeriesDetail["freq"],
    byWeekday: data.by_weekday ?? [],
    monthDay: data.month_day,
    missingDayPolicy: data.missing_day_policy as EventSeriesDetail["missingDayPolicy"],
    startsOn: data.starts_on,
    untilOn: data.until_on,
    startTime: data.start_time ? data.start_time.slice(0, 5) : null,
    durationMinutes: data.duration_minutes,
    isAllDay: data.is_all_day,
    title: data.title,
    categoryId: data.category_id,
    location: data.location,
    description: data.description,
    visibility: data.visibility as AgendaEvent["visibility"],
    importance: data.importance as AgendaEvent["importance"],
    wholeFamily: data.whole_family,
    participantIds: data.event_series_participants.map((p) => p.member_id),
  };
}
