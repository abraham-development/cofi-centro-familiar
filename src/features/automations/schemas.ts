import { z } from "zod";

import { timeSchema, uuidSchema } from "@/lib/validation/common";

export const ruleFormSchema = z.object({
  kind: z.enum(["visit_prep", "school_prep"]),
  name: z.string().trim().min(1, "Ponle un nombre").max(80),
  enabled: z.boolean(),
  eveningTime: timeSchema,
  morningTime: timeSchema,
  prepMinutesBefore: z.number().int().min(0).max(1440),
  taskTitle: z.string().trim().max(120),
  taskMemberIds: z.array(uuidSchema).max(20),
  taskPoints: z.number().int().min(0).max(1000),
  notifyAudience: z.enum(["family", "adults"]),
});

export type RuleFormValues = z.infer<typeof ruleFormSchema>;
