import { minutesOfDay, parseTimeToMinutes, zonedFromEpoch } from "@/lib/time/zoned";

/** Equal limits disable the interval. Includes windows across midnight. */
export function isQuietTime(now: number, timezone: string, start: string, end: string): boolean {
  const minute = minutesOfDay(zonedFromEpoch(now, timezone));
  const from = parseTimeToMinutes(start);
  const to = parseTimeToMinutes(end);
  return from < to ? minute >= from && minute < to : from > to && (minute >= from || minute < to);
}
