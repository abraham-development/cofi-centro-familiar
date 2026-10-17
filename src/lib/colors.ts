/**
 * Colores de integrantes. El color nunca es la única señal: siempre se
 * acompaña de nombre o iniciales.
 */
export const MEMBER_COLOR_PRESETS = [
  { value: "#7C3AED", label: "Morado" },
  { value: "#2563EB", label: "Azul" },
  { value: "#16A34A", label: "Verde" },
  { value: "#EA580C", label: "Naranja" },
  { value: "#DB2777", label: "Rosa" },
  { value: "#0891B2", label: "Turquesa" },
  { value: "#DC2626", label: "Rojo" },
  { value: "#65A30D", label: "Lima" },
  { value: "#9333EA", label: "Violeta" },
  { value: "#475569", label: "Pizarra" },
  { value: "#FACC15", label: "Amarillo" },
] as const;

export const HOME_COLOR_DEFAULT = "#FACC15";

function channel(hex: string, start: number): number {
  const v = parseInt(hex.slice(start, start + 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  return 0.2126 * channel(h, 0) + 0.7152 * channel(h, 2) + 0.0722 * channel(h, 4);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Texto blanco o casi negro según cuál contraste más con el fondo. */
export function readableTextColor(background: string): "#FFFFFF" | "#1C1917" {
  return contrastRatio(background, "#FFFFFF") >= contrastRatio(background, "#1C1917")
    ? "#FFFFFF"
    : "#1C1917";
}
