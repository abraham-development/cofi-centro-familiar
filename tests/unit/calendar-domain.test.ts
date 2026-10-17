import { describe, expect, it } from "vitest";

import { computeClockStatus } from "@/features/calendar/domain/clock-status";
import { buildRadar } from "@/features/calendar/domain/radar";
import { buildDayTimeline } from "@/features/calendar/domain/timeline";
import { makeEvent } from "./helpers";

const TZ = "America/Lima";
const bounds = { morningEnds: "12:00", afternoonEnds: "19:00" };

describe("línea del día", () => {
  it("agrupa en mañana, tarde y noche según la hora local", () => {
    const events = [
      makeEvent({ title: "Colegio", startsAt: "2026-10-22T12:30:00Z" }), // 07:30
      makeEvent({ title: "Almuerzo", startsAt: "2026-10-22T17:00:00Z" }), // 12:00
      makeEvent({ title: "Visita", startsAt: "2026-10-22T23:59:00Z" }), // 18:59
      makeEvent({ title: "Cena", startsAt: "2026-10-23T00:00:00Z" }), // 19:00
    ];
    const t = buildDayTimeline(events, "2026-10-22", TZ, bounds);
    expect(t.parts.morning.map((e) => e.event.title)).toEqual(["Colegio"]);
    expect(t.parts.afternoon.map((e) => e.event.title)).toEqual(["Almuerzo", "Visita"]);
    expect(t.parts.evening.map((e) => e.event.title)).toEqual(["Cena"]);
  });

  it("un evento que cruza medianoche aparece en ambos días marcado como continuación", () => {
    const party = makeEvent({
      title: "Fiesta",
      startsAt: "2026-10-23T03:00:00Z", // 22 oct 22:00
      endsAt: "2026-10-23T06:00:00Z", // 23 oct 01:00
      localStartDate: "2026-10-22",
      localEndDate: "2026-10-23",
    });
    const d1 = buildDayTimeline([party], "2026-10-22", TZ, bounds);
    const d2 = buildDayTimeline([party], "2026-10-23", TZ, bounds);
    expect(d1.parts.evening[0]).toMatchObject({ continuesNextDay: true, continuesFromPreviousDay: false });
    expect(d2.parts.morning[0]).toMatchObject({ continuesFromPreviousDay: true, startMinutes: 0 });
  });

  it("separa los eventos de día completo y excluye cancelados", () => {
    const events = [
      makeEvent({ title: "Feriado", isAllDay: true, startDate: "2026-10-22", endDate: "2026-10-23" }),
      makeEvent({ title: "Cancelado", startsAt: "2026-10-22T15:00:00Z", status: "cancelled" }),
    ];
    const t = buildDayTimeline(events, "2026-10-22", TZ, bounds);
    expect(t.allDay.map((e) => e.title)).toEqual(["Feriado"]);
    expect(t.total).toBe(1);
  });
});

describe("radar de 7 días", () => {
  it("cubre 7 días desde hoy aunque cambie el mes", () => {
    const radar = buildRadar([], "2026-10-28");
    expect(radar.map((d) => d.date)).toEqual([
      "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31",
      "2026-11-01", "2026-11-02", "2026-11-03",
    ]);
    expect(radar[0].isToday).toBe(true);
  });

  it("resume sin perder eventos y prioriza los importantes", () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      makeEvent({
        title: `E${i}`,
        startsAt: `2026-10-22T${String(13 + i).padStart(2, "0")}:00:00Z`,
        importance: i === 5 ? "high" : "normal",
      }),
    );
    const [today] = buildRadar(events, "2026-10-22", { maxPerDay: 3 });
    expect(today.total).toBe(6);
    expect(today.hiddenCount).toBe(3);
    expect(today.visible.map((e) => e.title)).toContain("E5");
  });

  it("un evento de varios días aparece en cada día que toca", () => {
    const trip = makeEvent({
      title: "Viaje",
      isAllDay: true,
      startDate: "2026-10-23",
      endDate: "2026-10-26",
      localStartDate: "2026-10-23",
      localEndDate: "2026-10-25",
    });
    const radar = buildRadar([trip], "2026-10-22");
    expect(radar.filter((d) => d.total === 1).map((d) => d.date)).toEqual([
      "2026-10-23", "2026-10-24", "2026-10-25",
    ]);
  });
});

describe("estado del reloj", () => {
  const now = Date.parse("2026-10-22T15:30:00Z"); // 10:30 en Lima

  it("indica el próximo evento y su cuenta regresiva", () => {
    const visit = makeEvent({ title: "Visita", startsAt: "2026-10-22T17:00:00Z" });
    const status = computeClockStatus([visit], now, TZ);
    expect(status.next?.title).toBe("Visita");
    expect(status.msUntilNext).toBe(90 * 60_000);
  });

  it("distingue un evento en curso, uno que empieza ahora y uno cancelado", () => {
    const ongoing = makeEvent({ title: "Clase", startsAt: "2026-10-22T15:00:00Z", endsAt: "2026-10-22T16:00:00Z" });
    const startsNow = makeEvent({ title: "Técnico", startsAt: "2026-10-22T15:30:00Z" });
    const cancelled = makeEvent({ title: "Reunión", startsAt: "2026-10-22T16:00:00Z", status: "cancelled" });
    const status = computeClockStatus([ongoing, startsNow, cancelled], now, TZ);
    expect(status.current.map((e) => e.title)).toEqual(["Clase", "Técnico"]);
    expect(status.next).toBeNull();
  });

  it("sin eventos próximos devuelve un estado vacío útil", () => {
    const status = computeClockStatus([], now, TZ);
    expect(status).toEqual({ current: [], allDayToday: [], next: null, msUntilNext: null });
  });
});
