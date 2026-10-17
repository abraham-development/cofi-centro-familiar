import Link from "next/link";
import { Temporal } from "temporal-polyfill";
import { cn } from "cn";

import type { AgendaEvent } from "../types";
import { MONTHS, WEEKDAYS_SHORT } from "@/lib/time/zoned";

/** Vista mensual secundaria: resumen por día con enlace al detalle. */
export function MonthGrid({ events, month, today }: { events: AgendaEvent[]; month: string; today: string }) {
  const first = Temporal.PlainDate.from(`${month}-01`);
  const gridStart = first.subtract({ days: first.dayOfWeek - 1 });
  const cells = Array.from({ length: 42 }, (_, i) => gridStart.add({ days: i }).toString());

  return (
    <section aria-label={`${MONTHS[first.month - 1]} ${first.year}`} className="flex flex-col gap-3">
      <h2 className="text-2xl font-bold capitalize">
        {MONTHS[first.month - 1]} {first.year}
      </h2>
      <div className="grid grid-cols-7 gap-1 text-center text-sm font-semibold text-muted-foreground" aria-hidden>
        {WEEKDAYS_SHORT.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {cells.map((date) => {
          const inMonth = date.slice(0, 7) === month;
          const dayEvents = events.filter((e) => e.localStartDate <= date && e.localEndDate >= date);
          return (
            <li key={date}>
              <Link
                href={`/agenda?desde=${date}&dias=1`}
                aria-label={`${date}: ${dayEvents.length} eventos`}
                className={cn(
                  "flex min-h-24 flex-col gap-1 rounded-xl border p-1.5 text-left transition-colors hover:bg-muted/60",
                  !inMonth && "opacity-45",
                  date === today && "border-2 border-ring",
                )}
              >
                <span className="text-sm font-bold">{Number(date.slice(8))}</span>
                {dayEvents.slice(0, 2).map((e) => (
                  <span key={e.id} className="truncate rounded bg-muted px-1 text-xs font-medium">
                    {e.title}
                  </span>
                ))}
                {dayEvents.length > 2 ? (
                  <span className="text-xs font-semibold text-muted-foreground">+{dayEvents.length - 2}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
