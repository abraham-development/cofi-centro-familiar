import { cn } from "cn";

/**
 * Tarjeta de contenido con título pequeño y subtítulo gris, al estilo de un
 * panel de producto (ver docs/diseno.md). El nombre accesible de la región es
 * solo el título: el subtítulo no lo cambia.
 *
 * - `featured`: la tarjeta destacada (lima en claro, violeta en oscuro).
 * - `plain`: sin caja, para agrupar dentro de otra tarjeta.
 * - `size="lg"`: para pantallas que se leen a distancia.
 */
export function Panel({
  id,
  title,
  caption,
  actions,
  variant = "default",
  size = "md",
  className,
  children,
}: {
  id: string;
  title: React.ReactNode;
  caption?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: "default" | "featured" | "plain";
  size?: "md" | "lg";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-2xl",
        variant === "default" && "border bg-card",
        variant === "featured" && "bg-featured",
        variant !== "plain" && (size === "md" ? "p-5" : "p-6 sm:p-7"),
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2
            id={id}
            className={cn("leading-tight font-semibold", size === "md" ? "text-base" : "text-xl sm:text-2xl")}
          >
            {title}
          </h2>
          {caption ? (
            <p
              className={cn(
                "mt-1",
                size === "md" ? "text-[0.8125rem]" : "text-base",
                variant === "featured" ? "text-featured-muted" : "text-muted-foreground",
              )}
            >
              {caption}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
