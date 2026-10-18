import { Eye, ListPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cn } from "cn";

import { ClockProvider } from "@/components/clock/clock-provider";
import { MemberAvatar } from "@/components/member-chip";
import { Meter } from "@/components/meter";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MemberSummary } from "@/features/calendar/types";
import { ChildrenSidebar, resolveSelectedKid } from "@/features/children/components/children-sidebar";
import { listMembers } from "@/features/families/queries";
import { listChildTasks, listReviewQueue, listTemplates } from "@/features/tasks/child-queries";
import type { ChildTask } from "@/features/tasks/child-types";
import { ChildTaskHistory } from "@/features/tasks/components/child-task-history";
import { CompliancePanel } from "@/features/tasks/components/compliance-panel";
import { ReviewQueue } from "@/features/tasks/components/review-queue";
import { TemplatesList } from "@/features/tasks/components/templates-list";
import { dailyProgress } from "@/features/tasks/domain/child-tasks";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { requestNow } from "@/lib/time/request-now";
import { addDays, localDateOf } from "@/lib/time/zoned";

export const metadata: Metadata = { title: "Responsabilidades" };

function Section({
  id,
  title,
  actions,
  children,
}: {
  id: string;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Panel id={id} title={title} actions={actions}>
      {children}
    </Panel>
  );
}

async function Responsibilities({ searchParams }: { searchParams: PageProps<"/responsabilidades">["searchParams"] }) {
  const ctx = await requireAdultWithFamily();
  const params = await searchParams;
  const now = await requestNow();
  const today = localDateOf(now, ctx.family.timezone);
  const members = await listMembers(ctx.supabase, ctx.family.id);
  const kids = members.filter((m) => m.kind === "child");
  const selected = resolveSelectedKid(kids, params.hijo);
  const historyDays = selected && params.dias === "30" ? 30 : 7;

  const [queue, recent, templates, todayTasks] = await Promise.all([
    listReviewQueue(ctx.supabase, ctx.family.id),
    listChildTasks(ctx.supabase, ctx.family.id, {
      from: addDays(today, -(historyDays - 1)),
      to: today,
      memberId: selected?.id,
    }),
    listTemplates(ctx.supabase, ctx.family.id),
    listChildTasks(ctx.supabase, ctx.family.id, { from: today, to: today }),
  ]);
  const byId = new Map(members.map((m) => [m.id, m]));

  const sidebarKids = kids.map((kid) => {
    const progress = dailyProgress(
      todayTasks.filter((t) => t.assigneeId === kid.id),
      today,
    );
    const toReview = queue.filter((t) => t.assigneeId === kid.id).length;
    return {
      ...kid,
      stat: progress.total ? `${progress.done}/${progress.total} hoy` : "Sin tareas hoy",
      badge: toReview ? `${toReview} por revisar` : null,
    };
  });

  return (
    <ClockProvider serverNow={now} timeZone={ctx.family.timezone} hourFormat={ctx.family.hourFormat}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <ChildrenSidebar
          kids={sidebarKids}
          selectedId={selected?.id ?? null}
          basePath="/responsabilidades"
          allStat={queue.length ? `${queue.length} por revisar` : undefined}
        />
        <div className="flex min-w-0 flex-col gap-4">
          {selected ? (
            <ChildFocus
              kid={selected}
              queue={queue.filter((t) => t.assigneeId === selected.id)}
              tasks={recent}
              templates={templates.filter((t) => t.assigneeIds.includes(selected.id))}
              byId={byId}
              today={today}
              historyDays={historyDays}
              hourFormat={ctx.family.hourFormat}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              <div className="flex flex-col gap-4">
                <Section id="revisar" title={`Por revisar${queue.length ? ` (${queue.length})` : ""}`}>
                  <ReviewQueue tasks={queue} recent={recent.filter((t) => t.status !== "in_review").reverse()} members={byId} />
                </Section>
                <Section id="semana" title="Últimos 7 días">
                  {kids.length ? (
                    <CompliancePanel kids={kids} tasks={recent} />
                  ) : (
                    <p className="text-muted-foreground">Agrega a tus hijos en Ajustes para asignarles responsabilidades.</p>
                  )}
                </Section>
              </div>
              <Section id="plantillas" title="Responsabilidades y hábitos">
                <TemplatesList templates={templates} members={byId} hourFormat={ctx.family.hourFormat} />
              </Section>
            </div>
          )}
        </div>
      </div>
    </ClockProvider>
  );
}

function ChildFocus({
  kid,
  queue,
  tasks,
  templates,
  byId,
  today,
  historyDays,
  hourFormat,
}: {
  kid: MemberSummary;
  queue: ChildTask[];
  tasks: ChildTask[];
  templates: Awaited<ReturnType<typeof listTemplates>>;
  byId: Map<string, MemberSummary>;
  today: string;
  historyDays: number;
  hourFormat: "12h" | "24h";
}) {
  const progress = dailyProgress(tasks, today);
  return (
    <>
      <header
        className="flex flex-wrap items-center gap-4 rounded-2xl border border-l-4 bg-card p-5"
        style={{ borderLeftColor: kid.color }}
      >
        <MemberAvatar member={kid} size="lg" className="ring-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">{kid.displayName}</h2>
          <p className="text-sm text-muted-foreground">
            {progress.total ? `Hoy: ${progress.done} de ${progress.total} cumplidas` : "Hoy no tiene tareas"}
            {queue.length ? ` · ${queue.length} por revisar` : ""}
          </p>
          {progress.total ? (
            <Meter
              className="mt-2 max-w-sm"
              value={progress.done}
              max={progress.total}
              color={kid.color}
              label={`Avance de hoy de ${kid.displayName}`}
            />
          ) : null}
        </div>
        <Link href={`/hijos/${kid.id}`} className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}>
          <Eye aria-hidden /> Ver su pantalla
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Section id="revisar-hijo" title={`Por revisar${queue.length ? ` (${queue.length})` : ""}`}>
            <ReviewQueue tasks={queue} recent={tasks.filter((t) => t.status !== "in_review").reverse()} members={byId} />
          </Section>
          <Section id="hoy-hijo" title="Hoy">
            <ChildTaskHistory tasks={tasks} mode="today" />
          </Section>
        </div>
        <div className="flex flex-col gap-4">
          <Section
            id="historial-hijo"
            title={`Lo que hizo · últimos ${historyDays} días`}
            actions={
              <Link
                scroll={false}
                href={`/responsabilidades?hijo=${kid.id}${historyDays === 30 ? "" : "&dias=30"}`}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                {historyDays === 30 ? "Ver 7 días" : "Ver 30 días"}
              </Link>
            }
          >
            <ChildTaskHistory tasks={tasks} mode="history" />
          </Section>
          <Section id="plantillas-hijo" title={`Responsabilidades de ${kid.displayName}`}>
            <TemplatesList templates={templates} members={byId} hourFormat={hourFormat} />
          </Section>
        </div>
      </div>
    </>
  );
}

export default function ResponsibilitiesPage(props: PageProps<"/responsabilidades">) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Responsabilidades"
        description="Tareas y hábitos de los hijos, revisión y seguimiento."
        actions={
          <Button size="lg" nativeButton={false} render={<Link href="/responsabilidades/nueva" />}>
            <ListPlus aria-hidden /> Nueva
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Responsibilities searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
