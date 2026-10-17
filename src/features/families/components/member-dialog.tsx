"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "cn";

import { addMemberAction, updateMemberAction } from "../actions";
import { type MemberFormValues, memberFormSchema } from "../schemas";
import { ColorPicker } from "@/components/color-picker";
import { MemberAvatar } from "@/components/member-chip";
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
import { suggestInitials } from "../initials";

const KINDS = [
  { value: "adult", label: "Adulto" },
  { value: "child", label: "Hijo o hija" },
  { value: "other", label: "Otra persona de la casa" },
] as const;

export function MemberDialog({
  trigger,
  memberId,
  initialValues,
  lockKind,
}: {
  trigger: React.ReactElement;
  memberId?: string;
  initialValues: MemberFormValues;
  lockKind?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: initialValues,
  });
  const { control, register, formState, reset } = form;
  const preview = useWatch({ control });

  async function onSubmit(values: MemberFormValues) {
    const result = memberId
      ? await updateMemberAction({ memberId, values })
      : await addMemberAction({ values });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(memberId ? "Integrante actualizado" : "Integrante agregado");
    setOpen(false);
    if (!memberId) reset(initialValues);
  }

  const { errors, isSubmitting } = formState;
  const displayName = preview.displayName ?? "";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{memberId ? "Editar integrante" : "Agregar integrante"}</DialogTitle>
            <DialogDescription>
              Solo se necesita un nombre o alias y un color. No pedimos fecha de nacimiento ni otros datos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <MemberAvatar
              size="lg"
              member={{
                displayName,
                color: preview.color ?? "#475569",
                initials: preview.initials || suggestInitials(displayName) || "?",
                avatarEmoji: preview.avatarEmoji || null,
              }}
            />
            <span className="text-lg font-semibold">{displayName || "Vista previa"}</span>
          </div>
          <FieldGroup>
            <Field data-invalid={!!errors.displayName}>
              <FieldLabel htmlFor="displayName">Nombre o alias</FieldLabel>
              <Input id="displayName" maxLength={40} placeholder="Ej.: Mateo" {...register("displayName")} />
              <FieldError errors={[errors.displayName]} />
            </Field>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend>Tipo</FieldLegend>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de integrante">
                    {KINDS.map((k) => (
                      <button
                        key={k.value}
                        type="button"
                        role="radio"
                        aria-checked={field.value === k.value}
                        disabled={lockKind}
                        onClick={() => field.onChange(k.value)}
                        className={cn(
                          "min-h-11 rounded-xl border-2 px-3 font-semibold disabled:opacity-60",
                          field.value === k.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                        )}
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>
                  {lockKind ? (
                    <FieldDescription>Tiene una cuenta de adulto activa: su tipo no se puede cambiar.</FieldDescription>
                  ) : null}
                </FieldSet>
              )}
            />
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend>Color</FieldLegend>
                  <ColorPicker value={field.value} onChange={field.onChange} label="Color del integrante" />
                </FieldSet>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.initials}>
                <FieldLabel htmlFor="initials">Iniciales (opcional)</FieldLabel>
                <Input id="initials" maxLength={3} placeholder="Automáticas" {...register("initials")} />
                <FieldError errors={[errors.initials]} />
              </Field>
              <Field data-invalid={!!errors.avatarEmoji}>
                <FieldLabel htmlFor="avatarEmoji">Emoji (opcional)</FieldLabel>
                <Input id="avatarEmoji" maxLength={8} placeholder="Ej.: 🦖" {...register("avatarEmoji")} />
                <FieldError errors={[errors.avatarEmoji]} />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
