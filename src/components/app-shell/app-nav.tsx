"use client";

import { CalendarDays, ClipboardList, Gift, House, ListChecks, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const LINKS = [
  { href: "/casa", label: "Casa", icon: House },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/pendientes", label: "Pendientes de hoy", icon: ClipboardList },
  { href: "/responsabilidades", label: "Tareas", icon: ListChecks },
  { href: "/premios", label: "Premios", icon: Gift },
  { href: "/configuracion", label: "Ajustes", icon: Settings },
] as const;

/** Navegación con la sección activa resaltada (lee la URL en el cliente). */
export function AppNav() {
  const pathname = usePathname();
  return <AppNavLinks pathname={pathname} />;
}

/** Versión sin estado activo: sirve de fallback estático mientras llega la URL. */
export function AppNavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Principal">
      <ul className="flex gap-0.5 rounded-xl border bg-card p-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = !!pathname && (pathname === href || pathname.startsWith(`${href}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 min-w-9 items-center justify-center gap-2 rounded-lg px-2 text-sm transition-colors pointer-coarse:h-11 pointer-coarse:min-w-11 xl:px-3",
                  active
                    ? "bg-muted font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                    : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon aria-hidden className={cn("size-[1.125rem]", active && "text-brand-strong")} />
                <span className="hidden xl:inline">{label}</span>
                <span className="sr-only xl:hidden">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
