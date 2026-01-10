import { z } from "zod";

export const composeDraftBody = z.object({
  prompt: z.string().trim().min(1, "Prompt cannot be empty"),
  subject: z.string().optional(),
  existingContent: z.string().optional(),
  replyContext: z
    .object({
      from: z.string().optional(),
      content: z.string(),
      date: z.string().optional(),
    })
    .optional(),
});

export type ComposeDraftBody = z.infer<typeof composeDraftBody>;
