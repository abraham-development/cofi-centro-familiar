/** Iniciales sugeridas (misma regla que private.initials en la base de datos). */
export function suggestInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
