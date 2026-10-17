/** Zonas sugeridas. Cualquier zona IANA válida se acepta en el servidor. */
export const COMMON_TIME_ZONES = [
  { value: "America/Lima", label: "Lima (Perú)" },
  { value: "America/Bogota", label: "Bogotá (Colombia)" },
  { value: "America/Guayaquil", label: "Guayaquil (Ecuador)" },
  { value: "America/La_Paz", label: "La Paz (Bolivia)" },
  { value: "America/Santiago", label: "Santiago (Chile)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (Argentina)" },
  { value: "America/Sao_Paulo", label: "São Paulo (Brasil)" },
  { value: "America/Caracas", label: "Caracas (Venezuela)" },
  { value: "America/Mexico_City", label: "Ciudad de México" },
  { value: "America/New_York", label: "Nueva York (EE. UU.)" },
  { value: "America/Los_Angeles", label: "Los Ángeles (EE. UU.)" },
  { value: "Europe/Madrid", label: "Madrid (España)" },
  { value: "UTC", label: "UTC" },
] as const;

export function timeZoneOptions(current?: string) {
  const list: { value: string; label: string }[] = [...COMMON_TIME_ZONES];
  if (current && !list.some((z) => z.value === current)) list.unshift({ value: current, label: current });
  return list;
}
