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

function defaultQuery() {
  // Gmail: has:attachment + common receipt keywords
  // Outlook: prefixes are stripped in the provider, so the keywords still apply
  return 'has:attachment (receipt OR invoice OR bill OR confirmation)';
}

function normalizeSender(from: string) {
  // Try to pull the display name, fall back to email/domain
  const match = from.match(/^(.*?)\s*<(.+?)>$/);
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

export const GET = withEmailProvider("ai/receipts", async (request) => {
  const { emailProvider } = request;
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q") || defaultQuery();
  const maxMessages = Math.min(
    Number.parseInt(searchParams.get("limit") || "60", 10),
    100,
  );

  const messages: ParsedMessage[] = [];
  let pageToken: string | undefined = undefined;
  let pages = 0;

  while (messages.length < maxMessages && pages < 5) {
    const res = await emailProvider.getMessagesWithPagination({
      query,
      maxResults: 20,
      pageToken,
    });

    for (const msg of res.messages) {
      if ((msg.attachments?.length || 0) > 0) {
        messages.push(msg);
        if (messages.length >= maxMessages) break;
      }
    }

    pageToken = res.nextPageToken;
    pages += 1;
    if (!pageToken) break;
  }

  const summary = summarizeMessages(messages);

  return NextResponse.json({
    query,
    totalMessages: summary.total,
    pagesScanned: pages,
    groups: summary.groups,
    samples: summary.samples,
  });
});
