import { cn } from "cn";

import type { MemberSummary } from "@/features/calendar/types";
import { readableTextColor } from "@/lib/colors";

type MemberLike = Pick<MemberSummary, "displayName" | "color" | "initials" | "avatarEmoji">;

export function MemberAvatar({
  member,
  size = "md",
  className,
}: {
  member: MemberLike;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "size-7 text-[0.7rem]",
    md: "size-9 text-sm",
    lg: "size-12 text-base",
    xl: "size-20 text-2xl",
  } as const;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-bold ring-2 ring-background",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: member.color, color: readableTextColor(member.color) }}
    >
      {member.avatarEmoji ? (
        <span className="text-[1.35em] leading-none">{member.avatarEmoji}</span>
      ) : (
        member.initials
      )}
    </span>
  );
}

/** Integrante con color + iniciales + nombre (el color nunca es la única señal). */
export function MemberChip({ member, size = "md" }: { member: MemberLike; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card pr-3 font-medium",
        size === "sm" ? "text-sm" : "text-base",
      )}
      style={{ borderColor: member.color }}
    >
      <MemberAvatar member={member} size="sm" className="ring-0" />
      {member.displayName}
    </span>
  );
}

/** Pila compacta de participantes, con nombres accesibles. */
export function MemberStack({
  members,
  wholeFamily,
  homeColor,
  max = 4,
}: {
  members: MemberLike[];
  wholeFamily?: boolean;
  homeColor?: string;
  max?: number;
}) {
  if (wholeFamily) {
    const color = homeColor ?? "#FACC15";
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold"
        style={{ backgroundColor: color, color: readableTextColor(color) }}
      >
        Toda la casa
      </span>
    );
  }
  if (members.length === 0) return null;
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;
  const label = members.map((m) => m.displayName).join(", ");
  return (
    <span className="inline-flex items-center" title={label}>
      <span className="sr-only">Participantes: {label}</span>
      <span aria-hidden className="flex -space-x-2">
        {shown.map((m) => (
          <MemberAvatar key={`${m.displayName}-${m.initials}`} member={m} size="sm" />
        ))}
        {rest > 0 ? (
          <span className="inline-grid size-7 place-items-center rounded-full bg-muted text-xs font-bold ring-2 ring-background">
            +{rest}
          </span>
        ) : null}
      </span>
    </span>
  );
}
