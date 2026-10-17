"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { createFamilyAction } from "../actions";
import { createFamilySchema } from "../schemas";
import { timeZoneOptions } from "../timezones";
import { ColorPicker } from "@/components/color-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommandId } from "@/hooks/use-command-id";

type Values = z.input<typeof createFamilySchema>;

const noopSubscribe = () => () => {};

export function CreateFamilyForm() {
  const router = useRouter();
  const [commandId] = useCommandId();
  const [error, setError] = useState<string | null>(null);
  // Sugerir la zona del dispositivo si es distinta (el adulto decide).
  const deviceZone = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
  const zones = useMemo(() => timeZoneOptions(deviceZone ?? "America/Lima"), [deviceZone]);
  const form = useForm<Values>({
    resolver: zodResolver(createFamilySchema),
    defaultValues: {
      commandId,
      name: "",
      timezone: "America/Lima",
      ownerDisplayName: "",
      ownerColor: "#7C3AED",
    },
  });
  const { control, register, formState } = form;

  async function onSubmit(values: Values) {
    setError(null);
    const result = await createFamilyAction({ ...values, commandId });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.replace("/onboarding?paso=integrantes");
    router.refresh();
  }

  const { errors, isSubmitting } = formState;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name" className="text-lg">
            Nombre de la familia
          </FieldLabel>
          <Input id="name" className="h-14 text-xl" placeholder="Ej.: Familia García" {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.ownerDisplayName}>
          <FieldLabel htmlFor="ownerDisplayName">¿Cómo te verán en las pantallas?</FieldLabel>
          <Input id="ownerDisplayName" placeholder="Ej.: Mamá" maxLength={40} {...register("ownerDisplayName")} />
          <FieldDescription>Puede ser tu nombre o un alias como «Mamá» o «Papá».</FieldDescription>
          <FieldError errors={[errors.ownerDisplayName]} />
        </Field>
        <Controller
          control={control}
          name="ownerColor"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend>Tu color</FieldLegend>
              <ColorPicker value={field.value} onChange={field.onChange} label="Tu color" />
            </FieldSet>
          )}
        />
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <Field data-invalid={!!errors.timezone}>
              <FieldLabel>Zona horaria de la casa</FieldLabel>
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
              <FieldError errors={[errors.timezone]} />
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Creando…" : "Crear familia"}
      </Button>
    </form>
  );
}
