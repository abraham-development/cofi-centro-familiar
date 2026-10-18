"use client";

import type { AgendaEvent } from "../types";
import { eventTimeLabel } from "./event-time-label";
import { CategoryIcon } from "@/components/category-icon";
import { useClock } from "@/components/clock/clock-provider";
import { Panel } from "@/components/panel";
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
    <Panel id="avisos-titulo" title="Importante" caption="Hoy y mañana">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada importante para hoy ni mañana.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((event) => (
            <li key={event.id} className="rounded-xl border-l-[3px] border-warning bg-warning/8 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CategoryIcon icon={event.category?.icon} className="size-3.5" />
                {relativeDayLabel(event.localStartDate < today ? today : event.localStartDate, today)} ·{" "}
                {eventTimeLabel(event, timeZone, hourFormat)}
              </p>
              <p className="mt-0.5 font-semibold">{event.title}</p>
              {event.description ? <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{event.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
