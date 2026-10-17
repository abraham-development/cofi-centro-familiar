import { describe, expect, it } from "vitest";

import { makeEvent } from "./helpers";
import { isQuietTime } from "@/lib/pwa/quiet-time";
import { makeSnapshot, readSnapshot, SNAPSHOT_TTL } from "@/lib/pwa/snapshot";

const now = Date.parse("2026-10-17T14:00:00Z");
const family = { id: "family-a", name: "Familia", timezone: "America/Lima", hourFormat: "12h" as const };
const snapshot = () => makeSnapshot({
  actor: "adult", identity: "adult-a", family, label: "Casa", now,
  events: [makeEvent({ title: "Dentista", description: "Información sensible", location: "Dirección privada" }), makeEvent({ status: "cancelled" })],
  tasks: [{ id: "task", title: "Ordenar", notes: "Nota sensible", assignee: null, dueDate: null, dueTime: null, dueAt: null, priority: "normal", visibility: "family", status: "pending", completedAt: null, version: 1 }],
});

describe("copia sin conexión", () => {
  it("conserva el alcance y proyecta solo lo necesario, omitiendo cancelados y notas", () => {
    const copy = snapshot();
    expect(copy.identity).toBe("adult-a");
    expect(copy.familyId).toBe("family-a");
    expect(copy.events).toHaveLength(1);
    expect(copy.tasks[0].title).toBe("Ordenar");
    expect(JSON.stringify(copy)).not.toMatch(/Información sensible|Dirección privada|Nota sensible|description|notes|location/);
  });
  it("caduca a las 24 horas exactas y rechaza copias futuras o con plazo ampliado", () => {
    const copy = snapshot();
    expect(readSnapshot(JSON.stringify(copy), now + SNAPSHOT_TTL - 1)).not.toBeNull();
    expect(readSnapshot(JSON.stringify(copy), now + SNAPSHOT_TTL)).toBeNull();
    expect(readSnapshot(JSON.stringify(copy), now - 1)).toBeNull();
    expect(readSnapshot(JSON.stringify({ ...copy, expiresAt: copy.expiresAt + 1 }), now)).toBeNull();
  });
  it("tolera almacenamiento vacío, corrupto y versiones incompatibles", () => {
    for (const raw of [null, "invalid", "{}", JSON.stringify({ ...snapshot(), version: 2 })]) expect(readSnapshot(raw, now)).toBeNull();
  });
});

describe("noche en la zona de la familia", () => {
  it("incluye inicio, excluye fin y cruza medianoche", () => {
    const quiet = (iso: string) => isQuietTime(Date.parse(iso), "America/Lima", "21:30", "06:30");
    expect(quiet("2026-10-18T02:29:00Z")).toBe(false);
    expect(quiet("2026-10-18T02:30:00Z")).toBe(true);
    expect(quiet("2026-10-18T05:00:00Z")).toBe(true);
    expect(quiet("2026-10-18T11:30:00Z")).toBe(false);
  });
  it("admite intervalos diurnos y horas iguales desactivan el modo", () => {
    expect(isQuietTime(now, "America/Lima", "08:00", "10:00")).toBe(true);
    expect(isQuietTime(now, "America/Lima", "08:00", "08:00")).toBe(false);
  });
  it("respeta ambas ocurrencias de la hora repetida por DST", () => {
    for (const instant of ["2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"]) {
      expect(isQuietTime(Date.parse(instant), "America/New_York", "01:00", "02:00")).toBe(true);
    }
  });
});
