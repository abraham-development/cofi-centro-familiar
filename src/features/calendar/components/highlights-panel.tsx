"use client";

import { BellRing } from "lucide-react";

import type { AgendaEvent } from "../types";
import { eventTimeLabel } from "./event-time-label";
import { CategoryIcon } from "@/components/category-icon";
import { useClock } from "@/components/clock/clock-provider";
import { addDays, epochFromIso, localDateOf, relativeDayLabel } from "@/lib/time/zoned";

/**
 * Avisos destacados: eventos importantes de hoy y mañana, con sus
 * indicaciones de preparación. Los avisos persistentes del servidor se suman
 * en el hito C.
 */
export function HighlightsPanel({ events }: { events: AgendaEvent[] }) {
  const { now, timeZone, hourFormat } = useClock();
  const today = localDateOf(now, timeZone);
  const tomorrow = addDays(today, 1);
  const items = events
    .filter(
      (e) =>
        e.status === "scheduled" &&
        e.importance === "high" &&
        e.localEndDate >= today &&
        e.localStartDate <= tomorrow &&
        (e.isAllDay || !e.endsAt || epochFromIso(e.endsAt) > now),
    )
    .slice(0, 4);

  return (
    <section aria-labelledby="avisos-titulo" className="flex flex-col gap-3 rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
      <h2 id="avisos-titulo" className="flex items-center gap-2 text-2xl font-bold">
        <BellRing aria-hidden className="size-6" /> Importante
      </h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground">Nada importante para hoy ni mañana.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((event) => (
            <li key={event.id} className="rounded-2xl bg-highlight/30 px-4 py-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <CategoryIcon icon={event.category?.icon} />
                {relativeDayLabel(event.localStartDate < today ? today : event.localStartDate, today)} ·{" "}
                {eventTimeLabel(event, timeZone, hourFormat)}
              </p>
              <p className="text-lg font-bold">{event.title}</p>
              {event.description ? <p className="mt-1 whitespace-pre-line">{event.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
