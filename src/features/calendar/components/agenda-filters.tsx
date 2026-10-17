"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "cn";

import type { CategorySummary, MemberSummary } from "../types";
import { MemberAvatar } from "@/components/member-chip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays } from "@/lib/time/zoned";

export function AgendaFilters({
  members,
  categories,
  from,
  days,
  view,
  today,
}: {
  members: MemberSummary[];
  categories: CategorySummary[];
  from: string;
  days: number;
  view: "lista" | "mes";
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const member = params.get("miembro");
  const category = params.get("categoria");

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const step = view === "mes" ? 30 : days;

  return (
    <div className={cn("flex flex-col gap-3", pending && "opacity-70")} aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border p-1" role="group" aria-label="Vista">
          {[
            { label: "Hoy", value: { vista: "lista", dias: "1", desde: today } },
            { label: "7 días", value: { vista: "lista", dias: "7" } },
            { label: "30 días", value: { vista: "lista", dias: "30" } },
            { label: "Mes", value: { vista: "mes", dias: null } },
          ].map((opt) => {
            const active =
              opt.value.vista === view &&
              (view === "mes" || (opt.value.dias === String(days) && (opt.label !== "Hoy" || from === today)));
            return (
              <Button
                key={opt.label}
                type="button"
                size="sm"
                variant={active ? "default" : "ghost"}
                aria-pressed={active}
                onClick={() => update(opt.value as Record<string, string | null>)}
              >
                {opt.label}
              </Button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Periodo anterior"
            onClick={() => update({ desde: addDays(from, -step) })}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button type="button" variant="outline" onClick={() => update({ desde: null })}>
            Hoy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Periodo siguiente"
            onClick={() => update({ desde: addDays(from, step) })}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <Select
          value={category ?? "todas"}
          onValueChange={(value) => update({ categoria: value === "todas" ? null : (value as string) })}
          items={[{ value: "todas", label: "Todas las categorías" }, ...categories.map((c) => ({ value: c.id, label: c.label }))]}
        >
          <SelectTrigger aria-label="Filtrar por categoría" className="min-w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por integrante">
        <Button
          type="button"
          size="sm"
          variant={member ? "outline" : "default"}
          aria-pressed={!member}
          onClick={() => update({ miembro: null })}
        >
          Todos
        </Button>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={member === m.id}
            onClick={() => update({ miembro: member === m.id ? null : m.id })}
            className={cn(
              "flex min-h-9 items-center gap-1.5 rounded-full border-2 py-0.5 pr-3 pl-0.5 text-sm font-semibold",
              member !== m.id && "hover:bg-muted",
            )}
            style={member === m.id ? { borderColor: m.color, backgroundColor: `${m.color}1f` } : undefined}
          >
            <MemberAvatar member={m} size="sm" className="ring-0" />
            {m.displayName}
          </button>
        ))}
      </div>
    </div>
  );
}
