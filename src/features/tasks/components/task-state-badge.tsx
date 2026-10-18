import { cn } from "cn";

import type { TaskState } from "../domain/child-tasks";

const TONES: Record<TaskState["tone"], { chip: string; dot: string }> = {
  neutral: { chip: "bg-muted text-foreground", dot: "bg-muted-foreground" },
  warning: { chip: "bg-warning/15 text-foreground", dot: "bg-warning" },
  info: { chip: "bg-brand-soft text-brand-strong", dot: "bg-brand" },
  success: { chip: "bg-success/12 text-success", dot: "bg-success" },
  muted: { chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
};

/** Estado de una tarea con punto de color y texto (el color nunca es la única señal). */
export function TaskStateBadge({ state, className }: { state: TaskState; className?: string }) {
  const tone = TONES[state.tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        tone.chip,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
      {state.label}
    </span>
  );
}
