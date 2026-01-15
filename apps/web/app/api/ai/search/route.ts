import { NextResponse } from "next/server";
import { z } from "zod";
import { tool } from "ai";
import { withEmailProvider } from "@/utils/middleware";
import type { ParsedMessage } from "@/utils/types";
import { getEmailAccountWithAi } from "@/utils/user/get";
import { chatCompletionStream } from "@/utils/llms";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("ai-search");

export const GET = withEmailProvider("ai/search", async (request) => {
  const { emailProvider, auth } = request;
  const { searchParams } = new URL(request.url);

  const userQuery = (searchParams.get("q") || "").trim();
  const limit = Math.min(
    Number.parseInt(searchParams.get("limit") || "30", 10),
    100,
  );

  if (!userQuery) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 },
    );
  }

  // Get email account with AI settings
  const emailAccount = await getEmailAccountWithAi({
    emailAccountId: auth.emailAccountId,
  });
  if (!emailAccount) {
    return NextResponse.json(
      { error: "Email account not found" },
      { status: 404 },
    );
  }

  // Store search results from tool calls
  const searchResults: ParsedMessage[] = [];
  const queriesUsed: string[] = [];

  // Create search tool that the AI can use
  const searchEmailsTool = tool({
    name: "searchEmails",
    description:
      "Search emails using Gmail query syntax. Call this multiple times with different queries to find what you're looking for.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Gmail search query (e.g., 'from:john agreement', '\"exact phrase\"', 'subject:invoice')",
        ),
    }),
    execute: async ({ query }: { query: string }) => {
      logger.info("AI searching emails", { query });
      queriesUsed.push(query);

      try {
        const res = await emailProvider.getMessagesWithPagination({
          query,
          maxResults: Math.min(limit, 20),
        });

        // Add to results, avoiding duplicates
        const existingIds = new Set(searchResults.map((m) => m.id));
        for (const msg of res.messages) {
          if (!existingIds.has(msg.id)) {
            searchResults.push(msg);
            existingIds.add(msg.id);
          }
        }

        // Return summary to AI
        return {
          found: res.messages.length,
          totalSoFar: searchResults.length,
          samples: res.messages.slice(0, 5).map((m) => ({
            subject: m.subject,
            from: m.headers.from,
            date: m.date,
            snippet: m.snippet?.slice(0, 100),
          })),
        };
      } catch (error) {
        logger.error("Search failed", { error, query });
        return { error: "Search failed", found: 0 };
      }
    },
  });

  const system = `You are an email search assistant. Your job is to find emails matching the user's request.

You have access to a searchEmails tool that searches Gmail. Use it to find relevant emails.

Strategy:
1. Start with a broad search using the key terms
2. If no results, try variations (different spellings, partial names, related terms)
3. If too many results, try narrowing with additional terms
4. Try multiple searches to ensure comprehensive results

Gmail query tips:
- "exact phrase" - search exact phrase anywhere
- from:name - from a sender
- to:name - to a recipient
- subject:word - in subject line
- has:attachment - has attachments
- after:2024/01/01 - date filters

For person names like "brandon willis":
- Try: "brandon willis"
- Try: from:brandon willis
- Try: brandon willis (without quotes)

Keep searching until you find relevant results or have tried several variations.`;

  try {
    // Use streaming to let AI call tools
    const result = await chatCompletionStream({
      userAi: emailAccount.user,
      userEmail: emailAccount.email,
      modelType: "fast",
      usageLabel: "ai-search",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Find emails about: ${userQuery}` },
      ],
      tools: {
        searchEmails: searchEmailsTool,
      },
      maxSteps: 5, // Allow up to 5 search attempts
    });

    // Consume the stream to let tools execute
    let aiExplanation = "";
    for await (const chunk of result.textStream) {
      aiExplanation += chunk;
    }

    // Group results by sender
    const groupsMap = new Map<
      string,
      {
        sender: string;
        count: number;
        subjects: string[];
        threadIds: string[];
      }
    >();

    for (const m of searchResults.slice(0, limit)) {
      const from = m.headers.from;
      const sender = from.match(/^(.*?)\s*</)
        ? from.match(/^(.*?)\s*</)?.[1]?.trim() || from
        : from.split("@")[0] || from;

      if (!groupsMap.has(sender)) {
        groupsMap.set(sender, {
          sender,
          count: 0,
          subjects: [],
          threadIds: [],
        });
      }
      const g = groupsMap.get(sender)!;
      g.count += 1;
      if (g.subjects.length < 5) g.subjects.push(m.subject);
      if (g.threadIds.length < 10) g.threadIds.push(m.threadId);
    }

    const samples = searchResults.slice(0, 20).map((m) => ({
      id: m.id,
      threadId: m.threadId,
      subject: m.subject,
      from: m.headers.from,
      date: m.date,
      snippet: m.snippet?.slice(0, 200),
    }));

    return NextResponse.json({
      query: {
        original: userQuery,
        interpreted: queriesUsed.join(" | "),
        explanation:
          aiExplanation || `Searched using: ${queriesUsed.join(", ")}`,
      },
      results: {
        total: searchResults.length,
        groups: Array.from(groupsMap.values()).sort(
          (a, b) => b.count - a.count,
        ),
        samples,
      },
    });
  } catch (error) {
    logger.error("AI search failed", { error, userQuery });
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
});
