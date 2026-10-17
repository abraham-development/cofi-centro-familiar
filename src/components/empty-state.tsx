import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
      <Icon aria-hidden className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-lg font-semibold">{title}</p>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
