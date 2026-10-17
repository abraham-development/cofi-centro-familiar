import { connection } from "next/server";

/**
 * Referencia de hora del servidor para el reloj contextual. No expone datos
 * familiares. Se consulta al montar, al volver de suspensión o al reconectar,
 * nunca cada segundo.
 */
export async function GET() {
  await connection();
  return Response.json(
    { now: Date.now() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
