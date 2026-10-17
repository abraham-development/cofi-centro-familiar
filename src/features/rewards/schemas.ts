import { z } from "zod";

import { uuidSchema } from "@/lib/validation/common";

export const rewardFormSchema = z.object({
  title: z.string().trim().min(1, "Escribe el premio").max(80),
  description: z.string().trim().max(300),
  cost: z.number().int().min(1, "Mínimo 1 punto").max(100000),
  isAvailable: z.boolean(),
  conditions: z.string().trim().max(300),
  memberIds: z.array(uuidSchema).max(20),
});

export type RewardFormValues = z.infer<typeof rewardFormSchema>;
