import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EventForm } from "@/features/calendar/components/event-form";
import { newEventDefaults } from "@/features/calendar/form-values";
import { listRules } from "@/features/automations/queries";
import { listCategories, listMembers } from "@/features/families/queries";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { requestNow } from "@/lib/time/request-now";
import { safeNextPath } from "@/lib/safe-redirect";
import { localDateOf } from "@/lib/time/zoned";
import { isoDateSchema, timeSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Nuevo evento" };

async function NewEvent({ searchParams }: { searchParams: PageProps<"/agenda/nuevo">["searchParams"] }) {
  const ctx = await requireAdultWithFamily();
  const params = await searchParams;
  const now = await requestNow();
  const today = localDateOf(now, ctx.family.timezone);
  const requested = isoDateSchema.safeParse(params.fecha);
  const date = requested.success ? requested.data : today;
  const hour = timeSchema.safeParse(params.hora);
  const [members, categories, rules] = await Promise.all([
    listMembers(ctx.supabase, ctx.family.id),
    listCategories(ctx.supabase, ctx.family.id),
    listRules(ctx.supabase, ctx.family.id),
  ]);
  return (
    <EventForm
      mode="create"
      initialValues={newEventDefaults(date, now, ctx.family.timezone, date === today, hour.success ? hour.data : undefined)}
      members={members}
      categories={categories}
      homeColor={ctx.family.homeColor}
      returnTo={safeNextPath(typeof params.volver === "string" ? params.volver : null, "/agenda")}
      allowRepeat
      rules={rules.filter((r) => r.enabled)}
      restoreDraft={params.borrador === "1"}
    />
  );
}

export default function NewEventPage(props: PageProps<"/agenda/nuevo">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title="Nuevo evento" description="Cita, visita, reunión, examen o vencimiento." />
      <Suspense fallback={<Skeleton className="h-[40rem] rounded-2xl" />}>
        <NewEvent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
