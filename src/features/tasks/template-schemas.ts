import { z } from "zod";

import { commandIdSchema, isoDateSchema, timeSchema, uuidSchema } from "@/lib/validation/common";

export const FREQ_OPTIONS = [
  { value: "once", label: "Una vez" },
  { value: "daily", label: "Todos los días" },
  { value: "weekdays", label: "De lunes a viernes" },
  { value: "weekly", label: "Días de la semana" },
  { value: "monthly", label: "Cada mes" },
] as const;

export const templateFormSchema = z
  .object({
    kind: z.enum(["chore", "habit"]),
    title: z.string().trim().min(1, "Escribe la responsabilidad").max(120),
    description: z.string().trim().max(500),
    points: z.number().int().min(0, "Mínimo 0").max(1000, "Máximo 1000"),
    requiresReview: z.boolean(),
    dueTime: timeSchema.nullable(),
    assigneeIds: z.array(uuidSchema).min(1, "Elige al menos un hijo").max(20),
    freq: z.enum(["once", "daily", "weekdays", "weekly", "monthly"]),
    intervalCount: z.number().int().min(1).max(12),
    byWeekday: z.array(z.number().int().min(1).max(7)).max(7),
    monthDay: z.number().int().min(1).max(31).nullable(),
    missingDayPolicy: z.enum(["skip", "last_day"]),
    startsOn: isoDateSchema,
    untilOn: isoDateSchema.nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.freq === "weekly" && v.byWeekday.length === 0) {
      ctx.addIssue({ code: "custom", path: ["byWeekday"], message: "Elige al menos un día" });
    }
    if (v.untilOn && v.untilOn < v.startsOn) {
      ctx.addIssue({ code: "custom", path: ["untilOn"], message: "Debe ser posterior al inicio" });
    }
  });

export type TemplateFormValues = z.infer<typeof templateFormSchema>;

export const saveTemplateSchema = z.object({
  commandId: commandIdSchema,
  templateId: uuidSchema.nullable(),
  expectedVersion: z.number().int().positive().nullable(),
  values: templateFormSchema,
});

export const actorSchema = z.enum(["adult", "device"]);

export const submitTaskSchema = z.object({ taskId: uuidSchema, commandId: commandIdSchema, as: actorSchema });

export const reviewTaskSchema = z.object({
  taskId: uuidSchema,
  expectedVersion: z.number().int().positive(),
  commandId: commandIdSchema,
  decision: z.enum(["approve", "needs_correction"]),
  note: z.string().trim().max(500),
});

export const adjustTaskSchema = z.object({
  taskId: uuidSchema,
  commandId: commandIdSchema,
  action: z.enum(["exempt", "reopen"]),
  reason: z.string().trim().min(1, "Indica el motivo").max(500),
});
