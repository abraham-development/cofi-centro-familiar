"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { GraduationCap, House, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "cn";

import { saveRuleAction } from "../actions";
import type { AutomationRule } from "../queries";
import { type RuleFormValues, ruleFormSchema } from "../schemas";
import { MemberAvatar } from "@/components/member-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { MemberSummary } from "@/features/calendar/types";
import { formatLocalTime, type HourFormat } from "@/lib/time/zoned";

const PRESETS: Record<RuleFormValues["kind"], RuleFormValues> = {
  visit_prep: {
    kind: "visit_prep",
    name: "Preparar visita",
    enabled: true,
    eveningTime: "20:00",
    morningTime: "07:30",
    prepMinutesBefore: 60,
    taskTitle: "Ordenar la sala y el cuarto",
    taskMemberIds: [],
    taskPoints: 10,
    notifyAudience: "family",
  },
  school_prep: {
    kind: "school_prep",
    name: "Preparar colegio",
    enabled: true,
    eveningTime: "19:30",
    morningTime: "06:30",
    prepMinutesBefore: 720,
    taskTitle: "Alistar materiales y uniforme",
    taskMemberIds: [],
    taskPoints: 10,
    notifyAudience: "family",
  },
};

export function RulesManager({
  rules,
  kids,
  hourFormat,
}: {
  rules: AutomationRule[];
  kids: MemberSummary[];
  hourFormat: HourFormat;
}) {
  const byId = new Map(kids.map((k) => [k.id, k]));
  return (
    <div className="flex flex-col gap-4">
      {rules.length === 0 ? (
        <p className="text-muted-foreground">
          Aún no hay reglas. Las reglas solo se aplican a los eventos en los que un adulto las elige.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
              {r.kind === "visit_prep" ? <House aria-hidden className="size-6" /> : <GraduationCap aria-hidden className="size-6" />}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  {r.name}
                  {!r.enabled ? <Badge variant="secondary">Desactivada</Badge> : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  Aviso a las {formatLocalTime(r.eveningTime, hourFormat)} del día anterior y a las{" "}
                  {formatLocalTime(r.morningTime, hourFormat)} del día
                  {r.taskTitle ? ` · «${r.taskTitle}» ${r.prepMinutesBefore} min antes` : ""}
                </p>
              </div>
              <span className="flex -space-x-2">
                {r.taskMemberIds.map((id) => byId.get(id)).filter(Boolean).map((k) => (
                  <MemberAvatar key={k!.id} member={k!} size="sm" />
                ))}
              </span>
              <RuleDialog
                rule={r}
                kids={kids}
                trigger={
                  <Button variant="ghost" size="icon" aria-label={`Editar ${r.name}`}>
                    <Pencil aria-hidden />
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <RuleDialog
          preset="visit_prep"
          kids={kids}
          trigger={
            <Button variant="outline">
              <Plus aria-hidden /> Regla para visitas
            </Button>
          }
        />
        <RuleDialog
          preset="school_prep"
          kids={kids}
          trigger={
            <Button variant="outline">
              <Plus aria-hidden /> Regla para colegio
            </Button>
          }
        />
      </div>
    </div>
  );
}

function RuleDialog({
  rule,
  preset,
  kids,
  trigger,
}: {
  rule?: AutomationRule;
  preset?: RuleFormValues["kind"];
  kids: MemberSummary[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const initial: RuleFormValues = rule
    ? {
        kind: rule.kind,
        name: rule.name,
        enabled: rule.enabled,
        eveningTime: rule.eveningTime,
        morningTime: rule.morningTime,
        prepMinutesBefore: rule.prepMinutesBefore,
        taskTitle: rule.taskTitle ?? "",
        taskMemberIds: rule.taskMemberIds,
        taskPoints: rule.taskPoints,
        notifyAudience: rule.notifyAudience,
      }
    : { ...PRESETS[preset ?? "visit_prep"], taskMemberIds: kids.map((k) => k.id) };
  const form = useForm<RuleFormValues>({ resolver: zodResolver(ruleFormSchema), defaultValues: initial });
  const { control, register, formState } = form;
  // Lo recién guardado manda al reabrir mientras la página aún no trae la versión nueva.
  const [lastSave, setLastSave] = useState<{ before: string; values: RuleFormValues } | null>(null);

  async function onSubmit(values: RuleFormValues) {
    const result = await saveRuleAction({ ruleId: rule?.id ?? null, values });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(rule ? "Regla actualizada (se reaplicó a los próximos eventos)" : "Regla creada");
    if (rule) setLastSave({ before: JSON.stringify(initial), values });
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) form.reset(lastSave && lastSave.before === JSON.stringify(initial) ? lastSave.values : initial);
        setOpen(next);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{rule ? "Editar regla" : "Nueva regla de preparativos"}</DialogTitle>
            <DialogDescription>
              Solo se aplica a los eventos en los que la elijas. Nunca crea tareas por cualquier cita.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={!!formState.errors.name}>
              <FieldLabel htmlFor="rule-name">Nombre</FieldLabel>
              <Input id="rule-name" maxLength={80} {...register("name")} />
              <FieldError errors={[formState.errors.name]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rule-evening">Aviso la noche anterior</FieldLabel>
                <Input id="rule-evening" type="time" {...register("eveningTime")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="rule-morning">Aviso el mismo día</FieldLabel>
                <Input id="rule-morning" type="time" {...register("morningTime")} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="rule-task">Tarea de preparación (opcional)</FieldLabel>
              <Input id="rule-task" maxLength={120} {...register("taskTitle")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rule-minutes">Minutos antes del evento</FieldLabel>
                <Input id="rule-minutes" type="number" min={0} max={1440} {...register("prepMinutesBefore", { valueAsNumber: true })} />
                <FieldDescription>Hora límite de la tarea.</FieldDescription>
                <FieldError errors={[formState.errors.prepMinutesBefore]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="rule-points">Puntos</FieldLabel>
                <Input id="rule-points" type="number" min={0} max={1000} {...register("taskPoints", { valueAsNumber: true })} />
                <FieldError errors={[formState.errors.taskPoints]} />
              </Field>
            </div>
            <Controller
              control={control}
              name="taskMemberIds"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend>¿Quiénes hacen la tarea?</FieldLegend>
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
                </FieldSet>
              )}
            />
            <Controller control={control} name="notifyAudience" render={({ field }) => (
              <FieldSet>
                <FieldLegend>¿Quién ve los avisos de preparación?</FieldLegend>
                <div className="flex flex-wrap gap-2">
                  {([ ["family", "Toda la familia"], ["adults", "Solo adultos"] ] as const).map(([value, label]) => (
                    <Button key={value} type="button" variant={field.value === value ? "default" : "outline"} aria-pressed={field.value === value} onClick={() => field.onChange(value)}>{label}</Button>
                  ))}
                </div>
                <FieldDescription>Las tareas elegidas siguen apareciendo a los hijos asignados.</FieldDescription>
              </FieldSet>
            )} />
            <Controller
              control={control}
              name="enabled"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Switch id="rule-enabled" checked={field.value} onCheckedChange={field.onChange} />
                  <FieldLabel htmlFor="rule-enabled">Regla activa</FieldLabel>
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
