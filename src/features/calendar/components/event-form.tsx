"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Bell, CalendarX2, ListTodo, Lock, Repeat, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "cn";

import {
  cancelEventAction,
  checkOverlapsAction,
  createEventAction,
  createEventSeriesAction,
  endEventSeriesAction,
  splitEventSeriesAction,
  updateEventAction,
} from "../actions";
import { takeAgendaDraft } from "../draft";
import { type EventFormValues, eventFormSchema, NO_REPEAT, type RepeatValues } from "../schemas";
import type { CategorySummary, MemberSummary } from "../types";
import { CategoryIcon } from "@/components/category-icon";
import { ConfirmAction } from "@/components/confirm-action";
import { MemberAvatar } from "@/components/member-chip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCommandId } from "@/hooks/use-command-id";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { readableTextColor } from "@/lib/colors";
import { formatLongDate, WEEKDAYS_SHORT } from "@/lib/time/zoned";

const VISIBILITY_OPTIONS = [
  { value: "family", label: "Toda la familia", hint: "Se ve en la pantalla de casa y en las de los hijos." },
  { value: "participants", label: "Solo participantes", hint: "Lo ven los adultos y los participantes." },
  { value: "adults", label: "Solo adultos", hint: "No aparece en pantallas comunes ni de hijos." },
] as const;

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export type EventFormProps = {
  mode: "create" | "edit";
  eventId?: string;
  version?: number;
  initialValues: EventFormValues;
  members: MemberSummary[];
  categories: CategorySummary[];
  homeColor: string;
  returnTo: string;
  isCancelled?: boolean;
  /** Muestra la opción «Repetir» (eventos nuevos y cambio de serie). */
  allowRepeat?: boolean;
  initialRepeat?: RepeatValues;
  /** Ocurrencia de una serie que se está editando de forma individual. */
  occurrenceOf?: { seriesId: string; date: string };
  /** «Cambiar esta y las siguientes»: parte la serie desde `from`. */
  splitSeries?: { seriesId: string; from: string };
  /** Reglas de preparativos disponibles (activas). */
  rules?: { id: string; name: string; kind: "visit_prep" | "school_prep" }[];
  /** Recupera lo escrito en la ventana rápida de la agenda («Más opciones»). */
  restoreDraft?: boolean;
};

const REMINDER_OPTIONS = [
  { value: 0, label: "Al empezar" },
  { value: 15, label: "15 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 h antes" },
  { value: 120, label: "2 h antes" },
  { value: 1440, label: "1 día antes" },
] as const;

const REPEAT_OPTIONS = [
  { value: "none", label: "No se repite" },
  { value: "daily", label: "Todos los días" },
  { value: "weekdays", label: "Lunes a viernes" },
  { value: "weekly", label: "Días de la semana" },
  { value: "monthly", label: "Cada mes" },
] as const;

export function EventForm({
  mode,
  eventId,
  version,
  initialValues,
  members,
  categories,
  homeColor,
  returnTo,
  isCancelled,
  allowRepeat,
  initialRepeat,
  occurrenceOf,
  splitSeries,
  rules = [],
  restoreDraft,
}: EventFormProps) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [commandId, renewCommandId] = useCommandId();
  const [conflict, setConflict] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [overlaps, setOverlaps] = useState<string[]>([]);
  const [cancelReason, setCancelReason] = useState("");
  const [repeat, setRepeat] = useState<RepeatValues>(initialRepeat ?? NO_REPEAT);
  const [, startOverlapCheck] = useTransition();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const { control, register, setValue, formState } = form;
  const { errors, isSubmitting } = formState;

  const isAllDay = useWatch({ control, name: "isAllDay" });
  const wholeFamily = useWatch({ control, name: "wholeFamily" });
  const startTime = useWatch({ control, name: "startTime" });
  const endTime = useWatch({ control, name: "endTime" });
  const watched = useWatch({ control });

  // La hora final propuesta acompaña a la de inicio (duración visible y editable).
  const lastStart = useRef(initialValues.startTime);
  useEffect(() => {
    if (!startTime || startTime === lastStart.current) return;
    const previous = lastStart.current;
    lastStart.current = startTime;
    const current = form.getValues("endTime");
    if (!previous || !current) {
      setValue("endTime", addMinutes(startTime, 60));
      return;
    }
    const [ph, pm] = previous.split(":").map(Number);
    const [ch, cm] = current.split(":").map(Number);
    const duration = (ch * 60 + cm - (ph * 60 + pm) + 24 * 60) % (24 * 60) || 60;
    setValue("endTime", addMinutes(startTime, duration));
  }, [startTime, setValue, form]);

  useEffect(() => {
    if (!restoreDraft) return;
    const draft = takeAgendaDraft();
    if (!draft) return;
    setValue("title", draft.title, { shouldDirty: true });
    setValue("endTime", draft.endTime);
    setValue("participantIds", draft.participantIds);
    setValue("reminderOffsets", draft.reminderOffsets);
  }, [restoreDraft, setValue]);

  // Aviso de solapamientos (informativo, con espera para no consultar en cada tecla).
  useEffect(() => {
    if (!online) return;
    const timer = setTimeout(() => {
      const parsed = eventFormSchema.safeParse(watched);
      if (!parsed.success || parsed.data.isAllDay) {
        setOverlaps([]);
        return;
      }
      startOverlapCheck(async () => {
        const result = await checkOverlapsAction(parsed.data, eventId);
        setOverlaps(result.ok ? result.data.titles : []);
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [watched, eventId, online]);

  const endsNextDay = !isAllDay && !!startTime && !!endTime && endTime <= startTime;

  async function onSubmit(values: EventFormValues) {
    setFormError(null);
    setConflict(false);
    if (allowRepeat && repeat.freq === "weekly" && repeat.byWeekday.length === 0) {
      setFormError("Elige al menos un día para repetir.");
      return;
    }
    if (allowRepeat && repeat.freq !== "none" && values.isAllDay && values.endDate && values.endDate !== values.date) {
      setFormError("Un evento de varios días no se puede repetir. Usa un solo día o quita la repetición.");
      return;
    }
    const result = splitSeries
      ? await splitEventSeriesAction({ commandId, values, repeat, seriesId: splitSeries.seriesId, from: splitSeries.from })
      : mode === "create" && allowRepeat && repeat.freq !== "none"
        ? await createEventSeriesAction({ commandId, values, repeat })
        : mode === "create"
          ? await createEventAction({ commandId, values })
          : await updateEventAction({ commandId, eventId, expectedVersion: version, values });
    if (!result.ok) {
      if (result.error.code === "VERSION_CONFLICT") setConflict(true);
      else setFormError(result.error.message);
      if (result.error.fieldErrors) {
        for (const [key, message] of Object.entries(result.error.fieldErrors)) {
          form.setError(key.replace(/^values\./, "") as keyof EventFormValues, { message });
        }
      }
      return;
    }
    renewCommandId();
    toast.success(
      splitSeries ? "Serie actualizada desde esa fecha" : repeat.freq !== "none" && mode === "create" ? "Serie creada" : mode === "create" ? "Evento guardado" : "Cambios guardados",
    );
    router.push(returnTo);
  }

  async function onEndSeries() {
    if (!occurrenceOf) return;
    const result = await endEventSeriesAction({ seriesId: occurrenceOf.seriesId, from: occurrenceOf.date });
    if (!result.ok) {
      toast.error(result.error.message);
      return false;
    }
    toast.success("La serie termina antes de esta fecha");
    router.push(returnTo);
  }

  async function onCancelEvent() {
    const result = await cancelEventAction({
      commandId: crypto.randomUUID(),
      eventId,
      expectedVersion: version,
      reason: cancelReason,
    });
    if (!result.ok) {
      if (result.error.code === "VERSION_CONFLICT") setConflict(true);
      toast.error(result.error.message);
      return false;
    }
    toast.success("Evento cancelado");
    router.push(returnTo);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {isCancelled ? (
        <Alert>
          <CalendarX2 aria-hidden />
          <AlertTitle>Este evento está cancelado</AlertTitle>
          <AlertDescription>No aparece en el panel ni en el radar. Puedes consultarlo aquí.</AlertDescription>
        </Alert>
      ) : null}
      {occurrenceOf && !isCancelled ? (
        <Alert>
          <Repeat aria-hidden />
          <AlertTitle>Este evento se repite</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            Lo que guardes aquí cambia solo el {formatLongDate(occurrenceOf.date).toLowerCase()}.
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                nativeButton={false}
                render={<Link href={`/agenda/serie/${occurrenceOf.seriesId}?desde=${occurrenceOf.date}`} />}
              >
                Cambiar esta y las siguientes
              </Button>
              <ConfirmAction
                trigger={
                  <Button type="button" variant="ghost">
                    Terminar la serie desde aquí
                  </Button>
                }
                title="¿Terminar la serie?"
                description="Se quitan esta fecha y las siguientes. Las fechas anteriores y las que editaste a mano se conservan."
                confirmLabel="Terminar serie"
                onConfirm={onEndSeries}
              />
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      {conflict ? (
        <Alert variant="destructive" role="alert">
          <AlertTriangle aria-hidden />
          <AlertTitle>Otra persona cambió este evento</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            Para no sobrescribir sus cambios, recarga la versión actual y vuelve a aplicar los tuyos.
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Recargar versión actual
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="title" className="text-[0.95rem]">
            ¿Qué es?
          </FieldLabel>
          <Input
            id="title"
            className="h-12 text-lg"
            placeholder="Ej.: Visita de la tía Carmen"
            maxLength={120}
            aria-invalid={!!errors.title}
            {...register("title")}
          />
          <FieldError errors={[errors.title]} />
        </Field>

        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend>Categoría</FieldLegend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría">
                {categories.map((cat) => {
                  const selected = field.value === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.onChange(selected ? null : cat.id)}
                      className={cn(
                        "flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium pointer-coarse:min-h-11 transition-colors",
                        selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      <CategoryIcon icon={cat.icon} className="size-5" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </FieldSet>
          )}
        />

        <Controller
          control={control}
          name="isAllDay"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch id="isAllDay" checked={field.value} onCheckedChange={field.onChange} />
              <FieldLabel htmlFor="isAllDay">Todo el día</FieldLabel>
            </Field>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Field data-invalid={!!errors.date}>
            <FieldLabel htmlFor="date">{isAllDay ? "Desde" : "Fecha"}</FieldLabel>
            <Input id="date" type="date" aria-invalid={!!errors.date} {...register("date")} />
            <FieldError errors={[errors.date]} />
          </Field>
          {isAllDay ? (
            <Field data-invalid={!!errors.endDate}>
              <FieldLabel htmlFor="endDate">Hasta (inclusive)</FieldLabel>
              <Input
                id="endDate"
                type="date"
                aria-invalid={!!errors.endDate}
                {...register("endDate", { setValueAs: (v) => (v ? v : null) })}
              />
              <FieldError errors={[errors.endDate]} />
            </Field>
          ) : (
            <>
              <Field data-invalid={!!errors.startTime}>
                <FieldLabel htmlFor="startTime">Empieza</FieldLabel>
                <Input
                  id="startTime"
                  type="time"
                  aria-invalid={!!errors.startTime}
                  {...register("startTime", { setValueAs: (v) => (v ? v : null) })}
                />
                <FieldError errors={[errors.startTime]} />
              </Field>
              <Field data-invalid={!!errors.endTime}>
                <FieldLabel htmlFor="endTime">Termina (opcional)</FieldLabel>
                <Input
                  id="endTime"
                  type="time"
                  aria-invalid={!!errors.endTime}
                  aria-describedby="endTime-help"
                  {...register("endTime", { setValueAs: (v) => (v ? v : null) })}
                />
                <FieldDescription id="endTime-help">
                  {endsNextDay ? "Termina al día siguiente." : "Propuesta: 1 hora. Puedes cambiarla o borrarla."}
                </FieldDescription>
                <FieldError errors={[errors.endTime]} />
              </Field>
            </>
          )}
        </div>

        {allowRepeat ? (
          <FieldSet>
            <FieldLegend className="flex items-center gap-2">
              <Repeat aria-hidden className="size-4" /> Repetir
            </FieldLegend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Repetir">
              {REPEAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={repeat.freq === opt.value}
                  onClick={() => setRepeat((r) => ({ ...r, freq: opt.value }))}
                  className={cn(
                    "min-h-10 rounded-lg border px-3 text-sm font-medium pointer-coarse:min-h-11",
                    repeat.freq === opt.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {repeat.freq === "weekly" ? (
              <div className="flex flex-wrap gap-2" aria-label="Días">
                {WEEKDAYS_SHORT.map((label, i) => {
                  const day = i + 1;
                  const selected = repeat.byWeekday.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setRepeat((r) => ({
                          ...r,
                          byWeekday: selected ? r.byWeekday.filter((d) => d !== day) : [...r.byWeekday, day].sort(),
                        }))
                      }
                      className={cn(
                        "size-10 rounded-lg border text-sm font-medium capitalize pointer-coarse:size-11",
                        selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {repeat.freq === "monthly" && Number((watched.date ?? "").slice(8, 10)) > 28 ? (
              <div className="flex flex-col gap-1" role="radiogroup" aria-label="Meses sin ese día">
                <span className="text-sm font-semibold">Meses que no tienen el día {Number((watched.date ?? "").slice(8, 10))}:</span>
                {[
                  { value: "skip", label: "Saltar ese mes" },
                  { value: "last_day", label: "Usar el último día del mes" },
                ].map((opt) => (
                  <label key={opt.value} className="flex min-h-11 items-center gap-2">
                    <input
                      type="radio"
                      className="size-5"
                      checked={repeat.missingDayPolicy === opt.value}
                      onChange={() => setRepeat((r) => ({ ...r, missingDayPolicy: opt.value as RepeatValues["missingDayPolicy"] }))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            ) : null}
            {repeat.freq !== "none" ? (
              <Field className="max-w-xs">
                <FieldLabel htmlFor="untilDate">Hasta (opcional)</FieldLabel>
                <Input
                  id="untilDate"
                  type="date"
                  value={repeat.untilDate ?? ""}
                  onChange={(e) => setRepeat((r) => ({ ...r, untilDate: e.target.value || null }))}
                />
              </Field>
            ) : null}
          </FieldSet>
        ) : null}

        <FieldSet>
          <FieldLegend>¿Quiénes participan?</FieldLegend>
          <div className="flex flex-wrap gap-2">
            <Controller
              control={control}
              name="wholeFamily"
              render={({ field }) => (
                <button
                  type="button"
                  aria-pressed={field.value}
                  onClick={() => field.onChange(!field.value)}
                  className={cn(
                    "flex min-h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium pointer-coarse:min-h-11",
                    !field.value && "hover:bg-muted",
                  )}
                  style={
                    field.value
                      ? { backgroundColor: homeColor, borderColor: homeColor, color: readableTextColor(homeColor) }
                      : undefined
                  }
                >
                  <Users aria-hidden className="size-5" /> Toda la casa
                </button>
              )}
            />
            <Controller
              control={control}
              name="participantIds"
              render={({ field }) => (
                <>
                  {members.map((m) => {
                    const selected = field.value.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={selected || wholeFamily}
                        disabled={wholeFamily}
                        onClick={() =>
                          field.onChange(selected ? field.value.filter((id) => id !== m.id) : [...field.value, m.id])
                        }
                        className={cn(
                          "flex min-h-10 items-center gap-2 rounded-lg border py-1 pr-3 pl-1 text-sm font-medium pointer-coarse:min-h-11 transition-colors disabled:opacity-50",
                          !selected && "hover:bg-muted",
                        )}
                        style={selected ? { borderColor: m.color, backgroundColor: `${m.color}1f` } : undefined}
                      >
                        <MemberAvatar member={m} size="sm" />
                        {m.displayName}
                      </button>
                    );
                  })}
                </>
              )}
            />
          </div>
          <FieldError errors={[errors.participantIds as { message?: string } | undefined]} />
        </FieldSet>

        {overlaps.length > 0 ? (
          <Alert>
            <AlertTriangle aria-hidden />
            <AlertTitle>Coincide con otro evento</AlertTitle>
            <AlertDescription>
              {overlaps.join(" · ")}. Puedes guardarlo igual si es correcto.
            </AlertDescription>
          </Alert>
        ) : null}

        <Controller
          control={control}
          name="visibility"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend>¿Quién puede verlo?</FieldLegend>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Visibilidad">
                {VISIBILITY_OPTIONS.map((opt) => {
                  const selected = field.value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => field.onChange(opt.value)}
                      className={cn(
                        "flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left",
                        selected ? "border-primary bg-primary/5" : "hover:bg-muted",
                      )}
                    >
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-sm text-muted-foreground">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </FieldSet>
          )}
        />

        <Controller
          control={control}
          name="reminderOffsets"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend className="flex items-center gap-2">
                <Bell aria-hidden className="size-4" /> Recordatorios
              </FieldLegend>
              <FieldDescription>
                Aparecen en las pantallas autorizadas y, si está activado, como notificación. Funcionan aunque nadie
                tenga la web abierta.
              </FieldDescription>
              <div className="flex flex-wrap gap-2">
                {REMINDER_OPTIONS.map((opt) => {
                  const selected = field.value.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        field.onChange(
                          selected ? field.value.filter((v) => v !== opt.value) : [...field.value, opt.value].sort((a, b) => a - b),
                        )
                      }
                      className={cn(
                        "min-h-10 rounded-lg border px-3 text-sm font-medium pointer-coarse:min-h-11",
                        selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </FieldSet>
          )}
        />

        {rules.length > 0 && !splitSeries && !(allowRepeat && repeat.freq !== "none") ? (
          <Controller
            control={control}
            name="ruleIds"
            render={({ field }) => (
              <FieldSet>
                <FieldLegend className="flex items-center gap-2">
                  <ListTodo aria-hidden className="size-4" /> Preparativos automáticos
                </FieldLegend>
                <FieldDescription>
                  Avisos la noche anterior y en la mañana, y tareas de preparación para los hijos que indique la regla.
                </FieldDescription>
                <div className="flex flex-wrap gap-2">
                  {rules.map((rule) => {
                    const selected = field.value.includes(rule.id);
                    return (
                      <button
                        key={rule.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          field.onChange(selected ? field.value.filter((id) => id !== rule.id) : [...field.value, rule.id])
                        }
                        className={cn(
                          "min-h-10 rounded-lg border px-3 text-sm font-medium pointer-coarse:min-h-11",
                          selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                        )}
                      >
                        {rule.name}
                      </button>
                    );
                  })}
                </div>
              </FieldSet>
            )}
          />
        ) : null}

        <Controller
          control={control}
          name="importance"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch
                id="importance"
                checked={field.value === "high"}
                onCheckedChange={(checked) => field.onChange(checked ? "high" : "normal")}
              />
              <FieldLabel htmlFor="importance">Importante: destacarlo en el panel y el radar</FieldLabel>
            </Field>
          )}
        />

        <Field data-invalid={!!errors.location}>
          <FieldLabel htmlFor="location">Lugar (opcional)</FieldLabel>
          <Input id="location" maxLength={200} {...register("location")} />
          <FieldError errors={[errors.location]} />
        </Field>

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="description">Indicaciones o preparación (opcional)</FieldLabel>
          <Textarea
            id="description"
            maxLength={2000}
            placeholder="Ej.: llevar uniforme de deporte"
            aria-describedby="description-help"
            {...register("description")}
          />
          <FieldDescription id="description-help">
            Se muestra a quienes pueden ver el evento, también en pantallas.
          </FieldDescription>
          <FieldError errors={[errors.description]} />
        </Field>

        <Field data-invalid={!!errors.privateNotes}>
          <FieldLabel htmlFor="privateNotes" className="flex items-center gap-1.5">
            <Lock aria-hidden className="size-4" /> Notas privadas de adultos (opcional)
          </FieldLabel>
          <Textarea id="privateNotes" maxLength={4000} aria-describedby="privateNotes-help" {...register("privateNotes")} />
          <FieldDescription id="privateNotes-help">Nunca se proyectan en la cocina ni en los cuartos.</FieldDescription>
          <FieldError errors={[errors.privateNotes]} />
        </Field>
      </FieldGroup>

      {!online ? (
        <Alert role="status">
          <AlertDescription>Sin conexión: podrás guardar cuando vuelva la red.</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="lg" onClick={() => router.push(returnTo)}>
            Volver
          </Button>
          {mode === "edit" && !isCancelled ? (
            <ConfirmAction
              trigger={
                <Button type="button" variant="destructive" size="lg">
                  Cancelar evento
                </Button>
              }
              title="¿Cancelar este evento?"
              description="Dejará de mostrarse en el panel y en el radar. Quedará registrado quién lo canceló."
              confirmLabel="Sí, cancelar evento"
              onConfirm={onCancelEvent}
            >
              <Field>
                <FieldLabel htmlFor="cancelReason">Motivo (opcional)</FieldLabel>
                <Input
                  id="cancelReason"
                  value={cancelReason}
                  maxLength={300}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </Field>
            </ConfirmAction>
          ) : null}
        </div>
        {!isCancelled ? (
          <Button type="submit" size="lg" disabled={isSubmitting || !online}>
            {isSubmitting
              ? "Guardando…"
              : splitSeries
                ? "Guardar esta y las siguientes"
                : mode === "create"
                  ? "Guardar evento"
                  : "Guardar cambios"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
