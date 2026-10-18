"use client";

import { AlertTriangle, Bell, CalendarPlus, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { createEventAction } from "../actions";
import type { DayBlock } from "../domain/day-layout";
import { saveAgendaDraft } from "../draft";
import { DEFAULT_REMINDER_OFFSETS, newEventDefaults } from "../form-values";
import type { EventFormValues } from "../schemas";
import type { MemberSummary } from "../types";
import { useClock } from "@/components/clock/clock-provider";
import { MemberAvatar } from "@/components/member-chip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCommandId } from "@/hooks/use-command-id";
import { formatLocalTime, formatLongDate, parseTimeToMinutes } from "@/lib/time/zoned";

const DURATIONS = [
  { value: null, label: "No sé" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 h" },
  { value: 120, label: "2 h" },
] as const;

const REMINDERS = [
  { value: 0, label: "Al empezar" },
  { value: 15, label: "15 min antes" },
  { value: 60, label: "1 h antes" },
  { value: 1440, label: "1 día antes" },
] as const;

type Reminder = EventFormValues["reminderOffsets"][number];

function addMinutes(hhmm: string, minutes: number): string {
  const total = (parseTimeToMinutes(hhmm) + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function chipClass(selected: boolean) {
  return cn(
    "min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors pointer-coarse:min-h-11",
    selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
  );
}

/**
 * Agendar en un toque desde la grilla del día: qué es y a qué hora empieza.
 * La duración es opcional («No sé») y los avisos vienen marcados para no
 * olvidarlo. «Más opciones» lleva al formulario completo con lo escrito.
 */
export function QuickScheduleDialog({
  date,
  startTime,
  members,
  blocks,
  onClose,
}: {
  date: string;
  startTime: string;
  members: MemberSummary[];
  /** Lo que ya hay ese día, para avisar de coincidencias. */
  blocks: DayBlock[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { now, timeZone, hourFormat } = useClock();
  const [commandId] = useCommandId();
  const [title, setTitle] = useState("");
  const [time, setTime] = useState(startTime);
  const [duration, setDuration] = useState<number | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([...DEFAULT_REMINDER_OFFSETS]);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const endTime = validTime && duration ? addMinutes(time, duration) : null;
  const startMin = validTime ? parseTimeToMinutes(time) : null;
  const clashes =
    startMin === null
      ? []
      : blocks.filter((b) => b.startMin <= startMin && startMin < Math.max(b.endMin, b.startMin + 1));

  function values(): EventFormValues {
    return {
      ...newEventDefaults(date, now, timeZone, false, time),
      title: title.trim(),
      endTime,
      participantIds,
      reminderOffsets: reminders,
    };
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Escribe qué vas a hacer.");
      return;
    }
    if (!validTime) {
      setError("Indica la hora de inicio.");
      return;
    }
    startTransition(async () => {
      // El mismo `commandId` en cada reintento: un doble toque no duplica el evento.
      const result = await createEventAction({ commandId, values: values() });
      if (!result.ok) {
        setError(result.error.fieldErrors ? Object.values(result.error.fieldErrors)[0] : result.error.message);
        return;
      }
      toast.success(`Agendado: ${title.trim()} · ${formatLocalTime(time, hourFormat)}`);
      onClose();
    });
  }

  function moreOptions() {
    const v = values();
    saveAgendaDraft({
      title: v.title,
      endTime: v.endTime,
      participantIds: v.participantIds,
      reminderOffsets: v.reminderOffsets,
    });
    const back = `/agenda?dia=${date}`;
    // Cerrar antes de navegar: Next conserva oculta la página anterior y la
    // ventana (en un portal) seguiría montada sobre el formulario.
    onClose();
    router.push(`/agenda/nuevo?fecha=${date}&hora=${validTime ? time : startTime}&borrador=1&volver=${encodeURIComponent(back)}`);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto p-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Agendar</DialogTitle>
          <DialogDescription>{formatLongDate(date)}</DialogDescription>
        </DialogHeader>
        <form id="agendar-rapido" onSubmit={submit} noValidate className="flex flex-col gap-5">
          <Field data-invalid={!!error && !title.trim()}>
            <FieldLabel htmlFor="quick-title">
              ¿Qué vas a hacer?
            </FieldLabel>
            <Input
              id="quick-title"
              autoFocus
              className="h-12 text-lg"
              placeholder="Ej.: Reunión con la profesora"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="quick-time">
              ¿A qué hora empieza?
            </FieldLabel>
            <Input
              id="quick-time"
              type="time"
              step={300}
              required
              className="h-12 w-40 text-lg tabular-nums"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>

          <FieldSet>
            <FieldLegend>¿Cuánto dura? (opcional)</FieldLegend>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={duration === opt.value}
                  onClick={() => setDuration(opt.value)}
                  className={chipClass(duration === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {endTime ? (
              <p className="text-sm text-muted-foreground">
                Hasta las {formatLocalTime(endTime, hourFormat)}
                {endTime <= time ? " del día siguiente" : ""}
              </p>
            ) : null}
          </FieldSet>

          <FieldSet>
            <FieldLegend className="flex items-center gap-2">
              <Bell aria-hidden className="size-4" /> Avisarme
            </FieldLegend>
            <div className="flex flex-wrap gap-2">
              {REMINDERS.map((opt) => {
                const selected = reminders.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setReminders((current) =>
                        selected ? current.filter((v) => v !== opt.value) : [...current, opt.value].sort((a, b) => a - b),
                      )
                    }
                    className={chipClass(selected)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </FieldSet>

          {members.length > 0 ? (
            <FieldSet>
              <FieldLegend>¿Para quién? (opcional)</FieldLegend>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const selected = participantIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setParticipantIds((current) =>
                          selected ? current.filter((id) => id !== m.id) : [...current, m.id],
                        )
                      }
                      className={cn(
                        "flex min-h-10 items-center gap-1.5 rounded-lg border py-0.5 pr-3 pl-1 text-sm font-medium pointer-coarse:min-h-11",
                        !selected && "hover:bg-muted",
                      )}
                      style={selected ? { borderColor: m.color, backgroundColor: `${m.color}1f` } : undefined}
                    >
                      <MemberAvatar member={m} size="sm" className="ring-0" />
                      {m.displayName}
                    </button>
                  );
                })}
              </div>
            </FieldSet>
          ) : null}

          {clashes.length > 0 ? (
            <p className="flex items-start gap-2 rounded-xl bg-warning/15 px-3 py-2 text-sm">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                A esa hora ya tienes {clashes.map((b) => `«${b.event.title}»`).join(", ")}. Puedes agendarlo igual.
              </span>
            </p>
          ) : null}

          <FieldError>{error}</FieldError>
        </form>
        <DialogFooter className="sticky -bottom-5 -mx-5 -mb-5 bg-popover p-5 sm:justify-between">
          <Button type="button" variant="ghost" onClick={moreOptions} disabled={pending}>
            <SlidersHorizontal aria-hidden /> Más opciones
          </Button>
          <Button type="submit" form="agendar-rapido" disabled={pending}>
            <CalendarPlus aria-hidden /> {pending ? "Agendando…" : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
