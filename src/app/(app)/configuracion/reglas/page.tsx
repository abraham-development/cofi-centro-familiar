import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { RulesManager } from "@/features/automations/components/rules-manager";
import { listRules } from "@/features/automations/queries";
import { listMembers } from "@/features/families/queries";
import { requireAdultWithFamily } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reglas de preparativos" };

async function Rules() {
  const ctx = await requireAdultWithFamily();
  const [rules, members] = await Promise.all([
    listRules(ctx.supabase, ctx.family.id),
    listMembers(ctx.supabase, ctx.family.id),
  ]);
  return (
    <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
      <RulesManager rules={rules} kids={members.filter((m) => m.kind === "child")} hourFormat={ctx.family.hourFormat} />
    </div>
  );
}

export default function RulesPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Reglas de preparativos"
        description="Visitas y colegio: avisos la noche anterior y en la mañana, y misiones de preparación para los hijos."
      />
      <Suspense fallback={<Skeleton className="h-72 rounded-3xl" />}>
        <Rules />
      </Suspense>
    </div>
  );
}
