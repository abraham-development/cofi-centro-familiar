import { z } from "zod";

import { isValidTimeZone } from "@/lib/time/zoned";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Fecha inválida");

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");

export const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido");

export const timeZoneSchema = z
  .string()
  .min(1)
  .refine((tz) => (tz === "UTC" || tz.includes("/")) && isValidTimeZone(tz), "Zona horaria inválida");

export const uuidSchema = z.uuid("Identificador inválido");

/** Identificador del comando para idempotencia (lo genera el cliente). */
export const commandIdSchema = z.uuid();
