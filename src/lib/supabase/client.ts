import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/** Cliente de Supabase para Client Components (singleton en el navegador). */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabasePublishableKey,
  );
}

/** Cliente de la pantalla vinculada (cookie propia; no es singleton compartido). */
let deviceClient: ReturnType<typeof createBrowserClient<Database>> | null = null;
export function createDeviceClient() {
  deviceClient ??= createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookieOptions: { name: "cofi-device" },
    isSingleton: false,
  });
  return deviceClient;
}
