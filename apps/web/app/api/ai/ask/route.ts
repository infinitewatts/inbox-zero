import { NextResponse } from "next/server";
import { withEmailProvider } from "@/utils/middleware";
import type { ParsedMessage } from "@/utils/types";

type ReceiptSummary = {
  sender: string;
  count: number;
  subjects: string[];
  messageIds: string[];
  threadIds: string[];
  dates: string[];
};

type AskIntent = "receipts" | "unknown";

function detectIntent(query: string): AskIntent {
  const q = query.toLowerCase();
  const receiptKeywords = [
    "receipt",
    "invoice",
    "bill",
    "confirmation",
    "payment",
    "expense",
    "purchase",
  ];
  if (receiptKeywords.some((k) => q.includes(k))) return "receipts";
  return "unknown";
}

function defaultReceiptQuery() {
  // Gmail: has:attachment + common receipt keywords
  // Outlook: prefixes are stripped in the provider, so the keywords still apply
  return 'has:attachment (receipt OR invoice OR bill OR confirmation)';
}

function normalizeSender(from: string) {
  const match = from.match(/^(.*?)\\s*<(.+?)>$/);
  if (match) {
    const [, name, email] = match;
    const trimmedName = name.trim();
    if (trimmedName) return trimmedName;
    const domain = email.split("@")[1];
    return domain || email;
  }
  const domain = from.split("@")[1];
  return domain || from;
}

function summarizeMessages(messages: ParsedMessage[]): {
  total: number;
  groups: ReceiptSummary[];
  samples: Array<{
    id: string;
    threadId: string;
    subject: string;
    from: string;
    date: string;
    hasAttachments: boolean;
  }>;
} {
  const groupsMap = new Map<string, ReceiptSummary>();

  for (const m of messages) {
    const sender = normalizeSender(m.headers.from);
    if (!groupsMap.has(sender)) {
      groupsMap.set(sender, {
        sender,
        count: 0,
        subjects: [],
        messageIds: [],
        threadIds: [],
        dates: [],
      });
    }
    const g = groupsMap.get(sender)!;
    g.count += 1;
    if (g.subjects.length < 5) g.subjects.push(m.subject);
    if (g.messageIds.length < 10) g.messageIds.push(m.id);
    if (g.threadIds.length < 10) g.threadIds.push(m.threadId);
    if (g.dates.length < 10) g.dates.push(m.date);
  }

  const samples = messages.slice(0, 20).map((m) => ({
    id: m.id,
    threadId: m.threadId,
    subject: m.subject,
    from: m.headers.from,
    date: m.date,
    hasAttachments: (m.attachments?.length || 0) > 0,
  }));

  return {
    total: messages.length,
    groups: Array.from(groupsMap.values()).sort((a, b) => b.count - a.count),
    samples,
  };
}

async function handleReceipts(options: {
  query: string;
  limit: number;
  emailProvider: any;
}) {
  const { query, limit, emailProvider } = options;
  const searchQuery = query || defaultReceiptQuery();

  const messages: ParsedMessage[] = [];
  let pageToken: string | undefined = undefined;
  let pages = 0;

  while (messages.length < limit && pages < 5) {
    const res = await emailProvider.getMessagesWithPagination({
      query: searchQuery,
      maxResults: 20,
      pageToken,
    });

    for (const msg of res.messages) {
      if ((msg.attachments?.length || 0) > 0) {
        messages.push(msg);
        if (messages.length >= limit) break;
      }
    }

    pageToken = res.nextPageToken;
    pages += 1;
    if (!pageToken) break;
  }

  const summary = summarizeMessages(messages);

  return {
    intent: "receipts" as const,
    queryUsed: searchQuery,
    totalMessages: summary.total,
    pagesScanned: pages,
    groups: summary.groups,
    samples: summary.samples,
  };
}

export const GET = withEmailProvider("ai/ask", async (request) => {
  const { emailProvider } = request;
  const { searchParams } = new URL(request.url);

  const userQuery = (searchParams.get("q") || "").trim();
  const limit = Math.min(
    Number.parseInt(searchParams.get("limit") || "60", 10),
    100,
  );

  const intent = detectIntent(userQuery);

  if (intent === "receipts") {
    const result = await handleReceipts({
      query: userQuery,
      limit,
      emailProvider,
    });
    return NextResponse.json(result);
  }

  return NextResponse.json(
    {
      intent: "unknown",
      message:
        "No intent matched yet. Try asking for receipts/invoices or provide more detail.",
    },
    { status: 400 },
  );
});
