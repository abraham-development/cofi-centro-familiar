/**
 * Errores de dominio comprensibles. La base de datos lanza mensajes con el
 * prefijo `COFI:` (ver private.raise_domain); aquí se traducen y nunca se
 * muestran errores SQL crudos al usuario.
 */
export const DOMAIN_ERROR_CODES = [
  "SESSION_REQUIRED",
  "FORBIDDEN",
  "INVALID",
  "NOT_FOUND",
  "VERSION_CONFLICT",
  "ALREADY_APPLIED",
  "INSUFFICIENT_BALANCE",
  "LAST_OWNER",
  "LIMIT_REACHED",
  "RATE_LIMITED",
  "CONFLICT",
  "MEMBER_HAS_ACCOUNT",
  "OFFLINE",
  "UNEXPECTED",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export const DOMAIN_ERROR_MESSAGES: Record<DomainErrorCode, string> = {
  SESSION_REQUIRED: "Tu sesión terminó. Vuelve a iniciar sesión.",
  FORBIDDEN: "No tienes permiso para hacer esto.",
  INVALID: "Revisa los datos: hay algo que no es válido.",
  NOT_FOUND: "No encontramos lo que buscas. Puede que ya no exista.",
  VERSION_CONFLICT:
    "Alguien cambió esto mientras lo editabas. Revisa la versión actual antes de guardar.",
  ALREADY_APPLIED: "Esto ya estaba hecho.",
  INSUFFICIENT_BALANCE: "No hay puntos suficientes.",
  LAST_OWNER: "La familia necesita al menos un propietario activo.",
  LIMIT_REACHED: "Llegaste al límite permitido.",
  RATE_LIMITED: "Demasiados intentos. Espera un momento y vuelve a intentarlo.",
  CONFLICT: "Hay un conflicto con otro registro.",
  MEMBER_HAS_ACCOUNT:
    "Este integrante tiene una cuenta de adulto activa. Retira primero su acceso.",
  OFFLINE: "Sin conexión. Los cambios se podrán guardar cuando vuelva la red.",
  UNEXPECTED: "Algo salió mal. Inténtalo de nuevo.",
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly detail?: string;

  constructor(code: DomainErrorCode, detail?: string) {
    super(DOMAIN_ERROR_MESSAGES[code]);
    this.name = "DomainError";
    this.code = code;
    this.detail = detail;
  }
}

type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string | null;
};

const SQLSTATE_TO_CODE: Record<string, DomainErrorCode> = {
  "42501": "FORBIDDEN", // privilegio insuficiente o RLS
  "23505": "CONFLICT", // único violado
  "23503": "INVALID", // FK
  "23514": "INVALID", // CHECK
  "23502": "INVALID", // NOT NULL
  "22P02": "INVALID", // texto inválido para el tipo
  "22007": "INVALID", // fecha/hora inválida
  "22008": "INVALID",
  PGRST116: "NOT_FOUND", // .single() sin filas
  PGRST301: "SESSION_REQUIRED", // JWT inválido o vencido
  PGRST303: "SESSION_REQUIRED",
};

/** Convierte un error de supabase-js/PostgREST en un DomainError. */
export function toDomainError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  const e = (error ?? {}) as PostgrestLikeError;
  const message = e.message ?? "";
  const match = /^COFI:([A-Z_]+)/.exec(message);
  if (match && (DOMAIN_ERROR_CODES as readonly string[]).includes(match[1])) {
    return new DomainError(match[1] as DomainErrorCode, e.details ?? undefined);
  }
  if (e.code && SQLSTATE_TO_CODE[e.code]) {
    return new DomainError(SQLSTATE_TO_CODE[e.code]);
  }
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return new DomainError("OFFLINE");
  }
  return new DomainError("UNEXPECTED");
}

/**
 * Lanza si la respuesta de Supabase trae error; devuelve los datos tipados.
 * Para listas: sin error, `data` nunca es null.
 */
export function unwrap<T>(response: { data: T | null; error: unknown }): T {
  if (response.error) throw toDomainError(response.error);
  return response.data as T;
}
