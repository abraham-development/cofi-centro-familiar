import { cn } from "cn";

/** Símbolo de la marca: cuatro bloques (la semana, la familia), uno con el acento. */
function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("shrink-0", className)}>
      <rect x="2" y="2" width="9" height="9" rx="2.5" className="fill-foreground" />
      <rect x="13" y="2" width="9" height="9" rx="4.5" className="fill-brand" />
      <rect x="2" y="13" width="9" height="9" rx="2.5" className="fill-foreground" />
      <rect x="13" y="13" width="9" height="9" rx="2.5" className="fill-foreground" />
    </svg>
  );
}

export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark className={size === "lg" ? "size-9" : "size-6"} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-heading font-bold tracking-tight", size === "lg" ? "text-[1.75rem]" : "text-xl")}>
          cofi
        </span>
        {size === "lg" ? <span className="mt-1 text-sm text-muted-foreground">Centro Familiar</span> : null}
      </span>
    </span>
  );
}
