"use client";

import { useEffect, useState } from "react";
import { MessageText, TypographyH3 } from "@/components/Typography";
import { SparklesIcon, Loader2Icon } from "lucide-react";

const defaultSuggestions = [
  "Find emails from last week",
  "Search for invoices",
  "Show unread emails",
];

export const Overview = ({
  setInput,
  emailAccountId,
}: {
  setInput: (input: string) => void;
  emailAccountId?: string;
}) => {
  const [suggestions, setSuggestions] = useState<string[]>(defaultSuggestions);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!emailAccountId) return;

    setLoading(true);
    fetch("/api/ai/suggestions")
      .then((res) => res.json())
      .then((data) => {
        if (data.suggestions?.length > 0) {
          setSuggestions(data.suggestions);
        }
      })
      .catch(() => {
        // Keep default suggestions on error
      })
      .finally(() => setLoading(false));
  }, [emailAccountId]);

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
          {loading ? (
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
