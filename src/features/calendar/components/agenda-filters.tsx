"use client";

import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "cn";

import type { CategorySummary, MemberSummary } from "../types";
import { MemberAvatar } from "@/components/member-chip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays } from "@/lib/time/zoned";

/** Cambia parámetros de la agenda en la URL, conservando el día elegido. */
function useAgendaUpdate(day: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    // `desde` es el nombre antiguo de `dia`: se normaliza al primer cambio.
    next.delete("desde");
    next.set("dia", day);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }
  return { params, pending, update };
}

/** Vista de la agenda: día por horas o lista de 7/30 días. */
export function AgendaViewToggle({ day, days, view }: { day: string; days: number; view: "dia" | "lista" }) {
  const { pending, update } = useAgendaUpdate(day);
  const viewOptions = [
    { key: "dia", label: "Día", icon: CalendarDays, changes: { vista: null, dias: null } },
    { key: "lista", label: "Lista", icon: List, changes: { vista: "lista", dias: String(days) } },
  ] as const;

  return (
    <div className={cn("flex flex-col gap-4", pending && "opacity-70")} aria-busy={pending}>
      <div className="grid grid-cols-2 rounded-xl border p-1" role="group" aria-label="Vista">
        {viewOptions.map((opt) => {
          const active = view === opt.key;
          return (
            <Button
              key={opt.key}
              type="button"
              variant={active ? "default" : "ghost"}
              aria-pressed={active}
              onClick={() => update(opt.changes)}
            >
              <opt.icon aria-hidden /> {opt.label}
            </Button>
          );
        })}
      </div>

      {view === "lista" ? (
        <div className="flex items-center gap-1">
          <div className="flex flex-1 rounded-xl border p-1" role="group" aria-label="Periodo">
            {[7, 30].map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                className="flex-1"
                variant={days === n ? "default" : "ghost"}
                aria-pressed={days === n}
                onClick={() => update({ dias: String(n) })}
              >
                {n} días
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Periodo anterior"
            onClick={() => update({ dia: addDays(day, -days) })}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Periodo siguiente"
            onClick={() => update({ dia: addDays(day, days) })}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Filtros por categoría e integrante. */
export function AgendaFilters({
  members,
  categories,
  day,
}: {
  members: MemberSummary[];
  categories: CategorySummary[];
  day: string;
}) {
  const { params, pending, update } = useAgendaUpdate(day);
  const member = params.get("miembro");
  const category = params.get("categoria");

  return (
    <div className={cn("flex flex-col gap-4", pending && "opacity-70")} aria-busy={pending}>
      <Select
        value={category ?? "todas"}
        onValueChange={(value) => update({ categoria: value === "todas" ? null : (value as string) })}
        items={[{ value: "todas", label: "Todas las categorías" }, ...categories.map((c) => ({ value: c.id, label: c.label }))]}
      >
        <SelectTrigger aria-label="Filtrar por categoría" className="w-full">
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
              "flex min-h-9 items-center gap-1.5 rounded-lg border py-0.5 pr-3 pl-0.5 text-sm font-medium",
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
