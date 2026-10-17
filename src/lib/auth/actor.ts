import "server-only";

import { getDeviceContext } from "./device";
import { getAdultContext } from "./session";
import type { DbClient } from "@/lib/supabase/types";

export type ActorKind = "adult" | "device";

/**
 * Cliente para una acción según quién la ejecuta. El navegador solo elige
 * qué sesión usar; los permisos los decide la base de datos con esa sesión
 * (una sesión de pantalla nunca obtiene permisos de adulto).
 */
export async function getActorClient(kind: ActorKind): Promise<{ supabase: DbClient; familyId: string } | null> {
  if (kind === "adult") {
    const ctx = await getAdultContext();
    return ctx?.family ? { supabase: ctx.supabase, familyId: ctx.family.id } : null;
  }
  const device = await getDeviceContext();
  return device.status === "paired" ? { supabase: device.supabase, familyId: device.family.id } : null;
}
