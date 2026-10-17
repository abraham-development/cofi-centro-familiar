import { CalendarPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Temporal } from "temporal-polyfill";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AgendaFilters } from "@/features/calendar/components/agenda-filters";
import { AgendaList } from "@/features/calendar/components/agenda-list";
import { MonthGrid } from "@/features/calendar/components/month-grid";
import { listEventsInRange } from "@/features/calendar/queries";
import { listCategories, listMembers } from "@/features/families/queries";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { requestNow } from "@/lib/time/request-now";
import { addDays, localDateOf } from "@/lib/time/zoned";
import { isoDateSchema, uuidSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Agenda" };

async function Agenda({ searchParams }: { searchParams: PageProps<"/agenda">["searchParams"] }) {
  const ctx = await requireAdultWithFamily();
  const params = await searchParams;
  const today = localDateOf(await requestNow(), ctx.family.timezone);
  const view = params.vista === "mes" ? "mes" : "lista";
  const parsedFrom = isoDateSchema.safeParse(params.desde);
  const from = parsedFrom.success ? parsedFrom.data : today;
  const days = [1, 7, 30].includes(Number(params.dias)) ? Number(params.dias) : 7;
  const memberId = uuidSchema.safeParse(params.miembro).success ? (params.miembro as string) : null;
  const categoryId = uuidSchema.safeParse(params.categoria).success ? (params.categoria as string) : null;

  const month = from.slice(0, 7);
  const monthStart = Temporal.PlainDate.from(`${month}-01`);
  const rangeFrom = view === "mes" ? monthStart.subtract({ days: monthStart.dayOfWeek - 1 }).toString() : from;
  const rangeTo = view === "mes" ? addDays(rangeFrom, 41) : addDays(from, days - 1);

  const [events, members, categories] = await Promise.all([
    listEventsInRange(ctx.supabase, ctx.family.id, rangeFrom, rangeTo, {
      memberId,
      categoryId,
      includeCancelled: view === "lista",
    }),
    listMembers(ctx.supabase, ctx.family.id),
    listCategories(ctx.supabase, ctx.family.id),
  ]);

  return (
    <>
      <AgendaFilters members={members} categories={categories} from={from} days={days} view={view} today={today} />
      {view === "mes" ? (
        <MonthGrid events={events.filter((e) => e.status === "scheduled")} month={month} today={today} />
      ) : (
        <AgendaList
          events={events}
          from={from}
          days={days}
          today={today}
          timeZone={ctx.family.timezone}
          hourFormat={ctx.family.hourFormat}
          homeColor={ctx.family.homeColor}
        />
      )}
    </>
  );
}

export default function AgendaPage(props: PageProps<"/agenda">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agenda"
        description="Citas, visitas, colegio, vencimientos y más."
        actions={
          <Button size="lg" nativeButton={false} render={<Link href="/agenda/nuevo" />}>
            <CalendarPlus aria-hidden /> Nuevo evento
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <Agenda searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
