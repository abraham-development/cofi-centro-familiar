import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { HourFormat } from "@/lib/time/zoned";

export const ACTIVE_FAMILY_COOKIE = "cofi-family";

export type SessionUser = {
  id: string;
  email: string | null;
  isAnonymous: boolean;
};

export type ActiveFamily = {
  id: string;
  name: string;
  timezone: string;
  hourFormat: HourFormat;
  morningEnds: string;
  afternoonEnds: string;
  homeColor: string;
  quietStart: string;
  quietEnd: string;
  version: number;
};

export type AdultMembership = {
  id: string;
  role: "owner" | "admin";
  familyId: string;
  memberId: string;
  familyName: string;
  /** Cómo aparece este adulto en su familia (p. ej., «Papá»). */
  me: {
    displayName: string;
    color: string;
    initials: string;
    avatarEmoji: string | null;
  };
};

/**
 * Usuario validado de la petición. `getClaims()` verifica la firma del JWT;
 * nunca se usa `getSession()` para autorizar en el servidor.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims as { sub: string; email?: string; is_anonymous?: boolean };
  return {
    id: claims.sub,
    email: claims.email ?? null,
    isAnonymous: Boolean(claims.is_anonymous),
  };
});

/**
 * Contexto de un adulto: pertenencias activas y familia activa. La familia
 * activa se elige por cookie, pero siempre se valida contra las pertenencias
 * reales (cambiar la cookie no amplía permisos).
 */
export const getAdultContext = cache(async () => {
  const user = await getSessionUser();
  if (!user || user.isAnonymous) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adult_memberships")
    .select(
      "id, role, family_id, member_id, families!inner(id, name, timezone, time_format, morning_ends, afternoon_ends, home_color, quiet_start, quiet_end, version), family_members!adult_memberships_member_fk(display_name, color, initials, avatar_emoji)",
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const memberships: AdultMembership[] = rows.map((row) => ({
    id: row.id,
    role: row.role as AdultMembership["role"],
    familyId: row.family_id,
    memberId: row.member_id,
    familyName: row.families.name,
    me: {
      displayName: row.family_members.display_name,
      color: row.family_members.color,
      initials: row.family_members.initials,
      avatarEmoji: row.family_members.avatar_emoji,
    },
  }));

  const preferred = (await cookies()).get(ACTIVE_FAMILY_COOKIE)?.value;
  const activeRow = rows.find((r) => r.family_id === preferred) ?? rows[0];

  const family: ActiveFamily | null = activeRow
    ? {
        id: activeRow.families.id,
        name: activeRow.families.name,
        timezone: activeRow.families.timezone,
        hourFormat: activeRow.families.time_format as HourFormat,
        morningEnds: activeRow.families.morning_ends.slice(0, 5),
        afternoonEnds: activeRow.families.afternoon_ends.slice(0, 5),
        homeColor: activeRow.families.home_color,
        quietStart: activeRow.families.quiet_start.slice(0, 5),
        quietEnd: activeRow.families.quiet_end.slice(0, 5),
        version: activeRow.families.version,
      }
    : null;

  const membership = memberships.find((m) => m.familyId === family?.id) ?? null;

  return { user, supabase, memberships, family, membership };
});

export type AdultContext = NonNullable<Awaited<ReturnType<typeof getAdultContext>>>;
export type AdultContextWithFamily = AdultContext & {
  family: ActiveFamily;
  membership: AdultMembership;
};

/** Exige un adulto con familia activa; si no, redirige al paso que falta. */
export async function requireAdultWithFamily(): Promise<AdultContextWithFamily> {
  const ctx = await getAdultContext();
  if (!ctx) redirect("/acceso");
  if (!ctx.family || !ctx.membership) redirect("/onboarding");
  return ctx as AdultContextWithFamily;
}
