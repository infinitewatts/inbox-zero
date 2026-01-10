import { z } from "zod";

export const composeSubjectBody = z.object({
  content: z.string().min(1),
  prompt: z.string().optional(),
  to: z.string().optional(),
});
