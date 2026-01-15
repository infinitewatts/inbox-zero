import { NextResponse } from "next/server";
import { withEmailProvider } from "@/utils/middleware";
import { extractSenderName } from "@/utils/ai/tools/search-emails";

export const GET = withEmailProvider("ai/suggestions", async (request) => {
  const { emailProvider } = request;

  try {
    // Fetch recent emails to extract sender names
    const recent = await emailProvider.getMessagesWithPagination({
      maxResults: 20,
    });

    // Extract unique sender names from recent emails
    const senderCounts = new Map<string, number>();
    for (const msg of recent.messages) {
      const name = extractSenderName(msg.headers.from);
      // Skip generic/automated senders
      if (
        name.toLowerCase().includes("noreply") ||
        name.toLowerCase().includes("no-reply") ||
        name.toLowerCase().includes("notification") ||
        name.length < 2
      ) {
        continue;
      }
      senderCounts.set(name, (senderCounts.get(name) || 0) + 1);
    }

    // Sort by frequency and take top 3
    const topSenders = Array.from(senderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    // Build dynamic suggestions
    const suggestions: string[] = [];

    if (topSenders[0]) {
      suggestions.push(`Find emails from ${topSenders[0]}`);
    }
    if (topSenders[1]) {
      suggestions.push(`Search ${topSenders[1]}`);
    }

    // Add some generic useful suggestions
    suggestions.push("Show unread emails");
    suggestions.push("Find emails with attachments");

    // Limit to 4 suggestions
    return NextResponse.json({
      suggestions: suggestions.slice(0, 4),
    });
  } catch (error) {
    // Return default suggestions on error
    return NextResponse.json({
      suggestions: [
        "Find emails from last week",
        "Search for invoices",
        "Show unread emails",
      ],
    });
  }
});
