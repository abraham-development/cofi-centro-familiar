import { CalendarPlus, House } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateFamilyForm } from "@/features/families/components/create-family-form";
import { MembersManager } from "@/features/families/components/members-manager";
import { listMembers } from "@/features/families/queries";
import { getAdultContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Primeros pasos" };

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Tu familia", "Integrantes", "Primer evento"];
  return (
    <ol className="flex gap-2" aria-label="Pasos">
      {steps.map((label, i) => (
        <li
          key={label}
          aria-current={current === i + 1 ? "step" : undefined}
          className={
            current === i + 1
              ? "rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground"
              : "rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground"
          }
        >
          {i + 1}. {label}
        </li>
      ))}
    </ol>
  );
}

async function Onboarding({ searchParams }: { searchParams: PageProps<"/onboarding">["searchParams"] }) {
  const ctx = await getAdultContext();
  if (!ctx) redirect("/acceso?next=/onboarding");
  const params = await searchParams;
  const step = params.paso === "integrantes" ? "members" : params.paso === "nueva" ? "new" : null;

  if (!ctx.family || step === "new") {
    return (
      <>
        <Steps current={1} />
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Crea el espacio de tu familia</h1>
          <p className="text-lg text-muted-foreground">Es privado: solo lo verán los adultos y las pantallas que autorices.</p>
        </div>
        <CreateFamilyForm />
      </>
    );
  }

  if (step === "members") {
    const members = await listMembers(ctx.supabase, ctx.family.id, { includeArchived: true });
    return (
      <>
        <Steps current={2} />
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">¿Quiénes viven en casa?</h1>
          <p className="text-lg text-muted-foreground">
            Agrega a los demás adultos e hijos. Los hijos no necesitan correo ni contraseña.
          </p>
        </div>
        <MembersManager members={members} />
        <div className="flex flex-col gap-2 border-t pt-6 sm:flex-row">
          <Button size="lg" nativeButton={false} render={<Link href="/agenda/nuevo?volver=/casa" />}>
            <CalendarPlus aria-hidden /> Crear el primer evento
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/casa" />}>
            <House aria-hidden /> Ir a la pantalla de casa
          </Button>
        </div>
      </>
    );
  }

  redirect("/casa");
}

export default function OnboardingPage(props: PageProps<"/onboarding">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <Brand />
      <div className="flex flex-col gap-6 rounded-3xl border bg-card p-5 shadow-sm sm:p-8">
        <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
          <Onboarding searchParams={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
