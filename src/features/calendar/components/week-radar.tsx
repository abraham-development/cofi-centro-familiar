"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

import { buildRadar } from "../domain/radar";
import type { AgendaEvent } from "../types";
import { CategoryIcon } from "@/components/category-icon";
import { useClock } from "@/components/clock/clock-provider";
import { ImportantMark } from "@/components/important-mark";
import { MemberStack } from "@/components/member-chip";
import { Panel } from "@/components/panel";
import { buttonVariants } from "@/components/ui/button";
import { formatInstantTime, formatShortDate, localDateOf, relativeDayLabel, WEEKDAYS } from "@/lib/time/zoned";
import { Temporal } from "temporal-polyfill";

function dayHeading(date: string, today: string): { title: string; subtitle: string } {
  const rel = relativeDayLabel(date, today);
  const weekday = WEEKDAYS[Temporal.PlainDate.from(date).dayOfWeek - 1];
  if (rel === "Hoy" || rel === "Mañana") return { title: rel, subtitle: `${weekday} ${formatShortDate(date)}` };
  return { title: weekday.charAt(0).toUpperCase() + weekday.slice(1), subtitle: formatShortDate(date) };
}

/** Radar de los próximos siete días: día, hora y participantes. */
export function WeekRadar({ events, homeColor }: { events: AgendaEvent[]; homeColor: string }) {
  const { now, timeZone, hourFormat } = useClock();
  const today = localDateOf(now, timeZone);
  const days = buildRadar(events, today, { days: 7, maxPerDay: 4 });

  return (
    <Panel
      id="radar-titulo"
      title="Próximos 7 días"
      caption="Lo que viene en la semana"
      actions={
        <Link href="/agenda" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Ver agenda <ArrowUpRight aria-hidden />
        </Link>
      }
    >
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {days.map((day) => {
          const heading = dayHeading(day.date, today);
          return (
            <li
              key={day.date}
              className={cn(
                "flex flex-col gap-3 rounded-xl p-3",
                day.isToday ? "bg-brand-soft ring-1 ring-brand/40 ring-inset" : "bg-muted/60",
              )}
            >
              <h3 className="flex items-baseline justify-between gap-2 leading-tight">
                <span className="font-semibold">{heading.title}</span>
                <span className="text-xs text-muted-foreground">{heading.subtitle}</span>
              </h3>
              {day.total === 0 ? (
                <p className="text-sm text-muted-foreground">Sin eventos</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {day.visible.map((event) => (
                    <li key={event.id} className="flex flex-col gap-1">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground tabular-nums">
                        <CategoryIcon icon={event.category?.icon} className="size-3.5" />
                        {event.isAllDay ? "Todo el día" : formatInstantTime(event.startsAt!, timeZone, hourFormat)}
                      </p>
                      <p className="text-sm leading-snug font-semibold">
                        {event.title}
                        {event.importance === "high" ? <ImportantMark className="ml-1 align-[-2px]" /> : null}
                      </p>
                      <MemberStack members={event.participants} wholeFamily={event.wholeFamily} homeColor={homeColor} max={3} />
                    </li>
                  ))}
                </ul>
              )}
              {day.hiddenCount > 0 ? (
                <Link
                  href={`/agenda?dia=${day.date}`}
                  className="mt-auto text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  +{day.hiddenCount} más
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
