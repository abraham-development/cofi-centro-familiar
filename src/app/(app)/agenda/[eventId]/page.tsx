import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EventForm } from "@/features/calendar/components/event-form";
import { eventToFormValues } from "@/features/calendar/form-values";
import { getEvent } from "@/features/calendar/queries";
import { listRules } from "@/features/automations/queries";
import { listCategories, listMembers } from "@/features/families/queries";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/safe-redirect";
import { uuidSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Evento" };

async function EditEvent({ params, searchParams }: PageProps<"/agenda/[eventId]">) {
  const ctx = await requireAdultWithFamily();
  const { eventId } = await params;
  const query = await searchParams;
  if (!uuidSchema.safeParse(eventId).success) notFound();
  const [event, members, categories, rules] = await Promise.all([
    getEvent(ctx.supabase, ctx.family.id, eventId),
    listMembers(ctx.supabase, ctx.family.id, { includeArchived: true }),
    listCategories(ctx.supabase, ctx.family.id),
    listRules(ctx.supabase, ctx.family.id),
  ]);
  if (!event) notFound();
  const participantIds = new Set(event.participants.map((p) => p.id));
  return (
    <EventForm
      key={`${event.id}-${event.version}`}
      mode="edit"
      eventId={event.id}
      version={event.version}
      isCancelled={event.status === "cancelled"}
      initialValues={eventToFormValues(event)}
      members={members.filter((m) => !m.archivedAt || participantIds.has(m.id))}
      categories={categories}
      homeColor={ctx.family.homeColor}
      returnTo={safeNextPath(typeof query.volver === "string" ? query.volver : null, "/agenda")}
      rules={rules.filter((r) => r.enabled || event.ruleIds.includes(r.id))}
      occurrenceOf={event.seriesId && event.occurrenceDate ? { seriesId: event.seriesId, date: event.occurrenceDate } : undefined}
    />
  );
}

export default function EventPage(props: PageProps<"/agenda/[eventId]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title="Editar evento" />
      <Suspense fallback={<Skeleton className="h-[40rem] rounded-2xl" />}>
        <EditEvent {...props} />
      </Suspense>
    </div>
  );
}
