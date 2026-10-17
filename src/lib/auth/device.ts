import "server-only";

import { cache } from "react";

import type { HourFormat } from "@/lib/time/zoned";
import { createDeviceClient } from "@/lib/supabase/server";

export type DeviceInfo = {
  id: string;
  familyId: string;
  familyName: string;
  name: string;
  scope: "home" | "child";
  memberId: string | null;
};

export type DeviceFamily = {
  id: string;
  name: string;
  timezone: string;
  hourFormat: HourFormat;
  morningEnds: string;
  afternoonEnds: string;
  homeColor: string;
  quietStart: string;
  quietEnd: string;
};

export type DeviceContext =
  | { status: "none" | "pending" | "revoked"; supabase: Awaited<ReturnType<typeof createDeviceClient>> }
  | {
      status: "paired";
      identity: string;
      supabase: Awaited<ReturnType<typeof createDeviceClient>>;
      device: DeviceInfo;
      family: DeviceFamily;
    };

/**
 * Contexto de la pantalla vinculada. La sesión anónima se valida con
 * getClaims(); el vínculo se comprueba en la base de datos en cada petición
 * (una pantalla revocada deja de ver datos de inmediato).
 */
export const getDeviceContext = cache(async (): Promise<DeviceContext> => {
  const supabase = await createDeviceClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub || !(claims.claims as { is_anonymous?: boolean }).is_anonymous) {
    return { status: "none", supabase };
  }

  const { data, error } = await supabase.rpc("get_device_status");
  if (error) throw error;
  const row = data?.[0];
  if (!row || row.status !== "paired") {
    return { status: (row?.status ?? "none") as "none" | "pending" | "revoked", supabase };
  }

  const { data: fam, error: famError } = await supabase
    .from("families")
    .select("id, name, timezone, time_format, morning_ends, afternoon_ends, home_color, quiet_start, quiet_end")
    .eq("id", row.family_id)
    .maybeSingle();
  if (famError) throw famError;
  // A revocation can commit after get_device_status and before this RLS read.
  // Treat the lost access as revoked instead of throwing PGRST116.
  if (!fam) return { status: "revoked", supabase };

  return {
    status: "paired",
    identity: claims.claims.sub,
    supabase,
    device: {
      id: row.device_id,
      familyId: row.family_id,
      familyName: row.family_name,
      name: row.device_name,
      scope: row.scope as "home" | "child",
      memberId: row.member_id,
    },
    family: {
      id: fam.id,
      name: fam.name,
      timezone: fam.timezone,
      hourFormat: fam.time_format as HourFormat,
      morningEnds: fam.morning_ends.slice(0, 5),
      afternoonEnds: fam.afternoon_ends.slice(0, 5),
      homeColor: fam.home_color,
      quietStart: fam.quiet_start.slice(0, 5),
      quietEnd: fam.quiet_end.slice(0, 5),
    },
  };
});
