import type { MemberSummary } from "@/features/calendar/types";
import type { IsoDate } from "@/lib/time/zoned";

export type HouseholdTask = {
  id: string;
  title: string;
  notes: string | null;
  assignee: MemberSummary | null;
  dueDate: IsoDate | null;
  dueTime: string | null;
  dueAt: string | null;
  priority: "low" | "normal" | "high";
  visibility: "family" | "adults";
  status: "pending" | "done" | "cancelled";
  completedAt: string | null;
  version: number;
};
