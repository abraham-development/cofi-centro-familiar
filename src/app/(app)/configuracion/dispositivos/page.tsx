import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DevicesManager } from "@/features/devices/components/devices-manager";
import { listDevices } from "@/features/devices/queries";
import { listMembers } from "@/features/families/queries";
import { requireAdultWithFamily } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Pantallas" };

async function Devices({ searchParams }: { searchParams: PageProps<"/configuracion/dispositivos">["searchParams"] }) {
  const ctx = await requireAdultWithFamily();
  const params = await searchParams;
  const [devices, members] = await Promise.all([
    listDevices(ctx.supabase, ctx.family.id),
    listMembers(ctx.supabase, ctx.family.id),
  ]);
  const code = typeof params.codigo === "string" ? params.codigo.slice(0, 9) : "";
  return <DevicesManager devices={devices} kids={members.filter((m) => m.kind === "child")} initialCode={code} />;
}

export default function DevicesPage(props: PageProps<"/configuracion/dispositivos">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pantallas"
        description="Configura este equipo o vincula otro mediante un código. Cada pantalla conserva solo los permisos que elijas."
        actions={<Button role="link" nativeButton={false} render={<Link href="/configuracion/dispositivos/esta-pantalla" />} className="h-auto min-h-11 whitespace-normal py-3 text-center">Configurar este dispositivo como pantalla</Button>}
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Devices searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
