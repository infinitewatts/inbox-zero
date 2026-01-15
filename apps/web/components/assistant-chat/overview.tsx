"use client";

import useSWR from "swr";
import { MessageText, TypographyH3 } from "@/components/Typography";
import { SparklesIcon, Loader2Icon } from "lucide-react";

const DEFAULT_SUGGESTIONS = [
  "Find emails from last week",
  "Search for invoices",
  "Show unread emails",
];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const Overview = ({
  setInput,
}: {
  setInput: (input: string) => void;
}) => {
  // SWR handles caching, deduplication, and revalidation
  const { data, isLoading } = useSWR<{ suggestions: string[] }>(
    "/api/ai/suggestions",
    fetcher,
    {
      revalidateOnFocus: false, // Don't refetch when tab regains focus
      revalidateOnReconnect: false,
      dedupingInterval: 300_000, // 5 minutes - match server cache
    },
  );

  const suggestions = data?.suggestions?.length
    ? data.suggestions
    : DEFAULT_SUGGESTIONS;

  return (
    <div className="mx-auto flex h-full max-w-3xl items-center justify-center">
      <div className="flex max-w-xl flex-col rounded-xl p-6 text-center leading-relaxed">
        <p className="flex flex-row items-center justify-center gap-4">
          <SparklesIcon size={32} className="text-blue-500" />
        </p>

        <TypographyH3 className="mt-8">How can I help?</TypographyH3>

        <MessageText className="mt-4 text-base text-muted-foreground">
          Search emails, take actions, or create automation rules
        </MessageText>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {isLoading ? (
            <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setInput(suggestion)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
              >
                {suggestion}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
