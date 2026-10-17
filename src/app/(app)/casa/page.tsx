import { ClipboardPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import Loading from "../loading";
import { SnapshotSaver } from "@/components/pwa/snapshot-saver";
import { makeSnapshot } from "@/lib/pwa/snapshot";
import { ClockProvider } from "@/components/clock/clock-provider";
import { ContextClock } from "@/components/clock/context-clock";
import { Button } from "@/components/ui/button";
import { HighlightsPanel } from "@/features/calendar/components/highlights-panel";
import { ChildrenSummary } from "@/features/children/components/children-summary";
import { listMembers } from "@/features/families/queries";
import { listBalances } from "@/features/rewards/queries";
import { listChildTasks } from "@/features/tasks/child-queries";
import { TodayTimeline } from "@/features/calendar/components/today-timeline";
import { WeekRadar } from "@/features/calendar/components/week-radar";
import { listEventsInRange } from "@/features/calendar/queries";
import { HouseholdList } from "@/features/tasks/components/household-list";
import { QuickAddHousehold } from "@/features/tasks/components/quick-add-household";
import { ScreenNotices } from "@/features/notifications/components/screen-notices";
import { listNotifications } from "@/features/notifications/queries";
import { listHouseholdTasks } from "@/features/tasks/queries";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { requestNow } from "@/lib/time/request-now";
import { addDays, localDateOf, localToInstant } from "@/lib/time/zoned";

export const metadata: Metadata = { title: "Casa" };

async function HomeDashboard() {
  const ctx = await requireAdultWithFamily();
  const serverNow = await requestNow();
  const { family } = ctx;
  const today = localDateOf(serverNow, family.timezone);

  const [events, tasks, members, childTasks, balances, notifications] = await Promise.all([
    listEventsInRange(ctx.supabase, family.id, addDays(today, -1), addDays(today, 7)),
    listHouseholdTasks(ctx.supabase, family.id, {
      doneSince: localToInstant(today, "00:00", family.timezone),
      upTo: addDays(today, 7),
    }),
    listMembers(ctx.supabase, family.id),
    listChildTasks(ctx.supabase, family.id, { from: today, to: today }),
    listBalances(ctx.supabase, family.id),
    listNotifications(ctx.supabase, family.id, { since: new Date(serverNow - 36 * 3600_000).toISOString(), limit: 30 }),
  ]);

  return (
    <ClockProvider serverNow={serverNow} timeZone={family.timezone} hourFormat={family.hourFormat}>
      <SnapshotSaver snapshot={makeSnapshot({ actor: "adult", identity: ctx.user.id, family, label: "Casa", now: serverNow, events, tasks: [...tasks, ...childTasks], members })} />
      <ContextClock events={events} homeColor={family.homeColor} />
      <ScreenNotices notifications={notifications} recipient={`user:${ctx.user.id}`} actor="adult" />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <TodayTimeline
            events={events}
            tasks={tasks}
            bounds={{ morningEnds: family.morningEnds, afternoonEnds: family.afternoonEnds }}
            homeColor={family.homeColor}
            canEdit
          />
          <WeekRadar events={events} homeColor={family.homeColor} />
        </div>
        <div className="flex flex-col gap-6">
          <section
            aria-labelledby="pendientes-titulo"
            className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="pendientes-titulo" className="text-2xl font-bold">
                Pendientes de la casa
              </h2>
              <Button variant="ghost" nativeButton={false} render={<Link href="/pendientes" />}>
                Ver todos
              </Button>
            </div>
            <HouseholdList
              tasks={tasks}
              emptyAction={
                <Button variant="outline" nativeButton={false} render={<Link href="/pendientes/nuevo?volver=/casa" />}>
                  <ClipboardPlus aria-hidden /> Nuevo pendiente
                </Button>
              }
            />
            <QuickAddHousehold />
          </section>
          <ChildrenSummary
            kids={members.filter((m) => m.kind === "child")}
            tasks={childTasks}
            balances={Object.fromEntries(balances)}
            linkToDetail
          />
          <HighlightsPanel events={events} />
        </div>
      </div>
    </ClockProvider>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeDashboard />
    </Suspense>
  );
}
