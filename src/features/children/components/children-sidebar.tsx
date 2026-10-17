import { Users } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

import { MemberAvatar } from "@/components/member-chip";
import type { MemberSummary } from "@/features/calendar/types";

export type SidebarKid = MemberSummary & {
  /** Dato breve bajo el nombre (p. ej., «2/4 hoy» o «40 pts»). */
  stat?: string;
  /** Aviso destacado (p. ej., «1 por revisar»). */
  badge?: string | null;
};

/**
 * Barra lateral para elegir un hijo («Todos» o uno). El estado vive en la URL
 * (`?hijo=`): se puede compartir y se renderiza en el servidor. En celulares
 * se convierte en una fila de chips desplazable.
 */
export function ChildrenSidebar({
  kids,
  selectedId,
  basePath,
  allStat,
}: {
  kids: SidebarKid[];
  selectedId: string | null;
  basePath: string;
  allStat?: string;
}) {
  const itemClass =
    "flex min-h-11 shrink-0 items-center gap-3 rounded-2xl border-2 px-3 py-2 transition-colors lg:w-full";
  return (
    <nav aria-label="Hijos" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
      <p className="mb-2 hidden px-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase lg:block">Hijos</p>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        <li className="shrink-0 lg:shrink">
          <Link
            href={basePath}
            scroll={false}
            aria-current={selectedId === null ? "page" : undefined}
            className={cn(
              itemClass,
              selectedId === null ? "border-primary bg-primary text-primary-foreground" : "border-transparent bg-card hover:bg-muted",
            )}
          >
            <span aria-hidden className="grid size-9 place-items-center rounded-full bg-muted text-foreground">
              <Users className="size-5" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-semibold">Todos</span>
              {allStat ? <span className={cn("text-sm", selectedId === null ? "opacity-90" : "text-muted-foreground")}>{allStat}</span> : null}
            </span>
          </Link>
        </li>
        {kids.map((kid) => {
          const selected = kid.id === selectedId;
          return (
            <li key={kid.id} className="shrink-0 lg:shrink">
              <Link
                href={`${basePath}?hijo=${kid.id}`}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={cn(itemClass, !selected && "border-transparent bg-card hover:bg-muted")}
                style={selected ? { borderColor: kid.color, backgroundColor: `${kid.color}1f` } : undefined}
              >
                <MemberAvatar member={kid} size="md" className="ring-0" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate font-semibold">{kid.displayName}</span>
                  {kid.stat ? <span className="truncate text-sm text-muted-foreground">{kid.stat}</span> : null}
                </span>
                {kid.badge ? (
                  <span className="shrink-0 rounded-full bg-warning/25 px-2 py-0.5 text-xs font-bold text-foreground">
                    {kid.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Valida `?hijo=`: debe ser un hijo activo de la familia; si no, «Todos». */
export function resolveSelectedKid<T extends { id: string }>(kids: T[], value: unknown): T | null {
  return typeof value === "string" ? (kids.find((k) => k.id === value) ?? null) : null;
}
