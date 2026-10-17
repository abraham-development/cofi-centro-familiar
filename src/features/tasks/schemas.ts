import { z } from "zod";

import { commandIdSchema, isoDateSchema, timeSchema, uuidSchema } from "@/lib/validation/common";

export const householdTaskFormSchema = z
  .object({
    title: z.string().trim().min(1, "Escribe qué hay que hacer").max(120, "Máximo 120 caracteres"),
    notes: z.string().trim().max(1000, "Máximo 1000 caracteres"),
    assigneeMemberId: uuidSchema.nullable(),
    dueDate: isoDateSchema.nullable(),
    dueTime: timeSchema.nullable(),
    priority: z.enum(["low", "normal", "high"]),
    visibility: z.enum(["family", "adults"]),
  })
  .refine((v) => !v.dueTime || v.dueDate, {
    path: ["dueDate"],
    message: "Para poner hora, elige también la fecha",
  });

export type HouseholdTaskFormValues = z.infer<typeof householdTaskFormSchema>;

export const createHouseholdTaskSchema = z.object({
  commandId: commandIdSchema,
  values: householdTaskFormSchema,
});

export const updateHouseholdTaskSchema = z.object({
  commandId: commandIdSchema,
  taskId: uuidSchema,
  expectedVersion: z.number().int().positive(),
  values: householdTaskFormSchema,
});

export const setHouseholdStatusSchema = z.object({
  commandId: commandIdSchema,
  taskId: uuidSchema,
  status: z.enum(["pending", "done", "cancelled"]),
  as: z.enum(["adult", "device"]).default("adult"),
});
