/**
 * Solo permite rutas internas relativas: evita redirecciones abiertas.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const url = new URL(next, "http://cofi.invalid");
    if (url.origin !== "http://cofi.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
