import type { AgendaEvent } from "../types";
import { addDays, epochFromIso, type IsoDate } from "@/lib/time/zoned";

export type RadarDay = {
  date: IsoDate;
  isToday: boolean;
  /** Eventos visibles en el resumen (los importantes primero). */
  visible: AgendaEvent[];
  /** Cuántos no caben en el resumen; siguen disponibles en la agenda. */
  hiddenCount: number;
  total: number;
};

function sortKey(e: AgendaEvent): number {
  return e.isAllDay ? Number.NEGATIVE_INFINITY : epochFromIso(e.startsAt!);
}

/**
 * Radar de los próximos días. Resume cuando hay muchos eventos, pero nunca los
 * pierde: `hiddenCount` indica cuántos ver en el detalle.
 */
export function buildRadar(
  events: AgendaEvent[],
  today: IsoDate,
  options: { days?: number; maxPerDay?: number } = {},
): RadarDay[] {
  const days = options.days ?? 7;
  const maxPerDay = options.maxPerDay ?? 4;
  const scheduled = events.filter((e) => e.status === "scheduled");

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i);
    const dayEvents = scheduled
      .filter((e) => e.localStartDate <= date && e.localEndDate >= date)
      .sort((a, b) => {
        if (a.importance !== b.importance) return a.importance === "high" ? -1 : 1;
        return sortKey(a) - sortKey(b) || a.title.localeCompare(b.title, "es");
      });
    const visible = dayEvents.slice(0, maxPerDay).sort((a, b) => sortKey(a) - sortKey(b));
    return {
      date,
      isToday: i === 0,
      visible,
      hiddenCount: Math.max(0, dayEvents.length - maxPerDay),
      total: dayEvents.length,
    };
  });
}
