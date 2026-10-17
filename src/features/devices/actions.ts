"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { ACTIVE_FAMILY_COOKIE, getAdultContext } from "@/lib/auth/session";
import { getDeviceContext } from "@/lib/auth/device";
import { DomainError, toDomainError } from "@/lib/errors";
import { type ActionResult, fail, failFromError, failFromZod, ok } from "@/lib/result";
import { createClient, createDeviceClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/common";

const approveSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
      .pipe(z.string().length(8, "El código tiene 8 caracteres")),
    name: z.string().trim().min(1, "Ponle un nombre a la pantalla").max(40),
    scope: z.enum(["home", "child"]),
    memberId: uuidSchema.nullable(),
  })
  .refine((v) => v.scope === "home" || v.memberId, { path: ["memberId"], message: "Elige a qué hijo pertenece" });

const PAIRING_ERRORS: Record<string, string> = {
  INVALID_CODE: "El código no es válido, ya se usó o venció. Genera uno nuevo en la pantalla.",
  RATE_LIMITED: "Demasiados intentos con códigos erróneos. Espera 15 minutos.",
  INVALID: "Revisa el nombre y el modo de la pantalla.",
};

export async function approveDeviceAction(input: unknown): Promise<ActionResult<{ deviceId: string }>> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const { data, error } = await ctx.supabase.rpc("approve_device_pairing", {
      p_code: parsed.data.code,
      p_family_id: ctx.family.id,
      p_name: parsed.data.name,
      p_scope: parsed.data.scope,
      p_member_id: parsed.data.memberId as string,
    });
    if (error) throw toDomainError(error);
    const row = data?.[0];
    if (!row?.ok) {
      const code = row?.error_code ?? "INVALID_CODE";
      return {
        ok: false,
        error: {
          code: code === "RATE_LIMITED" ? "RATE_LIMITED" : "INVALID",
          message: PAIRING_ERRORS[code] ?? PAIRING_ERRORS.INVALID_CODE,
        },
      };
    }
    refresh();
    return ok({ deviceId: row.device_id });
  } catch (error) {
    return failFromError(error);
  }
}

const updateSchema = z.object({
  deviceId: uuidSchema,
  name: z.string().trim().max(40).optional(),
  revoke: z.boolean().optional(),
});

export async function updateDeviceAction(input: unknown): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getAdultContext();
  if (!ctx?.family) return fail("SESSION_REQUIRED");
  try {
    const { error } = await ctx.supabase.rpc("update_device", {
      p_device_id: parsed.data.deviceId,
      p_name: (parsed.data.name ?? null) as string,
      p_revoke: parsed.data.revoke ?? false,
    });
    if (error) throw toDomainError(error);
    refresh();
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}

/** La pantalla olvida su sesión (al ser revocada o al desvincularse). */
export async function forgetDeviceAction(): Promise<ActionResult> {
  try {
    const supabase = await createDeviceClient();
    await supabase.auth.signOut({ scope: "local" });
    return ok(undefined);
  } catch (error) {
    return failFromError(error instanceof DomainError ? error : toDomainError(error));
  }
}

const currentDeviceSchema = z.object({
  expectedFamilyId: uuidSchema,
  name: z.string().trim().min(1, "Ponle un nombre a la pantalla").max(40),
  scope: z.enum(["home", "child"]),
  memberId: uuidSchema.nullable(),
}).refine((v) => v.scope === "home" || v.memberId, {
  path: ["memberId"], message: "Elige a qué hijo pertenece",
});

/** Both identities come from this request's separate cookies, never from user IDs in the form. */
export async function activateCurrentDeviceAction(input: unknown): Promise<ActionResult<{ deviceId: string }>> {
  const parsed = currentDeviceSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const adult = await getAdultContext();
  if (!adult?.family || !adult.membership) return fail("SESSION_REQUIRED");
  if (adult.family.id !== parsed.data.expectedFamilyId) {
    return { ok: false, error: { code: "VERSION_CONFLICT", message: "Cambió la familia activa. Revisa la familia y vuelve a intentarlo." } };
  }
  try {
    const device = await createDeviceClient();
    const { data: identity, error: identityError } = await device.auth.getClaims();
    if (identityError || !identity?.claims?.sub || identity.claims.is_anonymous !== true) return fail("SESSION_REQUIRED");
    const desired = parsed.data;
    const { data: status, error: statusError } = await device.rpc("get_device_status");
    if (statusError) throw statusError;
    const current = status?.[0];
    // A lost response can be retried, but an existing screen is never silently replaced.
    if (current?.status === "paired") {
      if (current.family_id === adult.family.id && current.device_name === desired.name && current.scope === desired.scope &&
        (current.member_id ?? null) === (desired.scope === "child" ? desired.memberId : null)) {
        return ok({ deviceId: current.device_id });
      }
      return { ok: false, error: { code: "ALREADY_APPLIED", message: "Este navegador ya está vinculado. Revisa su configuración antes de continuar." } };
    }
    if (current?.status === "revoked") return fail("ALREADY_APPLIED");

    const { data: request, error: requestError } = await device.rpc("request_device_pairing");
    if (requestError) throw requestError;
    if (!request?.[0]) return fail("UNEXPECTED");
    // The one-use code stays on the server; no code, token or auth_user_id reaches the UI.
    const { data: approval, error: approvalError } = await adult.supabase.rpc("approve_device_pairing", {
      p_code: request[0].code, p_family_id: adult.family.id, p_name: desired.name,
      p_scope: desired.scope, p_member_id: (desired.scope === "child" ? desired.memberId : null) as string,
    });
    if (approvalError) throw approvalError;
    const result = approval?.[0];
    if (!result?.ok) {
      const code = result?.error_code ?? "INVALID_CODE";
      return { ok: false, error: {
        code: code === "RATE_LIMITED" ? "RATE_LIMITED" : "INVALID",
        message: code === "INVALID_CODE" ? "Se interrumpió la activación. Vuelve a intentarlo en este dispositivo." : PAIRING_ERRORS[code] ?? PAIRING_ERRORS.INVALID,
      } };
    }
    const { data: confirmed, error: confirmError } = await device.rpc("get_device_status");
    if (confirmError) throw confirmError;
    const linked = confirmed?.[0];
    if (linked?.status !== "paired" || linked.device_id !== result.device_id || linked.family_id !== adult.family.id) return fail("FORBIDDEN");
    return ok({ deviceId: linked.device_id });
  } catch (error) {
    return failFromError(error);
  }
}

/** Separately retryable: never creates another device and never signs out an unverified screen. */
export async function finishCurrentDeviceSetupAction(deviceId: unknown): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(deviceId);
  if (!parsed.success) return failFromZod(parsed.error);
  try {
    const device = await getDeviceContext();
    if (device.status !== "paired" || device.device.id !== parsed.data) return fail("FORBIDDEN");
    const adult = await createClient();
    const { error } = await adult.auth.signOut({ scope: "local" });
    if (error) throw error;
    (await cookies()).delete(ACTIVE_FAMILY_COOKIE);
    return ok(undefined);
  } catch (error) {
    return failFromError(error);
  }
}
