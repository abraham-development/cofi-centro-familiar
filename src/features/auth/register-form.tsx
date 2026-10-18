"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { authErrorMessage } from "./auth-errors";
import { OtpCodeForm } from "./otp-code-form";
import { newPasswordSchema } from "./password-schema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/client";

const schema = z
  .object({
    email: z.email("Escribe un correo válido"),
    password: newPasswordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", confirm: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setError(null);
    const next = safeNextPath(params.get("next"), "/onboarding");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email: values.email, password: values.password });
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    if (data.session) {
      router.replace(next);
      router.refresh();
      return;
    }
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <OtpCodeForm
        email={sentTo}
        type="email"
        title="Activa tu cuenta"
        onVerified={() => {
          router.replace(safeNextPath(params.get("next"), "/onboarding"));
          router.refresh();
        }}
        onResend={() => createClient().auth.resend({ type: "signup", email: sentTo })}
        onBack={() => setSentTo(null)}
      />
    );
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Crear cuenta de adulto</h1>
        <p className="text-muted-foreground">
          Los hijos no necesitan cuenta: los agregarás como integrantes de tu familia.
        </p>
      </div>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Correo</FieldLabel>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby="password-help"
            {...form.register("password")}
          />
          <FieldDescription id="password-help">Mínimo 8 caracteres, con letras y números.</FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>
        <Field data-invalid={!!errors.confirm}>
          <FieldLabel htmlFor="confirm">Repite la contraseña</FieldLabel>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirm}
            {...form.register("confirm")}
          />
          <FieldError errors={[errors.confirm]} />
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">Te enviaremos un código de 8 dígitos para confirmar tu correo.</p>
      <p className="text-center text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link className="font-medium underline-offset-4 hover:underline" href="/acceso">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
