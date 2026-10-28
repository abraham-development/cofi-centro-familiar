"use server";

import { refresh } from "next/cache";

import { childAppearanceSchema, type ChildAppearance } from "./appearance";
import { getDeviceContext } from "@/lib/auth/device";
import { type ActionResult, fail, failFromError, failFromZod, ok } from "@/lib/result";

export async function saveChildAppearanceAction(input: unknown): Promise<ActionResult<ChildAppearance>> {
  const parsed = childAppearanceSchema.safeParse(input);
  if (!parsed.success) return failFromZod(parsed.error);
  const ctx = await getDeviceContext();
  if (ctx.status !== "paired" || ctx.device.scope !== "child") return fail("FORBIDDEN");
  try {
    const { data, error } = await ctx.supabase.rpc("save_child_appearance", {
      p_accent_color: parsed.data.accentColor as string,
      p_avatar_key: parsed.data.avatarKey as string,
    });
    if (error) throw error;
    const row = data?.[0];
    if (!row) return fail("FORBIDDEN");
    refresh();
    return ok(childAppearanceSchema.parse({ accentColor: row.accent_color, avatarKey: row.avatar_key }));
  } catch (error) {
    return failFromError(error);
  }
}
