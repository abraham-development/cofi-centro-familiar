"use client";

import { CheckCheck, Gift, House, Settings } from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { cn } from "cn";

import { resolveWorldView, type WorldView } from "@/features/children/appearance";

export function WorldLink({ view, children, onClick, ...props }: Omit<ComponentProps<"a">, "href"> & { view: WorldView }) {
  return <a {...props} href={`/pantalla?vista=${view}`} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState(null, "", `/pantalla?vista=${view}`);
  }}>{children}</a>;
}

const tabs = [
  { view: "inicio", label: "Inicio", icon: House },
  { view: "tareas", label: "Tareas", icon: CheckCheck },
  { view: "premios", label: "Premios", icon: Gift },
  { view: "ajustes", label: "Ajustes", icon: Settings },
] as const;

export function LinkedWorldShell({ scope, start, tasks, rewards, settings }: {
  scope: "child" | "home"; start: React.ReactNode; tasks?: React.ReactNode;
  rewards?: React.ReactNode; settings: React.ReactNode;
}) {
  const search = useSearchParams();
  const view = resolveWorldView(search.get("vista"), scope);
  return <>
    <nav aria-label={scope === "child" ? "Mi mundo" : "Mi pantalla"} className={cn("grid gap-1 rounded-2xl border bg-card p-1 sm:flex sm:gap-2 sm:p-2", scope === "child" ? "grid-cols-4" : "grid-cols-2")}>
      {tabs.filter((t) => scope === "child" || t.view === "inicio" || t.view === "ajustes").map(({ view: target, label, icon: Icon }) => (
        <WorldLink key={target} view={target} aria-current={view === target ? "page" : undefined}
          className={cn("flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors sm:flex-row sm:gap-2 sm:px-5 sm:text-sm", view === target ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
          <Icon aria-hidden className="size-4 sm:size-5" />{label}
        </WorldLink>
      ))}
    </nav>
    {view === "inicio" ? start : view === "tareas" ? tasks : view === "premios" ? rewards : settings}
  </>;
}
