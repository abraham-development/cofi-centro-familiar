import type { loadChildScreen } from "../load-child-screen";
import { ChildNotices } from "./child-notices";
import { Eye } from "lucide-react";
import Link from "next/link";

import { ClockProvider } from "@/components/clock/clock-provider";
import { ContextClock } from "@/components/clock/context-clock";
import { MemberAvatar } from "@/components/member-chip";
import type { MemberSummary } from "@/features/calendar/types";
import { ScreenNotices } from "@/features/notifications/components/screen-notices";
import { ChildRewards } from "@/features/rewards/components/child-rewards";
import { ChildTaskBoard } from "@/features/tasks/components/child-task-board";
import type { HourFormat } from "@/lib/time/zoned";

/** Pantalla del hijo (en su cuarto o vista por un adulto). Grande y amable. */
export function ChildScreen({
  member,
  data,
  serverNow,
  timeZone,
  hourFormat,
  homeColor,
  actor,
  recipient,
  viewer,
}: {
  member: MemberSummary;
  data: Awaited<ReturnType<typeof loadChildScreen>>;
  serverNow: number;
  timeZone: string;
  hourFormat: HourFormat;
  homeColor: string;
  actor: "adult" | "device";
  /** Destinatario que reconoce los avisos en esta pantalla. */
  recipient: string;
  /** Adulto que está viendo el mundo del hijo (vista previa desde el mundo de padres). */
  viewer?: { displayName: string };
}) {
  return (
    <ClockProvider serverNow={serverNow} timeZone={timeZone} hourFormat={hourFormat}>
      <div className="flex flex-col gap-4">
        {viewer ? (
          <div
            role="note"
            className="flex flex-wrap items-center gap-3 rounded-xl border border-l-4 bg-card px-4 py-3 text-sm"
            style={{ borderLeftColor: member.color }}
          >
            <Eye aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1">
              Estás viendo el <strong>mundo de {member.displayName}</strong> como {viewer.displayName}. Lo que marques
              aquí queda registrado a tu nombre.
            </p>
            <Link
              href={`/responsabilidades?hijo=${member.id}`}
              className="font-semibold underline-offset-4 hover:underline"
            >
              Ver su seguimiento
            </Link>
          </div>
        ) : null}
        <header className="flex items-center gap-4">
          <MemberAvatar member={member} size="xl" className="ring-0" />
          <div>
            <p className="text-base text-muted-foreground">Tu día</p>
            <h1 className="text-3xl font-semibold sm:text-4xl">Hola, {member.displayName}</h1>
          </div>
        </header>
        <ContextClock events={data.events} homeColor={homeColor} variant="compact" />
        <ScreenNotices notifications={data.notifications} recipient={recipient} actor={actor} title="Para ti" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
          <ChildTaskBoard
            tasks={data.tasks}
            habitHistory={data.tasks.filter((t) => t.kind === "habit")}
            actor={actor}
          />
          <div className="flex min-w-0 flex-col gap-4">
            <ChildNotices events={data.events} />
            <ChildRewards
              memberId={member.id}
              balance={data.balance}
              rewards={data.rewards}
              redemptions={data.redemptions}
              actor={actor}
            />
          </div>
        </div>
      </div>
    </ClockProvider>
  );
}
