import { z } from "zod";

/** Igual que la política de Supabase Auth: 8+ caracteres con letras y números. */
export const newPasswordSchema = z
  .string()
  .min(8, "Usa al menos 8 caracteres")
  .max(72, "Máximo 72 caracteres")
  .regex(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/, "Incluye al menos una letra")
  .regex(/\d/, "Incluye al menos un número");

export const OTP_LENGTH = 8;
export const RESEND_COOLDOWN_SECONDS = 60;
