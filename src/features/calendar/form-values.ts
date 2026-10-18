import type { EventDetail } from "./queries";
import type { EventFormValues } from "./schemas";
import { addDays, instantToLocalParts, zonedFromEpoch } from "@/lib/time/zoned";

/** Avisos marcados al agendar algo nuevo (decisión del usuario: 1 h y 15 min antes). */
export const DEFAULT_REMINDER_OFFSETS: EventFormValues["reminderOffsets"] = [15, 60];

/**
 * Valores iniciales de un evento nuevo: próxima hora en punto, 1 h de duración.
 * Con `startTime` (elegida en la grilla del día) no se propone fin: lo esencial
 * es a qué hora empieza.
 */
export function newEventDefaults(
  date: string,
  nowMs: number,
  timeZone: string,
  isToday: boolean,
  startTime?: string,
): EventFormValues {
  const zdt = zonedFromEpoch(nowMs, timeZone);
  const hour = isToday ? Math.min(zdt.hour + 1, 23) : 9;
  const start = `${String(hour).padStart(2, "0")}:00`;
  const end = `${String(Math.min(hour + 1, 23)).padStart(2, "0")}:${hour + 1 > 23 ? "59" : "00"}`;
  return {
    title: "",
    categoryId: null,
    isAllDay: false,
    date,
    endDate: null,
    startTime: startTime ?? start,
    endTime: startTime ? null : end,
    wholeFamily: false,
    participantIds: [],
    visibility: "family",
    importance: "normal",
    location: "",
    description: "",
    privateNotes: "",
    reminderOffsets: [...DEFAULT_REMINDER_OFFSETS],
    ruleIds: [],
  };
}

/** Valores de edición a partir de un evento guardado (en la zona del evento). */
export function eventToFormValues(event: EventDetail): EventFormValues {
  const base = {
    title: event.title,
    categoryId: event.category?.id ?? null,
    wholeFamily: event.wholeFamily,
    participantIds: event.participants.map((p) => p.id),
    visibility: event.visibility,
    importance: event.importance,
    location: event.location ?? "",
    description: event.description ?? "",
    privateNotes: event.privateNotes ?? "",
    reminderOffsets: event.reminderOffsets as EventFormValues["reminderOffsets"],
    ruleIds: event.ruleIds,
  };
  if (event.isAllDay) {
    return {
      ...base,
      isAllDay: true,
      date: event.startDate!,
      endDate: addDays(event.endDate!, -1),
      startTime: null,
      endTime: null,
    };
  }
  const start = instantToLocalParts(event.startsAt!, event.timezone);
  const end = event.endsAt ? instantToLocalParts(event.endsAt, event.timezone) : null;
  return {
    ...base,
    isAllDay: false,
    date: start.date,
    endDate: null,
    startTime: start.time,
    endTime: end?.time ?? null,
  };
}
