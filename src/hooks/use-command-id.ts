"use client";

import { useCallback, useState } from "react";

/**
 * Identificador de comando para idempotencia: se conserva mientras el usuario
 * reintenta el mismo envío (doble toque, red lenta) y se renueva tras un éxito.
 */
export function useCommandId() {
  const [commandId, setCommandId] = useState(() => crypto.randomUUID());
  const renew = useCallback(() => setCommandId(crypto.randomUUID()), []);
  return [commandId, renew] as const;
}
