import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrentDeviceSetup } from "@/features/devices/components/current-device-setup";
import { listMembers } from "@/features/families/queries";
import { getDeviceContext } from "@/lib/auth/device";
import { getAdultContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Configurar este dispositivo" };

async function Setup() {
  const [adult, device] = await Promise.all([getAdultContext(), getDeviceContext()]);
  // Finishing remains available after the adult cookie is cleared by the action.
  // Only the already-authorized device's minimal metadata is exposed here.
  if (!adult && device.status === "paired") {
    return <CurrentDeviceSetup family={{ id: device.family.id, name: device.family.name }} kids={[]} initialDevice={device.device} />;
  }
  if (!adult) redirect("/acceso?next=/configuracion/dispositivos/esta-pantalla");
  if (!adult.family || !adult.membership) redirect("/onboarding");
  const members = device.status === "paired" ? [] : await listMembers(adult.supabase, adult.family.id);
  return <CurrentDeviceSetup
    key={adult.family.id}
    family={{ id: adult.family.id, name: adult.family.name }}
    kids={members.filter((m) => m.kind === "child").map((m) => ({ id: m.id, displayName: m.displayName }))}
    initialDevice={device.status === "paired" ? device.device : null}
  />;
}

export default function CurrentDevicePage() {
  return <div className="flex flex-col gap-6">
    <PageHeader title="Configurar este dispositivo como pantalla" description="Prepara esta tablet o celular para la familia o para uno de tus hijos." />
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-xl rounded-3xl" />}><Setup /></Suspense>
  </div>;
}
