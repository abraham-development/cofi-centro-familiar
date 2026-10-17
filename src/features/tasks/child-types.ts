import type { IsoDate } from "@/lib/time/zoned";

export type ChildTaskStatus = "pending" | "in_review" | "done" | "needs_correction" | "exempt" | "cancelled";

/** Responsabilidad o hábito concreto de un hijo en una fecha. */
export type ChildTask = {
  id: string;
  templateId: string | null;
  kind: "chore" | "habit";
  title: string;
  notes: string | null;
  assigneeId: string;
  dueDate: IsoDate;
  dueTime: string | null;
  dueAt: string | null;
  status: ChildTaskStatus;
  points: number;
  requiresReview: boolean;
  submittedAt: string | null;
  submittedLate: boolean | null;
  reviewNote: string | null;
  version: number;
};
