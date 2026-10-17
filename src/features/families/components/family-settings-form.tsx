"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "cn";

import { updateFamilySettingsAction } from "../actions";
import { type FamilySettingsValues, familySettingsSchema } from "../schemas";
import { timeZoneOptions } from "../timezones";
import { ColorPicker } from "@/components/color-picker";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FamilySettingsForm({ initialValues, canEdit }: { initialValues: FamilySettingsValues; canEdit: boolean }) {
  const form = useForm<FamilySettingsValues>({
    resolver: zodResolver(familySettingsSchema),
    defaultValues: initialValues,
  });
  const { control, register, formState } = form;
  const { errors, isSubmitting, isDirty } = formState;
  const zones = timeZoneOptions(initialValues.timezone);

  async function onSubmit(values: FamilySettingsValues) {
    const result = await updateFamilySettingsAction(values);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Ajustes guardados");
    form.reset(values);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <fieldset disabled={!canEdit} className="contents">
        <FieldGroup>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="family-name">Nombre visible</FieldLabel>
            <Input id="family-name" maxLength={80} {...register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              <Field data-invalid={!!errors.timezone}>
                <FieldLabel>Zona horaria</FieldLabel>
                <Select value={field.value} onValueChange={(v) => field.onChange(v)} items={zones}>
                  <SelectTrigger className="w-full" aria-label="Zona horaria">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => (
                      <SelectItem key={z.value} value={z.value}>
                        {z.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Los eventos ya guardados conservan su instante; los nuevos usarán esta zona.
                </FieldDescription>
                <FieldError errors={[errors.timezone]} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="hourFormat"
            render={({ field }) => (
              <FieldSet>
                <FieldLegend>Formato de hora</FieldLegend>
                <div className="flex gap-2" role="radiogroup" aria-label="Formato de hora">
                  {[
                    { value: "12h", label: "12 horas (10:30 AM)" },
                    { value: "24h", label: "24 horas (22:30)" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={field.value === opt.value}
                      onClick={() => field.onChange(opt.value)}
                      className={cn(
                        "min-h-11 rounded-xl border-2 px-4 font-semibold",
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
          <FieldSet>
            <FieldLegend>Franjas del día</FieldLegend>
            <FieldDescription>Cómo se agrupa «Hoy paso a paso» en mañana, tarde y noche.</FieldDescription>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.morningEnds}>
                <FieldLabel htmlFor="morningEnds">La tarde empieza a las</FieldLabel>
                <Input id="morningEnds" type="time" {...register("morningEnds")} />
                <FieldError errors={[errors.morningEnds]} />
              </Field>
              <Field data-invalid={!!errors.afternoonEnds}>
                <FieldLabel htmlFor="afternoonEnds">La noche empieza a las</FieldLabel>
                <Input id="afternoonEnds" type="time" {...register("afternoonEnds")} />
                <FieldError errors={[errors.afternoonEnds]} />
              </Field>
            </div>
          </FieldSet>
          <FieldSet>
            <FieldLegend>Horas de silencio</FieldLegend>
            <FieldDescription>
              Las pantallas pasan a modo nocturno y las notificaciones normales esperan hasta el final (las importantes
              sí suenan).
            </FieldDescription>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.quietStart}>
                <FieldLabel htmlFor="quietStart">Desde</FieldLabel>
                <Input id="quietStart" type="time" {...register("quietStart")} />
              </Field>
              <Field data-invalid={!!errors.quietEnd}>
                <FieldLabel htmlFor="quietEnd">Hasta</FieldLabel>
                <Input id="quietEnd" type="time" {...register("quietEnd")} />
              </Field>
            </div>
          </FieldSet>
          <Controller
            control={control}
            name="homeColor"
            render={({ field }) => (
              <FieldSet>
                <FieldLegend>Color de «Toda la casa»</FieldLegend>
                <ColorPicker value={field.value} onChange={field.onChange} label="Color de toda la casa" />
              </FieldSet>
            )}
          />
        </FieldGroup>
        {canEdit ? (
          <Button type="submit" size="lg" className="self-start" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Guardando…" : "Guardar ajustes"}
          </Button>
        ) : null}
      </fieldset>
    </form>
  );
}
