import { MessageText, TypographyH3 } from "@/components/Typography";
import { SparklesIcon } from "lucide-react";

export const Overview = ({
  setInput,
}: {
  setInput: (input: string) => void;
}) => {
  const suggestions = [
    "Find emails from last week",
    "Search for invoices",
    "Draft an email to...",
  ];

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
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setInput(suggestion)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
