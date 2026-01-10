import { z } from "zod";

export const analyzeThreadBody = z.object({
  threadId: z.string(),
  forceRefresh: z.boolean().optional(),
});

export type AnalyzeThreadBody = z.infer<typeof analyzeThreadBody>;
