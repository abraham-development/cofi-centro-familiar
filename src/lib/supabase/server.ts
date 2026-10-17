import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Usa la sesión del actor (cookies), por lo que RLS se aplica siempre.
 * Debe crearse por petición; nunca se comparte entre usuarios.
 */
/** Nombre de la cookie de la sesión de pantalla vinculada (separada del adulto). */
export const DEVICE_COOKIE_NAME = "cofi-device";

export async function createClient() {
  return createServerSupabase();
}

/**
 * Cliente con la sesión de la PANTALLA vinculada (identidad anónima aprobada).
 * Convive con una sesión de adulto en el mismo navegador sin mezclarse.
 */
export async function createDeviceClient() {
  return createServerSupabase(DEVICE_COOKIE_NAME);
}

async function createServerSupabase(cookieName?: string) {
  // Los datos familiares siempre son de la petición: nunca se prerenderizan.
  // (Además, supabase-js consulta la hora para validar y refrescar el JWT.)
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: no puede escribir cookies.
            // proxy.ts se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
