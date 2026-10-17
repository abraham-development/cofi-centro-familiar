import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getDeviceContext } from "@/lib/auth/device";
import { getAdultContext } from "@/lib/auth/session";

async function ResolveEntry(): Promise<never> {
  const ctx = await getAdultContext();
  if (!ctx) {
    const device = await getDeviceContext();
    redirect(device.status === "paired" || device.status === "revoked" ? "/pantalla" : "/acceso");
  }
  if (!ctx.family) redirect("/onboarding");
  redirect("/casa");
}

/** Entrada: acceso, onboarding, familia activa o pantalla vinculada. */
export default function Home() {
  return (
    <Suspense fallback={<p className="m-auto text-muted-foreground">Cargando…</p>}>
      <ResolveEntry />
    </Suspense>
  );
}
