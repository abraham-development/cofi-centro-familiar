import type { IsoDate } from "@/lib/time/zoned";

export type MemberSummary = {
  id: string;
  displayName: string;
  color: string;
  initials: string;
  kind: "adult" | "child" | "other";
  avatarEmoji: string | null;
};

export type CategorySummary = {
  id: string;
  key: string;
  label: string;
  icon: string;
};

export type EventVisibility = "family" | "participants" | "adults";

/** Evento tal como lo consume la interfaz (ya autorizado por RLS). */
export type AgendaEvent = {
  id: string;
  title: string;
  status: "scheduled" | "cancelled";
  isAllDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: IsoDate | null;
  /** Fin exclusivo en días completos. */
  endDate: IsoDate | null;
  localStartDate: IsoDate;
  localEndDate: IsoDate;
  timezone: string;
  category: CategorySummary | null;
  importance: "normal" | "high";
  visibility: EventVisibility;
  wholeFamily: boolean;
  location: string | null;
  description: string | null;
  participants: MemberSummary[];
  version: number;
  seriesId: string | null;
  occurrenceDate: IsoDate | null;
};
