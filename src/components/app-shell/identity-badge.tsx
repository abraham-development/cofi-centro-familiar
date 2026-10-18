import { House } from "lucide-react";
import { cn } from "cn";

import { MemberAvatar } from "@/components/member-chip";

export type World = "parents" | "child" | "home";

const WORLD_LABEL: Record<World, string> = {
  parents: "Padres",
  child: "Hijos",
  home: "Casa",
};

const WORLD_DESCRIPTION: Record<World, string> = {
  parents: "Mundo de padres",
  child: "Mundo de hijos",
  home: "Pantalla de la casa",
};

/**
 * Quién está usando esta pantalla y en qué «mundo» está: padres
 * (administración), hijos (su pantalla) o casa (pantalla común).
 * En celulares se reduce al avatar; el nombre completo queda accesible.
 */
export function IdentityBadge({
  world,
  name,
  avatar,
  detail,
  accentColor,
}: {
  world: World;
  name: string;
  avatar?: { displayName: string; color: string; initials: string; avatarEmoji: string | null };
  /** Información adicional para el título emergente (p. ej., el rol). */
  detail?: string;
  /** Color del mundo del hijo; por defecto, el del propio avatar. */
  accentColor?: string;
}) {
  const label = `${world === "home" ? "Pantalla" : "Conectado como"} ${name} · ${WORLD_DESCRIPTION[world]}`;
  const childColor = accentColor ?? avatar?.color ?? "#16A34A";
  return (
    <span
      data-world={world}
      title={detail ? `${label} · ${detail}` : label}
      className="inline-flex min-h-10 items-center gap-2.5 rounded-xl border bg-card py-1 pr-1 pl-1 pointer-coarse:min-h-11 sm:pr-3"
    >
      <span className="sr-only">{detail ? `${label} (${detail})` : label}</span>
      {avatar ? (
        <MemberAvatar member={avatar} size="sm" className="ring-0" />
      ) : (
        <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-muted text-foreground">
          <House className="size-4" />
        </span>
      )}
      <span aria-hidden className="hidden min-w-0 flex-col leading-tight sm:flex">
        <span className="max-w-36 truncate text-sm font-semibold">{name}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn("size-1.5 rounded-full", world === "parents" && "bg-brand", world === "home" && "bg-highlight")}
            style={world === "child" ? { backgroundColor: childColor } : undefined}
          />
          {WORLD_LABEL[world]}
          {detail ? <span className="hidden lg:inline">· {detail}</span> : null}
        </span>
      </span>
    </span>
  );
}
