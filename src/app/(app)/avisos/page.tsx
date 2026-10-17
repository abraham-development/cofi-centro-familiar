import type { Metadata } from "next";
import { Suspense } from "react";

import { ClockProvider } from "@/components/clock/clock-provider";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { listDevices } from "@/features/devices/queries";
import { listAdults, listMembers } from "@/features/families/queries";
import { HealthPanel, NotificationsCenter } from "@/features/notifications/components/notifications-center";
import { PushOptIn } from "@/features/notifications/components/push-opt-in";
import { getRemindersHealth, listNotifications } from "@/features/notifications/queries";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { requestNow } from "@/lib/time/request-now";

export const metadata: Metadata = { title: "Avisos" };

async function Notices() {
  const ctx = await requireAdultWithFamily();
  const now = await requestNow();
  const [notifications, health, adults, devices, members] = await Promise.all([
    listNotifications(ctx.supabase, ctx.family.id, { limit: 60 }),
    getRemindersHealth(ctx.supabase, ctx.family.id),
    listAdults(ctx.supabase, ctx.family.id, ctx.user.id),
    listDevices(ctx.supabase, ctx.family.id),
    listMembers(ctx.supabase, ctx.family.id),
  ]);
  const names: Record<string, string> = {};
  for (const a of adults) names[`user:${a.userId}`] = a.displayName;
  for (const d of devices) names[`device:${d.id}`] = d.name;
  for (const m of members) names[`member:${m.id}`] = m.displayName;

  return (
    <ClockProvider serverNow={now} timeZone={ctx.family.timezone} hourFormat={ctx.family.hourFormat}>
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <section aria-labelledby="historial" className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
          <h2 id="historial" className="text-2xl font-bold">
            Historial
          </h2>
          <NotificationsCenter notifications={notifications} recipient={`user:${ctx.user.id}`} names={names} />
        </section>
        <div className="flex flex-col gap-6">
          <section aria-labelledby="push" className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
            <h2 id="push" className="text-2xl font-bold">
              Notificaciones en este dispositivo
            </h2>
            <PushOptIn actor="adult" vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
          </section>
          <section aria-labelledby="estado" className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
            <h2 id="estado" className="text-2xl font-bold">
              Estado del sistema de avisos
            </h2>
            <HealthPanel health={health} />
          </section>
        </div>
      </div>
    </ClockProvider>
  );
}

export default function NoticesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Avisos"
        description="Recordatorios y preparativos. Se generan en el servidor aunque nadie tenga la web abierta."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <Notices />
      </Suspense>
    </div>
  );
}
