import { LockKeyhole } from "lucide-react";
import Link from "next/link";

import { Panel } from "@/components/panel";
import { ScreenControls } from "@/components/pwa/screen-controls";
import { buttonVariants } from "@/components/ui/button";
import { ChildAppearanceForm } from "@/features/children/components/child-appearance-form";
import type { ChildAppearance } from "@/features/children/appearance";
import type { MemberSummary } from "@/features/calendar/types";

export function LinkedScreenSettings({ name, member, appearance }: { name: string; member?: MemberSummary; appearance?: ChildAppearance }) {
  return <section aria-label="Ajustes de mi pantalla" className="flex flex-col gap-4">
    <header><h2 className="text-2xl font-semibold">Ajustes de mi pantalla</h2><p className="mt-1 text-sm text-muted-foreground">{name}{member ? ` · Vinculada a ${member.displayName}` : " · Pantalla familiar"}</p></header>
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      {member && appearance ? <ChildAppearanceForm key={member.id} member={member} appearance={appearance} /> : null}
      <div className="flex min-w-0 flex-col gap-4">
        <ScreenControls />
        <Panel id="acceso-adultos" title="Para los adultos" caption="Las tareas, premios y reglas familiares se administran con una cuenta adulta">
          <Link href="/acceso?next=/casa" className={buttonVariants({ variant: "outline", className: "self-start" })}><LockKeyhole aria-hidden />Acceso para adultos</Link>
        </Panel>
      </div>
    </div>
  </section>;
}
