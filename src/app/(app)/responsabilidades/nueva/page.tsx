import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { listMembers } from "@/features/families/queries";
import { TemplateForm } from "@/features/tasks/components/template-form";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { requestNow } from "@/lib/time/request-now";
import { localDateOf } from "@/lib/time/zoned";

export const metadata: Metadata = { title: "Nueva responsabilidad" };

async function NewTemplate() {
  const ctx = await requireAdultWithFamily();
  const today = localDateOf(await requestNow(), ctx.family.timezone);
  const kids = (await listMembers(ctx.supabase, ctx.family.id)).filter((m) => m.kind === "child");
  if (kids.length === 0) {
    return <p className="text-lg text-muted-foreground">Primero agrega a tus hijos en Ajustes → Integrantes.</p>;
  }
  return (
    <TemplateForm
      kids={kids}
      initialValues={{
        kind: "chore",
        title: "",
        description: "",
        points: 10,
        requiresReview: true,
        dueTime: null,
        assigneeIds: kids.length === 1 ? [kids[0].id] : [],
        freq: "daily",
        intervalCount: 1,
        byWeekday: [],
        monthDay: null,
        missingDayPolicy: "skip",
        startsOn: today,
        untilOn: null,
      }}
    />
  );
}

export default function NewTemplatePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title="Nueva responsabilidad o hábito" />
      <Suspense fallback={<Skeleton className="h-[36rem] rounded-3xl" />}>
        <NewTemplate />
      </Suspense>
    </div>
  );
}
