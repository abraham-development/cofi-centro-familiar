import type { AgendaEvent } from "@/features/calendar/types";

let seq = 0;

export function makeEvent(partial: Partial<AgendaEvent>): AgendaEvent {
  seq += 1;
  return {
    id: `evt-${seq}`,
    title: `Evento ${seq}`,
    status: "scheduled",
    isAllDay: false,
    startsAt: null,
    endsAt: null,
    startDate: null,
    endDate: null,
    localStartDate: "2026-10-22",
    localEndDate: "2026-10-22",
    timezone: "America/Lima",
    category: null,
    importance: "normal",
    visibility: "family",
    wholeFamily: false,
    location: null,
    description: null,
    participants: [],
    version: 1,
    seriesId: null,
    occurrenceDate: null,
    ...partial,
  };
}
