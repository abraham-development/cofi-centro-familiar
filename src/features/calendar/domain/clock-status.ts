import type { AgendaEvent } from "../types";
import { epochFromIso, localDateOf } from "@/lib/time/zoned";

/** Un evento sin hora de fin se considera «empezando» durante este margen. */
export const POINT_EVENT_WINDOW_MS = 15 * 60_000;

export type ClockStatus = {
  /** Eventos con hora en curso ahora mismo. */
  current: AgendaEvent[];
  /** Eventos de día completo de hoy. */
  allDayToday: AgendaEvent[];
  /** Próximo evento con hora que aún no empezó. */
  next: AgendaEvent | null;
  msUntilNext: number | null;
};

function endEpoch(event: AgendaEvent): number {
  const start = epochFromIso(event.startsAt!);
  return event.endsAt ? epochFromIso(event.endsAt) : start + POINT_EVENT_WINDOW_MS;
}

/**
 * Calcula qué está en curso y qué viene después. Ignora cancelados.
 * Se ejecuta en el cliente cada segundo con datos precargados: no consulta
 * al servidor para mover el reloj.
 */
export function computeClockStatus(events: AgendaEvent[], nowMs: number, timeZone: string): ClockStatus {
  const today = localDateOf(nowMs, timeZone);
  const scheduled = events.filter((e) => e.status === "scheduled");

  const allDayToday = scheduled.filter(
    (e) => e.isAllDay && e.localStartDate <= today && e.localEndDate >= today,
  );

  const timed = scheduled
    .filter((e) => !e.isAllDay && e.startsAt)
    .map((e) => ({ e, start: epochFromIso(e.startsAt!), end: endEpoch(e) }))
    .sort((a, b) => a.start - b.start || a.e.title.localeCompare(b.e.title, "es"));

  const current = timed.filter((t) => t.start <= nowMs && nowMs < t.end).map((t) => t.e);
  const upcoming = timed.find((t) => t.start > nowMs);

  return {
    current,
    allDayToday,
    next: upcoming?.e ?? null,
    msUntilNext: upcoming ? upcoming.start - nowMs : null,
  };
}
