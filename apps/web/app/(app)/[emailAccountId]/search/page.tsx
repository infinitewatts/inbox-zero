"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  SearchIcon,
  MailIcon,
  Loader2Icon,
  ExternalLinkIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prefixPath } from "@/utils/path";
import { formatShortDate } from "@/utils/date";

type MessageSummary = {
  sender: string;
  count: number;
  subjects: string[];
  messageIds: string[];
  threadIds: string[];
};

type SearchResult = {
  intent: string;
  confidence: string;
  description: string;
  query: {
    original: string;
    executed: string;
  };
  results: {
    total: number;
    groups: MessageSummary[];
    samples: Array<{
      id: string;
      threadId: string;
      subject: string;
      from: string;
      date: string;
      snippet?: string;
    }>;
  };
  suggestions?: string[];
};

export default function SearchPage() {
  const params = useParams<{ emailAccountId: string }>();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/ai/ask?q=${encodeURIComponent(query)}&limit=60`,
        );
        if (!response.ok) {
          const data = await response.json();
          setError(data.message || "Search failed");
          setResult(null);
          return;
        }
        const data = await response.json();
        setResult(data);
      } catch {
        setError("Failed to search emails");
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  const openThread = useCallback(
    (threadId: string) => {
      router.push(prefixPath(params.emailAccountId, `/mail/${threadId}`));
    },
    [router, params.emailAccountId],
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Search Emails</h1>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Find receipts, documents, travel bookings..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Try: receipts, invoices, documents, photos, travel, meetings, or use
          filters like from:amazon
        </p>
      </form>

      {error && (
        <Card className="mb-4 border-destructive">
          <CardContent className="py-4 text-destructive">{error}</CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{result.intent}</Badge>
            <span className="text-sm text-muted-foreground">
              {result.results.total} emails found
            </span>
          </div>

          {result.results.total === 0 && result.suggestions && (
            <Card>
              <CardContent className="py-4">
                <p className="mb-2 font-medium">No results found. Try:</p>
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  {result.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {result.results.groups.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">By Sender</h2>
              {result.results.groups.slice(0, 10).map((group) => (
                <Card key={group.sender} className="hover:bg-muted/50">
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <MailIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{group.sender}</span>
                        <Badge variant="outline">{group.count}</Badge>
                      </div>
                      {group.threadIds[0] && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openThread(group.threadIds[0])}
                        >
                          <ExternalLinkIcon className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {group.subjects.slice(0, 3).map((subj, i) => (
                        <li key={i} className="truncate">
                          • {subj}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {result.results.samples.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Recent Matches</h2>
              {result.results.samples.slice(0, 10).map((email) => (
                <Card
                  key={email.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openThread(email.threadId)}
                >
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {email.subject || "(No subject)"}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {email.from}
                        </p>
                        {email.snippet && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {email.snippet}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatShortDate(new Date(email.date))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
