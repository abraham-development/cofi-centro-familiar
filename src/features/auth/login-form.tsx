"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { authErrorMessage } from "./auth-errors";
import { OtpCodeForm } from "./otp-code-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.email("Escribe un correo válido"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error?.code === "email_not_confirmed") {
      // La cuenta existe pero falta confirmar el correo: se envía un código nuevo.
      await supabase.auth.resend({ type: "signup", email: values.email });
      setConfirmEmail(values.email);
      return;
    }
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    // Discard any logged-out protected route that was prefetched before login.
    window.location.replace(safeNextPath(params.get("next")));
  }

  if (confirmEmail) {
    return (
      <OtpCodeForm
        email={confirmEmail}
        type="email"
        title="Confirma tu correo para entrar"
        onVerified={() => {
          window.location.replace(safeNextPath(params.get("next")));
        }}
        onResend={() => createClient().auth.resend({ type: "signup", email: confirmEmail })}
        onBack={() => setConfirmEmail(null)}
      />
    );
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Iniciar sesión</h1>
        <p className="text-muted-foreground">Acceso para adultos de la familia.</p>
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
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>
      <div className="flex flex-col gap-2 text-center text-sm sm:flex-row sm:justify-between">
        <Link className="font-medium underline-offset-4 hover:underline" href="/recuperar">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link className="font-medium underline-offset-4 hover:underline" href="/registro">
          Crear cuenta
        </Link>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        ¿Es una pantalla de cocina o de un cuarto?{" "}
        <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/vincular">
          Vincular esta pantalla
        </Link>
      </p>
    </form>
  );
}
