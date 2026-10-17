"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { authErrorMessage } from "./auth-errors";
import { newPasswordSchema } from "./password-schema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const schema = z
  .object({
    password: newPasswordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });

export function UpdatePasswordForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit({ password }: z.infer<typeof schema>) {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    if (onDone) {
      onDone();
      return;
    }
    router.replace("/");
    router.refresh();
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Nueva contraseña</h1>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Contraseña nueva</FieldLabel>
          <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
          <FieldDescription>Mínimo 8 caracteres, con letras y números.</FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>
        <Field data-invalid={!!errors.confirm}>
          <FieldLabel htmlFor="confirm">Repite la contraseña</FieldLabel>
          <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
          <FieldError errors={[errors.confirm]} />
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
