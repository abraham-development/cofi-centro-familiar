import { Temporal } from "temporal-polyfill";

/**
 * Utilidades de fecha y hora en la zona de la familia.
 *
 * Decisiones:
 * - `temporal-polyfill` resuelve zonas IANA y cambios de horario (DST) de forma
 *   correcta; `Date` solo se usa como fuente de milisegundos.
 * - Las fechas de día completo son `PlainDate` (YYYY-MM-DD): nunca se convierten
 *   a medianoche UTC.
 * - El texto visible usa nombres en español definidos aquí y no `Intl`, para
 *   que servidor y navegador produzcan exactamente la misma cadena (evita
 *   errores de hidratación por diferencias de ICU).
 */

export const WEEKDAYS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;

export const WEEKDAYS_SHORT = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;

export const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export const MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

export type HourFormat = "12h" | "24h";

/** Fecha local ISO `YYYY-MM-DD`. */
export type IsoDate = string;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function zonedFromEpoch(epochMs: number, timeZone: string): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(Math.trunc(epochMs)).toZonedDateTimeISO(timeZone);
}

export function zonedFromIso(instant: string, timeZone: string): Temporal.ZonedDateTime {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
}

export function epochFromIso(instant: string): number {
  return Temporal.Instant.from(instant).epochMilliseconds;
}

/** Fecha local de un instante en una zona. */
export function localDateOf(epochMs: number, timeZone: string): IsoDate {
  return zonedFromEpoch(epochMs, timeZone).toPlainDate().toString();
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return Temporal.PlainDate.compare(Temporal.PlainDate.from(a), Temporal.PlainDate.from(b));
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Temporal.PlainDate.from(from).until(Temporal.PlainDate.from(to), { largestUnit: "days" }).days;
}

/** Minutos desde la medianoche local para un instante en esa zona. */
export function minutesOfDay(zdt: Temporal.ZonedDateTime): number {
  return zdt.hour * 60 + zdt.minute;
}

export function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Convierte fecha + hora locales (zona familiar) a un instante ISO.
 * Para horas inexistentes por cambio de horario usa la política `compatible`
 * (adelanta a la primera hora válida), igual que PostgreSQL.
 */
export function localToInstant(date: IsoDate, time: string, timeZone: string): string {
  const pdt = Temporal.PlainDateTime.from(`${date}T${time.length === 5 ? `${time}:00` : time}`);
  return pdt.toZonedDateTime(timeZone, { disambiguation: "compatible" }).toInstant().toString();
}

/** Parte un instante ISO en fecha y hora locales (`YYYY-MM-DD`, `HH:MM`). */
export function instantToLocalParts(instant: string, timeZone: string): { date: IsoDate; time: string } {
  const zdt = zonedFromIso(instant, timeZone);
  return { date: zdt.toPlainDate().toString(), time: `${pad2(zdt.hour)}:${pad2(zdt.minute)}` };
}

export function formatClockParts(
  zdt: Temporal.ZonedDateTime,
  hourFormat: HourFormat,
): { time: string; period: "AM" | "PM" | null } {
  if (hourFormat === "24h") {
    return { time: `${pad2(zdt.hour)}:${pad2(zdt.minute)}`, period: null };
  }
  const period = zdt.hour < 12 ? "AM" : "PM";
  const h12 = zdt.hour % 12 === 0 ? 12 : zdt.hour % 12;
  return { time: `${h12}:${pad2(zdt.minute)}`, period };
}

/** "10:30 AM" o "22:30". */
export function formatTimeOfDay(zdt: Temporal.ZonedDateTime, hourFormat: HourFormat): string {
  const { time, period } = formatClockParts(zdt, hourFormat);
  return period ? `${time} ${period}` : time;
}

export function formatInstantTime(instant: string, timeZone: string, hourFormat: HourFormat): string {
  return formatTimeOfDay(zonedFromIso(instant, timeZone), hourFormat);
}

/** "10:00" → "10:00 AM" según preferencia. */
export function formatLocalTime(hhmm: string, hourFormat: HourFormat): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (hourFormat === "24h") return `${pad2(h)}:${pad2(m)}`;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${period}`;
}

/** Etiqueta compacta de una hora en punto: "5 PM" o "17:00". */
export function formatHourShort(hour: number, hourFormat: HourFormat): string {
  if (hourFormat === "24h") return `${pad2(hour)}:00`;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour < 12 ? "AM" : "PM"}`;
}

/** "Jueves 22 de octubre". */
export function formatLongDate(date: IsoDate | Temporal.PlainDate): string {
  const d = typeof date === "string" ? Temporal.PlainDate.from(date) : date;
  return `${capitalize(WEEKDAYS[d.dayOfWeek - 1])} ${d.day} de ${MONTHS[d.month - 1]}`;
}

/** "Jueves 22 de octubre de 2026" cuando el año no es el actual. */
export function formatLongDateWithYear(date: IsoDate, referenceYear: number): string {
  const d = Temporal.PlainDate.from(date);
  const base = formatLongDate(d);
  return d.year === referenceYear ? base : `${base} de ${d.year}`;
}

/** "jue 22". */
export function formatShortDay(date: IsoDate): string {
  const d = Temporal.PlainDate.from(date);
  return `${WEEKDAYS_SHORT[d.dayOfWeek - 1]} ${d.day}`;
}

/** "22 oct". */
export function formatShortDate(date: IsoDate): string {
  const d = Temporal.PlainDate.from(date);
  return `${d.day} ${MONTHS_SHORT[d.month - 1]}`;
}

/** Nombre relativo del día: Hoy, Mañana, Ayer o la fecha larga. */
export function relativeDayLabel(date: IsoDate, today: IsoDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  return formatLongDate(date);
}

/**
 * Cuenta regresiva legible: "1 h 30 min", "5 min", "menos de 1 min",
 * "2 días". Se redondea hacia arriba en minutos para no decir "0 min".
 */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return "menos de 1 min";
  const totalMinutes = Math.ceil(ms / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  if (days >= 2) return `${days} días`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Temporal.Now.instant().toZonedDateTimeISO(timeZone);
    return true;
  } catch {
    return false;
  }
}
