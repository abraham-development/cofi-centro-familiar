import type { AgendaEvent } from "../types";
import {
  type IsoDate,
  minutesOfDay,
  parseTimeToMinutes,
  zonedFromIso,
} from "@/lib/time/zoned";

export type DayPart = "morning" | "afternoon" | "evening";

export const DAY_PART_LABELS: Record<DayPart, string> = {
  morning: "Mañana",
  afternoon: "Tarde",
  evening: "Noche",
};

export type DayPartBounds = {
  /** Hora local "HH:MM" en que termina la mañana (por defecto 12:00). */
  morningEnds: string;
  /** Hora local "HH:MM" en que termina la tarde (por defecto 19:00). */
  afternoonEnds: string;
};

export type TimelineEventEntry = {
  event: AgendaEvent;
  /** Minutos desde la medianoche local del día mostrado. */
  startMinutes: number;
  continuesFromPreviousDay: boolean;
  continuesNextDay: boolean;
};

export type DayTimeline = {
  date: IsoDate;
  allDay: AgendaEvent[];
  parts: Record<DayPart, TimelineEventEntry[]>;
  total: number;
};

export function dayPartForMinutes(minutes: number, bounds: DayPartBounds): DayPart {
  if (minutes < parseTimeToMinutes(bounds.morningEnds)) return "morning";
  if (minutes < parseTimeToMinutes(bounds.afternoonEnds)) return "afternoon";
  return "evening";
}

/**
 * Agrupa los eventos que tocan `date` (fecha local) en mañana, tarde y noche.
 * Un evento que cruza medianoche aparece en ambos días, marcado como
 * continuación, para que siga siendo comprensible.
 */
export function buildDayTimeline(
  events: AgendaEvent[],
  date: IsoDate,
  timeZone: string,
  bounds: DayPartBounds,
): DayTimeline {
  const parts: DayTimeline["parts"] = { morning: [], afternoon: [], evening: [] };
  const allDay: AgendaEvent[] = [];

  for (const event of events) {
    if (event.status !== "scheduled") continue;
    if (event.localStartDate > date || event.localEndDate < date) continue;

    if (event.isAllDay) {
      allDay.push(event);
      continue;
    }

    const start = zonedFromIso(event.startsAt!, timeZone);
    const startsToday = start.toPlainDate().toString() === date;
    const startMinutes = startsToday ? minutesOfDay(start) : 0;
    const entry: TimelineEventEntry = {
      event,
      startMinutes,
      continuesFromPreviousDay: !startsToday,
      continuesNextDay: event.localEndDate > date,
    };
    parts[dayPartForMinutes(startMinutes, bounds)].push(entry);
  }

  const byStart = (a: TimelineEventEntry, b: TimelineEventEntry) =>
    a.startMinutes - b.startMinutes || a.event.title.localeCompare(b.event.title, "es");
  parts.morning.sort(byStart);
  parts.afternoon.sort(byStart);
  parts.evening.sort(byStart);
  allDay.sort((a, b) => a.title.localeCompare(b.title, "es"));

  return {
    date,
    allDay,
    parts,
    total: allDay.length + parts.morning.length + parts.afternoon.length + parts.evening.length,
  };
}
