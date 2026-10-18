"use client";

import { CalendarPlus, CheckSquare, Moon, Sun, Sunrise } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

import { buildDayTimeline, DAY_PART_LABELS, type DayPart, dayPartForMinutes } from "../domain/timeline";
import type { AgendaEvent } from "../types";
import { eventTimeLabel } from "./event-time-label";
import { CategoryIcon } from "@/components/category-icon";
import { useClock } from "@/components/clock/clock-provider";
import { MemberStack } from "@/components/member-chip";
import { ImportantMark } from "@/components/important-mark";
import { Panel } from "@/components/panel";
import { buttonVariants } from "@/components/ui/button";
import type { HouseholdTask } from "@/features/tasks/types";
import {
  epochFromIso,
  formatLocalTime,
  localDateOf,
  minutesOfDay,
  parseTimeToMinutes,
  zonedFromEpoch,
} from "@/lib/time/zoned";

const PART_ICONS = { morning: Sunrise, afternoon: Sun, evening: Moon } as const;

type Item =
  | { kind: "event"; key: string; minutes: number; event: AgendaEvent; fromYesterday: boolean; untilTomorrow: boolean }
  | { kind: "task"; key: string; minutes: number; task: HouseholdTask };

export function TodayTimeline({
  events,
  tasks,
  bounds,
  homeColor,
  canEdit,
}: {
  events: AgendaEvent[];
  tasks: HouseholdTask[];
  bounds: { morningEnds: string; afternoonEnds: string };
  homeColor: string;
  canEdit: boolean;
}) {
  const { now, timeZone, hourFormat } = useClock();
  const today = localDateOf(now, timeZone);
  const nowMinutes = minutesOfDay(zonedFromEpoch(now, timeZone));
  const currentPart = dayPartForMinutes(nowMinutes, bounds);
  const timeline = buildDayTimeline(events, today, timeZone, bounds);

  const parts: Record<DayPart, Item[]> = { morning: [], afternoon: [], evening: [] };
  for (const part of Object.keys(parts) as DayPart[]) {
    parts[part] = timeline.parts[part].map((e) => ({
      kind: "event" as const,
      key: `e-${e.event.id}`,
      minutes: e.startMinutes,
      event: e.event,
      fromYesterday: e.continuesFromPreviousDay,
      untilTomorrow: e.continuesNextDay,
    }));
  }
  for (const task of tasks) {
    if (task.status !== "pending" || task.dueDate !== today || !task.dueTime) continue;
    const minutes = parseTimeToMinutes(task.dueTime);
    parts[dayPartForMinutes(minutes, bounds)].push({ kind: "task", key: `t-${task.id}`, minutes, task });
  }
  for (const list of Object.values(parts)) list.sort((a, b) => a.minutes - b.minutes);

  const isEmpty = timeline.total === 0 && Object.values(parts).every((l) => l.length === 0);

  return (
    <Panel
      id="hoy-titulo"
      title="Hoy paso a paso"
      caption="Mañana, tarde y noche"
      actions={
        canEdit ? (
          <Link href={`/agenda/nuevo?fecha=${today}&volver=/casa`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <CalendarPlus aria-hidden /> Evento
          </Link>
        ) : null
      }
    >

      {timeline.allDay.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Todo el día">
          {timeline.allDay.map((event) => (
            <li key={event.id} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold">
              <CategoryIcon icon={event.category?.icon} className="size-4" />
              {event.title}
              <span className="font-normal text-muted-foreground">· todo el día</span>
            </li>
          ))}
        </ul>
      ) : null}

      {isEmpty ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-muted-foreground">
          Nada programado para hoy.
        </p>
      ) : (
        <ol className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {(Object.keys(parts) as DayPart[]).map((part) => {
            const Icon = PART_ICONS[part];
            const items = parts[part];
            const isCurrent = part === currentPart;
            return (
              <li
                key={part}
                aria-current={isCurrent ? "time" : undefined}
                className={cn(
                  "flex flex-col gap-3 rounded-xl p-3",
                  isCurrent ? "bg-brand-soft ring-1 ring-brand/40 ring-inset" : "bg-muted/60",
                )}
              >
                <h3 className="flex items-center gap-2 font-semibold">
                  <Icon aria-hidden className="size-4 text-muted-foreground" />
                  {DAY_PART_LABELS[part]}
                  {isCurrent ? (
                    <span className="ml-auto rounded-md bg-brand px-1.5 py-0.5 text-[0.6875rem] font-bold text-brand-foreground">
                      Ahora
                    </span>
                  ) : null}
                </h3>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Libre</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {items.map((item) =>
                      item.kind === "event" ? (
                        <TimelineEvent
                          key={item.key}
                          event={item.event}
                          past={
                            !item.untilTomorrow &&
                            (item.event.endsAt
                              ? epochFromIso(item.event.endsAt) <= now
                              : epochFromIso(item.event.startsAt!) + 15 * 60_000 <= now)
                          }
                          fromYesterday={item.fromYesterday}
                          untilTomorrow={item.untilTomorrow}
                          timeLabel={eventTimeLabel(item.event, timeZone, hourFormat)}
                          homeColor={homeColor}
                        />
                      ) : (
                        <li
                          key={item.key}
                          className="flex items-center gap-2 rounded-lg border border-dashed bg-card px-3 py-2"
                        >
                          <CheckSquare aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">
                              Pendiente · {formatLocalTime(item.task.dueTime!, hourFormat)}
                            </p>
                            <p className="truncate text-sm font-semibold">{item.task.title}</p>
                          </div>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function TimelineEvent({
  event,
  past,
  fromYesterday,
  untilTomorrow,
  timeLabel,
  homeColor,
}: {
  event: AgendaEvent;
  past: boolean;
  fromYesterday: boolean;
  untilTomorrow: boolean;
  timeLabel: string;
  homeColor: string;
}) {
  const accent = event.wholeFamily ? homeColor : (event.participants[0]?.color ?? "var(--border)");
  return (
    <li
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-l-[3px] bg-card px-3 py-2",
        past && "opacity-60",
      )}
      style={{ borderLeftColor: accent }}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground tabular-nums">
        <CategoryIcon icon={event.category?.icon} className="size-3.5" />
        {fromYesterday ? "Desde ayer · " : ""}
        {timeLabel}
        {untilTomorrow ? " · termina mañana" : ""}
      </p>
      <p className="leading-tight font-semibold">
        {event.title}
        {event.importance === "high" ? <ImportantMark className="ml-1 align-[-2px]" /> : null}
      </p>
      <div className="flex items-center justify-between gap-2">
        {event.location ? <p className="truncate text-xs text-muted-foreground">{event.location}</p> : <span />}
        <MemberStack members={event.participants} wholeFamily={event.wholeFamily} homeColor={homeColor} />
      </div>
    </li>
  );
}
