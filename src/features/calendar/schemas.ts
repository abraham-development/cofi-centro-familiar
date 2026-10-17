import { z } from "zod";

import {
  commandIdSchema,
  isoDateSchema,
  timeSchema,
  uuidSchema,
} from "@/lib/validation/common";
import { daysBetween } from "@/lib/time/zoned";

/** Formulario de evento: fechas y horas locales de la familia. */
export const eventFormSchema = z
  .object({
    title: z.string().trim().min(1, "Escribe un título").max(120, "Máximo 120 caracteres"),
    categoryId: uuidSchema.nullable(),
    isAllDay: z.boolean(),
    date: isoDateSchema,
    /** Último día (inclusive) para eventos de día completo. */
    endDate: isoDateSchema.nullable(),
    startTime: timeSchema.nullable(),
    endTime: timeSchema.nullable(),
    wholeFamily: z.boolean(),
    participantIds: z.array(uuidSchema).max(30),
    visibility: z.enum(["family", "participants", "adults"]),
    importance: z.enum(["normal", "high"]),
    location: z.string().trim().max(200, "Máximo 200 caracteres"),
    description: z.string().trim().max(2000, "Máximo 2000 caracteres"),
    privateNotes: z.string().trim().max(4000, "Máximo 4000 caracteres"),
    reminderOffsets: z.array(z.union([z.literal(0), z.literal(10), z.literal(15), z.literal(30), z.literal(60), z.literal(120), z.literal(1440)])).max(7),
    ruleIds: z.array(uuidSchema).max(10),
  })
  .superRefine((v, ctx) => {
    if (v.isAllDay) {
      const last = v.endDate ?? v.date;
      const span = daysBetween(v.date, last);
      if (span < 0) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "El último día no puede ser anterior al inicio" });
      } else if (span > 61) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "Un evento puede durar como máximo 62 días" });
      }
    } else if (!v.startTime) {
      ctx.addIssue({ code: "custom", path: ["startTime"], message: "Indica la hora de inicio" });
    }
    if (v.visibility === "participants" && !v.wholeFamily && v.participantIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["participantIds"],
        message: "Elige al menos un participante o «Toda la casa»",
      });
    }
  });

export type EventFormValues = z.infer<typeof eventFormSchema>;

export const createEventSchema = z.object({
  commandId: commandIdSchema,
  values: eventFormSchema,
});

export const updateEventSchema = z.object({
  commandId: commandIdSchema,
  eventId: uuidSchema,
  expectedVersion: z.number().int().positive(),
  values: eventFormSchema,
});

export const cancelEventSchema = z.object({
  commandId: commandIdSchema,
  eventId: uuidSchema,
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().max(300),
});

/** Repetición de un evento (series). «none» = evento único. */
export const repeatSchema = z
  .object({
    freq: z.enum(["none", "daily", "weekdays", "weekly", "monthly"]),
    byWeekday: z.array(z.number().int().min(1).max(7)).max(7),
    untilDate: isoDateSchema.nullable(),
    missingDayPolicy: z.enum(["skip", "last_day"]),
  })
  .superRefine((v, ctx) => {
    if (v.freq === "weekly" && v.byWeekday.length === 0) {
      ctx.addIssue({ code: "custom", path: ["byWeekday"], message: "Elige al menos un día" });
    }
  });

export type RepeatValues = z.infer<typeof repeatSchema>;

export const NO_REPEAT: RepeatValues = { freq: "none", byWeekday: [], untilDate: null, missingDayPolicy: "skip" };

export const createSeriesSchema = z.object({
  commandId: commandIdSchema,
  values: eventFormSchema,
  repeat: repeatSchema,
});

export const splitSeriesSchema = createSeriesSchema.extend({
  seriesId: uuidSchema,
  from: isoDateSchema,
});

export const endSeriesSchema = z.object({ seriesId: uuidSchema, from: isoDateSchema });
