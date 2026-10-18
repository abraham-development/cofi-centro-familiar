import { CalendarPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ClockProvider } from "@/components/clock/clock-provider";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AgendaFilters, AgendaViewToggle } from "@/features/calendar/components/agenda-filters";
import { AgendaList } from "@/features/calendar/components/agenda-list";
import { DayPlanner } from "@/features/calendar/components/day-planner";
import { MiniMonth, monthGridStart } from "@/features/calendar/components/mini-month";
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
  const now = await requestNow();
  const today = localDateOf(now, ctx.family.timezone);
  // `desde` y `dias=1` son los nombres anteriores: siguen abriendo el día.
  const parsedDay = isoDateSchema.safeParse(params.dia ?? params.desde);
  const day = parsedDay.success ? parsedDay.data : today;
  const listDays = [7, 30].includes(Number(params.dias)) ? Number(params.dias) : null;
  const view = params.vista === "lista" || listDays ? "lista" : "dia";
  const days = listDays ?? 7;
  const memberId = uuidSchema.safeParse(params.miembro).success ? (params.miembro as string) : null;
  const categoryId = uuidSchema.safeParse(params.categoria).success ? (params.categoria as string) : null;

  const gridFrom = monthGridStart(day);
  const filter = { memberId, categoryId };
  const [monthEvents, listEvents, members, categories] = await Promise.all([
    listEventsInRange(ctx.supabase, ctx.family.id, gridFrom, addDays(gridFrom, 41), filter),
    view === "lista"
      ? listEventsInRange(ctx.supabase, ctx.family.id, day, addDays(day, days - 1), { ...filter, includeCancelled: true })
      : Promise.resolve([]),
    listMembers(ctx.supabase, ctx.family.id),
    listCategories(ctx.supabase, ctx.family.id),
  ]);

  const hrefFor = (date: string) => {
    const q = new URLSearchParams({ dia: date });
    if (view === "lista") {
      q.set("vista", "lista");
      q.set("dias", String(days));
    }
    if (memberId) q.set("miembro", memberId);
    if (categoryId) q.set("categoria", categoryId);
    return `/agenda?${q.toString()}`;
  };

  return (
    <ClockProvider serverNow={now} timeZone={ctx.family.timezone} hourFormat={ctx.family.hourFormat}>
      {/* En el celular: calendario, día y filtros, en ese orden. En pantallas grandes el día ocupa la derecha. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[19rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-6">
        <aside aria-label="Calendario" className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
          <MiniMonth
            selected={day}
            today={today}
            events={monthEvents}
            homeColor={ctx.family.homeColor}
            hrefFor={hrefFor}
          />
          <AgendaViewToggle day={day} days={days} view={view} />
        </aside>
        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {view === "dia" ? (
            <DayPlanner
              date={day}
              events={monthEvents.filter((e) => e.localStartDate <= day && e.localEndDate >= day)}
              members={members}
              homeColor={ctx.family.homeColor}
              bounds={{ morningEnds: ctx.family.morningEnds, afternoonEnds: ctx.family.afternoonEnds }}
              prevHref={hrefFor(addDays(day, -1))}
              nextHref={hrefFor(addDays(day, 1))}
            />
          ) : (
            <AgendaList
              events={listEvents}
              from={day}
              days={days}
              today={today}
              timeZone={ctx.family.timezone}
              hourFormat={ctx.family.hourFormat}
              homeColor={ctx.family.homeColor}
            />
          )}
        </div>
        <section aria-label="Filtros" className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
          <AgendaFilters members={members} categories={categories} day={day} />
        </section>
      </div>
    </ClockProvider>
  );
}

export default function AgendaPage(props: PageProps<"/agenda">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agenda"
        description="Elige un día y toca una hora para agendar lo que no quieres olvidar."
        actions={
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/agenda/nuevo" />}>
            <CalendarPlus aria-hidden /> Nuevo evento
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-[40rem] rounded-2xl" />}>
        <Agenda searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
