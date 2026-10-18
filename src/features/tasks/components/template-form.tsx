"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "cn";

import { saveTemplateAction, setTemplateStatusAction } from "../child-actions";
import { FREQ_OPTIONS, type TemplateFormValues, templateFormSchema } from "../template-schemas";
import { ConfirmAction } from "@/components/confirm-action";
import { MemberAvatar } from "@/components/member-chip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { MemberSummary } from "@/features/calendar/types";
import { useCommandId } from "@/hooks/use-command-id";
import { WEEKDAYS_SHORT } from "@/lib/time/zoned";

export function TemplateForm({
  templateId,
  version,
  initialValues,
  kids,
}: {
  templateId?: string;
  version?: number;
  initialValues: TemplateFormValues;
  kids: MemberSummary[];
}) {
  const router = useRouter();
  const [commandId, renew] = useCommandId();
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const form = useForm<TemplateFormValues>({ resolver: zodResolver(templateFormSchema), defaultValues: initialValues });
  const { control, register, formState } = form;
  const { errors, isSubmitting } = formState;
  const freq = useWatch({ control, name: "freq" });
  const kind = useWatch({ control, name: "kind" });
  const monthDay = useWatch({ control, name: "monthDay" });

  async function onSubmit(values: TemplateFormValues) {
    setError(null);
    setConflict(false);
    const result = await saveTemplateAction({
      commandId,
      templateId: templateId ?? null,
      expectedVersion: version ?? null,
      values,
    });
    if (!result.ok) {
      if (result.error.code === "VERSION_CONFLICT") setConflict(true);
      else setError(result.error.message);
      return;
    }
    renew();
    toast.success(templateId ? "Cambios guardados. Las próximas tareas se actualizaron." : "Responsabilidad creada");
    router.push("/responsabilidades");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {conflict ? (
        <Alert variant="destructive" role="alert">
          <AlertTriangle aria-hidden />
          <AlertTitle>Otra persona cambió esta responsabilidad</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            Recarga para ver la versión actual antes de guardar.
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Recargar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend>Tipo</FieldLegend>
              <div className="flex gap-2" role="radiogroup" aria-label="Tipo">
                {[
                  { value: "chore", label: "Responsabilidad", hint: "Ej.: tender la cama" },
                  { value: "habit", label: "Hábito", hint: "Ej.: cepillarse los dientes" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={field.value === opt.value}
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      "flex flex-col items-start rounded-lg border px-4 py-2 text-left",
                      field.value === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted",
                    )}
                  >
                    <span className="font-semibold">{opt.label}</span>
                    <span className="text-sm text-muted-foreground">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </FieldSet>
          )}
        />

        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="title" className="text-[0.95rem]">
            ¿Qué hay que hacer?
          </FieldLabel>
          <Input
            id="title"
            className="h-12 text-lg"
            maxLength={120}
            placeholder={kind === "habit" ? "Cepillarse los dientes" : "Preparar la mochila"}
            {...register("title")}
          />
          <FieldError errors={[errors.title]} />
        </Field>

        <Controller
          control={control}
          name="assigneeIds"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend>¿Para quién?</FieldLegend>
              <FieldDescription>Si eliges a varios, cada uno tendrá su propia tarea.</FieldDescription>
              <div className="flex flex-wrap gap-2">
                {kids.map((k) => {
                  const selected = field.value.includes(k.id);
                  return (
                    <button
                      key={k.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        field.onChange(selected ? field.value.filter((id) => id !== k.id) : [...field.value, k.id])
                      }
                      className={cn(
                        "flex min-h-10 items-center gap-2 rounded-lg border py-1 pr-3 pl-1 text-sm font-medium pointer-coarse:min-h-11",
                        !selected && "hover:bg-muted",
                      )}
                      style={selected ? { borderColor: k.color, backgroundColor: `${k.color}1f` } : undefined}
                    >
                      <MemberAvatar member={k} size="sm" />
                      {k.displayName}
                    </button>
                  );
                })}
              </div>
              <FieldError errors={[errors.assigneeIds as { message?: string } | undefined]} />
            </FieldSet>
          )}
        />

        <Controller
          control={control}
          name="freq"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend>¿Cuándo?</FieldLegend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Repetición">
                {FREQ_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={field.value === opt.value}
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      "min-h-10 rounded-lg border px-3 text-sm font-medium pointer-coarse:min-h-11",
                      field.value === opt.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </FieldSet>
          )}
        />

        {freq === "weekly" ? (
          <Controller
            control={control}
            name="byWeekday"
            render={({ field }) => (
              <FieldSet>
                <FieldLegend>Días</FieldLegend>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS_SHORT.map((label, i) => {
                    const day = i + 1;
                    const selected = field.value.includes(day);
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          field.onChange(
                            selected ? field.value.filter((d) => d !== day) : [...field.value, day].sort((a, b) => a - b),
                          )
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
                <FieldError errors={[errors.byWeekday as { message?: string } | undefined]} />
              </FieldSet>
            )}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field data-invalid={!!errors.startsOn}>
            <FieldLabel htmlFor="startsOn">{freq === "once" ? "Fecha" : "Desde"}</FieldLabel>
            <Input id="startsOn" type="date" {...register("startsOn")} />
            <FieldError errors={[errors.startsOn]} />
          </Field>
          {freq !== "once" ? (
            <Field data-invalid={!!errors.untilOn}>
              <FieldLabel htmlFor="untilOn">Hasta (opcional)</FieldLabel>
              <Input id="untilOn" type="date" {...register("untilOn", { setValueAs: (v) => (v ? v : null) })} />
              <FieldError errors={[errors.untilOn]} />
            </Field>
          ) : null}
          <Field data-invalid={!!errors.dueTime}>
            <FieldLabel htmlFor="dueTime">Hora límite (opcional)</FieldLabel>
            <Input id="dueTime" type="time" {...register("dueTime", { setValueAs: (v) => (v ? v : null) })} />
            <FieldDescription>Sin hora: vence al terminar el día.</FieldDescription>
          </Field>
        </div>

        {freq === "monthly" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="monthDay">Día del mes</FieldLabel>
              <Input
                id="monthDay"
                type="number"
                min={1}
                max={31}
                {...register("monthDay", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })}
              />
            </Field>
            {(monthDay ?? 0) > 28 ? (
              <Controller
                control={control}
                name="missingDayPolicy"
                render={({ field }) => (
                  <FieldSet>
                    <FieldLegend>Meses sin ese día</FieldLegend>
                    <div className="flex flex-col gap-1" role="radiogroup" aria-label="Meses sin ese día">
                      {[
                        { value: "skip", label: "Saltar ese mes" },
                        { value: "last_day", label: "Usar el último día del mes" },
                      ].map((opt) => (
                        <label key={opt.value} className="flex min-h-11 items-center gap-2">
                          <input
                            type="radio"
                            className="size-5"
                            checked={field.value === opt.value}
                            onChange={() => field.onChange(opt.value)}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </FieldSet>
                )}
              />
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.points}>
            <FieldLabel htmlFor="points">Puntos</FieldLabel>
            <Input id="points" type="number" min={0} max={1000} {...register("points", { valueAsNumber: true })} />
            <FieldDescription>Sugerencia: 10. Cambiarlo no altera tareas ya cumplidas.</FieldDescription>
            <FieldError errors={[errors.points]} />
          </Field>
          <Controller
            control={control}
            name="requiresReview"
            render={({ field }) => (
              <Field orientation="horizontal" className="self-center">
                <Switch id="requiresReview" checked={field.value} onCheckedChange={field.onChange} />
                <FieldLabel htmlFor="requiresReview">Un adulto revisa antes de dar los puntos</FieldLabel>
              </Field>
            )}
          />
        </div>

        <Field>
          <FieldLabel htmlFor="description">Indicaciones (opcional)</FieldLabel>
          <Textarea id="description" maxLength={500} {...register("description")} />
        </Field>
      </FieldGroup>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="lg" onClick={() => router.push("/responsabilidades")}>
            Volver
          </Button>
          {templateId ? (
            <ConfirmAction
              trigger={
                <Button type="button" variant="destructive" size="lg">
                  Archivar
                </Button>
              }
              title="¿Archivar esta responsabilidad?"
              description="Dejará de generar tareas nuevas. Se conserva el historial y los puntos ya ganados."
              confirmLabel="Archivar"
              onConfirm={async () => {
                const result = await setTemplateStatusAction({ templateId, status: "archived" });
                if (!result.ok) {
                  toast.error(result.error.message);
                  return false;
                }
                router.push("/responsabilidades");
              }}
            />
          ) : null}
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
