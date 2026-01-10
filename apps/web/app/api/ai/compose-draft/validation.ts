import { z } from "zod";

export const composeDraftBody = z.object({
  prompt: z.string().min(1),
  subject: z.string().optional(),
  existingContent: z.string().optional(),
});

export type ComposeDraftBody = z.infer<typeof composeDraftBody>;
