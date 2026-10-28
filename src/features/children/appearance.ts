import { z } from "zod";

import type { MemberSummary } from "@/features/calendar/types";

export const CHILD_AVATARS = [
  { key: "initials", label: "Mis iniciales" },
  { key: "cat", label: "Gato" },
  { key: "dog", label: "Perro" },
  { key: "rabbit", label: "Conejo" },
  { key: "bird", label: "Pájaro" },
  { key: "fish", label: "Pez" },
  { key: "turtle", label: "Tortuga" },
  { key: "rocket", label: "Cohete" },
  { key: "flower", label: "Flor" },
] as const;

export type ChildAvatarKey = (typeof CHILD_AVATARS)[number]["key"];
export const childAppearanceSchema = z.object({
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).transform((v) => v.toUpperCase()).nullable(),
  avatarKey: z.enum(CHILD_AVATARS.map((a) => a.key)).nullable(),
}).strict();
export type ChildAppearance = z.infer<typeof childAppearanceSchema>;

export function childWorldMember(member: MemberSummary, appearance: ChildAppearance) {
  return {
    ...member,
    color: appearance.accentColor ?? member.color,
    avatarEmoji: appearance.avatarKey ? null : member.avatarEmoji,
    avatarKey: appearance.avatarKey,
  };
}

export const WORLD_VIEWS = ["inicio", "tareas", "premios", "ajustes"] as const;
export type WorldView = (typeof WORLD_VIEWS)[number];
export function resolveWorldView(value: string | null, scope: "child" | "home"): WorldView {
  if (value === "ajustes") return "ajustes";
  return scope === "child" && (value === "tareas" || value === "premios") ? value : "inicio";
}
