import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";

/**
 * Refresca la sesión de Supabase en cada petición y propaga las cookies
 * renovadas. No autoriza nada: cada página y acción vuelve a validar al actor.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Se refrescan ambas sesiones si existen: la del adulto y la de la pantalla.
  for (const cookieName of [undefined, "cofi-device"]) {
    if (cookieName && !request.cookies.getAll().some((c) => c.name.startsWith(cookieName))) continue;
    response = await refresh(request, response, cookieName);
  }
  return response;
}

async function refresh(request: NextRequest, current: NextResponse, cookieName?: string) {
  let response = current;
  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
    {
      ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          const previous = response;
          response = NextResponse.next({ request });
          // Conservar cookies ya escritas por la otra sesión en esta petición.
          previous.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // getClaims() valida la firma del JWT y refresca la sesión si está por vencer.
  // No insertar lógica entre la creación del cliente y esta llamada.
  await supabase.auth.getClaims();

  return response;
}
