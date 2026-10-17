import { z } from "zod";

import { colorSchema, commandIdSchema, timeSchema, timeZoneSchema, uuidSchema } from "@/lib/validation/common";

export const createFamilySchema = z.object({
  commandId: commandIdSchema,
  name: z.string().trim().min(1, "Ponle un nombre a tu familia").max(80),
  timezone: timeZoneSchema,
  ownerDisplayName: z.string().trim().min(1, "¿Cómo te llamamos?").max(40),
  ownerColor: colorSchema,
});

export const memberFormSchema = z.object({
  displayName: z.string().trim().min(1, "Escribe un nombre o alias").max(40, "Máximo 40 caracteres"),
  kind: z.enum(["adult", "child", "other"]),
  color: colorSchema,
  initials: z
    .string()
    .trim()
    .max(3, "Máximo 3 letras")
    .transform((v) => v.toUpperCase()),
  avatarEmoji: z.string().trim().max(16),
});

export type MemberFormValues = z.infer<typeof memberFormSchema>;

export const addMemberSchema = z.object({ values: memberFormSchema });
export const updateMemberSchema = z.object({ memberId: uuidSchema, values: memberFormSchema });
export const archiveMemberSchema = z.object({ memberId: uuidSchema, archived: z.boolean() });

export const familySettingsSchema = z
  .object({
    name: z.string().trim().min(1, "Escribe un nombre").max(80),
    timezone: timeZoneSchema,
    hourFormat: z.enum(["12h", "24h"]),
    morningEnds: timeSchema,
    afternoonEnds: timeSchema,
    homeColor: colorSchema,
    quietStart: timeSchema,
    quietEnd: timeSchema,
  })
  .refine((v) => v.morningEnds < v.afternoonEnds, {
    path: ["afternoonEnds"],
    message: "La tarde debe terminar después de la mañana",
  });

export type FamilySettingsValues = z.infer<typeof familySettingsSchema>;

export const createInvitationSchema = z.object({
  email: z.email("Correo inválido").transform((v) => v.trim().toLowerCase()),
  role: z.enum(["owner", "admin"]),
  memberId: uuidSchema.nullable(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(20).max(200),
  displayName: z.string().trim().max(40),
});
