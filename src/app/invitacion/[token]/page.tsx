import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AcceptInvitation } from "@/features/families/components/accept-invitation";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invitación", referrer: "no-referrer" };

const MESSAGES: Record<string, { title: string; body: string }> = {
  not_found: { title: "Invitación no válida", body: "El enlace no existe o está incompleto." },
  email_mismatch: {
    title: "Esta invitación es para otro correo",
    body: "Inicia sesión con el correo al que te invitaron.",
  },
  revoked: { title: "Invitación anulada", body: "Pide a la familia que te envíe una nueva." },
  used: { title: "Invitación ya utilizada", body: "Si eres tú, ya tienes acceso: entra a la pantalla de casa." },
  expired: { title: "Invitación vencida", body: "Pide a la familia que te envíe una nueva." },
};

async function Invitation({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  const user = await getSessionUser();
  const next = encodeURIComponent(`/invitacion/${token}`);

  if (!user || user.isAnonymous) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Tienes una invitación</h1>
        <p className="text-muted-foreground">Para verla, inicia sesión o crea tu cuenta con el correo al que te invitaron.</p>
        <Button size="lg" nativeButton={false} render={<Link href={`/acceso?next=${next}`} />}>
          Iniciar sesión
        </Button>
        <Button size="lg" variant="outline" nativeButton={false} render={<Link href={`/registro?next=${next}`} />}>
          Crear cuenta
        </Button>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation_preview", { p_token: token });
  const preview = data?.[0];

  if (!preview || preview.status !== "valid") {
    const msg = MESSAGES[preview?.status ?? "not_found"] ?? MESSAGES.not_found;
    return (
      <div className="flex flex-col gap-3" role="status">
        <h1 className="text-2xl font-semibold">{msg.title}</h1>
        <p className="text-muted-foreground">{msg.body}</p>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Ir al inicio
        </Button>
      </div>
    );
  }

  return <AcceptInvitation token={token} familyName={preview.family_name} />;
}

export default function InvitationPage(props: PageProps<"/invitacion/[token]">) {
  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
      <Brand size="lg" />
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 sm:p-8">
        <Suspense fallback={<Skeleton className="h-48 rounded-2xl" />}>
          <Invitation {...props} />
        </Suspense>
      </div>
    </main>
  );
}
