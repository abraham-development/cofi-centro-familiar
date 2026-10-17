import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { listMembers } from "@/features/families/queries";
import { HouseholdForm } from "@/features/tasks/components/household-form";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Pendiente" };

async function EditTask({ params }: PageProps<"/pendientes/[taskId]">) {
  const ctx = await requireAdultWithFamily();
  const { taskId } = await params;
  if (!uuidSchema.safeParse(taskId).success) notFound();
  const [{ data: task, error }, members] = await Promise.all([
    ctx.supabase
      .from("task_occurrences")
      .select("id, title, notes, assignee_member_id, due_date, due_time, priority, visibility, status, version")
      .eq("family_id", ctx.family.id)
      .eq("kind", "household")
      .eq("id", taskId)
      .maybeSingle(),
    listMembers(ctx.supabase, ctx.family.id),
  ]);
  if (error) throw error;
  if (!task || task.status === "cancelled") notFound();
  return (
    <HouseholdForm
      key={`${task.id}-${task.version}`}
      mode="edit"
      taskId={task.id}
      version={task.version}
      members={members}
      returnTo="/pendientes"
      initialValues={{
        title: task.title,
        notes: task.notes ?? "",
        assigneeMemberId: task.assignee_member_id,
        dueDate: task.due_date,
        dueTime: task.due_time ? task.due_time.slice(0, 5) : null,
        priority: task.priority as "low" | "normal" | "high",
        visibility: task.visibility as "family" | "adults",
      }}
    />
  );
}

export default function TaskPage(props: PageProps<"/pendientes/[taskId]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title="Editar pendiente" />
      <Suspense fallback={<Skeleton className="h-[32rem] rounded-3xl" />}>
        <EditTask {...props} />
      </Suspense>
    </div>
  );
}
