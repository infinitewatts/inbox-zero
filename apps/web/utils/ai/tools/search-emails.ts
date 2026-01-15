import { z } from "zod";
import { tool } from "ai";
import type { EmailProvider } from "@/utils/email/types";
import type { Logger } from "@/utils/logger";
import type { ParsedMessage } from "@/utils/types";

// Helper to format errors consistently
export const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Shared search tool configuration
export const searchEmailsInputSchema = z.object({
  query: z
    .string()
    .describe(
      "Gmail search query (e.g., 'from:john', '\"exact phrase\"', 'subject:invoice', 'has:attachment')",
    ),
  maxResults: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of results to return"),
});

export type SearchEmailsInput = z.infer<typeof searchEmailsInputSchema>;

export interface SearchResult {
  threadId: string;
  subject: string;
  from: string;
  date: Date | string | null;
  snippet?: string;
}

export interface SearchResponse {
  found: number;
  results: SearchResult[];
  hasMore: boolean;
  error?: string;
}

// Create the search emails tool
export const createSearchEmailsTool = ({
  emailProvider,
  logger,
  onResults,
}: {
  emailProvider: EmailProvider;
  logger: Logger;
  onResults?: (messages: ParsedMessage[], query: string) => void;
}) =>
  tool({
    name: "searchEmails",
    description:
      "Search the user's emails using Gmail query syntax. Use this to find specific emails. Returns thread IDs and summaries.",
    inputSchema: searchEmailsInputSchema,
    execute: async ({
      query,
      maxResults = 10,
    }: SearchEmailsInput): Promise<SearchResponse> => {
      logger.info("AI searching emails", { query, maxResults });

      try {
        const res = await emailProvider.getMessagesWithPagination({
          query,
          maxResults: Math.min(maxResults, 20),
        });

        // Callback for collecting results (used by search API)
        if (onResults) {
          onResults(res.messages, query);
        }

        const results = res.messages.slice(0, maxResults).map((m) => ({
          threadId: m.threadId,
          subject: m.subject,
          from: m.headers.from,
          date: m.date,
          snippet: m.snippet?.slice(0, 150),
        }));

        return {
          found: results.length,
          results,
          hasMore: !!res.nextPageToken,
        };
      } catch (error) {
        logger.error("Search failed", {
          error: formatError(error),
          query,
        });
        return {
          found: 0,
          results: [],
          hasMore: false,
          error: `Search failed: ${formatError(error)}`,
        };
      }
    },
  });

// Create the get thread summary tool
export const createGetThreadSummaryTool = ({
  emailProvider,
  logger,
}: {
  emailProvider: EmailProvider;
  logger: Logger;
}) =>
  tool({
    name: "getThreadSummary",
    description:
      "Get detailed information about a specific email thread by its ID.",
    inputSchema: z.object({
      threadId: z.string().describe("The thread ID to fetch"),
    }),
    execute: async ({ threadId }: { threadId: string }) => {
      logger.info("AI fetching thread", { threadId });

      try {
        const thread = await emailProvider.getThread(threadId);
        if (!thread || thread.messages.length === 0) {
          return { error: "Thread not found - it may have been deleted" };
        }

        const messages = thread.messages.map((m) => ({
          from: m.headers.from,
          to: m.headers.to,
          date: m.date,
          subject: m.subject,
          snippet: m.snippet?.slice(0, 300),
        }));

        return {
          threadId,
          messageCount: messages.length,
          subject: messages[0]?.subject,
          participants: [...new Set(messages.map((m) => m.from))],
          messages,
        };
      } catch (error) {
        logger.error("Failed to fetch thread", {
          error: formatError(error),
          threadId,
        });
        return { error: `Failed to fetch thread: ${formatError(error)}` };
      }
    },
  });

// Helper to extract sender name from email header
export const extractSenderName = (from: string): string => {
  // Try "Display Name <email@example.com>" format
  const match = from.match(/^(.+?)\s*<[^>]+>$/);
  if (match) {
    return match[1].trim().replace(/^["']|["']$/g, ""); // Remove quotes
  }
  // Fall back to username part of email
  const atIndex = from.indexOf("@");
  if (atIndex > 0) {
    return from.slice(0, atIndex);
  }
  return from;
};
