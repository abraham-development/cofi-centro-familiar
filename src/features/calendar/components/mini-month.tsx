import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Temporal } from "temporal-polyfill";
import { cn } from "cn";

import type { AgendaEvent } from "../types";
import { buttonVariants } from "@/components/ui/button";
import { type IsoDate, formatLongDate, MONTHS, WEEKDAYS_SHORT } from "@/lib/time/zoned";

/** Primer día (lunes) de la grilla de 6 semanas que contiene `date`. */
export function monthGridStart(date: IsoDate): IsoDate {
  const first = Temporal.PlainDate.from(date).with({ day: 1 });
  return first.subtract({ days: first.dayOfWeek - 1 }).toString();
}

/**
 * Calendario del mes para elegir el día. Cada día es un enlace (`?dia=`): se
 * renderiza en el servidor y conserva los filtros. Los puntos muestran, con el
 * color de cada participante, cuántas cosas hay agendadas ese día.
 */
export function MiniMonth({
  selected,
  today,
  events,
  homeColor,
  hrefFor,
}: {
  selected: IsoDate;
  today: IsoDate;
  events: AgendaEvent[];
  homeColor: string;
  hrefFor: (date: IsoDate) => string;
}) {
  const month = Temporal.PlainDate.from(selected).with({ day: 1 });
  const start = Temporal.PlainDate.from(monthGridStart(selected));
  const cells = Array.from({ length: 42 }, (_, i) => start.add({ days: i }).toString());
  // Al cambiar de mes se abre el día 1, o hoy si es el mes actual.
  const monthTarget = (m: Temporal.PlainDate) =>
    m.toString().slice(0, 7) === today.slice(0, 7) ? today : m.toString();
  const title = `${MONTHS[month.month - 1]} ${month.year}`;

  return (
    <section aria-labelledby="mes-titulo" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-1">
        <h2 id="mes-titulo" className="flex-1 text-base font-semibold whitespace-nowrap capitalize">
          {title}
        </h2>
        {selected !== today ? (
          <Link href={hrefFor(today)} scroll={false} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Hoy
          </Link>
        ) : null}
        <Link
          href={hrefFor(monthTarget(month.subtract({ months: 1 })))}
          scroll={false}
          aria-label="Mes anterior"
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <ChevronLeft aria-hidden />
        </Link>
        <Link
          href={hrefFor(monthTarget(month.add({ months: 1 })))}
          scroll={false}
          aria-label="Mes siguiente"
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <ChevronRight aria-hidden />
        </Link>
      </div>
      <div className="grid grid-cols-7 text-center text-[0.6875rem] font-medium text-muted-foreground" aria-hidden>
        {WEEKDAYS_SHORT.map((d) => (
          <span key={d}>{d.slice(0, 2)}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1" aria-label={`Días de ${title}`}>
        {cells.map((date) => {
          const inMonth = date.slice(0, 7) === month.toString().slice(0, 7);
          const isSelected = date === selected;
          const dayEvents = events.filter(
            (e) => e.status === "scheduled" && e.localStartDate <= date && e.localEndDate >= date,
          );
          const count = dayEvents.length;
          const label = `${formatLongDate(date)}${date === today ? " (hoy)" : ""}${
            count ? `: ${count} ${count === 1 ? "agendado" : "agendados"}` : ""
          }`;
          return (
            <li key={date}>
              <Link
                href={hrefFor(date)}
                scroll={false}
                aria-label={label}
                aria-current={isSelected ? "date" : undefined}
                className={cn(
                  "flex h-10 flex-col items-center justify-center gap-0.5 rounded-lg text-sm font-medium tabular-nums transition-colors pointer-coarse:h-11",
                  isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  !inMonth && !isSelected && "text-muted-foreground/60",
                  date === today && !isSelected && "font-bold text-brand-strong ring-1 ring-brand ring-inset",
                )}
              >
                <span>{Number(date.slice(8))}</span>
                <span className="flex h-1.5 gap-0.5" aria-hidden>
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={cn("size-1.5 rounded-full", isSelected && "ring-1 ring-primary-foreground")}
                      style={{
                        backgroundColor: e.wholeFamily ? homeColor : (e.participants[0]?.color ?? homeColor),
                      }}
                    />
                  ))}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
