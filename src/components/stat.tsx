import Link from "next/link";
import { cn } from "cn";

/** Cifra destacada con su etiqueta y una nota breve («3 por hacer · 1 atrasado»). */
export function Stat({
  label,
  value,
  unit,
  note,
  icon,
  href,
  className,
  children,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  note?: React.ReactNode;
  icon?: React.ReactNode;
  /** Si existe, la tarjeta entera es un enlace. */
  href?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="figure text-[2rem]">
        {value}
        {unit ? <span className="ml-1.5 text-sm font-medium tracking-normal text-muted-foreground">{unit}</span> : null}
      </p>
      {note ? <p className="text-[0.8125rem] text-muted-foreground">{note}</p> : null}
      {children}
    </>
  );
  const classes = cn("flex min-w-0 flex-col gap-2.5 rounded-2xl border bg-card p-5", className);
  return href ? (
    <Link href={href} className={cn(classes, "transition-colors hover:border-foreground/20")}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
