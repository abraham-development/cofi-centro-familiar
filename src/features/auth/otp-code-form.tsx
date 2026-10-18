"use client";

import { useEffect, useState } from "react";

import { authErrorMessage } from "./auth-errors";
import { OTP_LENGTH, RESEND_COOLDOWN_SECONDS } from "./password-schema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/**
 * Paso de verificación con el código de 8 dígitos enviado por correo.
 * `type` = "email" para activar la cuenta, "recovery" para recuperar la contraseña.
 */
export function OtpCodeForm({
  email,
  type,
  title,
  onVerified,
  onResend,
  onBack,
}: {
  email: string;
  type: "email" | "recovery";
  title: string;
  onVerified: () => void;
  onResend: () => Promise<{ error: { message?: string; code?: string; status?: number } | null }>;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== OTP_LENGTH) {
      setError(`El código tiene ${OTP_LENGTH} dígitos.`);
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type });
    setPending(false);
    if (error) {
      setError(
        error.code === "otp_expired" || /expired|invalid/i.test(error.message ?? "")
          ? "El código no es válido o ya venció. Revisa los dígitos o pide uno nuevo."
          : authErrorMessage(error),
      );
      return;
    }
    onVerified();
  }

  async function resend() {
    setError(null);
    setNotice(null);
    const { error } = await onResend();
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setNotice("Te enviamos un código nuevo. El anterior deja de servir.");
  }

  return (
    <form onSubmit={verify} noValidate className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">
          Enviamos un código de {OTP_LENGTH} dígitos a <strong className="text-foreground">{email}</strong>. Vence en 10
          minutos.
        </p>
      </div>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      <Field>
        <FieldLabel htmlFor="otp">Código</FieldLabel>
        <Input
          id="otp"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={OTP_LENGTH}
          autoFocus
          className="h-16 text-center font-mono text-3xl tracking-[0.4em]"
          aria-describedby="otp-help"
        />
        <FieldDescription id="otp-help">Si no lo ves, revisa la carpeta de spam.</FieldDescription>
      </Field>
      <Button type="submit" size="lg" disabled={pending || code.length !== OTP_LENGTH}>
        {pending ? "Verificando…" : "Verificar código"}
      </Button>
      <div className="flex flex-col items-center gap-2 text-sm sm:flex-row sm:justify-between">
        <Button type="button" variant="link" onClick={onBack}>
          Usar otro correo
        </Button>
        <Button type="button" variant="link" onClick={resend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Reenviar código en ${cooldown} s` : "Reenviar código"}
        </Button>
      </div>
    </form>
  );
}
