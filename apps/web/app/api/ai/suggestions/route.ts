import { NextResponse } from "next/server";
import { withEmailProvider } from "@/utils/middleware";
import { extractSenderName } from "@/utils/ai/tools/search-emails";

// Fetch enough emails to get variety, but not so many it's slow
const RECENT_EMAILS_TO_SCAN = 25;

// Automated/system senders to filter out
const AUTOMATED_SENDER_PATTERNS = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "notification",
  "notifications",
  "newsletter",
  "mailer-daemon",
  "postmaster",
  "admin@",
  "support@",
  "updates@",
  "alerts@",
  "info@",
  "hello@",
  "team@",
  "billing@",
  "automated",
];

function isAutomatedSender(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.length < 2 ||
    AUTOMATED_SENDER_PATTERNS.some((pattern) => lower.includes(pattern))
  );
}

export const GET = withEmailProvider("ai/suggestions", async (request) => {
  const { emailProvider } = request;

  try {
    const recent = await emailProvider.getMessagesWithPagination({
      maxResults: RECENT_EMAILS_TO_SCAN,
    });

    // Count sender frequency, filtering automated senders
    const senderCounts = new Map<string, number>();
    for (const msg of recent.messages) {
      const name = extractSenderName(msg.headers.from);
      if (isAutomatedSender(name)) continue;
      senderCounts.set(name, (senderCounts.get(name) || 0) + 1);
    }

    // Sort by frequency and take top senders
    const topSenders = Array.from(senderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    // Build personalized suggestions
    const suggestions: string[] = [];
    if (topSenders[0]) suggestions.push(`Find emails from ${topSenders[0]}`);
    if (topSenders[1]) suggestions.push(`Search ${topSenders[1]}`);
    suggestions.push("Show unread emails", "Find emails with attachments");

    return NextResponse.json(
      { suggestions: suggestions.slice(0, 4) },
      {
        headers: {
          // Cache for 5 minutes - suggestions don't need to be real-time
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  } catch (error) {
    return NextResponse.json({
      suggestions: [
        "Find emails from last week",
        "Search for invoices",
        "Show unread emails",
      ],
    });
  }
});
