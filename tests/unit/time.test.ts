import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  formatClockParts,
  formatDuration,
  formatLongDate,
  instantToLocalParts,
  localDateOf,
  localToInstant,
  relativeDayLabel,
  zonedFromIso,
} from "@/lib/time/zoned";

describe("fechas locales", () => {
  it("calcula el día de la semana real (sin textos fijos)", () => {
    expect(formatLongDate("2026-10-22")).toBe("Jueves 22 de octubre");
    expect(formatLongDate("2026-10-17")).toBe("Sábado 17 de octubre");
    expect(formatLongDate("2028-02-29")).toBe("Martes 29 de febrero");
  });

  it("cruza fin de mes, de año y años bisiestos", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
  });

  it("obtiene la fecha local de un instante según la zona", () => {
    // 2026-10-23 03:30 UTC = 22 oct 22:30 en Lima (UTC-5)
    const ms = Date.UTC(2026, 9, 23, 3, 30);
    expect(localDateOf(ms, "America/Lima")).toBe("2026-10-22");
    expect(localDateOf(ms, "Europe/Madrid")).toBe("2026-10-23");
  });

  it("etiqueta días relativos", () => {
    expect(relativeDayLabel("2026-10-22", "2026-10-22")).toBe("Hoy");
    expect(relativeDayLabel("2026-10-23", "2026-10-22")).toBe("Mañana");
    expect(relativeDayLabel("2026-10-21", "2026-10-22")).toBe("Ayer");
  });
});

describe("hora y zona", () => {
  it("convierte hora local a instante respetando DST", () => {
    // Nueva York: 7 mar 2026 es EST (UTC-5); 9 mar ya es EDT (UTC-4).
    expect(localToInstant("2026-03-07", "08:00", "America/New_York")).toBe("2026-03-07T13:00:00Z");
    expect(localToInstant("2026-03-09", "08:00", "America/New_York")).toBe("2026-03-09T12:00:00Z");
    // Lima no tiene cambio de horario.
    expect(localToInstant("2026-10-22", "10:30", "America/Lima")).toBe("2026-10-22T15:30:00Z");
  });

  it("una hora inexistente por el cambio de horario se adelanta como en PostgreSQL", () => {
    // 8 mar 2026 02:30 no existe en Nueva York.
    expect(localToInstant("2026-03-08", "02:30", "America/New_York")).toBe("2026-03-08T07:30:00Z");
  });

  it("descompone un instante en fecha y hora locales", () => {
    expect(instantToLocalParts("2026-10-22T15:30:00+00:00", "America/Lima")).toEqual({
      date: "2026-10-22",
      time: "10:30",
    });
  });

  it("formatea en 12 y 24 horas", () => {
    const morning = zonedFromIso("2026-10-22T15:30:00Z", "America/Lima");
    const midnight = zonedFromIso("2026-10-22T05:05:00Z", "America/Lima");
    const noon = zonedFromIso("2026-10-22T17:00:00Z", "America/Lima");
    expect(formatClockParts(morning, "12h")).toEqual({ time: "10:30", period: "AM" });
    expect(formatClockParts(midnight, "12h")).toEqual({ time: "12:05", period: "AM" });
    expect(formatClockParts(noon, "12h")).toEqual({ time: "12:00", period: "PM" });
    expect(formatClockParts(noon, "24h")).toEqual({ time: "12:00", period: null });
  });
});

describe("cuenta regresiva", () => {
  it("es legible y nunca dice 0 min", () => {
    expect(formatDuration(30_000)).toBe("menos de 1 min");
    expect(formatDuration(61_000)).toBe("2 min");
    expect(formatDuration(90 * 60_000)).toBe("1 h 30 min");
    expect(formatDuration(120 * 60_000)).toBe("2 h");
    expect(formatDuration(3 * 24 * 60 * 60_000)).toBe("3 días");
  });
});

describe("instantes con fracciones de milisegundo", () => {
  it("no fallan al convertir (el desfase del reloj puede no ser entero)", () => {
    expect(localDateOf(Date.UTC(2026, 9, 22, 15, 0) + 0.5, "America/Lima")).toBe("2026-10-22");
  });
});
