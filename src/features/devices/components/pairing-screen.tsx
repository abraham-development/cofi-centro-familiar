"use client";

import { Loader2, MonitorSmartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Brand } from "@/components/brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { forgetDeviceAction } from "@/features/devices/actions";
import { createDeviceClient } from "@/lib/supabase/client";

type State =
  | { name: "idle" }
  | { name: "working" }
  | { name: "code"; code: string; expiresAt: number }
  | { name: "error"; message: string };

const POLL_MS = 3000;

/**
 * Entrada de configuración directa; el código temporal queda como alternativa.
 * Solo al generar un código se prepara aquí la sesión anónima de la pantalla.
 */
export function PairingScreen({ revoked, isAdult }: { revoked: boolean; isAdult: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ name: "idle" });
  const [remaining, setRemaining] = useState(0);
  const [codeMode, setCodeMode] = useState(false);

  const checkStatus = useCallback(async () => {
    const supabase = createDeviceClient();
    // Una visita nueva (o recién revocada) todavía no tiene identidad de
    // pantalla. La RPC solo admite sesiones autenticadas.
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return false;
    const { data } = await supabase.rpc("get_device_status");
    const row = data?.[0];
    if (row?.status === "paired") {
      router.replace("/pantalla");
      router.refresh();
      return true;
    }
    if (row?.status === "revoked") {
      await forgetDeviceAction();
      await supabase.auth.signOut({ scope: "local" });
    }
    return false;
  }, [router]);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (state.name !== "code") return;
    const poll = setInterval(() => void checkStatus(), POLL_MS);
    const tick = setInterval(() => {
      const left = Math.max(0, Math.round((state.expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setState({ name: "idle" });
    }, 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [state, checkStatus]);

  async function generate() {
    setState({ name: "working" });
    const supabase = createDeviceClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setState({
          name: "error",
          message:
            error.status === 429
              ? "Se alcanzó el límite de vinculaciones desde esta red. Inténtalo más tarde."
              : "No se pudo iniciar la vinculación. Revisa la conexión.",
        });
        return;
      }
    }
    const { data, error } = await supabase.rpc("request_device_pairing");
    if (error || !data?.[0]) {
      setState({
        name: "error",
        message: error?.message.includes("RATE_LIMITED")
          ? "Demasiados códigos seguidos. Espera unos minutos."
          : error?.message.includes("ALREADY_APPLIED")
            ? "Esta pantalla ya está vinculada."
            : "No se pudo generar el código. Inténtalo de nuevo.",
      });
      if (error?.message.includes("ALREADY_APPLIED")) void checkStatus();
      return;
    }
    setState({ name: "code", code: data[0].code, expiresAt: Date.parse(data[0].expires_at) });
  }

  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-8 px-4 py-10 text-center">
      <Brand size="lg" />
      <div className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-2xl border bg-card p-8">
        <MonitorSmartphone aria-hidden className="size-14 text-muted-foreground" />
        <h1 className="text-3xl font-bold">Vincular esta pantalla</h1>
        {revoked ? (
          <Alert role="status">
            <AlertDescription>
              Esta pantalla fue desvinculada por un adulto y se borró su información local.
            </AlertDescription>
          </Alert>
        ) : null}
        {state.name === "code" ? (
          <>
            <p className="text-xl">Pide a un adulto que abra en su celular:</p>
            <p className="text-xl font-semibold">Ajustes → Pantallas → Vincular</p>
            <p className="font-mono text-[clamp(1.6rem,7vw,4.5rem)] font-bold tracking-[0.08em] whitespace-nowrap" aria-label={`Código ${state.code.split("").join(" ")}`}>
              {state.code}
            </p>
            <p className="text-lg text-muted-foreground" aria-live="polite">
              Vence en {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")} · esperando aprobación…
            </p>
            <Loader2 aria-hidden className="size-6 motion-safe:animate-spin text-muted-foreground" />
          </>
        ) : (
          <>
            <p className="max-w-md text-lg text-muted-foreground">
              Para la cocina, la sala o el cuarto de un hijo. La pantalla verá solo lo que un adulto autorice y se
              puede desvincular en cualquier momento.
            </p>
            {state.name === "error" ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}
            <Button size="lg" role="link" nativeButton={false} render={<Link href="/configuracion/dispositivos/esta-pantalla" />} className="h-auto min-h-14 whitespace-normal py-3">
              {isAdult ? "Configurar este dispositivo como pantalla" : "Entrar como adulto y configurar"}
            </Button>
            {!codeMode ? <Button variant="outline" className="h-auto min-h-11 whitespace-normal py-3" onClick={() => setCodeMode(true)}>
              Vincular mediante código desde otro equipo
            </Button> : <>
              <p className="text-sm text-muted-foreground">Genera un código y apruébalo desde la cuenta adulta en otro celular o computadora.</p>
              <Button size="lg" onClick={generate} disabled={state.name === "working"}>
                {state.name === "working" ? "Generando…" : "Generar código"}
              </Button>
            </>}
          </>
        )}
      </div>
    </main>
  );
}
