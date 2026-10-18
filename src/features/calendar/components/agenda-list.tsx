import { CalendarSearch, MapPin } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

import type { AgendaEvent } from "../types";
import { eventTimeLabel } from "./event-time-label";
import { CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { ImportantMark } from "@/components/important-mark";
import { MemberStack } from "@/components/member-chip";
import { addDays, daysBetween, formatLongDateWithYear, type HourFormat, relativeDayLabel } from "@/lib/time/zoned";

export function AgendaList({
  events,
  from,
  days,
  today,
  timeZone,
  hourFormat,
  homeColor,
}: {
  events: AgendaEvent[];
  from: string;
  days: number;
  today: string;
  timeZone: string;
  hourFormat: HourFormat;
  homeColor: string;
}) {
  const year = Number(today.slice(0, 4));
  const groups = Array.from({ length: days }, (_, i) => addDays(from, i))
    .map((date) => ({
      date,
      events: events
        .filter((e) => e.localStartDate <= date && e.localEndDate >= date)
        .sort((a, b) => {
          if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
          return (a.startsAt ?? "").localeCompare(b.startsAt ?? "");
        }),
    }))
    .filter((g) => g.events.length > 0);

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={CalendarSearch}
        title="No hay eventos en este periodo"
        description="Prueba otro rango o quita los filtros."
      />
    );
  }

  return (
    <ol className="flex flex-col gap-6">
      {groups.map((group) => {
        const rel = relativeDayLabel(group.date, today);
        const isRel = Math.abs(daysBetween(today, group.date)) <= 1;
        return (
          <li key={group.date} className="flex flex-col gap-2">
            <h2 className={cn("text-sm font-semibold text-muted-foreground", group.date === today && "text-brand-strong")}>
              {isRel ? `${rel} · ` : ""}
              {formatLongDateWithYear(group.date, year)}
            </h2>
            <ul className="flex flex-col gap-2">
              {group.events.map((event) => {
                const accent = event.wholeFamily ? homeColor : (event.participants[0]?.color ?? "var(--border)");
                return (
                  <li key={`${group.date}-${event.id}`}>
                    <Link
                      href={`/agenda/${event.id}`}
                      className={cn(
                        "flex flex-col gap-2 rounded-xl border border-l-[3px] bg-card px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center",
                        event.status === "cancelled" && "opacity-60",
                      )}
                      style={{ borderLeftColor: accent }}
                    >
                      <span className="w-40 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                        {eventTimeLabel(event, timeZone, hourFormat)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 font-semibold">
                          <CategoryIcon icon={event.category?.icon} className="size-4 shrink-0 text-muted-foreground" />
                          <span className={cn(event.status === "cancelled" && "line-through")}>{event.title}</span>
                          {event.importance === "high" ? <ImportantMark /> : null}
                          {event.status === "cancelled" ? (
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">Cancelado</span>
                          ) : null}
                        </span>
                        {event.location ? (
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin aria-hidden className="size-3.5" /> {event.location}
                          </span>
                        ) : null}
                      </span>
                      <MemberStack members={event.participants} wholeFamily={event.wholeFamily} homeColor={homeColor} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
