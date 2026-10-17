import type { AgendaEvent } from "../types";
import { formatInstantTime, type HourFormat } from "@/lib/time/zoned";

export function eventTimeLabel(event: AgendaEvent, timeZone: string, hourFormat: HourFormat): string {
  if (event.isAllDay) return "Todo el día";
  const start = formatInstantTime(event.startsAt!, timeZone, hourFormat);
  if (!event.endsAt) return start;
  return `${start} – ${formatInstantTime(event.endsAt, timeZone, hourFormat)}`;
}
