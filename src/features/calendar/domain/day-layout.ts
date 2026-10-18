import type { AgendaEvent } from "../types";
import { type IsoDate, minutesOfDay, zonedFromIso } from "@/lib/time/zoned";

const DAY_MINUTES = 24 * 60;

/** Alto mínimo visible de un bloque; también es el alto de un evento sin hora de fin. */
export const MIN_BLOCK_MINUTES = 30;

export type DayBlock = {
  event: AgendaEvent;
  /** Minutos desde la medianoche local del día mostrado. */
  startMin: number;
  /** Fin visible, recortado al día. Sin hora de fin: inicio + `MIN_BLOCK_MINUTES`. */
  endMin: number;
  hasEnd: boolean;
  fromYesterday: boolean;
  untilTomorrow: boolean;
  /** Columna dentro de su grupo de solapes (0 = izquierda). */
  column: number;
  /** Columnas del grupo de solapes al que pertenece. */
  columns: number;
};

export type DayLayout = {
  date: IsoDate;
  allDay: AgendaEvent[];
  blocks: DayBlock[];
};

/**
 * Coloca los eventos que tocan `date` (fecha local) sobre una grilla de horas.
 * Los que se solapan se reparten en columnas lado a lado; un evento que cruza
 * medianoche aparece en ambos días, recortado y marcado como continuación.
 */
export function layoutDayEvents(events: AgendaEvent[], date: IsoDate, timeZone: string): DayLayout {
  const allDay: AgendaEvent[] = [];
  const blocks: DayBlock[] = [];

  for (const event of events) {
    if (event.status !== "scheduled") continue;
    if (event.localStartDate > date || event.localEndDate < date) continue;
    if (event.isAllDay) {
      allDay.push(event);
      continue;
    }

    const start = zonedFromIso(event.startsAt!, timeZone);
    const fromYesterday = start.toPlainDate().toString() < date;
    const startMin = fromYesterday ? 0 : minutesOfDay(start);
    const untilTomorrow = event.localEndDate > date;
    let endMin = startMin + MIN_BLOCK_MINUTES;
    if (event.endsAt) {
      const end = zonedFromIso(event.endsAt, timeZone);
      // Termina otro día (o exactamente a medianoche): llega al final de este.
      endMin = end.toPlainDate().toString() > date ? DAY_MINUTES : minutesOfDay(end);
    }
    blocks.push({
      event,
      startMin,
      endMin: Math.min(DAY_MINUTES, Math.max(endMin, startMin + MIN_BLOCK_MINUTES)),
      hasEnd: !!event.endsAt,
      fromYesterday,
      untilTomorrow,
      column: 0,
      columns: 1,
    });
  }

  blocks.sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.event.title.localeCompare(b.event.title, "es"),
  );
  assignColumns(blocks);
  allDay.sort((a, b) => a.title.localeCompare(b.title, "es"));
  return { date, allDay, blocks };
}

/** Reparte columnas por grupos de bloques encadenados por solape. */
function assignColumns(sorted: DayBlock[]) {
  let group: DayBlock[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -1;
  const close = () => {
    for (const block of group) block.columns = columnEnds.length;
    group = [];
    columnEnds = [];
    groupEnd = -1;
  };
  for (const block of sorted) {
    if (group.length > 0 && block.startMin >= groupEnd) close();
    let column = columnEnds.findIndex((end) => end <= block.startMin);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(block.endMin);
    } else {
      columnEnds[column] = block.endMin;
    }
    block.column = column;
    group.push(block);
    groupEnd = Math.max(groupEnd, block.endMin);
  }
  close();
}

/**
 * Horas que muestra la grilla: `[from, to)` en horas enteras. Parte del rango
 * habitual y se amplía para que ningún evento quede fuera.
 */
export function hourRange(blocks: DayBlock[], base: { from: number; to: number } = { from: 6, to: 24 }) {
  let { from, to } = base;
  for (const block of blocks) {
    from = Math.min(from, Math.floor(block.startMin / 60));
    to = Math.max(to, Math.ceil(block.endMin / 60));
  }
  return { from: Math.max(0, from), to: Math.min(24, to) };
}
