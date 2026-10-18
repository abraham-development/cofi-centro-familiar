import { Bell } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { cn } from "cn";

import { AppNav, AppNavLinks } from "@/components/app-shell/app-nav";
import { IdentityBadge } from "@/components/app-shell/identity-badge";
import { KioskAdultGuard } from "@/components/app-shell/kiosk-adult-guard";
import { UserMenu } from "@/components/app-shell/user-menu";
import { Brand } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { SnapshotScope } from "@/components/pwa/snapshot-scope";
import { LiveSync } from "@/components/live/live-sync";
import { getAdultContext } from "@/lib/auth/session";

/** Si este navegador también es una pantalla vinculada, la sesión de adulto es temporal. */
async function KioskSlot() {
  const store = await cookies();
  const isDevice = store.getAll().some((c) => c.name.startsWith("cofi-device"));
  return isDevice ? <KioskAdultGuard /> : null;
}

async function UserMenuSlot() {
  const ctx = await getAdultContext();
  if (!ctx?.family) return null;
  const families = [...new Map(ctx.memberships.map((m) => [m.familyId, { id: m.familyId, name: m.familyName }])).values()];
  const me = ctx.membership?.me;
  const roleLabel = ctx.membership?.role === "owner" ? "Propietario" : "Administrador";
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <SnapshotScope identity={ctx.user.id} familyId={ctx.family.id} />
      <Link href="/avisos" aria-label="Avisos" className={cn(buttonVariants({ variant: "outline", size: "icon" }), "hidden sm:inline-flex")}>
        <Bell aria-hidden />
      </Link>
      {me ? (
        <span className="hidden sm:inline-flex">
          <IdentityBadge world="parents" name={me.displayName} avatar={me} detail={roleLabel} />
        </span>
      ) : null}
      <span className="hidden lg:inline-flex">
        <LiveSync topics={[`fam:${ctx.family.id}:adults`]} session="adult" />
      </span>
      <span className="lg:hidden">
        <LiveSync topics={[`fam:${ctx.family.id}:adults`]} session="adult" showIndicator={false} />
      </span>
      <UserMenu
        familyName={ctx.family.name}
        activeFamilyId={ctx.family.id}
        families={families}
        email={ctx.user.email}
        displayName={me?.displayName ?? null}
        roleLabel={roleLabel}
        avatar={me ?? null}
      />
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>
      <Suspense fallback={null}>
        <KioskSlot />
      </Suspense>
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex w-full max-w-[110rem] items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6">
          <Link href="/casa" className="hidden rounded-xl md:block" aria-label="Centro Familiar, ir a casa">
            <Brand />
          </Link>
          <Suspense fallback={<AppNavLinks pathname={null} />}>
            <AppNav />
          </Suspense>
          <Suspense fallback={<span className="h-11 w-32" aria-hidden />}>
            <UserMenuSlot />
          </Suspense>
        </div>
      </header>
      <main id="contenido" className="mx-auto flex w-full max-w-[110rem] flex-1 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">
        {children}
      </main>
    </div>
  );
}
