import { ArrowDownLeft, ArrowUpRight, Gift } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { cn } from "cn";

import { Meter } from "@/components/meter";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { Skeleton } from "@/components/ui/skeleton";
import type { MemberSummary } from "@/features/calendar/types";
import { ChildrenSidebar, resolveSelectedKid } from "@/features/children/components/children-sidebar";
import { listMembers } from "@/features/families/queries";
import { BalancesPanel } from "@/features/rewards/components/balances-panel";
import { RedemptionsQueue } from "@/features/rewards/components/redemptions-queue";
import { RewardsManager } from "@/features/rewards/components/rewards-manager";
import {
  type LedgerEntry,
  listBalances,
  listLedger,
  listRedemptions,
  listRewards,
  type Redemption,
  type Reward,
} from "@/features/rewards/queries";
import { requireAdultWithFamily } from "@/lib/auth/session";
import { formatShortDate } from "@/lib/time/zoned";

export const metadata: Metadata = { title: "Premios" };

const KIND_LABEL: Record<string, string> = {
  task_credit: "Tarea cumplida",
  task_reversal: "Tarea reabierta",
  redemption_debit: "Canje",
  redemption_refund: "Reembolso",
  adjustment: "Ajuste",
};

const REDEMPTION_LABEL: Record<Redemption["status"], string> = {
  requested: "Solicitado",
  approved: "Aprobado · por entregar",
  delivered: "Entregado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Panel id={id} title={title}>
      {children}
    </Panel>
  );
}

function LedgerList({ ledger, byId, showMember }: { ledger: LedgerEntry[]; byId: Map<string, MemberSummary>; showMember: boolean }) {
  if (ledger.length === 0) return <p className="text-muted-foreground">Todavía no hay movimientos.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {ledger.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-1.5">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg",
              e.amount > 0 ? "bg-brand-soft text-brand-strong" : "bg-muted text-muted-foreground",
            )}
          >
            {e.amount > 0 ? <ArrowDownLeft aria-hidden className="size-4" /> : <ArrowUpRight aria-hidden className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {showMember ? `${byId.get(e.memberId)?.displayName} · ` : ""}
              {KIND_LABEL[e.kind] ?? e.kind}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {formatShortDate(e.createdAt.slice(0, 10))}
              {e.reason ? ` · ${e.reason}` : ""}
            </p>
          </div>
          <span className={cn("text-sm font-semibold tabular-nums", e.amount > 0 && "text-success")}>
            {e.amount > 0 ? `+${e.amount}` : e.amount}
          </span>
        </li>
      ))}
    </ul>
  );
}

async function Rewards({ searchParams }: { searchParams: PageProps<"/premios">["searchParams"] }) {
  const ctx = await requireAdultWithFamily();
  const params = await searchParams;
  const members = await listMembers(ctx.supabase, ctx.family.id);
  const kids = members.filter((m) => m.kind === "child");
  const selected = resolveSelectedKid(kids, params.hijo);

  const [rewards, balances, openRedemptions, ledger, history] = await Promise.all([
    listRewards(ctx.supabase, ctx.family.id),
    listBalances(ctx.supabase, ctx.family.id),
    listRedemptions(ctx.supabase, ctx.family.id, { statuses: ["requested", "approved"] }),
    listLedger(ctx.supabase, ctx.family.id, { limit: selected ? 60 : 30, memberId: selected?.id }),
    selected
      ? listRedemptions(ctx.supabase, ctx.family.id, { memberId: selected.id, limit: 30 })
      : Promise.resolve([] as Redemption[]),
  ]);
  const byId = new Map(members.map((m) => [m.id, m]));
  const balanceRecord = Object.fromEntries(balances);

  const sidebarKids = kids.map((kid) => {
    const requests = openRedemptions.filter((r) => r.memberId === kid.id && r.status === "requested").length;
    return {
      ...kid,
      stat: `${balanceRecord[kid.id] ?? 0} pts`,
      badge: requests ? `${requests} ${requests === 1 ? "pedido" : "pedidos"}` : null,
    };
  });
  const totalRequests = openRedemptions.filter((r) => r.status === "requested").length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <ChildrenSidebar
        kids={sidebarKids}
        selectedId={selected?.id ?? null}
        basePath="/premios"
        allStat={totalRequests ? `${totalRequests} por aprobar` : undefined}
      />
      <div className="flex min-w-0 flex-col gap-4">
        {selected ? (
          <ChildRewardsFocus
            kid={selected}
            balance={balanceRecord[selected.id] ?? 0}
            balanceRecord={balanceRecord}
            open={openRedemptions.filter((r) => r.memberId === selected.id)}
            history={history}
            ledger={ledger}
            rewards={rewards}
            byId={byId}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Section id="saldos" title="Saldos">
                {kids.length ? (
                  <BalancesPanel kids={kids} balances={balanceRecord} />
                ) : (
                  <p className="text-muted-foreground">Sin hijos registrados.</p>
                )}
              </Section>
              <Section id="canjes" title="Canjes pendientes">
                <RedemptionsQueue redemptions={openRedemptions} members={byId} balances={balanceRecord} />
              </Section>
            </div>
            <div className="flex flex-col gap-4">
              <Section id="catalogo" title="Catálogo de premios">
                <RewardsManager rewards={rewards} kids={kids} />
              </Section>
              <Section id="historial" title="Movimientos recientes">
                <LedgerList ledger={ledger} byId={byId} showMember />
              </Section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChildRewardsFocus({
  kid,
  balance,
  balanceRecord,
  open,
  history,
  ledger,
  rewards,
  byId,
}: {
  kid: MemberSummary;
  balance: number;
  balanceRecord: Record<string, number>;
  open: Redemption[];
  history: Redemption[];
  ledger: LedgerEntry[];
  rewards: Reward[];
  byId: Map<string, MemberSummary>;
}) {
  const available = rewards.filter(
    (r) => r.isAvailable && (r.memberIds.length === 0 || r.memberIds.includes(kid.id)),
  );
  const earned = ledger.filter((e) => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
  const spent = ledger.filter((e) => e.amount < 0).reduce((sum, e) => sum - e.amount, 0);
  return (
    <>
      <div className="rounded-2xl border border-l-4 bg-card p-5" style={{ borderLeftColor: kid.color }}>
        <BalancesPanel kids={[kid]} balances={{ [kid.id]: balance }} />
        <p className="mt-3 text-sm text-muted-foreground">
          En los movimientos recientes: ganó <span className="font-semibold text-foreground">{earned} pts</span> y usó{" "}
          <span className="font-semibold text-foreground">{spent} pts</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Section id="canjes-hijo" title="Pedidos pendientes">
            <RedemptionsQueue redemptions={open} members={byId} balances={balanceRecord} />
          </Section>
          <Section id="disponibles-hijo" title={`Premios para ${kid.displayName}`}>
            {available.length === 0 ? (
              <p className="text-muted-foreground">No hay premios disponibles para {kid.displayName}.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {available.map((r) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
                      <Gift aria-hidden className="size-5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">{r.title}</span>
                        <span className="shrink-0 text-sm tabular-nums">
                          <span className="font-semibold">{Math.min(balance, r.cost)}</span>
                          <span className="text-muted-foreground"> / {r.cost} pts</span>
                        </span>
                      </p>
                      <Meter
                        className="mt-1.5"
                        value={balance}
                        max={r.cost}
                        tone={balance >= r.cost ? "brand" : "warning"}
                        label={`${kid.displayName} hacia «${r.title}»`}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {balance >= r.cost ? "Le alcanza" : `Le faltan ${r.cost - balance}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <div className="flex flex-col gap-4">
          <Section id="historial-canjes-hijo" title="Historial de canjes">
            {history.length === 0 ? (
              <p className="text-muted-foreground">Todavía no pidió premios.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {history.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-1.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                      <Gift aria-hidden className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.rewardTitle}</p>
                      <p className="text-xs text-muted-foreground">{formatShortDate(r.requestedAt.slice(0, 10))}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">{r.cost} pts</p>
                      <p className={cn("text-xs", r.status === "delivered" ? "text-success" : "text-muted-foreground")}>
                        {REDEMPTION_LABEL[r.status]}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section id="movimientos-hijo" title="Movimientos de puntos">
            <LedgerList ledger={ledger} byId={byId} showMember={false} />
          </Section>
        </div>
      </div>
    </>
  );
}

export default function RewardsPage(props: PageProps<"/premios">) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Premios y puntos" description="Puntos internos de la familia, sin valor monetario." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Rewards searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
