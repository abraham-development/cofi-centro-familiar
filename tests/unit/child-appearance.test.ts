import { describe, expect, it } from "vitest";

import { childAppearanceSchema, childWorldMember, resolveWorldView } from "@/features/children/appearance";
import type { MemberSummary } from "@/features/calendar/types";

const member: MemberSummary = { id: "mateo", displayName: "Mateo", color: "#16A34A", initials: "MA", kind: "child", avatarEmoji: null };

describe("apariencia del mundo infantil", () => {
  it("conserva la identidad familiar al aplicar la apariencia personal", () => {
    const personal = childWorldMember(member, { accentColor: "#2563EB", avatarKey: "cat" });
    expect(personal.color).toBe("#2563EB");
    expect(personal.avatarKey).toBe("cat");
    expect(member.color).toBe("#16A34A");
    expect(childWorldMember(member, { accentColor: null, avatarKey: null }).color).toBe(member.color);
  });
  it("normaliza color y rechaza valores o destinos enviados fuera de contrato", () => {
    expect(childAppearanceSchema.parse({ accentColor: "#db2777", avatarKey: "rocket" }).accentColor).toBe("#DB2777");
    for (const value of [
      { accentColor: "red", avatarKey: "cat" },
      { accentColor: "#2563EB", avatarKey: "<img>" },
      { accentColor: "#2563EB", avatarKey: "cat", memberId: "another-child" },
    ]) expect(childAppearanceSchema.safeParse(value).success).toBe(false);
  });
  it("limita las vistas al alcance del vínculo", () => {
    expect(resolveWorldView("tareas", "child")).toBe("tareas");
    expect(resolveWorldView("premios", "child")).toBe("premios");
    expect(resolveWorldView("ajustes", "home")).toBe("ajustes");
    expect(resolveWorldView("tareas", "home")).toBe("inicio");
    expect(resolveWorldView("desconocido", "child")).toBe("inicio");
  });
});
