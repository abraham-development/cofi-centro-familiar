import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { listMembers } from "@/features/families/queries";
import { HouseholdForm } from "@/features/tasks/components/household-form";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Nuevo pendiente" };

async function NewTask({ searchParams }: { searchParams: PageProps<"/pendientes/nuevo">["searchParams"] }) {
  const ctx = await requireAdultWithFamily();
  const params = await searchParams;
  const members = await listMembers(ctx.supabase, ctx.family.id);
  return (
    <HouseholdForm
      mode="create"
      members={members}
      returnTo={safeNextPath(typeof params.volver === "string" ? params.volver : null, "/pendientes")}
      initialValues={{
        title: "",
        notes: "",
        assigneeMemberId: null,
        dueDate: null,
        dueTime: null,
        priority: "normal",
        visibility: "family",
      }}
    />
  );
}

export default function NewTaskPage(props: PageProps<"/pendientes/nuevo">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title="Nuevo pendiente" />
      <Suspense fallback={<Skeleton className="h-[32rem] rounded-2xl" />}>
        <NewTask searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
