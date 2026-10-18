import { Star } from "lucide-react";
import { cn } from "cn";

/** Marca de evento importante: icono con texto accesible (sin emojis). */
export function ImportantMark({ className }: { className?: string }) {
  return (
    <>
      <span className="sr-only"> (importante)</span>
      <Star aria-hidden className={cn("inline size-3.5 shrink-0 fill-warning text-warning", className)} />
    </>
  );
}
