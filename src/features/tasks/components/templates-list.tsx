"use client";

import { ListChecks, Pause, Play } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { setTemplateStatusAction } from "../child-actions";
import type { TaskTemplate } from "../child-queries";
import { EmptyState } from "@/components/empty-state";
import { MemberStack } from "@/components/member-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MemberSummary } from "@/features/calendar/types";
import { formatLocalTime, formatShortDate, type HourFormat, WEEKDAYS_SHORT } from "@/lib/time/zoned";

export function describeTemplate(t: TaskTemplate, hourFormat: HourFormat): string {
  const when =
    t.freq === "once"
      ? `El ${formatShortDate(t.startsOn)}`
      : t.freq === "daily"
        ? "Todos los días"
        : t.freq === "weekdays"
          ? "De lunes a viernes"
          : t.freq === "weekly"
            ? t.byWeekday.map((d) => WEEKDAYS_SHORT[d - 1]).join(", ")
            : `Cada mes, día ${t.monthDay ?? Number(t.startsOn.slice(8))}`;
  const parts = [when];
  if (t.dueTime) parts.push(`antes de las ${formatLocalTime(t.dueTime, hourFormat)}`);
  parts.push(t.points ? `${t.points} pts` : "sin puntos");
  parts.push(t.requiresReview ? "con revisión" : "sin revisión");
  return parts.join(" · ");
}

export function TemplatesList({
  templates,
  members,
  hourFormat,
}: {
  templates: TaskTemplate[];
  members: Map<string, MemberSummary>;
  hourFormat: HourFormat;
}) {
  if (templates.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Sin responsabilidades todavía"
        description="Crea la primera: tender la cama, preparar la mochila, cepillarse los dientes…"
      />
    );
  }

  async function toggle(t: TaskTemplate) {
    const result = await setTemplateStatusAction({ templateId: t.id, status: t.status === "active" ? "paused" : "active" });
    if (result.ok) toast.success(t.status === "active" ? "Pausada: no se crearán tareas nuevas" : "Reactivada");
    else toast.error(result.error.message);
  }

  return (
    <ul className="flex flex-col gap-2">
      {templates.map((t) => (
        <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">
              <Link href={`/responsabilidades/${t.id}`} className="underline-offset-4 hover:underline">
                {t.title}
              </Link>
              <Badge variant="outline">{t.kind === "habit" ? "Hábito" : "Responsabilidad"}</Badge>
              {t.status === "paused" ? <Badge variant="secondary">Pausada</Badge> : null}
            </p>
            <p className="text-sm text-muted-foreground">{describeTemplate(t, hourFormat)}</p>
          </div>
          <MemberStack members={t.assigneeIds.map((id) => members.get(id)).filter((m): m is MemberSummary => !!m)} />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.status === "active" ? `Pausar ${t.title}` : `Reactivar ${t.title}`}
            onClick={() => void toggle(t)}
          >
            {t.status === "active" ? <Pause aria-hidden /> : <Play aria-hidden />}
          </Button>
        </li>
      ))}
    </ul>
  );
}
