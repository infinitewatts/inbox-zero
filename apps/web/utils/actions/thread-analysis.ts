"use server";

import prisma from "@/utils/prisma";
import { analyzeThreadBody } from "@/utils/actions/thread-analysis.validation";
import { actionClient } from "@/utils/actions/safe-action";
import { SafeError } from "@/utils/error";
import { getEmailAccountWithAiAndTokens } from "@/utils/user/get";
import { checkAiRateLimit } from "@/utils/ratelimit";
import {
  aiAnalyzeThread,
  mapSentimentToEnum,
  mapNextActionToEnum,
} from "@/utils/ai/thread/analyze-thread";
import { getThread } from "@/utils/gmail/thread";
import { parseMessage } from "@/utils/gmail/message";
import type { EmailForLLM, MessageWithPayload } from "@/utils/types";
import { getGmailClientWithRefresh } from "@/utils/gmail/client";
import { createScopedLogger } from "@/utils/logger";

const ONE_HOUR_MS = 60 * 60 * 1000;

export const analyzeThreadAction = actionClient
  .metadata({ name: "analyzeThread" })
  .inputSchema(analyzeThreadBody)
  .action(
    async ({
      ctx: { emailAccountId },
      parsedInput: { threadId, forceRefresh },
    }) => {
      const emailAccount = await getEmailAccountWithAiAndTokens({
        emailAccountId,
      });
      if (!emailAccount) {
        throw new SafeError("Email account not found");
      }

      const rateLimit = await checkAiRateLimit(emailAccount.userId);
      if (!rateLimit.allowed) {
        throw new SafeError("Rate limit exceeded. Please try again later.");
      }

      const existing = await prisma.threadAnalysis.findUnique({
        where: {
          emailAccountId_threadId: { emailAccountId, threadId },
        },
      });

      const logger = createScopedLogger("thread-analysis");
      const gmail = await getGmailClientWithRefresh({
        accessToken: emailAccount.tokens.access_token,
        refreshToken: emailAccount.tokens.refresh_token,
        expiresAt: emailAccount.tokens.expires_at,
        emailAccountId,
        logger,
      });

      const thread = await getThread(threadId, gmail);
      if (!thread.messages || thread.messages.length === 0) {
        throw new SafeError("Thread not found or has no messages");
      }

      const messageCount = thread.messages.length;
      const isStale =
        existing &&
        (existing.messageCount !== messageCount ||
          Date.now() - existing.updatedAt.getTime() > ONE_HOUR_MS);

      if (existing && !forceRefresh && !isStale) {
        return existing;
      }

      const threadMessages: EmailForLLM[] = thread.messages.map(
        (msg: MessageWithPayload) => {
          const parsed = parseMessage(msg);
          return {
            id: parsed.id,
            from: parsed.headers.from,
            to: parsed.headers.to,
            cc: parsed.headers.cc,
            subject: parsed.headers.subject,
            content: parsed.textPlain || parsed.snippet || "",
            date: parsed.headers.date
              ? new Date(parsed.headers.date)
              : undefined,
          };
        },
      );

      const participants = new Set<string>();
      for (const msg of threadMessages) {
        if (msg.from) participants.add(msg.from);
        if (msg.to) {
          msg.to.split(",").forEach((addr) => participants.add(addr.trim()));
        }
      }

      const analysis = await aiAnalyzeThread({
        emailAccount,
        threadMessages,
        userEmail: emailAccount.email,
      });

      const data = {
        threadId,
        messageCount,
        summary: analysis.summary.slice(0, 500),
        keyTopics: analysis.keyTopics.slice(0, 5),
        sentiment: mapSentimentToEnum(analysis.sentiment),
        sentimentScore: analysis.sentimentScore,
        nextAction: mapNextActionToEnum(analysis.nextAction),
        nextActionNote: analysis.nextActionNote?.slice(0, 200),
        participantCount: participants.size,
        emailAccountId,
      };

      const result = await prisma.threadAnalysis.upsert({
        where: {
          emailAccountId_threadId: { emailAccountId, threadId },
        },
        create: data,
        update: data,
      });

      return result;
    },
  );
