"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_FAMILY_COOKIE } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(ACTIVE_FAMILY_COOKIE);
  redirect("/acceso");
}
