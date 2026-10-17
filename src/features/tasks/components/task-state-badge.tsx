import { cn } from "cn";

import type { TaskState } from "../domain/child-tasks";

const TONES: Record<TaskState["tone"], string> = {
  neutral: "bg-muted text-foreground",
  warning: "bg-warning/20 text-foreground",
  info: "bg-ring/15 text-foreground",
  success: "bg-success/15 text-foreground",
  muted: "bg-muted text-muted-foreground",
};

export function TaskStateBadge({ state, className }: { state: TaskState; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold", TONES[state.tone], className)}>
      {state.label}
    </span>
  );
}
