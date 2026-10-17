"use client";

import { CalendarClock, CircleDot, WifiOff } from "lucide-react";
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
        "flex flex-col gap-4 rounded-3xl border bg-card shadow-sm",
        compact ? "p-4 sm:flex-row sm:items-center sm:justify-between" : "p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:gap-8",
      )}
    >
      <div className="flex flex-col">
        <p
          className={cn("font-semibold text-muted-foreground", compact ? "text-base" : "text-xl sm:text-2xl")}
         
        >
          {formatLongDate(zdt.toPlainDate())}
        </p>
        <p className="flex items-baseline gap-2 font-heading font-extrabold leading-none tracking-tight tabular-nums">
          <time
            dateTime={zdt.toString({ timeZoneName: "never" })}
            className={compact ? "text-5xl" : "text-7xl sm:text-8xl xl:text-9xl"}
           
          >
            {time}
          </time>
          {period ? (
            <span className={compact ? "text-2xl" : "text-3xl sm:text-4xl"}>
              {period}
            </span>
          ) : null}
        </p>
      </div>

      <div className={cn("flex min-w-0 flex-col gap-3", compact ? "" : "lg:max-w-xl lg:flex-1")} aria-live="polite">
        {status.current.map((event) => (
          <div key={event.id} className="flex items-center gap-3 rounded-2xl bg-highlight/70 px-4 py-3 text-highlight-foreground">
            <CircleDot aria-hidden className="size-6 shrink-0 motion-safe:animate-pulse" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold uppercase tracking-wide">Ahora</p>
              <p className="truncate text-xl font-bold sm:text-2xl">{event.title}</p>
            </div>
            <MemberStack members={event.participants} wholeFamily={event.wholeFamily} homeColor={homeColor} />
          </div>
        ))}

        {status.next ? (
          <div className="flex items-center gap-3 rounded-2xl border-2 px-4 py-3" style={{ borderColor: "var(--ring)" }}>
            <CalendarClock aria-hidden className="size-7 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className={cn("font-bold", compact ? "text-lg" : "text-xl sm:text-2xl")}>
                En {formatDuration(status.msUntilNext!)}
              </p>
              <p className="flex items-center gap-1.5 truncate text-lg text-muted-foreground">
                <CategoryIcon icon={status.next.category?.icon} className="size-5 shrink-0" />
                <span className="truncate">
                  <span className="font-semibold text-foreground">{status.next.title}</span>
                  {" · "}
                  {status.next.localStartDate !== today ? `${relativeDayLabel(status.next.localStartDate, today)}, ` : ""}
                  {formatInstantTime(status.next.startsAt!, timeZone, hourFormat)}
                </span>
              </p>
            </div>
            <MemberStack members={status.next.participants} wholeFamily={status.next.wholeFamily} homeColor={homeColor} />
          </div>
        ) : status.current.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-3 text-lg text-muted-foreground">
            Sin eventos próximos
          </p>
        ) : null}

        {status.allDayToday.length > 0 ? (
          <p className="text-base text-muted-foreground">
            Hoy todo el día: <span className="font-semibold text-foreground">{status.allDayToday.map((e) => e.title).join(" · ")}</span>
          </p>
        ) : null}

        {!online ? (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-warning/15 px-3 py-2 font-medium text-foreground">
            <WifiOff aria-hidden className="size-5" />
            Sin conexión: la hora sigue avanzando, pero los datos podrían haber cambiado.
          </p>
        ) : null}
      </div>
    </section>
  );
}
