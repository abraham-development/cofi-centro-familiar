import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EventForm } from "@/features/calendar/components/event-form";
import { getEventSeries } from "@/features/calendar/queries";
import { listCategories, listMembers } from "@/features/families/queries";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { formatLongDate } from "@/lib/time/zoned";
import { isoDateSchema, uuidSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Cambiar serie" };

function addMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function SplitSeries({ params, searchParams }: PageProps<"/agenda/serie/[seriesId]">) {
  const ctx = await requireAdultWithFamily();
  const { seriesId } = await params;
  const query = await searchParams;
  const from = isoDateSchema.safeParse(query.desde);
  if (!uuidSchema.safeParse(seriesId).success || !from.success) notFound();
  const [series, members, categories] = await Promise.all([
    getEventSeries(ctx.supabase, ctx.family.id, seriesId),
    listMembers(ctx.supabase, ctx.family.id),
    listCategories(ctx.supabase, ctx.family.id),
  ]);
  if (!series) notFound();
  return (
    <>
      <p className="text-lg text-muted-foreground">
        Desde el {formatLongDate(from.data).toLowerCase()}. Las fechas anteriores y las editadas a mano no cambian.
      </p>
      <EventForm
        mode="create"
        allowRepeat
        splitSeries={{ seriesId, from: from.data }}
        initialRepeat={{
          freq: series.freq,
          byWeekday: series.byWeekday,
          untilDate: series.untilOn,
          missingDayPolicy: series.missingDayPolicy,
        }}
        initialValues={{
          title: series.title,
          categoryId: series.categoryId,
          isAllDay: series.isAllDay,
          date: from.data,
          endDate: null,
          startTime: series.startTime,
          endTime: series.startTime && series.durationMinutes ? addMinutes(series.startTime, series.durationMinutes) : null,
          wholeFamily: series.wholeFamily,
          participantIds: series.participantIds,
          visibility: series.visibility,
          importance: series.importance,
          location: series.location ?? "",
          description: series.description ?? "",
          privateNotes: "",
          reminderOffsets: [],
          ruleIds: [],
        }}
        members={members}
        categories={categories}
        homeColor={ctx.family.homeColor}
        returnTo="/agenda"
      />
    </>
  );
}

export default function SplitSeriesPage(props: PageProps<"/agenda/serie/[seriesId]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title="Cambiar esta y las siguientes" />
      <Suspense fallback={<Skeleton className="h-[40rem] rounded-3xl" />}>
        <SplitSeries {...props} />
      </Suspense>
    </div>
  );
}
