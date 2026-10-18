"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "cn";

import { type DayBlock, hourRange, layoutDayEvents } from "../domain/day-layout";
import { DAY_PART_LABELS, type DayPartBounds, dayPartForMinutes } from "../domain/timeline";
import type { AgendaEvent, MemberSummary } from "../types";
import { eventTimeLabel } from "./event-time-label";
import { QuickScheduleDialog } from "./quick-schedule-dialog";
import { CategoryIcon } from "@/components/category-icon";
import { useClock } from "@/components/clock/clock-provider";
import { ImportantMark } from "@/components/important-mark";
import { MemberStack } from "@/components/member-chip";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  formatHourShort,
  formatLocalTime,
  formatLongDate,
  localDateOf,
  minutesOfDay,
  relativeDayLabel,
  zonedFromEpoch,
} from "@/lib/time/zoned";

/** Alto de una hora en la grilla (px). */
const HOUR_PX = 64;

function hhmm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * El día elegido, por horas. Cada hora libre se toca para agendar algo; lo
 * agendado se ve como bloques del color de sus participantes.
 */
export function DayPlanner({
  date,
  events,
  members,
  homeColor,
  bounds,
  prevHref,
  nextHref,
}: {
  date: string;
  events: AgendaEvent[];
  members: MemberSummary[];
  homeColor: string;
  bounds: DayPartBounds;
  prevHref: string;
  nextHref: string;
}) {
  const { now, timeZone, hourFormat } = useClock();
  const today = localDateOf(now, timeZone);
  const nowMin = minutesOfDay(zonedFromEpoch(now, timeZone));
  const isToday = date === today;
  const isPast = date < today;
  const layout = layoutDayEvents(events, date, timeZone);
  // Hoy, la grilla incluye siempre la hora actual (p. ej., de madrugada).
  const range = hourRange(layout.blocks, { from: isToday ? Math.min(6, Math.floor(nowMin / 60)) : 6, to: 24 });
  const hours = Array.from({ length: range.to - range.from }, (_, i) => range.from + i);
  const total = layout.allDay.length + layout.blocks.length;
  const [slot, setSlot] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstStart = layout.blocks[0]?.startMin ?? null;

  // Al abrir el día, la grilla (desplazable en pantallas grandes) muestra lo relevante:
  // la hora actual, lo primero agendado o el inicio de la mañana. Solo una vez por día:
  // una actualización en vivo no debe mover la grilla mientras alguien la recorre.
  const scrolledFor = useRef<string | null>(null);
  // Antes de pintar, para que el salto a la hora relevante no se vea ni mueva lo que se va a tocar.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || scrolledFor.current === date || el.scrollHeight <= el.clientHeight) return;
    scrolledFor.current = date;
    const target = isToday
      ? minutesOfDay(zonedFromEpoch(Date.now(), timeZone)) - 60
      : firstStart !== null
        ? firstStart - 30
        : 8 * 60;
    el.scrollTop = Math.max(0, ((target - range.from * 60) * HOUR_PX) / 60);
  }, [date, isToday, firstStart, range.from, timeZone]);

  // Primera hora en que se puede agendar (hoy no se agenda en horas ya pasadas).
  const earliest = isToday ? Math.ceil((nowMin + 1) / 15) * 15 : 0;
  const canAddAt = (hour: number) => !isPast && (hour + 1) * 60 > earliest;
  const openAt = (minutes: number) => setSlot(hhmm(Math.min(Math.max(minutes, earliest), 23 * 60 + 55)));
  const defaultStart = isToday ? Math.ceil(nowMin / 60) * 60 : 9 * 60;
  const rel = relativeDayLabel(date, today);

  const partStarts = new Map<number, string>();
  for (const hour of hours) {
    const part = dayPartForMinutes(hour * 60, bounds);
    if (hour === range.from || dayPartForMinutes((hour - 1) * 60, bounds) !== part) {
      partStarts.set(hour, DAY_PART_LABELS[part]);
    }
  }

  return (
    <section aria-labelledby="dia-titulo" className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          {rel !== formatLongDate(date) ? (
            <p className={cn("text-[0.8125rem] font-semibold", isToday ? "text-brand-strong" : "text-muted-foreground")}>
              {rel}
            </p>
          ) : null}
          <h2 id="dia-titulo" className="text-xl font-semibold sm:text-2xl">
            {formatLongDate(date)}
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            {total === 0 ? "Nada agendado todavía" : `${total} ${total === 1 ? "agendado" : "agendados"}`}
            {isPast ? " · este día ya pasó" : ""}
          </p>
        </div>
        <div className="flex flex-1 items-center gap-1 sm:flex-none">
          <Link href={prevHref} scroll={false} aria-label="Día anterior" className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronLeft aria-hidden />
          </Link>
          <Link href={nextHref} scroll={false} aria-label="Día siguiente" className={buttonVariants({ variant: "outline", size: "icon" })}>
            <ChevronRight aria-hidden />
          </Link>
        </div>
        {!isPast ? (
          <Button onClick={() => openAt(defaultStart)}>
            <CalendarPlus aria-hidden /> Agendar
          </Button>
        ) : null}
      </header>

      {layout.allDay.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Todo el día">
          {layout.allDay.map((event) => (
            <li key={event.id}>
              <Link
                href={`/agenda/${event.id}`}
                className="flex items-center gap-2 rounded-lg border border-l-[3px] bg-card px-3 py-1.5 text-sm font-semibold hover:bg-muted"
                style={{ borderLeftColor: event.wholeFamily ? homeColor : (event.participants[0]?.color ?? homeColor) }}
              >
                <CategoryIcon icon={event.category?.icon} className="size-4" />
                {event.title}
                <span className="font-normal text-muted-foreground">· todo el día</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        ref={scrollRef}
        className="rounded-xl border lg:max-h-[calc(100dvh-19rem)] lg:min-h-[28rem] lg:overflow-y-auto"
      >
        <div className="relative" style={{ height: hours.length * HOUR_PX }}>
          {hours.map((hour) => {
            const enabled = canAddAt(hour);
            const pastHour = isPast || (isToday && (hour + 1) * 60 <= nowMin);
            const label = formatLocalTime(hhmm(hour * 60), hourFormat);
            return (
              <div key={hour} className="flex border-t first:border-t-0" style={{ height: HOUR_PX }}>
                <div className="w-16 shrink-0 px-2 pt-1 text-right sm:w-20">
                  <span className={cn("block text-[0.6875rem] font-semibold tabular-nums", pastHour ? "text-muted-foreground/60" : "text-muted-foreground")}>
                    {formatHourShort(hour, hourFormat)}
                  </span>
                  {partStarts.has(hour) ? (
                    <span className="block text-[0.625rem] font-medium text-muted-foreground/80">
                      {partStarts.get(hour)}
                    </span>
                  ) : null}
                </div>
                <div className={cn("relative flex-1 border-l", pastHour && "bg-muted/40")}>
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border/70" />
                  {enabled ? (
                    <button
                      type="button"
                      aria-label={`Agendar a las ${label}`}
                      onClick={(e) => {
                        // Con el ratón o el dedo, la mitad inferior propone la media hora.
                        const rect = e.currentTarget.getBoundingClientRect();
                        const lower = e.detail > 0 && e.clientY - rect.top > rect.height / 2;
                        openAt(hour * 60 + (lower ? 30 : 0));
                      }}
                      className="group absolute inset-0 flex items-start px-3 py-1.5 text-left outline-none hover:bg-brand-soft/60 focus-visible:bg-brand-soft/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <span className="flex items-center gap-1 text-xs font-semibold text-brand-strong opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-50">
                        <Plus aria-hidden className="size-4" /> Agendar
                      </span>
                      {/* Franja libre a la derecha: se puede agendar aunque haya algo a esa hora. */}
                      <Plus
                        aria-hidden
                        className="absolute top-1.5 right-2.5 size-4 text-brand-strong opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-50"
                      />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}

          <ol aria-label="Agendado" className="pointer-events-none absolute inset-y-0 right-10 left-16 sm:left-20">
            {layout.blocks.map((block) => (
              <EventBlock
                key={block.event.id}
                block={block}
                top={((block.startMin - range.from * 60) * HOUR_PX) / 60}
                height={((block.endMin - block.startMin) * HOUR_PX) / 60}
                timeLabel={eventTimeLabel(block.event, timeZone, hourFormat)}
                homeColor={homeColor}
              />
            ))}
          </ol>

          {isToday && nowMin >= range.from * 60 && nowMin < range.to * 60 ? (
            <div
              className="pointer-events-none absolute right-0 left-16 z-20 flex items-center sm:left-20"
              style={{ top: ((nowMin - range.from * 60) * HOUR_PX) / 60 }}
            >
              <span className="-ml-1 size-2 shrink-0 rounded-full bg-destructive" aria-hidden />
              <span className="h-px flex-1 bg-destructive" aria-hidden />
              <span className="absolute -top-2.5 right-2 rounded-md bg-destructive px-1.5 py-0.5 text-[0.6875rem] font-semibold text-destructive-foreground tabular-nums">
                Ahora · {formatLocalTime(hhmm(nowMin), hourFormat)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {slot ? (
        <QuickScheduleDialog
          key={`${date}-${slot}`}
          date={date}
          startTime={slot}
          members={members}
          blocks={layout.blocks}
          onClose={() => setSlot(null)}
        />
      ) : null}
    </section>
  );
}

function EventBlock({
  block,
  top,
  height,
  timeLabel,
  homeColor,
}: {
  block: DayBlock;
  top: number;
  height: number;
  timeLabel: string;
  homeColor: string;
}) {
  const { event } = block;
  const accent = event.wholeFamily ? homeColor : (event.participants[0]?.color ?? homeColor);
  const compact = height < 48;
  const when = `${block.fromYesterday ? "Desde ayer · " : ""}${timeLabel}${block.untilTomorrow ? " · sigue mañana" : ""}`;
  return (
    <li
      className="pointer-events-auto absolute z-10 p-0.5"
      style={{
        top,
        height,
        left: `${(block.column / block.columns) * 100}%`,
        width: `${100 / block.columns}%`,
      }}
    >
      <Link
        href={`/agenda/${event.id}`}
        className={cn(
          "flex h-full min-w-0 overflow-hidden rounded-lg border border-l-[3px] px-2 transition-colors hover:brightness-95",
          compact ? "items-center gap-2" : "flex-col justify-start gap-0.5 py-1",
        )}
        style={{ borderLeftColor: accent, backgroundColor: `color-mix(in oklab, ${accent} 14%, var(--card))` }}
      >
        <span className="shrink-0 text-[0.6875rem] font-medium text-muted-foreground tabular-nums">
          {when}
          {block.hasEnd ? null : <span className="sr-only"> (sin hora de fin)</span>}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm leading-tight font-semibold">
          <CategoryIcon icon={event.category?.icon} className="size-3.5 shrink-0" />
          <span className="truncate">{event.title}</span>
          {event.importance === "high" ? (
<ImportantMark />
          ) : null}
        </span>
        {!compact && height >= 80 ? (
          <span className="flex min-w-0 items-center justify-between gap-2">
            {event.location ? (
              <span className="flex min-w-0 items-center gap-1 truncate text-sm text-muted-foreground">
                <MapPin aria-hidden className="size-3.5 shrink-0" /> <span className="truncate">{event.location}</span>
              </span>
            ) : (
              <span />
            )}
            <MemberStack members={event.participants} wholeFamily={event.wholeFamily} homeColor={homeColor} />
          </span>
        ) : null}
      </Link>
    </li>
  );
}
