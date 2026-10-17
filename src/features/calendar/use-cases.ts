import "server-only";

import type { EventFormValues, RepeatValues } from "./schemas";
import { DomainError, toDomainError } from "@/lib/errors";
import type { Database } from "@/lib/supabase/database.types";
import type { DbClient } from "@/lib/supabase/types";
import { addDays, localToInstant, parseTimeToMinutes } from "@/lib/time/zoned";

/**
 * Casos de uso de la agenda. Reciben datos ya validados y la familia activa
 * derivada de la sesión; los llaman Server Actions, Route Handlers y, en el
 * futuro, propuestas de IA confirmadas por un adulto.
 */

type Family = { id: string; timezone: string };
type EventRpcFields = Omit<
  Database["public"]["Functions"]["create_event"]["Args"],
  "p_family_id" | "p_command_id"
>;

/** Convierte fechas/horas locales de la familia en los campos del RPC. */
export function toEventRpcFields(values: EventFormValues, timeZone: string): EventRpcFields {
  let startsAt: string | null = null;
  let endsAt: string | null = null;
  let startDate: string | null = null;
  let endDate: string | null = null;

  if (values.isAllDay) {
    startDate = values.date;
    endDate = addDays(values.endDate ?? values.date, 1); // fin exclusivo
  } else {
    startsAt = localToInstant(values.date, values.startTime!, timeZone);
    if (values.endTime) {
      // Si la hora final es menor o igual, el evento termina al día siguiente.
      const endLocalDate = values.endTime <= values.startTime! ? addDays(values.date, 1) : values.date;
      endsAt = localToInstant(endLocalDate, values.endTime, timeZone);
    }
  }

  const fields = {
    p_title: values.title,
    p_category_id: values.categoryId,
    p_is_all_day: values.isAllDay,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_start_date: startDate,
    p_end_date: endDate,
    p_location: values.location,
    p_description: values.description,
    p_visibility: values.visibility,
    p_importance: values.importance,
    p_whole_family: values.wholeFamily,
    p_participant_ids: values.wholeFamily ? [] : values.participantIds,
    p_private_notes: values.privateNotes,
    p_reminder_offsets: values.reminderOffsets,
    p_rule_ids: values.ruleIds,
  };
  // Los RPC aceptan NULL en estos parámetros aunque los tipos generados no lo reflejen.
  return fields as unknown as EventRpcFields;
}

export async function createEvent(supabase: DbClient, family: Family, commandId: string, values: EventFormValues) {
  const { data, error } = await supabase.rpc("create_event", {
    p_family_id: family.id,
    p_command_id: commandId,
    ...toEventRpcFields(values, family.timezone),
  });
  if (error) throw toDomainError(error);
  return data;
}

export async function updateEvent(
  supabase: DbClient,
  family: Family,
  input: { eventId: string; expectedVersion: number; commandId: string; values: EventFormValues },
) {
  const { data, error } = await supabase.rpc("update_event", {
    p_event_id: input.eventId,
    p_expected_version: input.expectedVersion,
    p_command_id: input.commandId,
    ...toEventRpcFields(input.values, family.timezone),
  });
  if (error) throw toDomainError(error);
  return data;
}

export async function cancelEvent(
  supabase: DbClient,
  input: { eventId: string; expectedVersion: number; commandId: string; reason: string },
) {
  const { data, error } = await supabase.rpc("cancel_event", {
    p_event_id: input.eventId,
    p_expected_version: input.expectedVersion,
    p_command_id: input.commandId,
    p_reason: input.reason,
  });
  if (error) throw toDomainError(error);
  return data;
}

type SeriesRpcFields = Omit<
  Database["public"]["Functions"]["create_event_series"]["Args"],
  "p_family_id" | "p_command_id" | "p_starts_on"
>;

/** Campos de una serie a partir del formulario (hora local + duración). */
export function toSeriesRpcFields(values: EventFormValues, repeat: RepeatValues): SeriesRpcFields {
  if (repeat.freq === "none") throw new DomainError("INVALID", "repeat");
  if (values.isAllDay && values.endDate && values.endDate !== values.date) {
    throw new DomainError("INVALID", "multi_day_series");
  }
  let duration: number | null = null;
  if (!values.isAllDay && values.startTime && values.endTime) {
    const start = parseTimeToMinutes(values.startTime);
    const end = parseTimeToMinutes(values.endTime);
    duration = end > start ? end - start : end + 24 * 60 - start;
  }
  const fields = {
    p_title: values.title,
    p_category_id: values.categoryId,
    p_is_all_day: values.isAllDay,
    p_start_time: values.isAllDay ? null : values.startTime,
    p_duration_minutes: duration,
    p_location: values.location,
    p_description: values.description,
    p_visibility: values.visibility,
    p_importance: values.importance,
    p_whole_family: values.wholeFamily,
    p_participant_ids: values.wholeFamily ? [] : values.participantIds,
    p_freq: repeat.freq,
    p_interval: 1,
    p_by_weekday: repeat.freq === "weekly" ? repeat.byWeekday : null,
    p_month_day: repeat.freq === "monthly" ? Number(values.date.slice(8, 10)) : null,
    p_missing: repeat.missingDayPolicy,
    p_until: repeat.untilDate,
  };
  return fields as unknown as SeriesRpcFields;
}

export async function createEventSeries(
  supabase: DbClient,
  family: Family,
  commandId: string,
  values: EventFormValues,
  repeat: RepeatValues,
) {
  const { data, error } = await supabase.rpc("create_event_series", {
    p_family_id: family.id,
    p_command_id: commandId,
    p_starts_on: values.date,
    ...toSeriesRpcFields(values, repeat),
  });
  if (error) throw toDomainError(error);
  return data;
}

export async function splitEventSeries(
  supabase: DbClient,
  input: { seriesId: string; from: string; commandId: string; values: EventFormValues; repeat: RepeatValues },
) {
  const { p_title, p_category_id, ...rest } = toSeriesRpcFields(input.values, input.repeat);
  const { data, error } = await supabase.rpc("split_event_series", {
    p_series_id: input.seriesId,
    p_from: input.from,
    p_command_id: input.commandId,
    p_title,
    p_category_id,
    ...rest,
  });
  if (error) throw toDomainError(error);
  return data;
}

export async function endEventSeries(supabase: DbClient, seriesId: string, from: string) {
  const { error } = await supabase.rpc("end_event_series", {
    p_series_id: seriesId,
    p_from: from,
    p_cancel_future: false,
  });
  if (error) throw toDomainError(error);
}
