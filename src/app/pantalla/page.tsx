import { Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { IdentityBadge, type World } from "@/components/app-shell/identity-badge";
import { Brand } from "@/components/brand";
import { Panel } from "@/components/panel";
import { buttonVariants } from "@/components/ui/button";
import { SnapshotSaver } from "@/components/pwa/snapshot-saver";
import { ScreenControls } from "@/components/pwa/screen-controls";
import { makeSnapshot } from "@/lib/pwa/snapshot";
import { ClockProvider } from "@/components/clock/clock-provider";
import { ContextClock } from "@/components/clock/context-clock";
import { Skeleton } from "@/components/ui/skeleton";
import { TodayTimeline } from "@/features/calendar/components/today-timeline";
import { WeekRadar } from "@/features/calendar/components/week-radar";
import { listEventsInRange } from "@/features/calendar/queries";
import { ChildScreen } from "@/features/children/components/child-screen";
import { ChildrenSummary } from "@/features/children/components/children-summary";
import { loadChildScreen } from "@/features/children/load-child-screen";
import { DeviceRuntime, RevokedDevice } from "@/features/devices/components/device-runtime";
import { listMembers } from "@/features/families/queries";
import { listBalances } from "@/features/rewards/queries";
import { listChildTasks } from "@/features/tasks/child-queries";
import { HouseholdList } from "@/features/tasks/components/household-list";
import { ScreenNotices } from "@/features/notifications/components/screen-notices";
import { listNotifications } from "@/features/notifications/queries";
import { listHouseholdTasks } from "@/features/tasks/queries";
import { getDeviceContext } from "@/lib/auth/device";
import { requestNow } from "@/lib/time/request-now";
import { addDays, localDateOf, localToInstant } from "@/lib/time/zoned";

export const metadata: Metadata = { title: "Pantalla" };

async function DeviceScreen() {
  const ctx = await getDeviceContext();
  if (ctx.status === "revoked") return <RevokedDevice />;
  if (ctx.status !== "paired") redirect("/vincular");

  const { device, family, supabase } = ctx;
  const now = await requestNow();
  const today = localDateOf(now, family.timezone);
  const members = await listMembers(supabase, family.id);

  if (device.scope === "child") {
    const member = members.find((m) => m.id === device.memberId);
    if (!member) return <RevokedDevice />;
    const data = await loadChildScreen(supabase, family, member, now);
    return (
      <>
        <SnapshotSaver snapshot={makeSnapshot({ actor: "device", identity: ctx.identity, family, label: member.displayName, now, events: data.events, tasks: data.tasks, members })} />
        <DeviceBar
          name={device.name}
          identity={{ world: "child", name: member.displayName, avatar: member, accentColor: member.color }}
        >
          <DeviceRuntime topics={[`member:${member.id}`, `fam:${family.id}:screens`, `device:${device.id}`]} />
        </DeviceBar>
        <ScreenControls preferenceId={device.id} timezone={family.timezone} quietStart={family.quietStart} quietEnd={family.quietEnd} hourFormat={family.hourFormat} serverNow={now} />
        <ChildScreen
          member={member}
          data={data}
          serverNow={now}
          timeZone={family.timezone}
          hourFormat={family.hourFormat}
          homeColor={family.homeColor}
          actor="device"
          recipient={`device:${device.id}`}
        />
      </>
    );
  }

  const kids = members.filter((m) => m.kind === "child");
  const [events, tasks, childTasks, balances, notifications] = await Promise.all([
    listEventsInRange(supabase, family.id, addDays(today, -1), addDays(today, 7)),
    listHouseholdTasks(supabase, family.id, {
      doneSince: localToInstant(today, "00:00", family.timezone),
      upTo: addDays(today, 7),
    }),
    listChildTasks(supabase, family.id, { from: today, to: today }),
    listBalances(supabase, family.id),
    listNotifications(supabase, family.id, { since: new Date(now - 36 * 3600_000).toISOString(), limit: 30 }),
  ]);

  return (
    <>
      <SnapshotSaver snapshot={makeSnapshot({ actor: "device", identity: ctx.identity, family, label: device.name, now, events, tasks: [...tasks, ...childTasks], members })} />
      <DeviceBar name={device.name} identity={{ world: "home", name: device.name }}>
        <DeviceRuntime topics={[`fam:${family.id}:screens`, `device:${device.id}`]} />
      </DeviceBar>
      <ScreenControls preferenceId={device.id} timezone={family.timezone} quietStart={family.quietStart} quietEnd={family.quietEnd} hourFormat={family.hourFormat} serverNow={now} />
      <ClockProvider serverNow={now} timeZone={family.timezone} hourFormat={family.hourFormat}>
        <ContextClock events={events} homeColor={family.homeColor} />
        <ScreenNotices notifications={notifications} recipient={`device:${device.id}`} actor="device" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
            <TodayTimeline
              events={events}
              tasks={tasks}
              bounds={{ morningEnds: family.morningEnds, afternoonEnds: family.afternoonEnds }}
              homeColor={family.homeColor}
              canEdit={false}
            />
            <WeekRadar events={events} homeColor={family.homeColor} />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <Panel id="pendientes-casa" title="Pendientes de hoy" caption="Toca la casilla cuando esté hecho">
              <HouseholdList tasks={tasks} actor="device" />
            </Panel>
            <ChildrenSummary kids={kids} tasks={childTasks} balances={Object.fromEntries(balances)} linkToDetail={false} />
          </div>
        </div>
      </ClockProvider>
    </>
  );
}

type DeviceIdentity = {
  world: World;
  name: string;
  avatar?: { displayName: string; color: string; initials: string; avatarEmoji: string | null };
  accentColor?: string;
};

function DeviceBar({ name, identity, children }: { name: string; identity: DeviceIdentity; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {identity.world === "child" && identity.accentColor ? (
        // Acento del mundo del hijo: franja con su color.
        <div aria-hidden className="h-1.5 w-full rounded-full" style={{ backgroundColor: identity.accentColor }} />
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <Brand />
          {identity.world === "child" ? (
            <span className="hidden text-muted-foreground sm:inline">· {name}</span>
          ) : null}
        </span>
        <span className="flex items-center gap-2">
          <IdentityBadge
            world={identity.world}
            name={identity.name}
            avatar={identity.avatar}
            accentColor={identity.accentColor}
            detail={identity.world === "child" ? `Pantalla «${name}»` : undefined}
          />
          {children}
          <Link
            href="/acceso?next=/casa"
            className={buttonVariants({ variant: "outline" })}
          >
            <Settings aria-hidden /> <span className="hidden sm:inline">Administrar</span>
            <span className="sr-only sm:hidden">Administrar</span>
          </Link>
        </span>
      </div>
    </div>
  );
}

export default function DevicePage() {
  return (
    <main className="mx-auto flex w-full max-w-[110rem] flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
      <Suspense fallback={<Skeleton className="h-[80svh] rounded-2xl" />}>
        <DeviceScreen />
      </Suspense>
    </main>
  );
}
