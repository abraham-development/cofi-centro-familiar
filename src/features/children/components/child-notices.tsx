"use client";

import { Megaphone } from "lucide-react";

import { CategoryIcon } from "@/components/category-icon";
import { useClock } from "@/components/clock/clock-provider";
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
    <section aria-labelledby="avisos-hijo" className="flex flex-col gap-3 rounded-3xl border bg-card/60 p-5 shadow-sm sm:p-6">
      <h2 id="avisos-hijo" className="flex items-center gap-2 text-3xl font-bold">
        <Megaphone aria-hidden className="size-7" /> Avisos
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((e) => (
          <li key={e.id} className={e.importance === "high" ? "rounded-2xl bg-highlight/40 p-4" : "rounded-2xl border p-4"}>
            <p className="flex items-center gap-2 text-lg font-semibold">
              <CategoryIcon icon={e.category?.icon} className="size-5" />
              {relativeDayLabel(e.localStartDate < today ? today : e.localStartDate, today)} · {eventTimeLabel(e, timeZone, hourFormat)}
            </p>
            <p className="text-2xl font-bold">{e.title}</p>
            {e.description ? <p className="mt-1 text-xl">{e.description}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
