import { ListTodo, MonitorSmartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdultsPanel } from "@/features/families/components/adults-panel";
import { FamilySettingsForm } from "@/features/families/components/family-settings-form";
import { MembersManager } from "@/features/families/components/members-manager";
import { listAdults, listMembers, listPendingInvitations } from "@/features/families/queries";
import { requireAdultWithFamily } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ajustes" };

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Panel id={id} title={title} caption={description}>
      {children}
    </Panel>
  );
}

async function Settings() {
  const ctx = await requireAdultWithFamily();
  const isOwner = ctx.membership.role === "owner";
  const [members, adults, invitations] = await Promise.all([
    listMembers(ctx.supabase, ctx.family.id, { includeArchived: true }),
    listAdults(ctx.supabase, ctx.family.id, ctx.user.id),
    isOwner ? listPendingInvitations(ctx.supabase, ctx.family.id) : Promise.resolve([]),
  ]);
  const linkable = members.filter((m) => m.kind === "adult" && !m.hasAccount && !m.archivedAt);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Section id="integrantes" title="Integrantes" description="Personas de la casa, sus colores e iniciales.">
          <MembersManager members={members} />
        </Section>
        <Section id="adultos" title="Adultos con acceso" description="Quiénes pueden administrar la familia.">
          <AdultsPanel adults={adults} invitations={invitations} linkableMembers={linkable} isOwner={isOwner} />
        </Section>
      </div>
      <Section id="familia" title="Familia" description="Nombre, zona horaria y preferencias de la pantalla.">
        <FamilySettingsForm
          canEdit
          initialValues={{
            name: ctx.family.name,
            timezone: ctx.family.timezone,
            hourFormat: ctx.family.hourFormat,
            morningEnds: ctx.family.morningEnds,
            afternoonEnds: ctx.family.afternoonEnds,
            homeColor: ctx.family.homeColor,
            quietStart: ctx.family.quietStart,
            quietEnd: ctx.family.quietEnd,
          }}
        />
      </Section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ajustes"
        actions={
          <>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/configuracion/reglas" />}>
              <ListTodo aria-hidden /> Reglas de preparativos
            </Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/configuracion/dispositivos" />}>
              <MonitorSmartphone aria-hidden /> Pantallas vinculadas
            </Button>
          </>
        }
      />
      <Suspense fallback={<Skeleton className="h-[36rem] rounded-2xl" />}>
        <Settings />
      </Suspense>
    </div>
  );
}
