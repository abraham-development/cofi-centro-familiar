import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import Loading from "../../loading";
import { ChildScreen } from "@/features/children/components/child-screen";
import { loadChildScreen } from "@/features/children/load-child-screen";
import { listMembers } from "@/features/families/queries";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { requestNow } from "@/lib/time/request-now";
import { uuidSchema } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Vista del hijo" };

async function ChildView({ params }: PageProps<"/hijos/[memberId]">) {
  const ctx = await requireAdultWithFamily();
  const { memberId } = await params;
  if (!uuidSchema.safeParse(memberId).success) notFound();
  const member = (await listMembers(ctx.supabase, ctx.family.id)).find((m) => m.id === memberId && m.kind === "child");
  if (!member) notFound();
  const now = await requestNow();
  const data = await loadChildScreen(ctx.supabase, ctx.family, member, now);
  return (
    <ChildScreen
      member={member}
      data={data}
      serverNow={now}
      timeZone={ctx.family.timezone}
      hourFormat={ctx.family.hourFormat}
      homeColor={ctx.family.homeColor}
      actor="adult"
      recipient={`user:${ctx.user.id}`}
      viewer={{ displayName: ctx.membership.me.displayName }}
    />
  );
}

export default function ChildPage(props: PageProps<"/hijos/[memberId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <ChildView {...props} />
    </Suspense>
  );
}
