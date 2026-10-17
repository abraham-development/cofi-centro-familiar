"use client";

import Link from "next/link";
import { cn } from "cn";

import { buildRadar } from "../domain/radar";
import type { AgendaEvent } from "../types";
import { CategoryIcon } from "@/components/category-icon";
import { useClock } from "@/components/clock/clock-provider";
import { MemberStack } from "@/components/member-chip";
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
    <section aria-labelledby="radar-titulo" className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <h2 id="radar-titulo" className="text-2xl font-bold">
          Próximos 7 días
        </h2>
        <Link href="/agenda" className="font-semibold underline-offset-4 hover:underline">
          Ver agenda
        </Link>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {days.map((day) => {
          const heading = dayHeading(day.date, today);
          return (
            <li
              key={day.date}
              className={cn("flex flex-col gap-2 rounded-2xl border p-3", day.isToday && "border-2 border-ring")}
            >
              <h3 className="leading-tight">
                <span className="block text-lg font-bold">{heading.title}</span>
                <span className="text-sm text-muted-foreground">{heading.subtitle}</span>
              </h3>
              {day.total === 0 ? (
                <p className="text-sm text-muted-foreground">Sin eventos</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {day.visible.map((event) => (
                    <li key={event.id} className="flex flex-col gap-0.5">
                      <p className="flex items-center gap-1 text-sm font-semibold text-muted-foreground tabular-nums">
                        <CategoryIcon icon={event.category?.icon} className="size-3.5" />
                        {event.isAllDay ? "Todo el día" : formatInstantTime(event.startsAt!, timeZone, hourFormat)}
                      </p>
                      <p className="font-semibold leading-snug">
                        {event.title}
                        {event.importance === "high" ? <span aria-label="importante"> ⭐</span> : null}
                      </p>
                      <MemberStack members={event.participants} wholeFamily={event.wholeFamily} homeColor={homeColor} max={3} />
                    </li>
                  ))}
                </ul>
              )}
              {day.hiddenCount > 0 ? (
                <Link
                  href={`/agenda?desde=${day.date}&dias=1`}
                  className="mt-auto text-sm font-semibold underline-offset-4 hover:underline"
                >
                  +{day.hiddenCount} más
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
