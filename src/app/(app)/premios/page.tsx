import { Gift } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
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
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
      <h2 id={id} className="text-2xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function LedgerList({ ledger, byId, showMember }: { ledger: LedgerEntry[]; byId: Map<string, MemberSummary>; showMember: boolean }) {
  if (ledger.length === 0) return <p className="text-muted-foreground">Todavía no hay movimientos.</p>;
  return (
    <ul className="flex flex-col divide-y">
      {ledger.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-2">
          <span className="w-16 shrink-0 text-sm text-muted-foreground">{formatShortDate(e.createdAt.slice(0, 10))}</span>
          <span className="min-w-0 flex-1 truncate">
            {showMember ? <span className="font-semibold">{byId.get(e.memberId)?.displayName} · </span> : null}
            {KIND_LABEL[e.kind] ?? e.kind}
            {e.reason ? ` · ${e.reason}` : ""}
          </span>
          <span className={e.amount > 0 ? "font-bold text-success" : "font-bold"}>
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <ChildrenSidebar
        kids={sidebarKids}
        selectedId={selected?.id ?? null}
        basePath="/premios"
        allStat={totalRequests ? `${totalRequests} por aprobar` : undefined}
      />
      <div className="flex min-w-0 flex-col gap-6">
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
          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <div className="flex flex-col gap-6">
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
            <div className="flex flex-col gap-6">
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
      <div className="rounded-3xl border-2 bg-card p-5 shadow-sm" style={{ borderColor: kid.color }}>
        <BalancesPanel kids={[kid]} balances={{ [kid.id]: balance }} />
        <p className="mt-3 text-muted-foreground">
          En los movimientos recientes: ganó {earned} pts y usó {spent} pts.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Section id="canjes-hijo" title="Pedidos pendientes">
            <RedemptionsQueue redemptions={open} members={byId} balances={balanceRecord} />
          </Section>
          <Section id="disponibles-hijo" title={`Premios para ${kid.displayName}`}>
            {available.length === 0 ? (
              <p className="text-muted-foreground">No hay premios disponibles para {kid.displayName}.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {available.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl border p-3">
                    <Gift aria-hidden className="size-5 shrink-0" />
                    <span className="min-w-0 flex-1 font-semibold">{r.title}</span>
                    <span className="text-sm">{r.cost} pts</span>
                    <span
                      className={
                        balance >= r.cost
                          ? "rounded-full bg-success/15 px-2.5 py-0.5 text-sm font-semibold"
                          : "rounded-full bg-muted px-2.5 py-0.5 text-sm text-muted-foreground"
                      }
                    >
                      {balance >= r.cost ? "Le alcanza" : `Le faltan ${r.cost - balance}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <div className="flex flex-col gap-6">
          <Section id="historial-canjes-hijo" title="Historial de canjes">
            {history.length === 0 ? (
              <p className="text-muted-foreground">Todavía no pidió premios.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {history.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2">
                    <span className="w-16 shrink-0 text-sm text-muted-foreground">
                      {formatShortDate(r.requestedAt.slice(0, 10))}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{r.rewardTitle}</span>
                    <span className="text-sm text-muted-foreground">
                      {r.cost} pts · {REDEMPTION_LABEL[r.status]}
                    </span>
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
    <div className="flex flex-col gap-6">
      <PageHeader title="Premios y puntos" description="Puntos internos de la familia, sin valor monetario." />
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <Rewards searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
