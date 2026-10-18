import { describe, expect, it } from "vitest";

import { hourRange, layoutDayEvents, MIN_BLOCK_MINUTES } from "@/features/calendar/domain/day-layout";
import { makeEvent } from "./helpers";

const TZ = "America/Lima"; // UTC−5, sin horario de verano
const DAY = "2026-10-22";

describe("día por horas", () => {
  it("ubica cada evento por su hora local de inicio y fin", () => {
    const layout = layoutDayEvents(
      [makeEvent({ title: "Dentista", startsAt: "2026-10-22T16:00:00Z", endsAt: "2026-10-22T17:30:00Z" })],
      DAY,
      TZ,
    );
    expect(layout.blocks[0]).toMatchObject({ startMin: 11 * 60, endMin: 12 * 60 + 30, hasEnd: true, column: 0, columns: 1 });
  });

  it("un evento sin hora de fin ocupa el alto mínimo y lo indica", () => {
    const layout = layoutDayEvents([makeEvent({ startsAt: "2026-10-22T22:00:00Z" })], DAY, TZ); // 17:00
    expect(layout.blocks[0]).toMatchObject({ startMin: 17 * 60, endMin: 17 * 60 + MIN_BLOCK_MINUTES, hasEnd: false });
  });

  it("reparte en columnas los que se solapan y deja solos a los demás", () => {
    const layout = layoutDayEvents(
      [
        makeEvent({ title: "A", startsAt: "2026-10-22T14:00:00Z", endsAt: "2026-10-22T16:00:00Z" }), // 9–11
        makeEvent({ title: "B", startsAt: "2026-10-22T15:00:00Z", endsAt: "2026-10-22T15:30:00Z" }), // 10–10:30
        makeEvent({ title: "C", startsAt: "2026-10-22T15:30:00Z", endsAt: "2026-10-22T16:30:00Z" }), // 10:30–11:30
        makeEvent({ title: "D", startsAt: "2026-10-22T18:00:00Z" }), // 13:00, aparte
      ],
      DAY,
      TZ,
    );
    const byTitle = Object.fromEntries(layout.blocks.map((b) => [b.event.title, b]));
    expect(byTitle.A).toMatchObject({ column: 0, columns: 2 });
    expect(byTitle.B).toMatchObject({ column: 1, columns: 2 });
    // C empieza cuando termina B: reutiliza su columna.
    expect(byTitle.C).toMatchObject({ column: 1, columns: 2 });
    expect(byTitle.D).toMatchObject({ column: 0, columns: 1 });
  });

  it("recorta los eventos que cruzan medianoche y los marca en ambos días", () => {
    const party = makeEvent({
      startsAt: "2026-10-23T03:00:00Z", // 22 oct 22:00
      endsAt: "2026-10-23T06:00:00Z", // 23 oct 01:00
      localStartDate: "2026-10-22",
      localEndDate: "2026-10-23",
    });
    expect(layoutDayEvents([party], DAY, TZ).blocks[0]).toMatchObject({
      startMin: 22 * 60,
      endMin: 24 * 60,
      untilTomorrow: true,
      fromYesterday: false,
    });
    expect(layoutDayEvents([party], "2026-10-23", TZ).blocks[0]).toMatchObject({
      startMin: 0,
      endMin: 60,
      fromYesterday: true,
      untilTomorrow: false,
    });
  });

  it("un evento que termina a medianoche llega al final del día", () => {
    const late = makeEvent({ startsAt: "2026-10-23T04:00:00Z", endsAt: "2026-10-23T05:00:00Z" }); // 23:00–00:00
    expect(layoutDayEvents([late], DAY, TZ).blocks[0]).toMatchObject({ startMin: 23 * 60, endMin: 24 * 60 });
  });

  it("separa los de día completo y excluye cancelados y otros días", () => {
    const layout = layoutDayEvents(
      [
        makeEvent({ title: "Cumpleaños", isAllDay: true, startDate: DAY, endDate: "2026-10-23" }),
        makeEvent({ title: "Cancelado", status: "cancelled", startsAt: "2026-10-22T15:00:00Z" }),
        makeEvent({
          title: "Mañana",
          startsAt: "2026-10-23T15:00:00Z",
          localStartDate: "2026-10-23",
          localEndDate: "2026-10-23",
        }),
      ],
      DAY,
      TZ,
    );
    expect(layout.allDay.map((e) => e.title)).toEqual(["Cumpleaños"]);
    expect(layout.blocks).toHaveLength(0);
  });

  it("la grilla se amplía para mostrar eventos de madrugada", () => {
    const layout = layoutDayEvents([makeEvent({ startsAt: "2026-10-22T09:30:00Z" })], DAY, TZ); // 4:30
    expect(hourRange(layout.blocks)).toEqual({ from: 4, to: 24 });
    expect(hourRange([])).toEqual({ from: 6, to: 24 });
  });
});
