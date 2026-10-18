import { ArrowUpRight, CalendarDays, ClipboardList, ClipboardPlus, Coins, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import Loading from "../loading";
import { SnapshotSaver } from "@/components/pwa/snapshot-saver";
import { makeSnapshot } from "@/lib/pwa/snapshot";
import { ClockProvider } from "@/components/clock/clock-provider";
import { ContextClock } from "@/components/clock/context-clock";
import { Meter } from "@/components/meter";
import { Panel } from "@/components/panel";
import { Stat } from "@/components/stat";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { dailyProgress } from "@/features/tasks/domain/child-tasks";
import { householdUrgency } from "@/features/tasks/domain/household";
import { listHouseholdTasks } from "@/features/tasks/queries";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { requestNow } from "@/lib/time/request-now";
import { addDays, epochFromIso, localDateOf, localToInstant } from "@/lib/time/zoned";

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

  // Cifras del día (se recalculan con cada actualización en vivo).
  const todayEvents = events.filter((e) => e.status === "scheduled" && e.localStartDate <= today && e.localEndDate >= today);
  const comingToday = todayEvents.filter((e) => !e.isAllDay && e.startsAt && epochFromIso(e.startsAt) > serverNow).length;
  const openToday = tasks.filter((t) => t.status === "pending" && ["overdue", "today"].includes(householdUrgency(t, today, serverNow)));
  const overdue = openToday.filter((t) => householdUrgency(t, today, serverNow) === "overdue").length;
  const kids = members.filter((m) => m.kind === "child");
  const kidsProgress = dailyProgress(childTasks, today);
  const points = kids.reduce((sum, k) => sum + (balances.get(k.id) ?? 0), 0);

  return (
    <ClockProvider serverNow={serverNow} timeZone={family.timezone} hourFormat={family.hourFormat}>
      <SnapshotSaver snapshot={makeSnapshot({ actor: "adult", identity: ctx.user.id, family, label: "Casa", now: serverNow, events, tasks: [...tasks, ...childTasks], members })} />
      <ContextClock events={events} homeColor={family.homeColor} />
      <ScreenNotices notifications={notifications} recipient={`user:${ctx.user.id}`} actor="adult" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          href="/agenda"
          icon={<CalendarDays aria-hidden className="size-4" />}
          label="Agendado hoy"
          value={todayEvents.length}
          note={comingToday ? `${comingToday} por venir` : "Nada más por hoy"}
        />
        <Stat
          href="/pendientes"
          icon={<ClipboardList aria-hidden className="size-4" />}
          label="Pendientes del día"
          value={openToday.length}
          note={overdue ? `${overdue} ${overdue === 1 ? "atrasado" : "atrasados"}` : "Todo al día"}
        />
        <Stat
          href="/responsabilidades"
          icon={<ListChecks aria-hidden className="size-4" />}
          label="Tareas de los hijos"
          value={kidsProgress.done}
          unit={`de ${kidsProgress.total}`}
        >
          <Meter value={kidsProgress.done} max={kidsProgress.total} label="Tareas de los hijos cumplidas hoy" />
        </Stat>
        <Stat
          href="/premios"
          icon={<Coins aria-hidden className="size-4" />}
          label="Puntos de los hijos"
          value={points}
          unit="pts"
          note={kids.map((k) => `${k.displayName} ${balances.get(k.id) ?? 0}`).join(" · ") || "Sin hijos registrados"}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <TodayTimeline
            events={events}
            tasks={tasks}
            bounds={{ morningEnds: family.morningEnds, afternoonEnds: family.afternoonEnds }}
            homeColor={family.homeColor}
            canEdit
          />
          <WeekRadar events={events} homeColor={family.homeColor} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            id="pendientes-titulo"
            title="Pendientes de hoy"
            caption="Lo del día a día"
            actions={
              <Link href="/pendientes" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Ver todos <ArrowUpRight aria-hidden />
              </Link>
            }
          >
            <HouseholdList
              tasks={tasks}
              emptyAction={
                <Button variant="outline" nativeButton={false} render={<Link href="/pendientes/nuevo?volver=/casa" />}>
                  <ClipboardPlus aria-hidden /> Nuevo pendiente
                </Button>
              }
            />
            <QuickAddHousehold />
          </Panel>
          <ChildrenSummary
            kids={kids}
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
