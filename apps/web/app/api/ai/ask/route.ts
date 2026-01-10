import { NextResponse } from "next/server";
import { withEmailProvider } from "@/utils/middleware";
import type { ParsedMessage } from "@/utils/types";
import type { EmailProvider } from "@/utils/email/types";

type MessageSummary = {
  sender: string;
  count: number;
  subjects: string[];
  messageIds: string[];
  threadIds: string[];
  dates: string[];
};

type AskIntent =
  | "receipts"
  | "documents"
  | "photos"
  | "approvals"
  | "travel"
  | "meetings"
  | "newsletters"
  | "search"
  | "unknown";

type IntentConfig = {
  keywords: string[];
  defaultQuery: string;
  attachmentsOnly: boolean;
  description: string;
};

const INTENT_CONFIGS: Record<Exclude<AskIntent, "search" | "unknown">, IntentConfig> = {
  receipts: {
    keywords: ["receipt", "invoice", "bill", "confirmation", "payment", "expense", "purchase", "order"],
    defaultQuery: "has:attachment (receipt OR invoice OR bill OR confirmation OR order)",
    attachmentsOnly: true,
    description: "Receipts, invoices, and purchase confirmations",
  },
  documents: {
    keywords: ["document", "contract", "agreement", "proposal", "report", "pdf", "doc", "attachment"],
    defaultQuery: "has:attachment (filename:pdf OR filename:doc OR filename:docx OR contract OR agreement OR proposal)",
    attachmentsOnly: true,
    description: "Documents, contracts, and attachments",
  },
  photos: {
    keywords: ["photo", "image", "picture", "screenshot", "pic", "jpg", "png", "media"],
    defaultQuery: "has:attachment (filename:jpg OR filename:jpeg OR filename:png OR filename:gif OR filename:heic)",
    attachmentsOnly: true,
    description: "Photos and images",
  },
  approvals: {
    keywords: ["approve", "approval", "sign", "signature", "review", "action required", "pending", "waiting"],
    defaultQuery: "(action required OR please review OR needs approval OR please sign OR waiting for)",
    attachmentsOnly: false,
    description: "Items needing your approval or action",
  },
  travel: {
    keywords: ["flight", "hotel", "booking", "itinerary", "reservation", "travel", "trip", "airline", "airbnb"],
    defaultQuery: "(flight OR hotel OR booking OR itinerary OR reservation OR confirmation) (from:expedia OR from:booking OR from:airbnb OR from:airline OR travel)",
    attachmentsOnly: false,
    description: "Travel bookings and itineraries",
  },
  meetings: {
    keywords: ["meeting", "calendar", "invite", "schedule", "agenda", "call", "zoom", "teams"],
    defaultQuery: "(calendar OR invite OR meeting OR agenda) (from:calendar-notification OR from:zoom OR from:teams)",
    attachmentsOnly: false,
    description: "Meeting invites and calendar events",
  },
  newsletters: {
    keywords: ["newsletter", "digest", "subscribe", "unsubscribe", "weekly", "daily", "update"],
    defaultQuery: "(unsubscribe OR newsletter OR digest OR weekly update)",
    attachmentsOnly: false,
    description: "Newsletters and subscriptions",
  },
};

function splitFiltersAndAbout(query: string): { filters: string[]; aboutTerms: string[] } {
  const tokens = query.split(/\s+/).filter(Boolean);
  const filters: string[] = [];
  const about: string[] = [];

  for (const tok of tokens) {
    const m = tok.match(/^(from|to|subject|label|is|before|after|has|newer_than|older_than|filename):(.*)$/i);
    if (m) {
      filters.push(tok);
    } else {
      about.push(tok);
    }
  }
  return { filters, aboutTerms: about };
}

function detectIntent(query: string): { intent: AskIntent; confidence: "high" | "medium" | "low" } {
  const q = query.toLowerCase();
  const { aboutTerms, filters } = splitFiltersAndAbout(q);
  const searchText = aboutTerms.join(" ");

  // Check each intent's keywords
  for (const [intentName, config] of Object.entries(INTENT_CONFIGS)) {
    const matchCount = config.keywords.filter((k) => searchText.includes(k)).length;
    if (matchCount >= 2) {
      return { intent: intentName as AskIntent, confidence: "high" };
    }
    if (matchCount === 1) {
      return { intent: intentName as AskIntent, confidence: "medium" };
    }
  }

  // Fallback to search if there's any query
  if (searchText || filters.length) {
    return { intent: "search", confidence: "low" };
  }

  return { intent: "unknown", confidence: "low" };
}

function normalizeSender(from: string): string {
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
  groups: MessageSummary[];
  samples: Array<{
    id: string;
    threadId: string;
    subject: string;
    from: string;
    date: string;
    hasAttachments: boolean;
    snippet?: string;
  }>;
} {
  const groupsMap = new Map<string, MessageSummary>();

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
    snippet: m.snippet?.slice(0, 150),
  }));

  return {
    total: messages.length,
    groups: Array.from(groupsMap.values()).sort((a, b) => b.count - a.count),
    samples,
  };
}

async function fetchMessagesPaged(options: {
  query: string;
  limit: number;
  emailProvider: EmailProvider;
  attachmentsOnly?: boolean;
  maxPages?: number;
}): Promise<{ messages: ParsedMessage[]; pages: number; queryUsed: string }> {
  const { query, limit, emailProvider, attachmentsOnly = false, maxPages = 5 } = options;

  const messages: ParsedMessage[] = [];
  let pageToken: string | undefined = undefined;
  let pages = 0;

  while (messages.length < limit && pages < maxPages) {
    const res = await emailProvider.getMessagesWithPagination({
      query,
      maxResults: 20,
      pageToken,
    });

    for (const msg of res.messages) {
      if (attachmentsOnly && (msg.attachments?.length || 0) === 0) continue;
      messages.push(msg);
      if (messages.length >= limit) break;
    }

    pageToken = res.nextPageToken;
    pages += 1;
    if (!pageToken) break;
  }

  return { messages, pages, queryUsed: query };
}

async function handleIntentSearch(options: {
  intent: AskIntent;
  userQuery: string;
  limit: number;
  emailProvider: EmailProvider;
  confidence: "high" | "medium" | "low";
}) {
  const { intent, userQuery, limit, emailProvider, confidence } = options;
  const { filters, aboutTerms } = splitFiltersAndAbout(userQuery);

  // Get intent config (or use defaults for generic search)
  const config = intent !== "search" && intent !== "unknown"
    ? INTENT_CONFIGS[intent]
    : null;

  // Build query: user filters + (user about terms OR default query)
  const filterPart = filters.join(" ");
  const aboutPart = aboutTerms.join(" ");

  let searchQuery: string;
  if (aboutPart) {
    // User provided search terms - use them with any filters
    searchQuery = [filterPart, aboutPart].filter(Boolean).join(" ");
  } else if (config) {
    // No user terms but we have an intent - use default query
    searchQuery = [filterPart, config.defaultQuery].filter(Boolean).join(" ");
  } else {
    // Generic search with just filters
    searchQuery = filterPart || "in:anywhere";
  }

  // First attempt
  let result = await fetchMessagesPaged({
    query: searchQuery,
    limit,
    emailProvider,
    attachmentsOnly: config?.attachmentsOnly ?? false,
  });

  let retried = false;
  let retryQuery: string | undefined;

  // If no results and we have a specific intent, try broader search
  if (result.messages.length === 0 && config && !aboutPart) {
    retried = true;
    // Try without attachments-only restriction
    retryQuery = config.defaultQuery;
    result = await fetchMessagesPaged({
      query: retryQuery,
      limit,
      emailProvider,
      attachmentsOnly: false,
      maxPages: 3,
    });
  }

  // If still no results and user had filters, try just about terms
  if (result.messages.length === 0 && filters.length > 0 && aboutPart) {
    retried = true;
    retryQuery = aboutPart;
    result = await fetchMessagesPaged({
      query: retryQuery,
      limit,
      emailProvider,
      attachmentsOnly: false,
      maxPages: 3,
    });
  }

  const summary = summarizeMessages(result.messages);

  return {
    intent,
    confidence,
    description: config?.description || "Search results",
    query: {
      original: userQuery,
      parsed: {
        filters,
        aboutTerms,
      },
      executed: result.queryUsed,
      retried,
      retryQuery,
    },
    results: {
      total: summary.total,
      pagesScanned: result.pages,
      groups: summary.groups,
      samples: summary.samples,
    },
    suggestions: result.messages.length === 0
      ? [
          "Try broader search terms",
          "Remove some filters",
          `Try: ${Object.keys(INTENT_CONFIGS).join(", ")}`,
        ]
      : undefined,
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

  // Detect intent with confidence
  const { intent, confidence } = detectIntent(userQuery);

  if (intent === "unknown") {
    return NextResponse.json(
      {
        intent: "unknown",
        confidence: "low",
        message: "No search query provided.",
        suggestions: [
          "Try: receipts, invoices, documents",
          "Try: photos, attachments",
          "Try: approvals, action required",
          "Try: travel, flights, hotels",
          "Try: meetings, calendar",
          "Use filters: from:, to:, subject:, before:, after:, has:attachment",
        ],
        availableIntents: Object.entries(INTENT_CONFIGS).map(([name, cfg]) => ({
          name,
          description: cfg.description,
          exampleKeywords: cfg.keywords.slice(0, 3),
        })),
      },
      { status: 400 },
    );
  }

  const result = await handleIntentSearch({
    intent,
    userQuery,
    limit,
    emailProvider,
    confidence,
  });

  return NextResponse.json(result);
});
