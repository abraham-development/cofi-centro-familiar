import { House } from "lucide-react";

export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2 font-heading font-bold tracking-tight">
      <span
        aria-hidden
        className={
          size === "lg"
            ? "grid size-11 place-items-center rounded-2xl bg-highlight text-highlight-foreground"
            : "grid size-8 place-items-center rounded-xl bg-highlight text-highlight-foreground"
        }
      >
        <House className={size === "lg" ? "size-6" : "size-4.5"} />
      </span>
      <span className={size === "lg" ? "text-2xl" : "text-lg"}>Centro Familiar</span>
    </span>
  );
}
