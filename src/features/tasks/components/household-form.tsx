"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "cn";

import { createHouseholdTaskAction, setHouseholdTaskStatusAction, updateHouseholdTaskAction } from "../actions";
import { type HouseholdTaskFormValues, householdTaskFormSchema } from "../schemas";
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
import { useOnlineStatus } from "@/hooks/use-online-status";

const PRIORITIES = [
  { value: "low", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
] as const;

export function HouseholdForm({
  mode,
  taskId,
  version,
  initialValues,
  members,
  returnTo,
}: {
  mode: "create" | "edit";
  taskId?: string;
  version?: number;
  initialValues: HouseholdTaskFormValues;
  members: MemberSummary[];
  returnTo: string;
}) {
  const router = useRouter();
  const online = useOnlineStatus();
  const [commandId, renewCommandId] = useCommandId();
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const form = useForm<HouseholdTaskFormValues>({
    resolver: zodResolver(householdTaskFormSchema),
    defaultValues: initialValues,
  });
  const { control, register, formState } = form;
  const { errors, isSubmitting } = formState;
  const dueDate = useWatch({ control, name: "dueDate" });

  async function onSubmit(values: HouseholdTaskFormValues) {
    setError(null);
    setConflict(false);
    const result =
      mode === "create"
        ? await createHouseholdTaskAction({ commandId, values })
        : await updateHouseholdTaskAction({ commandId, taskId, expectedVersion: version, values });
    if (!result.ok) {
      if (result.error.code === "VERSION_CONFLICT") setConflict(true);
      else setError(result.error.message);
      return;
    }
    renewCommandId();
    toast.success(mode === "create" ? "Pendiente guardado" : "Cambios guardados");
    router.push(returnTo);
  }

  async function onCancelTask() {
    const result = await setHouseholdTaskStatusAction({
      taskId,
      status: "cancelled",
      commandId: crypto.randomUUID(),
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return false;
    }
    toast.success("Pendiente descartado");
    router.push(returnTo);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {conflict ? (
        <Alert variant="destructive" role="alert">
          <AlertTriangle aria-hidden />
          <AlertTitle>Otra persona cambió este pendiente</AlertTitle>
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
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="title" className="text-lg">
            ¿Qué hay que hacer?
          </FieldLabel>
          <Input
            id="title"
            className="h-14 text-xl"
            placeholder="Ej.: Descongelar el pollo"
            maxLength={120}
            aria-invalid={!!errors.title}
            {...register("title")}
          />
          <FieldError errors={[errors.title]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.dueDate}>
            <FieldLabel htmlFor="dueDate">Fecha (opcional)</FieldLabel>
            <Input id="dueDate" type="date" {...register("dueDate", { setValueAs: (v) => (v ? v : null) })} />
            <FieldDescription>Sin fecha: «cuando se pueda».</FieldDescription>
            <FieldError errors={[errors.dueDate]} />
          </Field>
          <Field data-invalid={!!errors.dueTime}>
            <FieldLabel htmlFor="dueTime">Hora límite (opcional)</FieldLabel>
            <Input
              id="dueTime"
              type="time"
              disabled={!dueDate}
              {...register("dueTime", { setValueAs: (v) => (v ? v : null) })}
            />
            <FieldDescription>Sin hora: pendiente del día, no una cita.</FieldDescription>
            <FieldError errors={[errors.dueTime]} />
          </Field>
        </div>

        <Controller
          control={control}
          name="assigneeMemberId"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend>Responsable (opcional)</FieldLegend>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={field.value === null}
                  onClick={() => field.onChange(null)}
                  className={cn(
                    "min-h-11 rounded-full border-2 px-4 font-semibold",
                    field.value === null ? "border-primary bg-primary/5" : "hover:bg-muted",
                  )}
                >
                  Cualquiera
                </button>
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={field.value === m.id}
                    onClick={() => field.onChange(m.id)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-full border-2 py-1 pr-4 pl-1 font-semibold",
                      field.value !== m.id && "hover:bg-muted",
                    )}
                    style={field.value === m.id ? { borderColor: m.color, backgroundColor: `${m.color}1f` } : undefined}
                  >
                    <MemberAvatar member={m} size="sm" />
                    {m.displayName}
                  </button>
                ))}
              </div>
            </FieldSet>
          )}
        />

        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend>Prioridad</FieldLegend>
              <div className="flex gap-2" role="radiogroup" aria-label="Prioridad">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={field.value === p.value}
                    onClick={() => field.onChange(p.value)}
                    className={cn(
                      "min-h-11 rounded-xl border-2 px-4 font-semibold",
                      field.value === p.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </FieldSet>
          )}
        />

        <Controller
          control={control}
          name="visibility"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch
                id="adultsOnly"
                checked={field.value === "adults"}
                onCheckedChange={(checked) => field.onChange(checked ? "adults" : "family")}
              />
              <FieldLabel htmlFor="adultsOnly">Solo para adultos (no se muestra en pantallas)</FieldLabel>
            </Field>
          )}
        />

        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="notes">Notas (opcional)</FieldLabel>
          <Textarea id="notes" maxLength={1000} {...register("notes")} />
          <FieldError errors={[errors.notes]} />
        </Field>
      </FieldGroup>

      <p className="text-sm text-muted-foreground">Los pendientes de la casa no dan puntos ni tienen penalizaciones.</p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="lg" onClick={() => router.push(returnTo)}>
            Volver
          </Button>
          {mode === "edit" ? (
            <ConfirmAction
              trigger={
                <Button type="button" variant="destructive" size="lg">
                  Descartar
                </Button>
              }
              title="¿Descartar este pendiente?"
              description="Dejará de mostrarse. Quedará registrado en el historial."
              confirmLabel="Sí, descartar"
              onConfirm={onCancelTask}
            />
          ) : null}
        </div>
        <Button type="submit" size="lg" disabled={isSubmitting || !online}>
          {isSubmitting ? "Guardando…" : mode === "create" ? "Guardar pendiente" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
