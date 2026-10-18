"use client";


import { CategoryIcon } from "@/components/category-icon";
import { useClock } from "@/components/clock/clock-provider";
import { Panel } from "@/components/panel";
import { eventTimeLabel } from "@/features/calendar/components/event-time-label";
import type { AgendaEvent } from "@/features/calendar/types";
import { addDays, epochFromIso, localDateOf, relativeDayLabel } from "@/lib/time/zoned";

/** Avisos del hijo: visitas, exámenes y preparativos de hoy y mañana. */
export function ChildNotices({ events }: { events: AgendaEvent[] }) {
  const { now, timeZone, hourFormat } = useClock();
  const today = localDateOf(now, timeZone);
  const tomorrow = addDays(today, 1);
  const items = events
    .filter(
      (e) =>
        e.status === "scheduled" &&
        e.localEndDate >= today &&
        e.localStartDate <= tomorrow &&
        (e.isAllDay || !e.endsAt || epochFromIso(e.endsAt) > now),
    )
    .sort((a, b) => (a.importance === b.importance ? 0 : a.importance === "high" ? -1 : 1));
  if (items.length === 0) return null;
  return (
    <Panel id="avisos-hijo" size="lg" title="Avisos" caption="Lo que viene hoy y mañana">
      <ul className="flex flex-col gap-3">
        {items.map((e) => (
          <li key={e.id} className={e.importance === "high" ? "rounded-xl border-l-4 border-warning bg-warning/10 p-4" : "rounded-xl bg-muted/60 p-4"}>
            <p className="flex items-center gap-2 text-base font-medium text-muted-foreground">
              <CategoryIcon icon={e.category?.icon} className="size-5" />
              {relativeDayLabel(e.localStartDate < today ? today : e.localStartDate, today)} · {eventTimeLabel(e, timeZone, hourFormat)}
            </p>
            <p className="mt-1 text-2xl font-semibold">{e.title}</p>
            {e.description ? <p className="mt-1 text-xl">{e.description}</p> : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
