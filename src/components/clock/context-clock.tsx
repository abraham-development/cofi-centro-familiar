"use client";

import { CalendarClock, WifiOff } from "lucide-react";
import { cn } from "cn";

import { useClock } from "./clock-provider";
import { CategoryIcon } from "@/components/category-icon";
import { MemberStack } from "@/components/member-chip";
import { computeClockStatus } from "@/features/calendar/domain/clock-status";
import type { AgendaEvent } from "@/features/calendar/types";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  formatClockParts,
  formatDuration,
  formatInstantTime,
  formatLongDate,
  localDateOf,
  relativeDayLabel,
  zonedFromEpoch,
} from "@/lib/time/zoned";

/**
 * Cabecera con hora grande, fecha, actividad en curso y próximo evento con
 * cuenta regresiva. Se lee desde unos dos metros en modo casa.
 */
export function ContextClock({
  events,
  homeColor,
  variant = "home",
}: {
  events: AgendaEvent[];
  homeColor: string;
  variant?: "home" | "compact";
}) {
  const { now, timeZone, hourFormat } = useClock();
  const online = useOnlineStatus();
  const zdt = zonedFromEpoch(now, timeZone);
  const { time, period } = formatClockParts(zdt, hourFormat);
  const today = localDateOf(now, timeZone);
  const status = computeClockStatus(events, now, timeZone);
  const compact = variant === "compact";

  return (
    <section
      aria-label="Reloj y próximo evento"
      className={cn(
        "grid grid-cols-1 gap-4",
        compact ? "md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]",
      )}
    >
      <div className={cn("flex min-w-0 flex-col justify-between gap-4 rounded-2xl border bg-card", compact ? "p-4 sm:p-5" : "p-5 sm:p-6")}>
        <div>
          <p className={cn("font-medium text-muted-foreground", compact ? "text-sm" : "text-base sm:text-lg")}>
            {formatLongDate(zdt.toPlainDate())}
          </p>
          <p className="mt-2 flex items-baseline gap-2">
            <time
              dateTime={zdt.toString({ timeZoneName: "never" })}
              className={cn("figure", compact ? "text-5xl" : "text-7xl sm:text-8xl xl:text-[7.5rem]")}
            >
              {time}
            </time>
            {period ? (
              <span className={cn("font-medium text-muted-foreground", compact ? "text-xl" : "text-2xl sm:text-3xl")}>
                {period}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-col gap-2" aria-live="polite">
          {status.current.map((event) => (
            <div key={event.id} className="flex items-center gap-3 rounded-xl bg-brand-soft px-3 py-2.5">
              <span className="rounded-md bg-brand px-2 py-0.5 text-xs font-bold text-brand-foreground">Ahora</span>
              <p className="min-w-0 flex-1 truncate text-lg font-semibold">{event.title}</p>
              <MemberStack members={event.participants} wholeFamily={event.wholeFamily} homeColor={homeColor} />
            </div>
          ))}
          {status.allDayToday.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Hoy todo el día:{" "}
              <span className="font-semibold text-foreground">{status.allDayToday.map((e) => e.title).join(" · ")}</span>
            </p>
          ) : null}
          {!online ? (
            <p role="status" className="flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm font-medium">
              <WifiOff aria-hidden className="size-4" />
              Sin conexión: la hora sigue avanzando, pero los datos podrían haber cambiado.
            </p>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-col justify-between gap-6 rounded-2xl",
          status.next ? "bg-featured" : "border border-dashed bg-card",
          compact ? "p-4 sm:p-5" : "p-5 sm:p-6",
        )}
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3">
          <p className={cn("flex items-center gap-2 text-sm font-medium", status.next ? "text-featured-muted" : "text-muted-foreground")}>
            <CalendarClock aria-hidden className="size-4" /> Lo próximo
          </p>
          {status.next ? (
            <MemberStack members={status.next.participants} wholeFamily={status.next.wholeFamily} homeColor={homeColor} />
          ) : null}
        </div>
        {status.next ? (
          <div className="min-w-0">
            <p className={cn("figure", compact ? "text-3xl" : "text-4xl sm:text-5xl")}>En {formatDuration(status.msUntilNext!)}</p>
            <p className={cn("mt-3 flex min-w-0 items-center gap-2", compact ? "text-base" : "text-lg")}>
              <CategoryIcon icon={status.next.category?.icon} className="size-5 shrink-0" />
              <span className="truncate">
                <span className="font-semibold">{status.next.title}</span>
                <span className="text-featured-muted">
                  {" · "}
                  {status.next.localStartDate !== today ? `${relativeDayLabel(status.next.localStartDate, today)}, ` : ""}
                  {formatInstantTime(status.next.startsAt!, timeZone, hourFormat)}
                </span>
              </span>
            </p>
          </div>
        ) : (
          <p className={cn("text-muted-foreground", compact ? "text-base" : "text-lg")}>
            {status.current.length ? "Nada más agendado por ahora" : "Sin eventos próximos"}
          </p>
        )}
      </div>
    </section>
  );
}
