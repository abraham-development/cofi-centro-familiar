"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { authErrorMessage } from "./auth-errors";
import { OtpCodeForm } from "./otp-code-form";
import { UpdatePasswordForm } from "./update-password-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({ email: z.email("Escribe un correo válido") });

type Step = { name: "email" } | { name: "code"; email: string } | { name: "password" };

/** Recuperación en tres pasos: correo → código de 8 dígitos → nueva contraseña. */
export function RecoverForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "email" });
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const sendCode = (email: string) => createClient().auth.resetPasswordForEmail(email);

  async function onSubmit({ email }: z.infer<typeof schema>) {
    setError(null);
    const { error } = await sendCode(email);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    // Mismo resultado exista o no la cuenta: no revela qué correos están registrados.
    setStep({ name: "code", email });
  }

  if (step.name === "code") {
    return (
      <OtpCodeForm
        email={step.email}
        type="recovery"
        title="Escribe tu código"
        onVerified={() => setStep({ name: "password" })}
        onResend={() => sendCode(step.email)}
        onBack={() => setStep({ name: "email" })}
      />
    );
  }

  if (step.name === "password") {
    return <UpdatePasswordForm onDone={() => { router.replace("/"); router.refresh(); }} />;
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
        <p className="text-muted-foreground">
          Si el correo tiene una cuenta, te enviaremos un código de 8 dígitos para crear una nueva contraseña.
        </p>
      </div>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor="email">Correo</FieldLabel>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
        <FieldError errors={[errors.email]} />
      </Field>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Enviando…" : "Enviar código"}
      </Button>
      <Link className="text-center text-sm font-medium underline-offset-4 hover:underline" href="/acceso">
        Volver
      </Link>
    </form>
  );
}
