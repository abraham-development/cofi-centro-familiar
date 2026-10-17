import { describe, expect, it } from "vitest";

import type { ChildTask } from "@/features/tasks/child-types";
import {
  childTaskState,
  complianceSummary,
  dailyProgress,
  habitStreak,
} from "@/features/tasks/domain/child-tasks";

let seq = 0;
function task(partial: Partial<ChildTask>): ChildTask {
  seq += 1;
  return {
    id: `t-${seq}`,
    templateId: "tpl",
    kind: "chore",
    title: `Tarea ${seq}`,
    notes: null,
    assigneeId: "mateo",
    dueDate: "2026-10-22",
    dueTime: null,
    dueAt: null,
    status: "pending",
    points: 10,
    requiresReview: true,
    submittedAt: null,
    submittedLate: null,
    reviewNote: null,
    version: 1,
    ...partial,
  };
}

const today = "2026-10-22";
const now = Date.parse("2026-10-22T20:00:00Z"); // 15:00 en Lima

describe("estado de una tarea infantil", () => {
  it("distingue pendiente vencida por hora límite y por fecha", () => {
    expect(childTaskState(task({ dueAt: "2026-10-22T19:00:00Z" }), today, now).key).toBe("overdue");
    expect(childTaskState(task({ dueAt: "2026-10-22T23:00:00Z" }), today, now).key).toBe("pending");
    expect(childTaskState(task({ dueDate: "2026-10-21" }), today, now).key).toBe("overdue");
    expect(childTaskState(task({}), today, now).key).toBe("pending");
  });

  it("la puntualidad depende de la entrega del hijo, no de la aprobación", () => {
    expect(childTaskState(task({ status: "in_review", submittedLate: false }), today, now).label).toBe(
      "En revisión (a tiempo)",
    );
    expect(childTaskState(task({ status: "in_review", submittedLate: true }), today, now).key).toBe("in_review_late");
    expect(childTaskState(task({ status: "done", submittedLate: false }), today, now).key).toBe("done_on_time");
    expect(childTaskState(task({ status: "done", submittedLate: true }), today, now).label).toBe("Cumplida tarde");
  });
});

describe("progreso y resumen", () => {
  it("las exentas no cuentan como pendientes del día", () => {
    const tasks = [
      task({ status: "done" }),
      task({ status: "pending" }),
      task({ status: "exempt" }),
      task({ status: "done", dueDate: "2026-10-21" }),
    ];
    expect(dailyProgress(tasks, today)).toEqual({ done: 1, total: 2 });
  });

  it("resume cumplimiento sin contar exenciones como fallos", () => {
    const tasks = [
      task({ status: "done", submittedLate: false }),
      task({ status: "done", submittedLate: true }),
      task({ status: "pending", dueDate: "2026-10-20" }),
      task({ status: "in_review", submittedLate: false }),
      task({ status: "exempt" }),
    ];
    expect(complianceSummary(tasks, today, now)).toEqual({ onTime: 1, late: 1, overdue: 1, inReview: 1, exempt: 1 });
  });
});

describe("racha de hábitos", () => {
  const habit = (dueDate: string, status: ChildTask["status"]) => task({ kind: "habit", dueDate, status });

  it("cuenta días seguidos cumplidos; hoy pendiente no la rompe", () => {
    const occ = [
      habit("2026-10-22", "pending"),
      habit("2026-10-21", "done"),
      habit("2026-10-20", "done"),
      habit("2026-10-19", "pending"),
      habit("2026-10-18", "done"),
    ];
    expect(habitStreak(occ, today)).toBe(2);
  });

  it("un día exento pausa la racha en lugar de romperla", () => {
    const occ = [
      habit("2026-10-22", "done"),
      habit("2026-10-21", "exempt"),
      habit("2026-10-20", "done"),
      habit("2026-10-19", "done"),
    ];
    expect(habitStreak(occ, today)).toBe(3);
  });
});
