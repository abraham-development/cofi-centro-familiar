import { cn } from "cn";

/**
 * Barra de avance con relleno rayado (cumplimiento, puntos hacia un premio).
 * `color` permite usar el color de un integrante en su propio mundo.
 */
export function Meter({
  value,
  max,
  label,
  tone = "brand",
  color,
  size = "md",
  className,
}: {
  value: number;
  max: number;
  /** Nombre accesible: «Mateo: 2 de 3 tareas». */
  label: string;
  tone?: "brand" | "warning" | "success";
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn(
        "w-full overflow-hidden rounded-full bg-muted",
        size === "sm" ? "h-1.5" : size === "md" ? "h-2.5" : "h-4",
        className,
      )}
    >
      <div
        className={cn(
          "bg-stripes h-full rounded-full transition-[width] duration-500",
          !color && (tone === "brand" ? "bg-brand" : tone === "warning" ? "bg-warning" : "bg-success"),
        )}
        style={{ width: `${ratio * 100}%`, backgroundColor: color }}
      />
    </div>
  );
}
