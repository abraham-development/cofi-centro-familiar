import "server-only";

import { connection } from "next/server";

/**
 * Hora de referencia de la petición (servidor). Marca la ruta como dinámica:
 * nunca se prerenderiza ni se comparte entre familias.
 */
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}
