import { z } from "zod";
import { createGenerateObject } from "@/utils/llms";
import type { EmailAccountWithAI } from "@/utils/llms/types";
import type { EmailForLLM } from "@/utils/types";
import { getModel } from "@/utils/llms/model";
import { getUserInfoPrompt, getEmailListPrompt } from "@/utils/ai/helpers";
import { ThreadSentiment, ThreadNextAction } from "@/generated/prisma/enums";

const threadAnalysisSchema = z.object({
  summary: z
    .string()
    .describe(
      "A concise one-line summary of the thread (max 100 characters). Focus on the main topic or request.",
    ),
  keyTopics: z
    .array(z.string())
    .max(5)
    .describe(
      "Up to 5 key topics or keywords from the thread (e.g., 'meeting', 'proposal', 'deadline')",
    ),
  sentiment: z
    .enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "MIXED"])
    .describe(
      "Overall emotional tone: POSITIVE (friendly, happy, agreement), NEGATIVE (frustrated, unhappy, conflict), MIXED (varied emotions), NEUTRAL (factual, business)",
    ),
  sentimentScore: z
    .number()
    .min(-1)
    .max(1)
    .describe(
      "Sentiment score from -1 (very negative) to 1 (very positive). 0 is neutral.",
    ),
  nextAction: z
    .enum(["TO_REPLY", "AWAITING", "FYI", "DONE"])
    .describe(
      "What the user should do: TO_REPLY (needs to respond), AWAITING (waiting for others), FYI (informational only), DONE (thread complete)",
    ),
  nextActionNote: z
    .string()
    .optional()
    .describe(
      "Brief note about the next action (e.g., 'Respond to meeting request', 'Waiting for John's report')",
    ),
});

export type ThreadAnalysisResult = z.infer<typeof threadAnalysisSchema>;

export async function aiAnalyzeThread({
  emailAccount,
  threadMessages,
  userEmail,
}: {
  emailAccount: EmailAccountWithAI;
  threadMessages: EmailForLLM[];
  userEmail: string;
}): Promise<ThreadAnalysisResult> {
  const system = `You are an AI assistant that analyzes email threads to provide quick insights.

Your task is to analyze an email thread and extract:
1. A brief one-line summary (what is this thread about?)
2. Key topics/keywords
3. Overall sentiment (how does the conversation feel?)
4. Next action for the user (what should they do?)

SENTIMENT GUIDELINES:
- POSITIVE: Friendly exchanges, good news, agreement, gratitude, success
- NEGATIVE: Complaints, conflicts, bad news, frustration, problems
- MIXED: Thread has both positive and negative elements
- NEUTRAL: Factual business communication, no strong emotions

NEXT ACTION GUIDELINES:
- TO_REPLY: User needs to respond (questions asked, action requested from user)
- AWAITING: User is waiting for someone else (user asked questions, requested info)
- FYI: Informational only (updates, announcements, no response needed)
- DONE: Thread is complete (all questions answered, task finished)

Focus on being accurate and helpful. The summary should help the user quickly understand what the thread is about without reading all messages.`;

  const prompt = `${getUserInfoPrompt({ emailAccount })}

The user's email is: ${userEmail}

Email thread (in chronological order, oldest to newest):

<thread>
${getEmailListPrompt({
  messages: threadMessages,
  messageMaxLength: 800,
  maxMessages: 10,
})}
</thread>

Analyze this thread and provide a summary, key topics, sentiment, and next action.`.trim();

  const modelOptions = getModel(emailAccount.user, "economy");

  const generateObject = createGenerateObject({
    emailAccount,
    label: "Analyze thread",
    modelOptions,
  });

  const result = await generateObject({
    ...modelOptions,
    system,
    prompt,
    schema: threadAnalysisSchema,
  });

  return result.object;
}

export function mapSentimentToEnum(
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED",
): ThreadSentiment {
  const map: Record<string, ThreadSentiment> = {
    POSITIVE: ThreadSentiment.POSITIVE,
    NEUTRAL: ThreadSentiment.NEUTRAL,
    NEGATIVE: ThreadSentiment.NEGATIVE,
    MIXED: ThreadSentiment.MIXED,
  };
  return map[sentiment] ?? ThreadSentiment.NEUTRAL;
}

export function mapNextActionToEnum(
  nextAction: "TO_REPLY" | "AWAITING" | "FYI" | "DONE",
): ThreadNextAction {
  const map: Record<string, ThreadNextAction> = {
    TO_REPLY: ThreadNextAction.TO_REPLY,
    AWAITING: ThreadNextAction.AWAITING,
    FYI: ThreadNextAction.FYI,
    DONE: ThreadNextAction.DONE,
  };
  return map[nextAction] ?? ThreadNextAction.FYI;
}
