import type { ZodError } from "zod";

import {
  DOMAIN_ERROR_MESSAGES,
  type DomainErrorCode,
  toDomainError,
} from "@/lib/errors";

/** Resultado serializable de una Server Action. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: DomainErrorCode;
        message: string;
        fieldErrors?: Record<string, string>;
        detail?: string;
      };
    };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(code: DomainErrorCode, detail?: string): ActionResult<never> {
  return { ok: false, error: { code, message: DOMAIN_ERROR_MESSAGES[code], detail } };
}

export function failFromError(error: unknown): ActionResult<never> {
  const domain = toDomainError(error);
  if (domain.code === "UNEXPECTED") {
    // Registro técnico mínimo: sin títulos, notas ni datos personales.
    console.error("[cofi] acción fallida", {
      name: (error as Error)?.name,
      code: (error as { code?: string })?.code,
    });
  }
  return fail(domain.code, domain.detail);
}

export function failFromZod(error: ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return {
    ok: false,
    error: { code: "INVALID", message: DOMAIN_ERROR_MESSAGES.INVALID, fieldErrors },
  };
}
