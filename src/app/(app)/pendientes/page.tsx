import { ClipboardPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ClockProvider } from "@/components/clock/clock-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HouseholdList } from "@/features/tasks/components/household-list";
import { QuickAddHousehold } from "@/features/tasks/components/quick-add-household";
import { listHouseholdTasks } from "@/features/tasks/queries";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { requestNow } from "@/lib/time/request-now";
import { addDays, localDateOf, localToInstant } from "@/lib/time/zoned";

export const metadata: Metadata = { title: "Pendientes" };

async function Pending() {
  const ctx = await requireAdultWithFamily();
  const now = await requestNow();
  const today = localDateOf(now, ctx.family.timezone);
  const tasks = await listHouseholdTasks(ctx.supabase, ctx.family.id, {
    doneSince: localToInstant(addDays(today, -1), "00:00", ctx.family.timezone),
  });
  return (
    <ClockProvider serverNow={now} timeZone={ctx.family.timezone} hourFormat={ctx.family.hourFormat}>
      <div className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <QuickAddHousehold />
        <HouseholdList tasks={tasks} variant="full" />
      </div>
    </ClockProvider>
  );
}

export default function PendingPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Pendientes de la casa"
        description="Lo operativo del hogar: compras, pagos, llamadas. Sin puntos."
        actions={
          <Button size="lg" nativeButton={false} render={<Link href="/pendientes/nuevo" />}>
            <ClipboardPlus aria-hidden /> Nuevo pendiente
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <Pending />
      </Suspense>
    </div>
  );
}
