import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

export type DbClient = SupabaseClient<Database>;
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
