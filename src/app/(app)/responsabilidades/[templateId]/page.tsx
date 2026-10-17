import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { listMembers } from "@/features/families/queries";
import { getTemplate } from "@/features/tasks/child-queries";
import { TemplateForm } from "@/features/tasks/components/template-form";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Responsabilidad" };

async function EditTemplate({ params }: PageProps<"/responsabilidades/[templateId]">) {
  const ctx = await requireAdultWithFamily();
  const { templateId } = await params;
  if (!uuidSchema.safeParse(templateId).success) notFound();
  const [template, members] = await Promise.all([
    getTemplate(ctx.supabase, ctx.family.id, templateId),
    listMembers(ctx.supabase, ctx.family.id),
  ]);
  if (!template || template.status === "archived") notFound();
  return (
    <TemplateForm
      key={`${template.id}-${template.version}`}
      templateId={template.id}
      version={template.version}
      kids={members.filter((m) => m.kind === "child")}
      initialValues={{
        kind: template.kind,
        title: template.title,
        description: template.description ?? "",
        points: template.points,
        requiresReview: template.requiresReview,
        dueTime: template.dueTime,
        assigneeIds: template.assigneeIds,
        freq: template.freq,
        intervalCount: template.intervalCount,
        byWeekday: template.byWeekday,
        monthDay: template.monthDay,
        missingDayPolicy: template.missingDayPolicy,
        startsOn: template.startsOn,
        untilOn: template.untilOn,
      }}
    />
  );
}

export default function TemplatePage(props: PageProps<"/responsabilidades/[templateId]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Editar responsabilidad"
        description="Los cambios se aplican a las próximas tareas; lo ya entregado o revisado no se modifica."
      />
      <Suspense fallback={<Skeleton className="h-[36rem] rounded-3xl" />}>
        <EditTemplate {...props} />
      </Suspense>
    </div>
  );
}
